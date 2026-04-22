"""Shared singletons and DI helpers for all routes."""
import os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from slowapi import Limiter
from slowapi.util import get_remote_address
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from rag_engine import RagEngine
from groq_service import GroqService

# MongoDB
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# Engines
rag_engine = RagEngine()
groq_service = GroqService(os.environ["GROQ_API_KEY"])

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

# Config
MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MB
