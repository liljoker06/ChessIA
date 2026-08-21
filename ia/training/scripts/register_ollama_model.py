"""Register a finetuned run's GGUF export as a custom Ollama model.

Writes a Modelfile next to the GGUF and calls `ollama create` against the
Ollama HTTP API (works from inside the docker-compose network without the
ollama CLI being installed in this container).
"""

import argparse
import glob
import os
from pathlib import Path

import requests

SYSTEM_PROMPT = (
    "Tu es un moteur d'echecs. Etant donne une position au format FEN, "
    "reponds uniquement par le meilleur coup en notation SAN, sans explication."
)


def find_gguf(gguf_dir: Path) -> Path:
    matches = glob.glob(str(gguf_dir / "*.gguf"))
    if not matches:
        raise FileNotFoundError(f"No .gguf file found in {gguf_dir}")
    return Path(matches[0])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gguf-dir", required=True, help="Directory containing the exported .gguf file (as seen in THIS container, under /output)")
    parser.add_argument("--model-name", required=True, help="Name to register in Ollama")
    parser.add_argument("--ollama-url", default=os.environ.get("OLLAMA_URL", "http://ollama:11434"))
    parser.add_argument(
        "--ollama-mount-prefix",
        default="/models",
        help="Where ./training/output is mounted inside the ollama container (must point at the same host dir as --gguf-dir's /output mount)",
    )
    args = parser.parse_args()

    gguf_path = find_gguf(Path(args.gguf_dir))
    # /output/... (this container) and /models/... (ollama container) both map to
    # the same host directory ./training/output -- rewrite the path accordingly
    # so the FROM line in the Modelfile resolves inside the Ollama container.
    ollama_gguf_path = args.ollama_mount_prefix + str(gguf_path)[len("/output"):]
    modelfile = f'FROM {ollama_gguf_path}\nSYSTEM """{SYSTEM_PROMPT}"""\n'

    resp = requests.post(
        f"{args.ollama_url}/api/create",
        json={"model": args.model_name, "modelfile": modelfile},
        stream=True,
        timeout=1800,
    )
    resp.raise_for_status()
    for line in resp.iter_lines():
        if line:
            print(line.decode("utf-8"))

    print(f"registered model_name={args.model_name} from gguf={gguf_path}")


if __name__ == "__main__":
    main()
