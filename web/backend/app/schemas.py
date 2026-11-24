from __future__ import annotations

from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class Meta(BaseModel):
    generated_at: str
    last_artifact_update: str | None = None
    data_mode: Literal["live_artifacts"] = "live_artifacts"
    warnings: list[str] = Field(default_factory=list)


class Envelope(BaseModel, Generic[T]):
    data: T
    meta: Meta


class Availability(BaseModel):
    status: Literal["available", "missing", "partial"]
    artifact: str | None = None
    note: str | None = None


class SourceRef(BaseModel):
    artifact: str
    field: str | None = None
    derivation: str | None = None
    kind: Literal["measured", "derived", "manual"] = "measured"


class MetricValue(BaseModel):
    value: float | int | None
    source: SourceRef | None = None


class DatasetCounts(BaseModel):
    raw_records: int
    phase1_raw_records: int
    phase2_raw_records: int
    nodes: int
    edges: int
    events: int
    phase1_events: int
    phase2_events: int
    original_positives: int
    contextual_positives: int
    attack_prevalence_percent: float


class Partition(BaseModel):
    name: str
    records: int
    unique_descriptions: int | None = None
    start_timestamp: float | None = None
    end_timestamp: float | None = None


class ExperimentSummary(BaseModel):
    id: str
    name: str
    group: str
    kind: str
    status: str
    representation: str | None = None
    encoder: str | None = None
    algorithm: str | None = None
    research_question: str | None = None
    hypothesis: str | None = None
    roc_auc: float | None = None
    average_precision: float | None = None
    recall: float | None = None
    precision: float | None = None
    f1: float | None = None
    true_positives: int | None = None
    false_positives: int | None = None
    false_negatives: int | None = None
    true_negatives: int | None = None
    benign_fpr: float | None = None
    attack_fpr: float | None = None
    contextual_recall: float | None = None
    threshold: float | None = None
    threshold_percentile: float | None = None
    training_seconds: float | None = None
    seed: int | None = None
    availability: Availability | None = None
    rank: int | None = None
    operating_point: str | None = None
    warnings: list[str] = Field(default_factory=list)


class ModelRow(ExperimentSummary):
    rank: int | None = None
    operating_point: str | None = None


class EventRow(BaseModel):
    phase: str
    event_id: str
    timestamp: float | None = None
    split: str | None = None
    original_label: int | None = None
    contextual_label: int | None = None
    original_tactics: list[str] = Field(default_factory=list)
    contextual_tactics: list[str] = Field(default_factory=list)
    anomaly_score: float | None = None
    prediction: int | None = None
    seen_in_training: bool | None = None
    edge_count: int | None = None
    text: str | None = None


class EventPage(BaseModel):
    items: list[EventRow]
    page: int
    page_size: int
    total: int
    total_pages: int
    sort_by: str
    sort_order: str
    filters: dict[str, Any] = Field(default_factory=dict)
