 # Datasets Lichess
 
 Les données utilisées par le projet peuvent être téléchargées depuis la
 [Lichess Open Database](https://database.lichess.org/).
 
 ## Installation
 
 1. Choisir le mois et le format du dataset sur le site de Lichess.
 2. Télécharger l’archive, généralement au format `.pgn.zst`.
 3. Installer [Zstandard](https://github.com/facebook/zstd), puis décompresser
	 l’archive :
 
	 ```bash
	 zstd -d lichess_YYYY-MM.pgn.zst -o lichess_YYYY-MM.pgn
	 ```
 
 4. Placer le fichier `.pgn` obtenu dans ce dossier (`data/`).
 
 Les datasets peuvent être volumineux : vérifier l’espace disque disponible avant
 le téléchargement et conserver le mois dans le nom du fichier.
