"""Start and stream a live game played by our Ollama model on Lichess --
either against Lichess's built-in AI, or by challenging a specific
user/bot -- on the connected (bot-upgraded) Lichess account.
"""

import asyncio
import json

import chess
import chess.variant
from fastapi import APIRouter, HTTPException, Security
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from routes.auth import active_sessions, header_scheme
from services import lichess_bot, ollama_chess

router = APIRouter(prefix="/api/play")

DIFFICULTY_TO_LEVEL = {"facile": 2, "moyen": 4, "difficile": 6, "maitre": 8}
COLOR_TO_LICHESS = {"w": "white", "b": "black", "random": "random"}
MAX_MOVE_RETRIES = 3
CHALLENGE_TIMEOUT_SECONDS = 120

TIME_CONTROLS = {
    "bullet": {"clock_limit_seconds": 120, "clock_increment_seconds": 1},
    "blitz": {"clock_limit_seconds": 300, "clock_increment_seconds": 3},
    "rapid": {"clock_limit_seconds": 600, "clock_increment_seconds": 5},
    "classical": {"clock_limit_seconds": 1800, "clock_increment_seconds": 20},
    "correspondence": {"clock_limit_seconds": None, "clock_increment_seconds": 0, "days": 2},
}

# Variants python-chess implements as a dedicated Board subclass. Standard and
# chess960 both use plain chess.Board (chess960 just flips a flag).
_VARIANT_BOARD_CLASSES = {
    "crazyhouse": chess.variant.CrazyhouseBoard,
    "atomic": chess.variant.AtomicBoard,
    "kingOfTheHill": chess.variant.KingOfTheHillBoard,
    "racingKings": chess.variant.RacingKingsBoard,
    "horde": chess.variant.HordeBoard,
    "threeCheck": chess.variant.ThreeCheckBoard,
    "antichess": chess.variant.AntichessBoard,
}
VALID_VARIANTS = {"standard", "chess960", *_VARIANT_BOARD_CLASSES}

# game_id -> {"subscribers": list[asyncio.Queue], "latest": dict}
_games: dict[str, dict] = {}


def _board_for_variant(variant: str) -> chess.Board:
    if variant == "chess960":
        return chess.Board(chess960=True)
    return _VARIANT_BOARD_CLASSES.get(variant, chess.Board)()


class StartRequest(BaseModel):
    difficulty: str = "moyen"
    color: str = "w"  # "w" | "b" | "random"
    opponent: str = "ai"  # "ai" | "user"
    username: str | None = None
    time_control: str = "rapid"
    variant: str = "standard"
    rated: bool = False


def _get_session(auth_header: str) -> dict:
    token = auth_header.replace("Bearer ", "").strip()
    session = active_sessions.get(token)
    if not session:
        raise HTTPException(status_code=401, detail="Non autorise ou session expiree")
    return session


def _publish(game_id: str, event: dict) -> None:
    game = _games.get(game_id)
    if not game:
        return
    # Merge onto the previous snapshot so terminal events (resigned/error),
    # which don't carry fen/moves, don't blank out the board on the frontend.
    merged = {**(game["latest"] or {}), **event}
    game["latest"] = merged
    for queue in game["subscribers"]:
        queue.put_nowait(merged)


async def _wait_for_acceptance(lichess_token: str, challenge_id: str, timeout_s: int = CHALLENGE_TIMEOUT_SECONDS) -> str | None:
    """Watch the account event stream until the challenge becomes a game (or
    is declined/canceled). Returns "accepted"/"declined"/"canceled", or None
    on timeout."""

    async def _watch() -> str:
        async for event in lichess_bot.stream_events(lichess_token):
            etype = event.get("type")
            if etype == "gameStart" and event.get("game", {}).get("id") == challenge_id:
                return "accepted"
            if etype == "challengeDeclined" and event.get("challenge", {}).get("id") == challenge_id:
                return "declined"
            if etype == "challengeCanceled" and event.get("challenge", {}).get("id") == challenge_id:
                return "canceled"
        return "declined"

    try:
        return await asyncio.wait_for(_watch(), timeout=timeout_s)
    except asyncio.TimeoutError:
        return None


async def _run_challenge_then_game(challenge_id: str, lichess_token: str, my_username: str, variant: str) -> None:
    _publish(challenge_id, {"status": "waiting_for_opponent"})
    result = await _wait_for_acceptance(lichess_token, challenge_id)
    if result != "accepted":
        try:
            await lichess_bot.cancel_challenge(lichess_token, challenge_id)
        except Exception:  # noqa: BLE001
            pass
        _publish(challenge_id, {"status": "challenge_expired", "reason": result or "timeout"})
        return
    await _run_game_loop(challenge_id, lichess_token, my_username, variant)


