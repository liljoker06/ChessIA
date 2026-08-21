"""Play full games between a finetuned Ollama chess model and a very weak
Stockfish, and report whether each game completed without any illegal move.

No fallback on an illegal/unparsable model move: the game is immediately
marked failed at that ply.
"""

import argparse
import json
import os
import re
from pathlib import Path

import chess
import chess.engine
import requests

SYSTEM_PROMPT = (
    "Tu es un moteur d'echecs. Etant donne une position au format FEN, "
    "reponds uniquement par le meilleur coup en notation SAN, sans explication."
)


def query_model(ollama_url: str, model_name: str, fen: str) -> str:
    prompt = f"{SYSTEM_PROMPT}\n\nFEN: {fen}"
    resp = requests.post(
        f"{ollama_url}/api/generate",
        json={"model": model_name, "prompt": prompt, "stream": False},
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()["response"]


def extract_move(board: chess.Board, raw_response: str) -> chess.Move | None:
    candidate = raw_response.strip().split()[0] if raw_response.strip() else ""
    candidate = re.sub(r"[.!?,]+$", "", candidate)
    try:
        return board.parse_san(candidate)
    except ValueError:
        return None


def play_game(engine: chess.engine.SimpleEngine, ollama_url: str, model_name: str, model_is_white: bool, max_plies: int) -> dict:
    board = chess.Board()
    moves_played = []

    while not board.is_game_over() and board.ply() < max_plies:
        model_turn = board.turn == chess.WHITE if model_is_white else board.turn == chess.BLACK

        if model_turn:
            raw = query_model(ollama_url, model_name, board.fen())
            move = extract_move(board, raw)
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
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    stockfish_path = os.environ.get("STOCKFISH_PATH", "stockfish")
    engine = chess.engine.SimpleEngine.popen_uci(stockfish_path)
    engine.configure({"Skill Level": args.stockfish_skill_level})

    games = []
    try:
        for i in range(args.num_games):
            model_is_white = i % 2 == 0
            game_result = play_game(engine, args.ollama_url, args.ollama_model, model_is_white, args.max_plies)
            game_result["model_color"] = "white" if model_is_white else "black"
            games.append(game_result)
            print(f"game {i + 1}/{args.num_games}: {game_result['result']} ({len(game_result['moves_played'])} plies)")
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

    print(f"model={args.ollama_model} legal_complete={complete}/{args.num_games} -> {output_path}")


if __name__ == "__main__":
    main()
