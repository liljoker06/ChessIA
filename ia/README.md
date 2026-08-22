# IA — data pipeline + fine-tuning + evaluation

Everything that builds and evaluates the chess model lives here, in three
stages: `ia/data` (parsing/dataset), `ia/training` (LoRA fine-tuning + GGUF
export), `ia/eval` (games against Stockfish). The raw Lichess file
(`.pgn.zst`) and the generated datasets stay in [`data/`](../data/README.MD)
at the repo root — `ia/` only holds code. Every run (training + eval) is
tracked in **MLflow**.

## 1. Start MinIO + Ollama + MLflow

```bash
cp ../.env.example ../.env   # fill in MINIO_ROOT_USER / MINIO_ROOT_PASSWORD
docker compose up -d
```

The `chessia-raw`/`chessia-processed` buckets are created automatically.
MinIO: http://localhost:9001. Ollama: http://localhost:11434.
MLflow: http://localhost:5000 (run history, loss curves, eval metrics).

## 2. `ia/data` — parsing and dataset

Separate Python environment (batch/CLI tooling, no GPU needed here):

```bash
cd ia/data
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

### Parse the raw archive (`parse_pgn.py`)

Streams the `.pgn.zst`, replays every game with `python-chess`, and emits
one JSONL record per move played (`fen`, `move`, ratings, `eval_cp`/
`eval_mate`, `game_id`, `ply_index`) to `chessia-raw`. **No quality
filtering here** — only a cheap, optional Elo pre-filter (see the warning
below).

```bash
python scripts/parse_pgn.py \
  --input ../../data/lichess_db_standard_rated_2026-07.pgn.zst \
  --output-key raw/2026-07.jsonl.zst \
  --limit-games 200   # quick smoke test; drop this for a full run
```

### Build the final dataset (`build_dataset.py`)

Reads the intermediate file from `chessia-raw`, applies the real quality
filter (Elo range 1800-2200 by default, optional eval filter), samples up
to `--max-examples`, and writes `{"fen", "move"}` to `data/processed/` and
to `chessia-processed`.

```bash
python scripts/build_dataset.py \
  --input-key raw/2026-07.jsonl.zst \
  --output-key processed/2026-07.jsonl \
  --local-output ../../data/processed/2026-07.jsonl \
  --max-examples 1000
```

## 3. `ia/training` — get a GGUF model served by Ollama

Docker container (CUDA + Unsloth), no local venv needed. Two ways to get
there:

### 3a. Fine-tune from scratch on our data (`finetune.py`)

```bash
docker compose run --rm training scripts/finetune.py \
  --dataset /data/processed/dataset_5000.jsonl \
  --run-name gemma2-2b-5000 \
  --output-dir /output/gemma2-2b-5000
```

Automatically logs to MLflow (params + loss curve) via
`report_to=["mlflow"]`, and writes `mlflow_run_id.txt` next to the GGUF so
the evaluation step (section 4) can attach its metrics to the same run.

### 3b. Export an existing model as-is (`export_gguf.py`)

To use an already-trained Hugging Face model (e.g. a chess-specialized one)
with no further fine-tuning:

```bash
docker compose run --rm training scripts/export_gguf.py \
  --model-id alexneakameni/Qwen2.5-Coder-0.5B-Instruct-chess-grpo \
  --output-dir /output/chess-grpo-05b
```

### Register the GGUF as an Ollama model (`register_ollama_model.py`)

```bash
docker compose run --rm training scripts/register_ollama_model.py \
  --run-dir /output/chess-grpo-05b \
  --model-name chess-grpo-05b \
  --template chatml \
  --system-prompt "..."
```

- `--run-dir`: recursively searches the run directory for the `.gguf` file
  (Unsloth writes it into a `<name>_gguf/` sibling folder, not the
  requested directory — handled automatically).
- `--template chatml`: forces the ChatML template (Qwen2/Qwen2.5) on the
  Ollama side — needed because Ollama doesn't always faithfully pick up the
  `chat_template.jinja` embedded by Unsloth's export (without this, the
  model gets a raw prompt with no role tokens and answers nonsense).
  Omitting the flag lets Ollama guess (works for some models, not others —
  check with `curl :11434/api/show -d '{"model":"..."}'` if the template
  looks empty, `{{ .Prompt }}`).
- `--system-prompt`: must match exactly the format used on the eval/API
  side (`ia/eval/scripts/play_vs_stockfish.py` /
  `api/app/services/ollama_chess.py`).

## 4. `ia/eval` — games against Stockfish

Lightweight Docker container (Stockfish + python-chess, no GPU):

```bash
docker compose run --rm eval scripts/play_vs_stockfish.py \
  --ollama-model chess-grpo-05b \
  --prompt-format fen_uci_legal \
  --num-games 5 \
  --output /results/results.json \
  --run-dir /models/chess-grpo-05b
```

- `--prompt-format`: `fen_san` (FEN only, response = bare SAN move — our
  from-scratch Gemma fine-tunes' format) or `fen_uci_legal` (FEN + side to
  move + legal moves in UCI, response = `<rationale>...</rationale>
  <uci_move>...</uci_move>` — the chess-grpo model's format).
- `--run-dir` (optional): if `mlflow_run_id.txt` exists in that folder
  (created by `finetune.py`/`export_gguf.py`), eval metrics are logged
  **into the same MLflow run** as training instead of a disconnected one.

## 5. Full sweep (host orchestrator)

`ia/run_threshold_sweep.py` chains dataset → finetune → register → eval
across several dataset sizes (the Gemma FEN→SAN pipeline) and aggregates
the results. Run it with the `ia/data/venv` interpreter (it drives Docker
via `docker compose run`):

```bash
ia\data\venv\Scripts\python.exe ia\run_threshold_sweep.py --raw-key raw/2026-07.jsonl.zst
```

Output: `ia/eval/results/sweep_results.md` — resilient to partial failures
(a size that crashes doesn't stop the rest; results are written as it
goes).

## Results so far

- **Gemma 2 2B (LoRA, FEN→SAN, 5k-30k examples)**: 0 legal games out of 5,
  at every size tested — the model fails on its very first move despite a
  training loss that converges properly (the "respond with only a move"
  format doesn't hold at this fine-tuning scale).
- **`Qwen2.5-Coder-0.5B-Instruct-chess-grpo`** (a chess specialist trained
  via RL on Lichess puzzles, used as-is with no further fine-tuning): clear
  improvement — 2 to 10 legal moves in a row per game (vs. 0-1 for Gemma),
  and validated live on actual Lichess games (see the API integration in
  [`api/app/services/`](../api/app/services)).

## ⚠️ Disk space and the Elo pre-filter

MinIO runs single-node here via docker-compose: its volume is stored on the
**same physical disk** as everything else — it doesn't add storage. A 100%
raw parse of the dump's ~89.3M games could produce hundreds of GB / billions
of lines.

`parse_pgn.py` therefore applies a cheap Elo pre-filter (reading PGN headers
only, before replaying moves — `--elo-filter-mode`, default `either`, wide
1600-2400 range) to bound the size of the intermediate output. This is
**not** the final quality filter (that's `build_dataset.py`'s job, 1800-2200
range by default): it's a disk-space safeguard, disable it with
`--elo-filter-mode none` if disk space allows. Use `--limit-games`/
`--max-examples` on the scripts to iterate quickly before a full run.
