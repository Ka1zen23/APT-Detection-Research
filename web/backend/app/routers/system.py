from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse

from app import __version__
from app.config import API_PREFIX, ROOT
from app.deps import envelope, utc_now
from app.services import artifacts

router = APIRouter(tags=["system"])


@router.get("/health")
def health() -> dict:
    return envelope(
        {
            "status": "ok",
            "version": __version__,
            "api_prefix": API_PREFIX,
            "repository_root_exists": ROOT.exists(),
            "allowed_artifact_roots": [
                "results",
                "data/processed",
                "data/splits",
                "data/raw",
                "web/content",
            ],
            "last_artifact_update": artifacts.last_artifact_update(),
            "checked_at": utc_now(),
            "read_only": True,
        }
    )


@router.post("/cache/refresh")
def refresh_cache() -> dict:
    artifacts.invalidate()
    return envelope(
        {
            "refreshed": True,
            "scope": "in-memory artifact cache only",
            "filesystem_modified": False,
        }
    )


@router.get("/artifacts/figures/{run}/{filename}")
def artifact_figure(run: str, filename: str):
    path = artifacts.figure_path(run, filename)
    if path is None:
        raise HTTPException(status_code=404, detail="Figure not found")
    return FileResponse(path, media_type="image/png", filename=path.name)


@router.get("/artifacts/documents/{key}", response_class=PlainTextResponse)
def artifact_document(key: str):
    resolved = artifacts.document_path(key)
    if resolved is None:
        raise HTTPException(status_code=404, detail="Document not found")
    path, meta = resolved
    return PlainTextResponse(
        path.read_text(encoding="utf-8", errors="replace"),
        media_type="text/plain; charset=utf-8",
        headers={"X-Artifact-Path": meta["path"]},
    )
