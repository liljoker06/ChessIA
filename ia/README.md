# IA — pipeline données + fine-tuning + évaluation

Tout ce qui construit et évalue le modèle d'échecs finetuné vit ici, en trois
étapes : `ia/data` (parsing/dataset), `ia/training` (fine-tuning LoRA +
export GGUF), `ia/eval` (parties contre Stockfish). Le fichier brut Lichess
(`.pgn.zst`) et les datasets générés restent dans [`data/`](../data/README.MD)
à la racine — `ia/` ne contient que le code.

## 1. Démarrer MinIO + Ollama

```bash
cp .env.example .env   # remplir MINIO_ROOT_USER / MINIO_ROOT_PASSWORD
docker compose up -d
```

Les buckets `chessia-raw`/`chessia-processed` sont créés automatiquement.
Console MinIO : http://localhost:9001. Ollama : http://localhost:11434.

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

## 3. `ia/training` — fine-tuning LoRA + export GGUF

Conteneur Docker (CUDA + Unsloth), pas de venv local nécessaire :

```bash
docker compose run --rm training scripts/finetune.py \
  --dataset /data/processed/dataset_5000.jsonl \
  --run-name gemma2-2b-5000 \
  --output-dir /output/gemma2-2b-5000

docker compose run --rm training scripts/register_ollama_model.py \
  --gguf-dir /output/gemma2-2b-5000/gguf \
  --model-name gemma2-2b-5000
```

## 4. `ia/eval` — parties contre Stockfish

Conteneur Docker léger (Stockfish + python-chess, pas de GPU) :

```bash
docker compose run --rm eval scripts/play_vs_stockfish.py \
  --ollama-model gemma2-2b-5000 \
  --num-games 5 \
  --output /results/results_5000.json
```

## 5. Sweep complet (orchestrateur host)

`ia/run_threshold_sweep.py` enchaîne les 4 étapes ci-dessus pour plusieurs
tailles de dataset et agrège les résultats. À lancer avec l'interpréteur
`ia/data/venv` (il pilote Docker via `docker compose run`) :

```bash
ia\data\venv\Scripts\python.exe ia\run_threshold_sweep.py --raw-key raw/2026-07.jsonl.zst
```

Résultat : `ia/eval/results/sweep_results.md`.

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
