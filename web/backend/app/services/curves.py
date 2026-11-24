from __future__ import annotations

import threading
from typing import Any

import numpy as np

from app.services import artifacts, metrics

from sklearn.metrics import (
    average_precision_score,
    precision_recall_curve,
    roc_auc_score,
    roc_curve,
)

_LOCK = threading.RLock()
_CACHE: dict[str, tuple[tuple[int, int] | None, dict[str, Any]]] = {}


def curve_source(experiment_id: str) -> str | None:
    if experiment_id in metrics.BASELINE_RUNS:
        return metrics.BASELINE_RUNS[experiment_id]["predictions"]
    if experiment_id in metrics.E2_RUNS:
        return metrics.E2_RUNS[experiment_id]["predictions"]
    if experiment_id in metrics.ABLATION_RUNS:
        return metrics.ABLATION_RUNS[experiment_id]["predictions"]
    return None


def _mtime(relative: str) -> tuple[int, int] | None:
    try:
        path = artifacts.resolve_allowed(relative)
        stat = path.stat()
        return stat.st_mtime_ns, stat.st_size
    except (OSError, PermissionError):
        return None


def _downsample(x: np.ndarray, y: np.ndarray, limit: int = 240) -> list[dict[str, float]]:
    if len(x) <= limit:
        indices = range(len(x))
    else:
        indices = np.linspace(0, len(x) - 1, limit, dtype=int)
    return [
        {"x": float(x[index]), "y": float(y[index])}
        for index in indices
    ]


def curves(experiment_id: str, label: str = "original") -> dict[str, Any] | None:
    source = curve_source(experiment_id)
    if source is None:
        return None
    key = f"{experiment_id}:{label}"
    mtime = _mtime(source)
    with _LOCK:
        cached = _CACHE.get(key)
        if cached and cached[0] == mtime:
            return cached[1]

    frame = artifacts.read_parquet(
        source,
        columns=["original_label", "contextual_label", "anomaly_score"],
    )
    if frame is None or frame.empty:
        return None
    target = "original_label" if label == "original" else "contextual_label"
    y_true = frame[target].to_numpy(dtype=int)
    scores = frame["anomaly_score"].to_numpy(dtype=float)
    if len(np.unique(y_true)) < 2:
        return {
            "experiment_id": experiment_id,
            "label": label,
            "available": False,
            "reason": "Only one class is present in this partition.",
            "source": source,
        }

    fpr, tpr, _ = roc_curve(y_true, scores)
    precision, recall, _ = precision_recall_curve(y_true, scores)
    result = {
        "experiment_id": experiment_id,
        "label": label,
        "available": True,
        "computed_roc_auc": float(roc_auc_score(y_true, scores)),
        "computed_average_precision": float(average_precision_score(y_true, scores)),
        "roc": _downsample(fpr, tpr),
        "pr": _downsample(recall[::-1], precision[::-1]),
        "source": source,
        "points": {
            "roc_raw": int(len(fpr)),
            "pr_raw": int(len(recall)),
        },
        "note": "Curves are computed from stored per-event anomaly scores, then evenly downsampled for display.",
    }
    with _LOCK:
        _CACHE[key] = (mtime, result)
    return result
