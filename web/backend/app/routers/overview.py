from __future__ import annotations

from fastapi import APIRouter

from app.deps import envelope
from app.services import content, metrics

router = APIRouter(tags=["overview"])


@router.get("/overview")
def overview() -> dict:
    data = metrics.overview()
    warnings = []
    if data["counts"]["reports_available"] == 0:
        warnings.append("No report documents are available in the repository.")
    return envelope(data, warnings)


@router.get("/status")
def status() -> dict:
    return envelope(content.research_status())


@router.get("/objectives")
def objectives() -> dict:
    return envelope({"objectives": content.objectives()})
