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
 disque. Le même principe est repris par les scripts de pipeline dans
 [`ia/`](../ia/README.md) — c'est là que se trouvent le parsing, le
 fine-tuning et l'évaluation du modèle. Ce dossier `data/` ne contient que le
 fichier brut téléchargé et les datasets générés (`processed/`).
