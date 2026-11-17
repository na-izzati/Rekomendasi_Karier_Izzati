import os
import threading
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import URL, Engine
from sqlalchemy.orm import sessionmaker

try:
    from dotenv import load_dotenv
except ImportError:  
    load_dotenv = None


class DatabaseConfigurationError(RuntimeError):
    
_engine: Engine | None = None
_lock = threading.Lock()


def _load_env_file() -> None:
    if load_dotenv is not None:
        load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False)


def build_database_url() -> URL | str:
    _load_env_file()
    full_url = os.environ.get("CAREER_DB_URL", "").strip()
    if full_url:
        return full_url
    password = os.environ.get("CAREER_DB_PASSWORD", "")
    if not password:
        raise DatabaseConfigurationError(
            "Database is not configured: set CAREER_DB_URL, or set CAREER_DB_PASSWORD "
            "(optionally CAREER_DB_HOST, CAREER_DB_PORT, CAREER_DB_NAME, CAREER_DB_USER) "
            "in the environment or in backend/.env (see .env.example)."
        )
    try:
        port = int(os.environ.get("CAREER_DB_PORT", "5433"))
    except ValueError:
        raise DatabaseConfigurationError("CAREER_DB_PORT must be an integer.") from None
    return URL.create(
        "postgresql+psycopg2",
        username=os.environ.get("CAREER_DB_USER", "postgres"),
        password=password,
        host=os.environ.get("CAREER_DB_HOST", "localhost"),
        port=port,
        database=os.environ.get("CAREER_DB_NAME", "career_intelligence"),
    )


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        with _lock:
            if _engine is None:
                _engine = create_engine(build_database_url(), pool_pre_ping=True, future=True)
    return _engine


class _LazyEngine:
    
    def __getattr__(self, name):
        return getattr(get_engine(), name)

    def __repr__(self) -> str:
        return "<LazyEngine>"


engine = _LazyEngine()


def SessionLocal():
    return sessionmaker(bind=get_engine(), future=True)()