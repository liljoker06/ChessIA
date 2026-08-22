"""Ask an Ollama-served chess model for a move, given a python-chess board.

Ported from ia/eval/scripts/play_vs_stockfish.py's PROMPT_FORMATS dispatch --
keep both in sync if the prompt format changes.
"""

import re

import chess
import httpx

from config import OLLAMA_MODEL, OLLAMA_URL


def _extract_move_fen_san(board: chess.Board, raw_response: str) -> chess.Move | None:
    candidate = raw_response.strip().split()[0] if raw_response.strip() else ""
    candidate = re.sub(r"[.!?,]+$", "", candidate)
    try:
        return board.parse_san(candidate)
    except ValueError:
        return None


def _extract_move_fen_uci_legal(board: chess.Board, raw_response: str) -> chess.Move | None:
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
        "extract_move": _extract_move_fen_san,
        "num_predict": 20,
    },
    "fen_uci_legal": {
        "build_prompt": lambda board: (
            f"FEN: {board.fen()}\n"
            f"Side to move: {'White' if board.turn == chess.WHITE else 'Black'}\n"
            f"Legal moves (UCI): {' '.join(m.uci() for m in board.legal_moves)}"
        ),
        "extract_move": _extract_move_fen_uci_legal,
        "num_predict": 400,
    },
}

# chess-grpo-05b (our current default) expects fen_uci_legal; adjust here if
# OLLAMA_MODEL is swapped for a model trained on the plain fen_san format.
DEFAULT_PROMPT_FORMAT = "fen_uci_legal"


async def get_move(board: chess.Board, prompt_format: str = DEFAULT_PROMPT_FORMAT) -> chess.Move | None:
    fmt = PROMPT_FORMATS[prompt_format]
    prompt = fmt["build_prompt"](board)

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {"num_predict": fmt["num_predict"]},
            },
            timeout=120,
        )
        resp.raise_for_status()
        raw = resp.json()["response"]

    return fmt["extract_move"](board, raw)
