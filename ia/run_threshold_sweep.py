"""Orchestrate the full dataset-size threshold sweep from the HOST machine.

For each dataset size: build the filtered dataset (locally, via ia/data/venv),
finetune + export + register a model (docker compose run --rm training),
play it against Stockfish (docker compose run --rm eval), then aggregate
all results into a summary table.

Meant to run unattended for hours: if a size fails at any step, the error is
logged and the sweep moves on to the next size instead of aborting entirely.

Run with the ia/data/venv interpreter, e.g.:
  ia\\data\\venv\\Scripts\\python.exe ia\\run_threshold_sweep.py --raw-key raw/2026-07.jsonl.zst
"""

import argparse
import json
import subprocess
import sys
import traceback
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SIZES = [5000, 10000, 15000, 20000, 25000, 30000]
LOG_PATH = REPO_ROOT / "ia" / "eval" / "results" / "sweep.log"


def log(msg: str) -> None:
    line = f"[{datetime.now().isoformat(timespec='seconds')}] {msg}"
    print(line, flush=True)
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def run(cmd: list[str]) -> None:
    log("+ " + " ".join(cmd))
    subprocess.run(cmd, check=True, cwd=REPO_ROOT)


def build_dataset(raw_key: str, size: int) -> None:
    run([
        sys.executable, str(REPO_ROOT / "ia" / "data" / "scripts" / "build_dataset.py"),
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
        "--run-dir", f"/output/{run_name}",
        "--model-name", run_name,
    ])


def evaluate(run_name: str, size: int, num_games: int) -> dict:
    run([
        "docker", "compose", "run", "--rm", "eval",
        "scripts/play_vs_stockfish.py",
        "--ollama-model", run_name,
        "--num-games", str(num_games),
        "--output", f"/results/results_{size}.json",
        "--run-dir", f"/models/{run_name}",
    ])
    result_path = REPO_ROOT / "ia" / "eval" / "results" / f"results_{size}.json"
    return json.loads(result_path.read_text(encoding="utf-8"))


def write_summary(results: list[dict], output_path: Path) -> None:
    lines = ["| Taille dataset | Parties completes / total | Statut |", "| --- | --- | --- |"]
    for r in results:
        if r.get("error"):
            lines.append(f"| {r['size']} | - | ECHEC: {r['error']} |")
        else:
            lines.append(f"| {r['size']} | {r['legal_complete']}/{r['num_games']} | OK |")
    output_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sizes", type=int, nargs="+", default=DEFAULT_SIZES)
    parser.add_argument("--raw-key", required=True, help="Bucket key of the parsed intermediate JSONL (chessia-raw)")
    parser.add_argument("--num-games", type=int, default=5)
    args = parser.parse_args()

    results = []
    results_dir = REPO_ROOT / "ia" / "eval" / "results"

    for size in args.sizes:
        run_name = f"gemma2-2b-{size}"
        log(f"===== Palier {size} ({run_name}) : debut =====")
        try:
            build_dataset(args.raw_key, size)
            finetune_and_register(run_name, size)
            eval_result = evaluate(run_name, size, args.num_games)
            results.append({
                "size": size,
                "legal_complete": eval_result["legal_complete"],
                "num_games": args.num_games,
            })
            log(f"===== Palier {size} : OK ({eval_result['legal_complete']}/{args.num_games}) =====")
        except Exception:
            error_text = traceback.format_exc()
            log(f"===== Palier {size} : ECHEC =====\n{error_text}")
            results.append({"size": size, "error": error_text.splitlines()[-1]})

        # Write partial results after every size so progress survives a crash.
        (results_dir / "sweep_results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
        write_summary(results, results_dir / "sweep_results.md")

    log(f"Sweep done -> {results_dir / 'sweep_results.json'} / {results_dir / 'sweep_results.md'}")


if __name__ == "__main__":
    main()
