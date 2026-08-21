"""Stream a Lichess .pgn / .pgn.zst dump into raw (fen, move) records.

No move-quality/Elo filtering happens here beyond a cheap, optional,
header-only Elo pre-filter — see --elo-filter-mode. Real filtering
(Elo range + eval-based quality) happens downstream in build_dataset.py.

The pre-filter exists purely to bound the size of the intermediate output
for local disk space: MinIO's docker-compose volume lives on the same
physical disk as everything else, and an unfiltered pass over ~89M games
could produce hundreds of GB / billions of lines. See data/README.MD.
"""

import argparse
import io
import json
import re
import tempfile
from pathlib import Path

import chess.pgn
import zstandard as zstd
from tqdm import tqdm

import storage

EVAL_RE = re.compile(r"\[%eval\s+(#?-?\d+(?:\.\d+)?)\]")


def _open_text(path: str | Path) -> io.TextIOWrapper:
    """Open a .pgn or .pgn.zst file as a streaming text reader."""
    path = Path(path)
    if path.suffix == ".zst":
        fh = path.open("rb")
        reader = zstd.ZstdDecompressor().stream_reader(fh)
        return io.TextIOWrapper(reader, encoding="utf-8", errors="replace")
    return open(path, "r", encoding="utf-8", errors="replace")


def _parse_eval(comment: str) -> tuple[float | None, int | None]:
    """Extract (eval_cp, eval_mate) from a move comment, if present."""
    match = EVAL_RE.search(comment)
    if not match:
        return None, None
    raw = match.group(1)
    if raw.startswith("#"):
        return None, int(raw[1:])
    return float(raw), None


def _passes_elo_prefilter(headers, min_elo: int, max_elo: int, mode: str) -> bool:
    if mode == "none":
        return True
    try:
        white_elo = int(headers.get("WhiteElo", ""))
        black_elo = int(headers.get("BlackElo", ""))
    except ValueError:
        return False

    white_in_range = min_elo <= white_elo <= max_elo
    black_in_range = min_elo <= black_elo <= max_elo
    if mode == "both":
        return white_in_range and black_in_range
    return white_in_range or black_in_range


def parse_pgn(
    input_path: Path,
    local_tmp: Path,
    min_elo: int,
    max_elo: int,
    elo_filter_mode: str,
    limit_games: int | None,
    max_examples: int | None,
) -> dict:
    stats = {"games_seen": 0, "games_kept": 0, "plies_emitted": 0}

    compressor = zstd.ZstdCompressor()
    with _open_text(input_path) as src, open(local_tmp, "wb") as raw_out:
        with compressor.stream_writer(raw_out) as out:
            progress = tqdm(unit="games")
            while True:
                if limit_games is not None and stats["games_seen"] >= limit_games:
                    break
                if max_examples is not None and stats["plies_emitted"] >= max_examples:
                    break

                game = chess.pgn.read_game(src)
                if game is None:
                    break
                stats["games_seen"] += 1
                progress.update(1)

                if not _passes_elo_prefilter(game.headers, min_elo, max_elo, elo_filter_mode):
                    continue
                stats["games_kept"] += 1

                white_elo = game.headers.get("WhiteElo")
                black_elo = game.headers.get("BlackElo")
                board = game.board()
                ply_index = 0
                for node in game.mainline():
                    if max_examples is not None and stats["plies_emitted"] >= max_examples:
                        break
                    move = node.move
                    fen_before = board.fen()
                    san = board.san(move)
                    eval_cp, eval_mate = _parse_eval(node.comment or "")

                    record = {
                        "fen": fen_before,
                        "move": san,
                        "white_elo": int(white_elo) if white_elo and white_elo.isdigit() else None,
                        "black_elo": int(black_elo) if black_elo and black_elo.isdigit() else None,
                        "eval_cp": eval_cp,
                        "eval_mate": eval_mate,
                        "game_id": stats["games_seen"],
                        "ply_index": ply_index,
                    }
                    out.write((json.dumps(record) + "\n").encode("utf-8"))
                    stats["plies_emitted"] += 1

                    board.push(move)
                    ply_index += 1
            progress.close()

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Local path to a .pgn or .pgn.zst file")
    parser.add_argument("--output-key", required=True, help="Destination object key in MinIO")
    parser.add_argument("--bucket", default=storage.RAW_BUCKET)
    parser.add_argument("--min-elo", type=int, default=1600)
    parser.add_argument("--max-elo", type=int, default=2400)
    parser.add_argument(
        "--elo-filter-mode",
        choices=["either", "both", "none"],
        default="either",
        help="Cheap header-only pre-filter, wider than build_dataset.py's real filter",
    )
    parser.add_argument("--limit-games", type=int, default=None)
    parser.add_argument("--max-examples", type=int, default=None)
    args = parser.parse_args()

    input_path = Path(args.input)
    client = storage.get_s3_client()
    storage.ensure_bucket(client, args.bucket)

    with tempfile.TemporaryDirectory() as tmp_dir:
        local_tmp = Path(tmp_dir) / "parsed.jsonl.zst"
        stats = parse_pgn(
            input_path,
            local_tmp,
            args.min_elo,
            args.max_elo,
            args.elo_filter_mode,
            args.limit_games,
            args.max_examples,
        )
        size_bytes = local_tmp.stat().st_size
        storage.upload_local_file(client, args.bucket, args.output_key, local_tmp)

    print(
        f"games_seen={stats['games_seen']} games_kept={stats['games_kept']} "
        f"plies_emitted={stats['plies_emitted']} output_size_bytes={size_bytes} "
        f"-> s3://{args.bucket}/{args.output_key}"
    )


if __name__ == "__main__":
    main()
