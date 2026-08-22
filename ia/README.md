# IA — pipeline données + fine-tuning + évaluation

Tout ce qui construit et évalue le modèle d'échecs vit ici, en trois étapes :
`ia/data` (parsing/dataset), `ia/training` (fine-tuning LoRA + export GGUF),
`ia/eval` (parties contre Stockfish). Le fichier brut Lichess (`.pgn.zst`) et
les datasets générés restent dans [`data/`](../data/README.MD) à la racine —
`ia/` ne contient que le code. Tous les runs (training + eval) sont tracés
dans **MLflow**.

## 1. Démarrer MinIO + Ollama + MLflow

```bash
cp ../.env.example ../.env   # remplir MINIO_ROOT_USER / MINIO_ROOT_PASSWORD
docker compose up -d
```

Les buckets `chessia-raw`/`chessia-processed` sont créés automatiquement.
MinIO : http://localhost:9001. Ollama : http://localhost:11434.
MLflow : http://localhost:5000 (historique des runs, courbes de loss,
métriques d'éval).

## 2. `ia/data` — parsing et dataset

Environnement Python séparé (outils batch/CLI, pas de GPU nécessaire ici) :

```bash
cd ia/data
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

### Parser l'archive brute (`parse_pgn.py`)

Lit le `.pgn.zst` en streaming, rejoue chaque partie avec `python-chess` et
émet un enregistrement JSONL par coup joué (`fen`, `move`, elos, `eval_cp`/
`eval_mate`, `game_id`, `ply_index`) vers `chessia-raw`. **Aucun filtrage
qualité ici** — seulement un pré-filtre Elo optionnel et bon marché (voir
avertissement plus bas).

```bash
python scripts/parse_pgn.py \
  --input ../../data/lichess_db_standard_rated_2026-07.pgn.zst \
  --output-key raw/2026-07.jsonl.zst \
  --limit-games 200   # smoke-test rapide ; retirer pour un run complet
```

### Construire le dataset final (`build_dataset.py`)

Lit l'intermédiaire depuis `chessia-raw`, applique le vrai filtrage qualité
(plage d'Elo 1800-2200 par défaut, filtre eval optionnel), échantillonne
jusqu'à `--max-examples`, et écrit `{"fen", "move"}` dans `data/processed/`
et sur `chessia-processed`.

```bash
python scripts/build_dataset.py \
  --input-key raw/2026-07.jsonl.zst \
  --output-key processed/2026-07.jsonl \
  --local-output ../../data/processed/2026-07.jsonl \
  --max-examples 1000
```

## 3. `ia/training` — obtenir un modèle GGUF servi par Ollama

Conteneur Docker (CUDA + Unsloth), pas de venv local nécessaire. Deux façons
d'y arriver :

### 3a. Fine-tuner depuis zéro sur nos données (`finetune.py`)

```bash
docker compose run --rm training scripts/finetune.py \
  --dataset /data/processed/dataset_5000.jsonl \
  --run-name gemma2-2b-5000 \
  --output-dir /output/gemma2-2b-5000
```

Logue automatiquement dans MLflow (params + courbe de loss) via
`report_to=["mlflow"]`, et écrit `mlflow_run_id.txt` à côté du GGUF pour que
l'étape d'évaluation (section 4) rattache ses métriques au même run.

### 3b. Exporter un modèle existant tel quel (`export_gguf.py`)

Pour utiliser un modèle Hugging Face déjà entraîné (ex. un modèle chess
spécialisé) sans fine-tuning supplémentaire :

```bash
docker compose run --rm training scripts/export_gguf.py \
  --model-id alexneakameni/Qwen2.5-Coder-0.5B-Instruct-chess-grpo \
  --output-dir /output/chess-grpo-05b
```

### Enregistrer le GGUF comme modèle Ollama (`register_ollama_model.py`)

```bash
docker compose run --rm training scripts/register_ollama_model.py \
  --run-dir /output/chess-grpo-05b \
  --model-name chess-grpo-05b \
  --template chatml \
  --system-prompt "..."
