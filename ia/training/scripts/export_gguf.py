"""Export a Hugging Face model (no LoRA training involved) directly to GGUF,
for models we want to serve via Ollama as-is or as a starting point for
further fine-tuning later.
"""

import argparse
import os
from contextlib import nullcontext
from pathlib import Path

import mlflow
from unsloth import FastLanguageModel

MLFLOW_EXPERIMENT = "chessia-finetune"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-id", required=True, help="HF model id, e.g. alexneakameni/Qwen2.5-Coder-0.5B-Instruct-chess-grpo")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--quantization", default="q4_k_m")
    parser.add_argument("--max-seq-len", type=int, default=2048)
    parser.add_argument("--run-name", default=None, help="Defaults to the model id")
    args = parser.parse_args()

    run_name = args.run_name or args.model_id.split("/")[-1]

    mlflow_uri = os.environ.get("MLFLOW_TRACKING_URI")
    if mlflow_uri:
        mlflow.set_tracking_uri(mlflow_uri)
        mlflow.set_experiment(MLFLOW_EXPERIMENT)

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    run_ctx = mlflow.start_run(run_name=run_name) if mlflow_uri else nullcontext()
    with run_ctx as run:
        if mlflow_uri:
            mlflow.log_params({
                "base_model": args.model_id,
                "quantization": args.quantization,
                "source": "external_export",
            })

        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=args.model_id,
            max_seq_length=args.max_seq_len,
            dtype=None,
            load_in_4bit=False,
        )

        gguf_dir = output_dir / "gguf"
        model.save_pretrained_gguf(str(gguf_dir), tokenizer, quantization_method=args.quantization)

        if mlflow_uri:
            (output_dir / "mlflow_run_id.txt").write_text(run.info.run_id, encoding="utf-8")

    print(f"exported model_id={args.model_id} -> {gguf_dir}")


if __name__ == "__main__":
    main()
