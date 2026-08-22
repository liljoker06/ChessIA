"""Play full games between an Ollama chess model and a very weak Stockfish,
and report whether each game completed without any illegal move.

No fallback on an illegal/unparsable model move: the game is immediately
marked failed at that ply.

Two prompt formats are supported (--prompt-format):
  fen_san        FEN only in the prompt, expects a bare SAN move back
                 (used by our own Gemma fine-tunes, see training/scripts/finetune.py).
  fen_uci_legal  FEN + side to move + legal moves in UCI, expects
                 <rationale>...</rationale><uci_move>...</uci_move> back
                 (used by alexneakameni/Qwen2.5-Coder-0.5B-Instruct-chess-grpo).
"""

import argparse
import json
import os
import re
from contextlib import nullcontext
from pathlib import Path

import chess
import chess.engine
import mlflow
import requests

MLFLOW_EXPERIMENT = "chessia-finetune"


def query_ollama(ollama_url: str, model_name: str, prompt: str, num_predict: int) -> str:
    resp = requests.post(
        f"{ollama_url}/api/generate",
        json={
            "model": model_name,
            "prompt": prompt,
            "stream": False,
            "options": {
                "num_predict": num_predict,
                # Matches the chess-grpo model card's recommended sampling
                # params -- keep in sync with api/app/services/ollama_chess.py.
                "temperature": 1.0,
                "top_p": 0.95,
                "top_k": 64,
            },
        },
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()["response"]


def extract_move_fen_san(board: chess.Board, raw_response: str) -> chess.Move | None:
    candidate = raw_response.strip().split()[0] if raw_response.strip() else ""
    candidate = re.sub(r"[.!?,]+$", "", candidate)
    try:
        return board.parse_san(candidate)
    except ValueError:
        return None


def extract_move_fen_uci_legal(board: chess.Board, raw_response: str) -> chess.Move | None:
    match = re.search(r"<uci_move>\s*([a-h][1-8][a-h][1-8][qrbn]?)\s*</uci_move>", raw_response)
    if not match:
        return None
    try:
        move = chess.Move.from_uci(match.group(1))
    except ValueError:
        return None
    return move if move in board.legal_moves else None


PROMPT_FORMATS = {
    "fen_san": {
        "build_prompt": lambda board: f"FEN: {board.fen()}",
        "extract_move": extract_move_fen_san,
        "num_predict": 20,
    },
    "fen_uci_legal": {
        "build_prompt": lambda board: (
            f"FEN: {board.fen()}\n"
            f"Side to move: {'White' if board.turn == chess.WHITE else 'Black'}\n"
            f"Legal moves (UCI): {' '.join(m.uci() for m in board.legal_moves)}"
        ),
        "extract_move": extract_move_fen_uci_legal,
        "num_predict": 400,
    },
}


def play_game(
    engine: chess.engine.SimpleEngine,
    ollama_url: str,
    model_name: str,
    model_is_white: bool,
    max_plies: int,
    fmt: dict,
) -> dict:
    board = chess.Board()
    moves_played = []

    while not board.is_game_over() and board.ply() < max_plies:
        model_turn = board.turn == chess.WHITE if model_is_white else board.turn == chess.BLACK

        if model_turn:
            prompt = fmt["build_prompt"](board)
            raw = query_ollama(ollama_url, model_name, prompt, fmt["num_predict"])
            move = fmt["extract_move"](board, raw)
            if move is None:
                return {
                    "result": "illegal_move",
                    "failing_ply": board.ply() + 1,
                    "raw_response": raw,
                    "moves_played": moves_played,
                }
        else:
            result = engine.play(board, chess.engine.Limit(time=0.05))
            move = result.move

        moves_played.append(board.san(move))
        board.push(move)

    if board.is_game_over():
        outcome = board.outcome()
        return {"result": "legal_complete", "termination": outcome.termination.name, "moves_played": moves_played}
    return {"result": "legal_complete", "termination": "MAX_PLIES_ADJUDICATED", "moves_played": moves_played}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ollama-model", required=True)
    parser.add_argument("--num-games", type=int, default=5)
    parser.add_argument("--ollama-url", default=os.environ.get("OLLAMA_URL", "http://ollama:11434"))
    parser.add_argument("--max-plies", type=int, default=150)
    parser.add_argument("--stockfish-skill-level", type=int, default=0, help="0 (weakest) to 20 (strongest)")
    parser.add_argument("--prompt-format", choices=list(PROMPT_FORMATS), default="fen_san")
    parser.add_argument("--output", required=True)
    parser.add_argument(
        "--run-dir",
        default=None,
        help="Training run's output dir (e.g. /models/<run-name>) -- if it contains mlflow_run_id.txt, "
        "eval metrics are logged against that same MLflow run instead of a new standalone one.",
    )
    args = parser.parse_args()

    fmt = PROMPT_FORMATS[args.prompt_format]

    mlflow_uri = os.environ.get("MLFLOW_TRACKING_URI")
    run_id = None
    if mlflow_uri and args.run_dir:
        run_id_path = Path(args.run_dir) / "mlflow_run_id.txt"
        if run_id_path.exists():
            run_id = run_id_path.read_text(encoding="utf-8").strip()

    if mlflow_uri:
        mlflow.set_tracking_uri(mlflow_uri)
        mlflow.set_experiment(MLFLOW_EXPERIMENT)
        run_ctx = mlflow.start_run(run_id=run_id) if run_id else mlflow.start_run(run_name=f"{args.ollama_model}-eval")
    else:
        run_ctx = nullcontext()

    stockfish_path = os.environ.get("STOCKFISH_PATH", "stockfish")
    engine = chess.engine.SimpleEngine.popen_uci(stockfish_path)
    engine.configure({"Skill Level": args.stockfish_skill_level})

    with run_ctx:
        if mlflow_uri:
            mlflow.log_params({
                "eval_ollama_model": args.ollama_model,
                "eval_prompt_format": args.prompt_format,
                "eval_num_games": args.num_games,
                "eval_stockfish_skill_level": args.stockfish_skill_level,
            })

        games = []
        try:
            for i in range(args.num_games):
                model_is_white = i % 2 == 0
                game_result = play_game(engine, args.ollama_url, args.ollama_model, model_is_white, args.max_plies, fmt)
                game_result["model_color"] = "white" if model_is_white else "black"
                games.append(game_result)
                print(f"game {i + 1}/{args.num_games}: {game_result['result']} ({len(game_result['moves_played'])} plies)")
                if mlflow_uri:
                    mlflow.log_metric("plies_before_failure", len(game_result["moves_played"]), step=i)
        finally:
            engine.quit()

        complete = sum(1 for g in games if g["result"] == "legal_complete")
        summary = {
            "ollama_model": args.ollama_model,
            "num_games": args.num_games,
            "legal_complete": complete,
            "games": games,
        }

        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)

        if mlflow_uri:
            mlflow.log_metric("legal_complete_games", complete)
            mlflow.log_metric("legal_complete_rate", complete / args.num_games)
            mlflow.log_artifact(str(output_path))

    print(f"model={args.ollama_model} legal_complete={complete}/{args.num_games} -> {output_path}")


if __name__ == "__main__":
    main()