```

- `--run-dir` : cherche récursivement le `.gguf` dans le dossier du run
  (Unsloth l'écrit dans un sous-dossier `<nom>_gguf/`, pas dans le dossier
  demandé — géré automatiquement).
- `--template chatml` : force le template ChatML (Qwen2/Qwen2.5) côté
  Ollama — nécessaire car Ollama ne reprend pas toujours fidèlement le
  `chat_template.jinja` embarqué par l'export Unsloth (sans ça, le modèle
  reçoit un prompt brut sans balises de rôle et répond n'importe quoi).
  Omettre l'option laisse Ollama deviner (fonctionne pour certains modèles,
  pas d'autres — vérifier avec `curl :11434/api/show -d '{"model":"..."}'`
  si le template a l'air vide `{{ .Prompt }}`).
- `--system-prompt` : doit correspondre exactement au format utilisé côté
  éval/API (`ia/eval/scripts/play_vs_stockfish.py` /
  `api/app/services/ollama_chess.py`).

## 4. `ia/eval` — parties contre Stockfish

Conteneur Docker léger (Stockfish + python-chess, pas de GPU) :

```bash
docker compose run --rm eval scripts/play_vs_stockfish.py \
  --ollama-model chess-grpo-05b \
  --prompt-format fen_uci_legal \
  --num-games 5 \
  --output /results/results.json \
  --run-dir /models/chess-grpo-05b
```

- `--prompt-format` : `fen_san` (FEN seul, réponse = coup SAN brut — format
  de nos fine-tunes Gemma) ou `fen_uci_legal` (FEN + côté au trait + liste
  des coups légaux en UCI, réponse = `<rationale>...</rationale>
  <uci_move>...</uci_move>` — format du modèle chess-grpo).
- `--run-dir` (optionnel) : si `mlflow_run_id.txt` existe dans ce dossier
  (créé par `finetune.py`/`export_gguf.py`), les métriques d'éval sont
  loguées **dans le même run MLflow** que l'entraînement plutôt que dans un
  run isolé.

## 5. Sweep complet (orchestrateur host)

`ia/run_threshold_sweep.py` enchaîne dataset → finetune → register → eval
pour plusieurs tailles de dataset (pipeline Gemma FEN→SAN) et agrège les
résultats. À lancer avec l'interpréteur `ia/data/venv` (il pilote Docker via
`docker compose run`) :

```bash
ia\data\venv\Scripts\python.exe ia\run_threshold_sweep.py --raw-key raw/2026-07.jsonl.zst
```

Résultat : `ia/eval/results/sweep_results.md` — robuste aux échecs partiels
(un palier qui plante n'interrompt pas les suivants, résultats écrits au fur
et à mesure).

## Résultats obtenus

- **Gemma 2 2B (LoRA, FEN→SAN, 5k-30k exemples)** : 0 partie légale sur 5, à
  tous les paliers testés — le modèle échoue dès son premier coup malgré une
  loss d'entraînement qui converge correctement (le format "réponds
  uniquement par un coup" ne tient pas à cette échelle de fine-tuning).
- **`Qwen2.5-Coder-0.5B-Instruct-chess-grpo`** (spécialiste échecs entraîné
  par RL sur des puzzles Lichess, utilisé tel quel sans fine-tuning
  supplémentaire) : nette amélioration — 2 à 10 coups légaux enchaînés par
  partie (contre 0-1 pour Gemma), et validé en conditions réelles sur
  Lichess (voir intégration API dans [`api/app/services/`](../api/app/services)).

## ⚠️ Espace disque et pré-filtre Elo

MinIO tourne ici en single-node via docker-compose : son volume est stocké
sur le **même disque physique** que le reste — ça n'ajoute pas d'espace.
Un parsing 100% brut des ~89,3M parties du dump pourrait produire des
centaines de Go / milliards de lignes.

`parse_pgn.py` applique donc un pré-filtre Elo bon marché (lecture des
headers PGN uniquement, avant de rejouer les coups — `--elo-filter-mode`,
défaut `either`, plage large 1600-2400) pour borner la taille de la sortie
intermédiaire. Ce n'est **pas** le filtrage qualité final (celui-là est fait
par `build_dataset.py`, plage 1800-2200 par défaut) : c'est un garde-fou
disque, désactivable via `--elo-filter-mode none` si l'espace disque le
permet. Utiliser `--limit-games`/`--max-examples` sur les scripts pour
itérer rapidement avant un run complet.
