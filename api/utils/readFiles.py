"""Utilities to read large (possibly zstd-compressed) PGN files without
loading them fully into memory or extracting them to disk first.

Lichess PGN dumps are tens to hundreds of gigabytes once decompressed, so
these helpers stream lines out of the .pgn / .pgn.zst file directly instead
of materializing the whole thing.
"""

import io
import itertools
from pathlib import Path

import polars as pl
import zstandard as zstd


def _open_text(path: str | Path):
    """Open a .pgn or .pgn.zst file as a text stream, decompressing on the fly."""
    path = Path(path)
    if path.suffix == ".zst":
        fh = path.open("rb")
        reader = zstd.ZstdDecompressor().stream_reader(fh)
        return io.TextIOWrapper(reader, encoding="utf-8", errors="replace")
    return open(path, "r", encoding="utf-8", errors="replace")


def read_pgn_lines(path: str | Path, n_lines: int = 40) -> pl.DataFrame:
    """Return the first `n_lines` lines of a PGN file as a polars DataFrame.

    Works with plain .pgn files or .pgn.zst archives, streaming only the
    requested lines instead of reading/decompressing the whole file.
    """
    with _open_text(path) as f:
        lines = list(itertools.islice(f, n_lines))

    return pl.DataFrame({"line": [line.rstrip("\n") for line in lines]})


if __name__ == "__main__":
    default_path = (
        Path(__file__).resolve().parents[2]
        / "data"
        / "lichess_db_standard_rated_2026-07.pgn.zst"
    )
    pl.Config.set_fmt_str_lengths(10000)
    print(read_pgn_lines(default_path))