async def _run_game_loop(game_id: str, lichess_token: str, my_username: str, variant: str) -> None:
    bot_color: chess.Color | None = None
    game_info: dict = {}

    try:
        async for event in lichess_bot.stream_game_state(lichess_token, game_id):
            event_type = event.get("type")

            if event_type == "gameFull":
                bot_color = (
                    chess.WHITE
                    if event.get("white", {}).get("id", "").lower() == my_username.lower()
                    else chess.BLACK
                )
                clock = event.get("clock") or {}
                white_info = event.get("white", {})
                black_info = event.get("black", {})
                game_info = {
                    "speed": event.get("speed"),
                    "perf": (event.get("perf") or {}).get("name"),
                    "variant": (event.get("variant") or {}).get("key", variant),
                    "clock_initial_ms": clock.get("initial"),
                    "clock_increment_ms": clock.get("increment"),
                    "white_ai_level": white_info.get("aiLevel"),
                    "black_ai_level": black_info.get("aiLevel"),
                    "white_name": white_info.get("name") or white_info.get("id"),
                    "black_name": black_info.get("name") or black_info.get("id"),
                }
                state = event.get("state", {})
            elif event_type == "gameState":
                state = event
            else:
                continue

            moves = state.get("moves", "")
            status = state.get("status")

            board = _board_for_variant(variant)
            for uci in moves.split():
                board.push_uci(uci)

            _publish(game_id, {
                **game_info,
                "fen": board.fen(),
                "moves": moves,
                "last_move": moves.split()[-1] if moves else None,
                "status": status,
                "turn": "w" if board.turn == chess.WHITE else "b",
                "bot_color": "w" if bot_color == chess.WHITE else "b",
                "wtime_ms": state.get("wtime"),
                "btime_ms": state.get("btime"),
            })

            if status != "started":
                break

            if bot_color is not None and board.turn == bot_color and not board.is_game_over():
                move = None
                for _ in range(MAX_MOVE_RETRIES):
                    move = await ollama_chess.get_move(board)
                    if move is not None:
                        break
                if move is None:
                    await lichess_bot.resign(lichess_token, game_id)
                    _publish(game_id, {"status": "resigned", "reason": "no_legal_move"})
                    break
                await lichess_bot.make_move(lichess_token, game_id, move.uci())
    except Exception as exc:  # noqa: BLE001
        _publish(game_id, {"status": "error", "error": str(exc)})


@router.post("/start")
async def start_game(body: StartRequest, auth_header: str = Security(header_scheme)):
    session = _get_session(auth_header)
    color = body.color if body.color in ("w", "b") else "random"
    variant = body.variant if body.variant in VALID_VARIANTS else "standard"
    tc = TIME_CONTROLS.get(body.time_control, TIME_CONTROLS["rapid"])

    if body.opponent == "user":
        if not body.username:
            raise HTTPException(status_code=400, detail="Pseudo requis pour defier un joueur/bot precis")
        challenge_id = await lichess_bot.create_user_challenge(
            session["lichess_token"],
            body.username,
            COLOR_TO_LICHESS[color],
            variant,
            body.rated,
            tc.get("clock_limit_seconds"),
            tc.get("clock_increment_seconds", 0),
            tc.get("days"),
        )
        _games[challenge_id] = {"subscribers": [], "latest": None}
        session["current_game_id"] = challenge_id
        asyncio.create_task(
            _run_challenge_then_game(challenge_id, session["lichess_token"], session["username"], variant)
        )
        return {"game_id": challenge_id}

    level = DIFFICULTY_TO_LEVEL.get(body.difficulty, 4)
    game_id = await lichess_bot.create_ai_challenge(
        session["lichess_token"],
        level,
        COLOR_TO_LICHESS[color],
        variant,
        tc.get("clock_limit_seconds"),
        tc.get("clock_increment_seconds", 0),
        tc.get("days"),
    )
    _games[game_id] = {"subscribers": [], "latest": None}
    session["current_game_id"] = game_id

    asyncio.create_task(_run_game_loop(game_id, session["lichess_token"], session["username"], variant))

    return {"game_id": game_id}


@router.get("/current")
def get_current_game(auth_header: str = Security(header_scheme)):
    session = _get_session(auth_header)
    return {"game_id": session.get("current_game_id")}


@router.get("/stream/{game_id}")
async def stream_game(game_id: str):
    if game_id not in _games:
        raise HTTPException(status_code=404, detail="Partie inconnue")

    queue: asyncio.Queue = asyncio.Queue()
    _games[game_id]["subscribers"].append(queue)

    latest = _games[game_id]["latest"]
    if latest is not None:
        queue.put_nowait(latest)

    async def event_stream():
        try:
            while True:
                event = await queue.get()
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("status") not in ("started", "waiting_for_opponent", None):
                    break
        finally:
            _games[game_id]["subscribers"].remove(queue)

    return StreamingResponse(event_stream(), media_type="text/event-stream")
