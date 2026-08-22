"""Register a finetuned run's GGUF export as a custom Ollama model.

Uploads the .gguf file to Ollama as a content-addressed blob (current
/api/create schema: {"model", "files": {name: "sha256:..."}}) then creates
the model referencing that blob.
"""

import argparse
import hashlib
import os
from pathlib import Path

import requests

DEFAULT_SYSTEM_PROMPT = (
    "Tu es un moteur d'echecs. Etant donne une position au format FEN, "
    "reponds uniquement par le meilleur coup en notation SAN, sans explication."
)

# ChatML template (Qwen2/Qwen2.5 family). Ollama does not always pick up the
# chat_template.jinja embedded by Unsloth's GGUF export -- without this, it
# falls back to a raw "{{ .Prompt }}" passthrough with no role tokens at all,
# which breaks any model trained on a role-based chat format.
CHATML_TEMPLATE = (
    "{{ if .System }}<|im_start|>system\n{{ .System }}<|im_end|>\n{{ end }}"
    "{{ if .Prompt }}<|im_start|>user\n{{ .Prompt }}<|im_end|>\n{{ end }}"
    "<|im_start|>assistant\n{{ .Response }}<|im_end|>\n"
)


def find_gguf(run_dir: Path) -> Path:
    # Unsloth's save_pretrained_gguf writes the actual .gguf file into a
    # sibling "<dir>_gguf" folder rather than the given directory itself,
    # so search the whole run directory tree recursively.
    matches = sorted(run_dir.rglob("*.gguf"))
    if not matches:
        raise FileNotFoundError(f"No .gguf file found under {run_dir}")
    return matches[0]


def sha256_of_file(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def upload_blob(ollama_url: str, path: Path, digest: str) -> None:
    with open(path, "rb") as f:
        resp = requests.post(f"{ollama_url}/api/blobs/sha256:{digest}", data=f, timeout=1800)
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Blob upload failed ({resp.status_code}): {resp.text}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", required=True, help="Run's output directory to search recursively for the .gguf file")
    parser.add_argument("--model-name", required=True, help="Name to register in Ollama")
    parser.add_argument("--ollama-url", default=os.environ.get("OLLAMA_URL", "http://ollama:11434"))
    parser.add_argument(
        "--system-prompt",
        default=DEFAULT_SYSTEM_PROMPT,
        help="System prompt to bake into the model (must match whatever format the model was trained/prompted with)",
    )
    parser.add_argument(
        "--template",
        default=None,
        help="Ollama Modelfile TEMPLATE (Go template syntax). Use 'chatml' for the built-in Qwen2/ChatML template, "
        "omit to let Ollama auto-detect from the GGUF (works for some models, not others -- verify with /api/show).",
    )
    args = parser.parse_args()

    template = CHATML_TEMPLATE if args.template == "chatml" else args.template

    gguf_path = find_gguf(Path(args.run_dir))
    print(f"Found GGUF: {gguf_path} ({gguf_path.stat().st_size / 1e9:.2f} GB)")

    digest = sha256_of_file(gguf_path)
    print(f"sha256={digest}, uploading blob...")
    upload_blob(args.ollama_url, gguf_path, digest)

    # Gemma has no native system role: Ollama's chat template folds the
    # "system" field into the first user turn automatically. This must
    # match training exactly (system + FEN concatenated into one user
    # turn, see finetune.py) -- so the caller must send ONLY "FEN: ..."
    # as the generate prompt, not re-prepend the system text itself.
    payload = {
        "model": args.model_name,
        "files": {gguf_path.name: f"sha256:{digest}"},
        "system": args.system_prompt,
    }
    if template:
        payload["template"] = template

    resp = requests.post(
        f"{args.ollama_url}/api/create",
        json=payload,
        stream=True,
        timeout=1800,
    )
    if not resp.ok:
        print(f"Ollama /api/create error body: {resp.text}")
    resp.raise_for_status()
    for line in resp.iter_lines():
        if line:
            print(line.decode("utf-8"))

    print(f"registered model_name={args.model_name} from gguf={gguf_path}")


if __name__ == "__main__":
    main()
