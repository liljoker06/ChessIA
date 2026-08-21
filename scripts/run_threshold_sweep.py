"""Orchestrate the full dataset-size threshold sweep from the HOST machine.

For each dataset size: build the filtered dataset (locally, via data/venv),
finetune + export + register a model (docker compose run --rm training),
play it against Stockfish (docker compose run --rm eval), then aggregate
all results into a summary table.

Run with the data/venv interpreter, e.g.:
  data\\venv\\Scripts\\python.exe scripts\\run_threshold_sweep.py --raw-key raw/2026-07.jsonl.zst
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SIZES = [5000, 10000, 15000, 20000, 25000, 30000]


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd))
    subprocess.run(cmd, check=True, cwd=REPO_ROOT)


def build_dataset(raw_key: str, size: int) -> None:
    run([
        sys.executable, str(REPO_ROOT / "data" / "scripts" / "build_dataset.py"),
        "--input-key", raw_key,
        "--output-key", f"processed/dataset_{size}.jsonl",
        "--local-output", str(REPO_ROOT / "data" / "processed" / f"dataset_{size}.jsonl"),
        "--max-examples", str(size),
    ])


def finetune_and_register(run_name: str, size: int) -> None:
    run([
        "docker", "compose", "run", "--rm", "training",
        "scripts/finetune.py",
        "--dataset", f"/data/processed/dataset_{size}.jsonl",
        "--run-name", run_name,
        "--output-dir", f"/output/{run_name}",
    ])
    run([
        "docker", "compose", "run", "--rm", "training",
        "scripts/register_ollama_model.py",
        "--gguf-dir", f"/output/{run_name}/gguf",
        "--model-name", run_name,
    ])


def evaluate(run_name: str, size: int, num_games: int) -> dict:
    run([
        "docker", "compose", "run", "--rm", "eval",
        "scripts/play_vs_stockfish.py",
        "--ollama-model", run_name,
        "--num-games", str(num_games),
        "--output", f"/results/results_{size}.json",
    ])
    result_path = REPO_ROOT / "eval" / "results" / f"results_{size}.json"
    return json.loads(result_path.read_text(encoding="utf-8"))


def write_summary(results: list[dict], output_path: Path) -> None:
    lines = ["| Taille dataset | Parties completes / total |", "| --- | --- |"]
    for r in results:
        lines.append(f"| {r['size']} | {r['legal_complete']}/{r['num_games']} |")
    output_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sizes", type=int, nargs="+", default=DEFAULT_SIZES)
    parser.add_argument("--raw-key", required=True, help="Bucket key of the parsed intermediate JSONL (chessia-raw)")
    parser.add_argument("--num-games", type=int, default=5)
    args = parser.parse_args()

    results = []
    for size in args.sizes:
        run_name = f"gemma2-2b-{size}"
        build_dataset(args.raw_key, size)
        finetune_and_register(run_name, size)
        eval_result = evaluate(run_name, size, args.num_games)
        results.append({"size": size, "legal_complete": eval_result["legal_complete"], "num_games": args.num_games})

    results_dir = REPO_ROOT / "eval" / "results"
    (results_dir / "sweep_results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    write_summary(results, results_dir / "sweep_results.md")

    print(f"Sweep done -> {results_dir / 'sweep_results.json'} / {results_dir / 'sweep_results.md'}")


if __name__ == "__main__":
    main()
