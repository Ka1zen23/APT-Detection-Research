from __future__ import annotations

import os
from pathlib import Path

# web/backend/app/config.py -> app, backend, web, repository root
_DEFAULT_ROOT = Path(__file__).resolve().parents[3]
ROOT = Path(os.getenv("APT_REPO_ROOT", str(_DEFAULT_ROOT))).resolve()
WEB_DIR = ROOT / "web"
CONTENT_DIR = WEB_DIR / "content"
FRONTEND_DIR = WEB_DIR / "frontend"

try:
    from dotenv import load_dotenv

    load_dotenv(WEB_DIR / ".env")
except ImportError:
    pass

RESULTS_DIR = ROOT / "results"
PROCESSED_DIR = ROOT / "data" / "processed"
SPLITS_DIR = ROOT / "data" / "splits"
RAW_DIR = ROOT / "data" / "raw"
MODELS_DIR = ROOT / "models"

# Only these roots may ever be read by artifact services.
ALLOWED_ROOTS: tuple[Path, ...] = (
    RESULTS_DIR,
    PROCESSED_DIR,
    SPLITS_DIR,
    RAW_DIR,
    CONTENT_DIR,
)

DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
]


def _cors_origins() -> list[str]:
    configured = os.getenv("APT_CORS_ORIGINS", "")
    if not configured.strip():
        return DEFAULT_CORS_ORIGINS
    return [origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()]


CORS_ORIGINS = _cors_origins()
API_KEY = os.getenv("APT_API_KEY", "").strip()
DEPLOYMENT_MODE = os.getenv("APT_DEPLOYMENT_MODE", "local").strip()

API_PREFIX = "/api/v1"
CACHE_TTL_SECONDS = int(os.getenv("APT_DASHBOARD_CACHE_TTL", "15"))
MAX_EVENT_PAGE_SIZE = 100
DEFAULT_EVENT_PAGE_SIZE = 25
HOST = os.getenv("APT_DASHBOARD_HOST", "127.0.0.1")
PORT = int(os.getenv("APT_DASHBOARD_PORT", "8000"))


def resolve_allowed(relative: str | Path) -> Path:
    """Resolve a repository-relative path and assert it lives in an allowed root."""
    candidate = (ROOT / relative).resolve()
    for allowed in ALLOWED_ROOTS:
        allowed_resolved = allowed.resolve()
        if candidate == allowed_resolved or allowed_resolved in candidate.parents:
            return candidate
    raise PermissionError(f"Path is outside permitted research directories: {relative}")
