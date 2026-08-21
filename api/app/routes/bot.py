import httpx
import json
import time
import asyncio
from fastapi import APIRouter, Security, HTTPException
from routes.auth import active_sessions, header_scheme

router = APIRouter(prefix="/api/bot")

# cache
games_cache = {}
fetch_lock = asyncio.Lock()

@router.get("/games")
async def get_bot_games(limit: int = 10, auth_header: str = Security(header_scheme)):
    token = auth_header.replace("Bearer ", "").strip()
    user_data = active_sessions.get(token)
    
    if not user_data:
        raise HTTPException(status_code=401, detail="Session expirée")
        
    username = user_data["username"]
    lichess_token = user_data.get("lichess_token") 

    async with fetch_lock:
        current_time = time.time()
        
        # (logic identique...)
        if username in games_cache and (current_time - games_cache[username]["time"] < 60):
            return games_cache[username]["data"]

        # recup parties avec auth
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://lichess.org/api/games/user/{username}",
                params={
                    "max": limit, 
                    "opening": "true",
                    "pgnInJson": "true"
                },
                headers={
                    "Accept": "application/x-ndjson",
                    "User-Agent": "ChessIA-Bot-Project (fastapi)",
                    "Authorization": f"Bearer {lichess_token}"
                },
                timeout=15.0
            )
            
            if response.status_code != 200:
                print(f"\neRREUR")
                print(f"Code : {response.status_code}")
                print(f"Message : {response.text}")

                raise HTTPException(status_code=400, detail="Erreur Lichess")
                
            raw_games = response.text.strip().split('\n')
            games = [json.loads(line) for line in raw_games if line.strip()]
            
            result_data = {"username": username, "total_returned": len(games), "games": games}
            
            # load dans le cache
            games_cache[username] = {
                "time": current_time,
                "data": result_data
            }
            
            return result_data

@router.get("/puzzle/next")
async def get_next_puzzle(auth_header: str = Security(header_scheme)):
    token = auth_header.replace("Bearer ", "").strip()
    user_data = active_sessions.get(token)
    
    if not user_data or not user_data.get("lichess_token"):
        raise HTTPException(status_code=401, detail="Session Lichess requise")
        
    lichess_token = user_data["lichess_token"]

    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://lichess.org/api/puzzle/next",
            headers={
                "Authorization": f"Bearer {lichess_token}",
                "User-Agent": "ChessIA-Bot-Project (fastapi)"
            },
            timeout=10.0
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Erreur Lichess sur les puzzles")
            
        return response.json()