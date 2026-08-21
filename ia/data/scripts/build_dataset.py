"""Filter the raw (fen, move) records produced by parse_pgn.py into the
final {"fen", "move"} JSONL dataset used for fine-tuning.

This is where the real quality filtering happens: Elo range (default
1800-2200, per the project's target rating band) and, optionally, an
eval-based blunder filter using the eval_cp values grouped by game_id.
"""

import argparse
import json
import random
from pathlib import Path

import storage


def _passes_elo_filter(record: dict, min_elo: int, max_elo: int) -> bool:
    white_elo, black_elo = record.get("white_elo"), record.get("black_elo")
    if white_elo is None or black_elo is None:
        return False
    return min_elo <= white_elo <= max_elo and min_elo <= black_elo <= max_elo


def _iter_filtered_records(reader, min_elo: int, max_elo: int, stats: dict):
    """Yield records passing the Elo filter, tracking basic drop stats."""
    for line in reader:
        line = line.strip()
        if not line:
            continue
        stats["read"] += 1
        record = json.loads(line)
        if not _passes_elo_filter(record, min_elo, max_elo):
            stats["dropped_elo"] += 1
            continue
        yield record


def _apply_eval_filter(records, eval_filter_mode: str, blunder_cp_threshold: int, require_eval: bool, stats: dict):
    """Drop plies that look like blunders, comparing consecutive plies
    within the same game via game_id/ply_index."""
    if eval_filter_mode == "none":
        yield from records
        return

    prev_by_game: dict[int, float | None] = {}
    for record in records:
        eval_cp = record.get("eval_cp")
        game_id = record["game_id"]
        prev_eval = prev_by_game.get(game_id)
        prev_by_game[game_id] = eval_cp if eval_cp is not None else prev_eval

        if eval_cp is None:
            if require_eval:
                stats["dropped_eval"] += 1
                continue
            yield record
            continue

        if prev_eval is not None and abs(eval_cp - prev_eval) > blunder_cp_threshold:
            stats["dropped_eval"] += 1
            continue
        yield record


def _reservoir_sample(records, max_examples: int | None, shuffle: bool, seed: int):
    if max_examples is None:
        yield from records
        return

    rng = random.Random(seed)
    reservoir: list[dict] = []
    for i, record in enumerate(records):
        if len(reservoir) < max_examples:
            reservoir.append(record)
        elif shuffle:
            j = rng.randint(0, i)
            if j < max_examples:
                reservoir[j] = record
        else:
            break
    yield from reservoir


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-key", required=True)
    parser.add_argument("--input-bucket", default=storage.RAW_BUCKET)
    parser.add_argument("--output-key", required=True)
    parser.add_argument("--output-bucket", default=storage.PROCESSED_BUCKET)
    parser.add_argument("--local-output", required=True)
    parser.add_argument("--min-elo", type=int, default=1800)
    parser.add_argument("--max-elo", type=int, default=2200)
    parser.add_argument("--eval-filter-mode", choices=["none", "blunder-exclude"], default="none")
    parser.add_argument("--blunder-cp-threshold", type=int, default=200)
    parser.add_argument("--require-eval", action="store_true")
    parser.add_argument("--max-examples", type=int, default=50000)
    parser.add_argument("--shuffle", action="store_true")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    stats = {"read": 0, "dropped_elo": 0, "dropped_eval": 0, "final": 0}

    client = storage.get_s3_client()
    reader = storage.open_s3_zst_reader(client, args.input_bucket, args.input_key)

    with reader:
        elo_filtered = _iter_filtered_records(reader, args.min_elo, args.max_elo, stats)
        eval_filtered = _apply_eval_filter(
            elo_filtered, args.eval_filter_mode, args.blunder_cp_threshold, args.require_eval, stats
        )
        sampled = _reservoir_sample(eval_filtered, args.max_examples, args.shuffle, args.seed)

        local_output = Path(args.local_output)
        local_output.parent.mkdir(parents=True, exist_ok=True)
        with open(local_output, "w", encoding="utf-8") as f:
            for record in sampled:
                f.write(json.dumps({"fen": record["fen"], "move": record["move"]}) + "\n")
                stats["final"] += 1

    storage.upload_local_file(client, args.output_bucket, args.output_key, local_output)

    print(
        f"read={stats['read']} dropped_elo={stats['dropped_elo']} "
        f"dropped_eval={stats['dropped_eval']} final={stats['final']} "
        f"-> {local_output} and s3://{args.output_bucket}/{args.output_key}"
    )


if __name__ == "__main__":
    main()
