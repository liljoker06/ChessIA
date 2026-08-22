# Lichess datasets

The data used by the project can be downloaded from the
[Lichess Open Database](https://database.lichess.org/).

## Setup

1. Pick the month and dataset format on the Lichess site.
2. Download the archive in `.pgn.zst` format.
3. Drop the `.pgn.zst` archive as-is into this folder (`data/`), **without
   decompressing it**.

## ⚠️ Do not extract the archive

A `.pgn.zst` often decompresses into a file **5 to 10 times bigger**
(the `%eval`/`%clk` annotations are highly repetitive). A month of Lichess
weighs ~29 GB compressed but can exceed 150-300 GB once extracted, which may
not fit on disk — an extraction interrupted by lack of space leaves a
corrupted `.pgn` file (truncated/inconsistent from the very start).

Use [`api/utils/readFiles.py`](../api/utils/readFiles.py) instead, which
reads the `.pgn.zst` directly in streaming mode (on-the-fly decompression via
the `zstandard` package) without ever writing the full decompressed file to
disk. The same principle is used by the pipeline scripts in
[`ia/`](../ia/README.md) — that's where the parsing, fine-tuning, and model
evaluation live. This `data/` folder only holds the downloaded raw file and
the generated datasets (`processed/`).
