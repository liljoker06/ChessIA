"""Async client for the Lichess Bot API: create a game (against Lichess's
built-in AI, or by challenging a specific user/bot), stream its state, and
submit moves.
"""

import json
from typing import AsyncIterator

import httpx

LICHESS_API = "https://lichess.org/api"


def _clock_params(clock_limit_seconds: int | None, clock_increment_seconds: int, days: int | None) -> dict:
    """Correspondence games use `days` instead of a real clock."""
    if days is not None:
        return {"days": days}
    return {"clock.limit": clock_limit_seconds, "clock.increment": clock_increment_seconds}


async def create_ai_challenge(
    token: str,
    level: int,
    color: str,
    variant: str = "standard",
    clock_limit_seconds: int | None = 900,
    clock_increment_seconds: int = 10,
    days: int | None = None,
) -> str:
    """Start a game against Lichess's built-in AI. Returns the game id."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{LICHESS_API}/challenge/ai",
            data={
                "level": level,
                "color": color,
                "variant": variant,
                **_clock_params(clock_limit_seconds, clock_increment_seconds, days),
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()["id"]


async def create_user_challenge(
    token: str,
    username: str,
    color: str,
    variant: str = "standard",
    rated: bool = False,
    clock_limit_seconds: int | None = 600,
    clock_increment_seconds: int = 5,
    days: int | None = None,
) -> str:
    """Challenge a specific Lichess user/bot. Returns the challenge id (this
    becomes the game id once the challenge is accepted)."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{LICHESS_API}/challenge/{username}",
            data={
                "rated": "true" if rated else "false",
                "color": color,
                "variant": variant,
                **_clock_params(clock_limit_seconds, clock_increment_seconds, days),
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()["challenge"]["id"]


async def cancel_challenge(token: str, challenge_id: str) -> None:
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{LICHESS_API}/challenge/{challenge_id}/cancel",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )


async def stream_events(token: str) -> AsyncIterator[dict]:
    """Stream account-level events: incoming/outgoing challenges, gameStart, gameFinish."""
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream(
            "GET",
            f"{LICHESS_API}/stream/event",
            headers={"Authorization": f"Bearer {token}"},
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                line = line.strip()
                if line:
                    yield json.loads(line)


async def stream_game_state(token: str, game_id: str) -> AsyncIterator[dict]:
    """Yield parsed NDJSON events (gameFull, then gameState/chatLine/...) for a game."""
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream(
            "GET",
            f"{LICHESS_API}/bot/game/stream/{game_id}",
            headers={"Authorization": f"Bearer {token}"},
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                line = line.strip()
                if line:
                    yield json.loads(line)


async def make_move(token: str, game_id: str, uci: str) -> None:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{LICHESS_API}/bot/game/{game_id}/move/{uci}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        resp.raise_for_status()


async def resign(token: str, game_id: str) -> None:
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{LICHESS_API}/bot/game/{game_id}/resign",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
