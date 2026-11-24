from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.deps import envelope
from app.schemas import Envelope, ExperimentSummary
from app.services import content, curves, metrics

router = APIRouter(prefix="/experiments", tags=["experiments"])


@router.get("", response_model=Envelope[list[ExperimentSummary]])
def list_experiments(
    status: str | None = Query(default=None),
    group: str | None = Query(default=None),
) -> dict:
    items = metrics.experiments()
    if status:
        items = [item for item in items if item.get("status") == status]
    if group:
        items = [item for item in items if item.get("group") == group]
    return envelope(items)


@router.get("/{experiment_id}")
def experiment(experiment_id: str) -> dict:
    detail = metrics.experiment_detail(experiment_id)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Unknown experiment: {experiment_id}")
    return envelope(detail)


@router.get("/{experiment_id}/metrics")
def experiment_metrics(experiment_id: str) -> dict:
    row = metrics.model_row(experiment_id)
    if row is None:
        if experiment_id in {e["id"] for e in content.experiment_registry()}:
            return envelope(
                {
                    "experiment_id": experiment_id,
                    "available": False,
                    "reason": "No measured model metrics exist for this experiment.",
                }
            )
        raise HTTPException(status_code=404, detail=f"Unknown experiment: {experiment_id}")
    return envelope({"experiment_id": experiment_id, "available": True, "metrics": row})


@router.get("/{experiment_id}/thresholds")
def experiment_thresholds(experiment_id: str) -> dict:
    payload = metrics.thresholds(experiment_id)
    if payload is None:
        return envelope(
            {
                "experiment_id": experiment_id,
                "available": False,
                "reason": "No measured threshold sweep is available for this experiment.",
            }
        )
    return envelope({"available": True, **payload})


@router.get("/{experiment_id}/alert-budgets")
def experiment_alert_budgets(experiment_id: str) -> dict:
    payload = metrics.alert_budgets(experiment_id)
    if payload is None:
        return envelope(
            {
                "experiment_id": experiment_id,
                "available": False,
                "reason": "No measured alert-budget analysis is available for this experiment.",
            }
        )
    return envelope({"available": True, **payload})


@router.get("/{experiment_id}/curves")
def experiment_curves(
    experiment_id: str,
    label: str = Query(default="original", pattern="^(original|contextual)$"),
) -> dict:
    payload = curves.curves(experiment_id, label)
    if payload is None:
        return envelope(
            {
                "experiment_id": experiment_id,
                "label": label,
                "available": False,
                "reason": "No stored per-event scores are available for this experiment.",
            }
        )
    return envelope(payload)


@router.get("/{experiment_id}/figures")
def experiment_figures(experiment_id: str) -> dict:
    detail = metrics.experiment_detail(experiment_id)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Unknown experiment: {experiment_id}")
    return envelope({"experiment_id": experiment_id, "figures": detail.get("figures", [])})
