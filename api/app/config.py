import os
from dotenv import load_dotenv

# load .env
load_dotenv()

CLIENT_ID = os.getenv("LICHESS_CLIENT_ID")
REDIRECT_URI = os.getenv("REDIRECT_URI")
FRONTEND_URL = os.getenv("FRONTEND_URL")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "chess-grpo-05b")