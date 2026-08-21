"""LoRA finetune of Gemma 2 2B on FEN -> SAN move pairs, via Unsloth.

Reads a {"fen", "move"} JSONL dataset (produced by data/scripts/build_dataset.py),
finetunes unsloth/gemma-2-2b-bnb-4bit with LoRA, and exports the result as a
quantized GGUF file ready to be registered as an Ollama model.
"""

import argparse
import json
import os
from pathlib import Path

from datasets import Dataset
from dotenv import load_dotenv
from trl import SFTConfig, SFTTrainer
from unsloth import FastLanguageModel
from unsloth.chat_templates import get_chat_template

load_dotenv("/data/.env") if Path("/data/.env").exists() else load_dotenv()

SYSTEM_PROMPT = (
    "Tu es un moteur d'echecs. Etant donne une position au format FEN, "
    "reponds uniquement par le meilleur coup en notation SAN, sans explication."
)
BASE_MODEL = "unsloth/gemma-2-2b-bnb-4bit"


def load_examples(dataset_path: Path) -> list[dict]:
    examples = []
    with open(dataset_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                examples.append(json.loads(line))
    return examples


def to_chat_text(tokenizer, fen: str, move: str) -> str:
    messages = [
        {"role": "user", "content": f"{SYSTEM_PROMPT}\n\nFEN: {fen}"},
        {"role": "assistant", "content": move},
    ]
    return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True, help="Path to a {fen,move} JSONL file")
    parser.add_argument("--run-name", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--max-seq-len", type=int, default=512)
    parser.add_argument("--lora-r", type=int, default=16)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--quantization", default="q4_k_m", help="GGUF quantization method")
    args = parser.parse_args()

    hf_token = os.environ.get("HF_TOKEN") or None

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=BASE_MODEL,
        max_seq_length=args.max_seq_len,
        dtype=None,
        load_in_4bit=True,
        token=hf_token,
    )
    tokenizer = get_chat_template(tokenizer, chat_template="gemma-2")

    model = FastLanguageModel.get_peft_model(
        model,
        r=args.lora_r,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_alpha=args.lora_r,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=3407,
    )

    examples = load_examples(Path(args.dataset))
    texts = [to_chat_text(tokenizer, ex["fen"], ex["move"]) for ex in examples]
    dataset = Dataset.from_dict({"text": texts})

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        args=SFTConfig(
            dataset_text_field="text",
            max_seq_length=args.max_seq_len,
            per_device_train_batch_size=args.batch_size,
            gradient_accumulation_steps=4,
            num_train_epochs=args.epochs,
            learning_rate=2e-4,
            logging_steps=10,
            output_dir=str(output_dir / "checkpoints"),
            optim="adamw_8bit",
            seed=3407,
        ),
    )
    trainer.train()

    gguf_dir = output_dir / "gguf"
    model.save_pretrained_gguf(str(gguf_dir), tokenizer, quantization_method=args.quantization)

    print(f"run_name={args.run_name} examples={len(examples)} gguf_dir={gguf_dir}")


if __name__ == "__main__":
    main()
