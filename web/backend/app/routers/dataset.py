from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.config import DEFAULT_EVENT_PAGE_SIZE, MAX_EVENT_PAGE_SIZE
from app.deps import envelope
from app.schemas import Envelope, EventPage
from app.services import dataset

router = APIRouter(prefix="/dataset", tags=["dataset"])


@router.get("/summary")
def dataset_summary() -> dict:
    return envelope(dataset.summary())


@router.get("/distributions")
def dataset_distributions() -> dict:
    summary = dataset.summary()
    return envelope(
        {
            "node_types": summary["node_types"],
            "edge_types": summary["edge_types"],
            "operations": summary["operations"],
            "tactics": summary["tactics"],
            "timeline": summary["timeline"],
            "missing_values": summary["missing_values"],
            "sources": summary["sources"],
        }
    )


@router.get("/events", response_model=Envelope[EventPage])
def dataset_events(
    phase: str | None = Query(default=None, pattern="^(phase1|phase2)$"),
    split: str | None = Query(
        default=None, pattern="^(train|validation|benign_test|attack_test)$"
    ),
    event_id: str | None = Query(default=None, max_length=80),
    original_label: int | None = Query(default=None, ge=0, le=1),
    contextual_label: int | None = Query(default=None, ge=0, le=1),
    tactic: str | None = Query(default=None, max_length=80),
    min_score: float | None = Query(default=None),
    max_score: float | None = Query(default=None),
    prediction: int | None = Query(default=None, ge=0, le=1),
    seen: bool | None = Query(default=None),
    timestamp_from: float | None = Query(default=None),
    timestamp_to: float | None = Query(default=None),
    search: str | None = Query(default=None, max_length=200),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=DEFAULT_EVENT_PAGE_SIZE, ge=1, le=MAX_EVENT_PAGE_SIZE),
    sort_by: str = Query(default="timestamp"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
) -> dict:
    return envelope(
        dataset.events(
            phase=phase,
            split=split,
            event_id=event_id,
            original_label=original_label,
            contextual_label=contextual_label,
            tactic=tactic,
            min_score=min_score,
            max_score=max_score,
            prediction=prediction,
            seen=seen,
            timestamp_from=timestamp_from,
            timestamp_to=timestamp_to,
            search=search,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )
    )


@router.get("/events/{phase}/{event_id}")
def dataset_event_detail(phase: str, event_id: str) -> dict:
    if phase not in {"phase1", "phase2"}:
        raise HTTPException(status_code=404, detail="Unknown dataset phase")
    item = dataset.event_detail(phase, event_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return envelope(item)
