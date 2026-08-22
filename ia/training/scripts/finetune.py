"""LoRA finetune of a chess-playing base model on our filtered Lichess
FEN -> move dataset, via Unsloth.

Reads a {"fen", "move"} JSONL dataset (produced by
ia/data/scripts/build_dataset.py), finetunes the given base model, and
exports the result as a quantized GGUF file ready to be registered as an
Ollama model.

Two target formats are supported (--target-format), matching the two
formats ia/eval/scripts/play_vs_stockfish.py / api/app/services/ollama_chess.py
know how to query at inference time:
  fen_san        FEN only in the prompt, bare SAN move as the response
                 (used for the from-scratch Gemma runs).
  fen_uci_legal  FEN + side to move + legal moves in UCI, response is
                 <rationale>...</rationale><uci_move>...</uci_move>
                 (matches alexneakameni/Qwen2.5-Coder-0.5B-Instruct-chess-grpo's
                 own format -- use this to continue fine-tuning that model).
"""

import argparse
import json
import os
from contextlib import nullcontext
from pathlib import Path

# Unsloth must be imported before transformers/trl/peft: it patches those
# libraries at import time, so importing it later causes duplicate-patch
# errors (e.g. torch._dynamo polyfill registration conflicts).
from unsloth import FastLanguageModel
from unsloth.chat_templates import get_chat_template

import chess
import mlflow
from datasets import Dataset
from dotenv import load_dotenv
from trl import SFTConfig, SFTTrainer

load_dotenv("/data/.env") if Path("/data/.env").exists() else load_dotenv()

MLFLOW_EXPERIMENT = "chessia-finetune"

FEN_SAN_SYSTEM_PROMPT = (
    "Tu es un moteur d'echecs. Etant donne une position au format FEN, "
    "reponds uniquement par le meilleur coup en notation SAN, sans explication."
)
FEN_UCI_LEGAL_SYSTEM_PROMPT = (
    "You are a chess engine. Given a FEN position, the side to move, and the "
    "list of legal moves in UCI format, respond with your reasoning in "
    "<rationale></rationale> tags and your chosen move in <uci_move></uci_move> tags."
)


def load_examples(dataset_path: Path) -> list[dict]:
    examples = []
    with open(dataset_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                examples.append(json.loads(line))
    return examples


def to_chat_text_fen_san(tokenizer, fen: str, move_san: str) -> str:
    messages = [
        {"role": "user", "content": f"{FEN_SAN_SYSTEM_PROMPT}\n\nFEN: {fen}"},
        {"role": "assistant", "content": move_san},
    ]
    return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)


def to_chat_text_fen_uci_legal(tokenizer, fen: str, move_san: str) -> str | None:
    board = chess.Board(fen)
    try:
        move = board.parse_san(move_san)
    except ValueError:
        return None
    uci = move.uci()
    side_to_move = "White" if board.turn == chess.WHITE else "Black"
    legal_moves_uci = " ".join(m.uci() for m in board.legal_moves)

    user_msg = f"FEN: {fen}\nSide to move: {side_to_move}\nLegal moves (UCI): {legal_moves_uci}"
    # No real rationale available from the Lichess data -- keep it short and
    # generic. The point of this continued fine-tune is legal-move reliability,
    # not richer reasoning (the base model already does RL-trained reasoning).
    assistant_msg = f"<rationale>{move_san} is the move played in this position.</rationale>\n<uci_move>{uci}</uci_move>"

    messages = [
        {"role": "system", "content": FEN_UCI_LEGAL_SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
        {"role": "assistant", "content": assistant_msg},
    ]
    return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)


TARGET_FORMATS = {
    "fen_san": to_chat_text_fen_san,
    "fen_uci_legal": to_chat_text_fen_uci_legal,
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True, help="Path to a {fen,move} JSONL file")
    parser.add_argument("--run-name", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--base-model", default="unsloth/gemma-2-2b-bnb-4bit")
    parser.add_argument("--target-format", choices=list(TARGET_FORMATS), default="fen_san")
    parser.add_argument(
        "--chat-template",
        default=None,
        help="Unsloth chat template override (e.g. 'gemma2'). Omit to use the "
        "base model's own chat_template from its tokenizer config (correct "
        "default for Qwen/ChatML-based models).",
    )
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--max-seq-len", type=int, default=512)
    parser.add_argument("--lora-r", type=int, default=16)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--quantization", default="q4_k_m", help="GGUF quantization method")
    args = parser.parse_args()

    hf_token = os.environ.get("HF_TOKEN") or None
    to_chat_text = TARGET_FORMATS[args.target_format]

    mlflow_uri = os.environ.get("MLFLOW_TRACKING_URI")
    if mlflow_uri:
        mlflow.set_tracking_uri(mlflow_uri)
        mlflow.set_experiment(MLFLOW_EXPERIMENT)

    run_ctx = mlflow.start_run(run_name=args.run_name) if mlflow_uri else nullcontext()
    with run_ctx as run:
        if mlflow_uri:
            mlflow.log_params({
                "base_model": args.base_model,
                "target_format": args.target_format,
                "dataset": args.dataset,
                "epochs": args.epochs,
                "max_seq_len": args.max_seq_len,
                "lora_r": args.lora_r,
                "batch_size": args.batch_size,
                "quantization": args.quantization,
            })

        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=args.base_model,
            max_seq_length=args.max_seq_len,
            dtype=None,
            load_in_4bit=True,
            token=hf_token,
        )
        if args.chat_template:
            tokenizer = get_chat_template(tokenizer, chat_template=args.chat_template)

        model = FastLanguageModel.get_peft_model(
            model,
            r=args.lora_r,
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
            lora_alpha=args.lora_r,
            lora_dropout=0,
            bias="none",
            use_gradient_checkpointing=True,
            random_state=3407,
        )

        examples = load_examples(Path(args.dataset))
        texts = [t for ex in examples if (t := to_chat_text(tokenizer, ex["fen"], ex["move"])) is not None]
        skipped = len(examples) - len(texts)
        dataset = Dataset.from_dict({"text": texts})

        output_dir = Path(args.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        if mlflow_uri:
            mlflow.log_param("num_examples", len(texts))
            mlflow.log_param("num_examples_skipped", skipped)

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
                report_to=["mlflow"] if mlflow_uri else [],
            ),
        )
        trainer.train()

        gguf_dir = output_dir / "gguf"
        model.save_pretrained_gguf(str(gguf_dir), tokenizer, quantization_method=args.quantization)

        if mlflow_uri:
            # Written next to the GGUF so register_ollama_model.py / eval can
            # log follow-up metrics (registration status, legal-move rate)
            # against this exact run instead of starting a disconnected one.
            (output_dir / "mlflow_run_id.txt").write_text(run.info.run_id, encoding="utf-8")

    print(f"run_name={args.run_name} examples={len(texts)} skipped={skipped} gguf_dir={gguf_dir}")


if __name__ == "__main__":
    main()
