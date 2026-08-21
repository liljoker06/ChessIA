 # Datasets Lichess
 
 Les données utilisées par le projet peuvent être téléchargées depuis la
 [Lichess Open Database](https://database.lichess.org/).
 
 ## Installation
 
 1. Choisir le mois et le format du dataset sur le site de Lichess.
 2. Télécharger l’archive au format `.pgn.zst`.
 3. Placer l’archive `.pgn.zst` telle quelle dans ce dossier (`data/`), **sans
	 la décompresser**.
 
 ## ⚠️ Ne pas extraire l’archive
 
 Un `.pgn.zst` décompresse souvent en un fichier **5 à 10 fois plus gros**
 (annotations `%eval`/`%clk` très répétitives). Un mois de Lichess pèse
 ~29 Go compressé mais peut dépasser 150-300 Go une fois extrait, ce qui ne
 tient pas forcément sur le disque — une extraction interrompue par manque
 d’espace laisse un fichier `.pgn` corrompu (tronqué/incohérent dès le début).
 
 Utiliser plutôt [`api/utils/readFiles.py`](../api/utils/readFiles.py), qui lit
 le `.pgn.zst` directement en streaming (décompression à la volée via le
 package `zstandard`) sans jamais écrire le fichier complet décompressé sur
 disque. Le même principe est repris par les scripts de pipeline ci-dessous.

 ## Pipeline (MinIO + parsing)

 Le dataset JSONL final est construit en deux étapes, via un stockage MinIO
 (S3-compatible) lancé en local avec docker-compose — en préparation de la
 dockerisation complète du projet.

 ### 1. Démarrer MinIO

 ```bash
 cp ../.env.example ../.env   # remplir MINIO_ROOT_USER / MINIO_ROOT_PASSWORD
 docker-compose -f ../docker-compose.yml up -d
 ```

 Les buckets `chessia-raw` et `chessia-processed` sont créés automatiquement.
 Console web : http://localhost:9001.

 ### 2. Installer l'environnement Python des scripts

 Environnement séparé de `api/venv` (les scripts de `data/` sont des outils
 batch/CLI, pas le service FastAPI) :

 ```bash
 cd scripts
 python -m venv ../venv
 ../venv/Scripts/activate   # Windows
 pip install -r ../requirements.txt
 ```

 ### 3. Parser l'archive brute (`parse_pgn.py`)

 Lit le `.pgn.zst` en streaming, rejoue chaque partie avec `python-chess` et
 émet un enregistrement JSONL par coup joué (`fen`, `move`, elos, `eval_cp`/
 `eval_mate`, `game_id`, `ply_index`) vers `chessia-raw`. **Aucun filtrage
 qualité ici** — seulement un pré-filtre Elo optionnel et bon marché (voir
 avertissement ci-dessous).

 ```bash
 python parse_pgn.py \
   --input ../lichess_db_standard_rated_2026-07.pgn.zst \
   --output-key raw/2026-07.jsonl.zst \
   --limit-games 200   # smoke-test rapide ; retirer pour un run complet
 ```

 ### 4. Construire le dataset final (`build_dataset.py`)

 Lit l'intermédiaire depuis `chessia-raw`, applique le vrai filtrage qualité
 (plage d'Elo 1800-2200 par défaut, filtre eval optionnel), échantillonne
 jusqu'à `--max-examples`, et écrit `{"fen", "move"}` dans `data/processed/`
 et sur `chessia-processed`.

 ```bash
 python build_dataset.py \
   --input-key raw/2026-07.jsonl.zst \
   --output-key processed/2026-07.jsonl \
   --local-output ../processed/2026-07.jsonl \
   --max-examples 1000
 ```

 ## ⚠️ Espace disque et pré-filtre Elo

 MinIO tourne ici en single-node via docker-compose : son volume est stocké
 sur le **même disque physique** que le reste — ça n'ajoute pas d'espace.
 Un parsing 100% brut des ~89,3M parties du dump pourrait produire des
 centaines de Go / milliards de lignes.

 `parse_pgn.py` applique donc un pré-filtre Elo bon marché (lecture des
 headers PGN uniquement, avant de rejouer les coups — `--elo-filter-mode`,
 défaut `either`, plage large 1600-2200) pour borner la taille de la sortie
 intermédiaire. Ce n'est **pas** le filtrage qualité final (celui-là est fait
 par `build_dataset.py`, plage 1800-2200 par défaut) : c'est un garde-fou
 disque, désactivable via `--elo-filter-mode none` si l'espace disque le
 permet. Utiliser `--limit-games`/`--max-examples` sur les deux scripts pour
 itérer rapidement avant un run complet.
