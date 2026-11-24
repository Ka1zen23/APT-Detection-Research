from __future__ import annotations

from fastapi import APIRouter

from app.deps import envelope
from app.services import metrics

router = APIRouter(prefix="/comparisons", tags=["comparisons"])


@router.get("/models")
def compare_models() -> dict:
    return envelope(metrics.model_comparison())


@router.get("/ablation")
def compare_ablation() -> dict:
    return envelope(metrics.ablation())


@router.get("/description-overlap")
def compare_description_overlap() -> dict:
    return envelope(metrics.description_overlap())
