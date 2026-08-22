import base64
import hashlib
import secrets
import httpx
from fastapi import APIRouter, Request, HTTPException, Security
from fastapi.responses import RedirectResponse
from fastapi.security import APIKeyHeader
from config import CLIENT_ID, REDIRECT_URI, FRONTEND_URL

# Création du routeur avec le préfixe /api
router = APIRouter(prefix="/api")

pkce_store = {}
active_sessions = {}
header_scheme = APIKeyHeader(name="Authorization")

@router.get("/auth/lichess")
def lichess_login():
    # PKCE
    code_verifier = secrets.token_urlsafe(32)
    hashed = hashlib.sha256(code_verifier.encode('ascii')).digest()
    code_challenge = base64.urlsafe_b64encode(hashed).decode('ascii').rstrip('=')
    
    state = secrets.token_hex(16)
    
    # On sauvegarde le verifier avec le state comme clé
    pkce_store[state] = code_verifier

    # Construction de l'URL Lichess
    # scope bot:play + challenge:write: necessaire pour lancer/jouer des parties bot.
    # Toute session obtenue avant cet ajout de scope doit se reconnecter.
    auth_url = (
        f"https://lichess.org/oauth?response_type=code"
        f"&client_id={CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&code_challenge_method=S256"
        f"&code_challenge={code_challenge}"
        f"&state={state}"
        f"&scope=bot:play%20challenge:write"
    )
    
    #redirect du user 
    return RedirectResponse(url=auth_url)

@router.get("/auth/lichess/callback")
async def lichess_callback(request: Request):
    code = request.query_params.get("code")
    state = request.query_params.get("state")
    error = request.query_params.get("error")

    if error:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=access_denied")

    if not code or not state or state not in pkce_store:
        raise HTTPException(status_code=400, detail="Requête invalide ou expirée")

    code_verifier = pkce_store.pop(state) 

    async with httpx.AsyncClient() as client:
        # Échanger le 'code' contre le Token d'accès
        token_response = await client.post(
            "https://lichess.org/api/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "code_verifier": code_verifier,
                "redirect_uri": REDIRECT_URI,
                "client_id": CLIENT_ID
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if token_response.status_code != 200:
            return RedirectResponse(url=f"{FRONTEND_URL}/login?error=token_failed")
            
        token_data = token_response.json()
        access_token = token_data.get("access_token")

        # récup profil du joueur
        user_response = await client.get(
            "https://lichess.org/api/account",
            headers={"Authorization": f"Bearer {access_token}"}
        )

        lichess_user = user_response.json()

        print(f"Joueur connecté : {lichess_user.get('username')} (Elo Blitz: {lichess_user.get('perfs', {}).get('blitz', {}).get('rating', 'N/A')})")

        blitz_elo = lichess_user.get('perfs', {}).get('blitz', {}).get('rating', None)
        perfs = lichess_user.get('perfs', {})
        profile = lichess_user.get('profile', {})

        #  token aléatoire 32 caractères 
        token = secrets.token_urlsafe(32)
        
        active_sessions[token] = {
            "id": lichess_user.get("id"),
            "username": lichess_user.get("username"),
            "email": "lichess@hidden.com",
            "bio": profile.get("bio", "Aucune bio renseignée sur Lichess."),
            "url": lichess_user.get("url"),
            "stats": {
                "blitz": perfs.get('blitz', {}).get('rating', 'Non classé'),
                "bullet": perfs.get('bullet', {}).get('rating', 'Non classé'),
                "rapid": perfs.get('rapid', {}).get('rating', 'Non classé'),
            },
            "isLichess": True,
            "lichess_token": access_token
        }

        return RedirectResponse(url=f"{FRONTEND_URL}/oauth/callback?token={token}")

@router.get("/me")
def get_current_user(auth_header: str = Security(header_scheme)):

    token = auth_header.replace("Bearer ", "").strip()
    
    user_data = active_sessions.get(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Non autorisé ou session expirée")
        
    return user_data