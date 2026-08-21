import os
from dotenv import load_dotenv

# load .env
load_dotenv()

CLIENT_ID = os.getenv("LICHESS_CLIENT_ID")
REDIRECT_URI = os.getenv("REDIRECT_URI")
FRONTEND_URL = os.getenv("FRONTEND_URL")