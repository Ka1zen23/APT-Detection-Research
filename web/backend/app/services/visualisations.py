"""Allowlisted, aggregate inputs for the public comparison charts."""

from __future__ import annotations

import math
import re
from typing import Any

import numpy as np

from app.services import artifacts, metrics


def _number(value: Any) -> float | None:
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def training() -> dict:
    runs = []
    for experiment_id, run in metrics.E2_RUNS.items():
        root = f"results/{run['dir']}"
        history_path = f"{root}/training_history.csv"
        summary_path = f"{root}/training_summary.json"
        frame = artifacts.read_csv(history_path)
        history = []
        if frame is not None and {"epoch", "train_loss", "validation_loss"} <= set(frame.columns):
            for row in frame.itertuples(index=False):
                epoch = _number(row.epoch)
                if epoch is not None and epoch > 0 and epoch.is_integer():
                    history.append({
                        "epoch": int(epoch),
                        "train_loss": _number(row.train_loss),
                        "validation_loss": _number(row.validation_loss),
                    })
        summary = artifacts.read_json(summary_path) or {}
        samples, batch, epochs, checkpoint = (
            _number(summary.get(key)) for key in ("train_samples", "batch_size", "epochs_completed", "best_epoch")
        )
        # Both saved E2 loaders keep the last partial batch and take one step per batch.
        batches = math.ceil(samples / batch) if samples and batch else None
        completed_updates = _number(summary.get("completed_updates"))
        checkpoint_updates = _number(summary.get("best_checkpoint_updates"))
        runs.append({
            "id": experiment_id, "label": run["label"],
            "history": history, "history_source": history_path if history else None,
            "summary_source": summary_path if summary else None,
            "train_samples": samples, "epochs_completed": epochs, "checkpoint_epoch": checkpoint,
            "training_seconds": _number(summary.get("elapsed_seconds")),
            "completed_updates": completed_updates if completed_updates is not None else batches * epochs if batches is not None and epochs is not None else None,
            "checkpoint_updates": checkpoint_updates if checkpoint_updates is not None else batches * checkpoint if batches is not None and checkpoint is not None else None,
            "updates_basis": "recorded" if completed_updates is not None else "calculated" if batches is not None and epochs is not None else None,
        })

    frequency_path = "results/e2d-unique-matched/training_log.txt"
    log = artifacts.read_text(frequency_path) or ""

    def count(label: str) -> int | None:
        match = re.search(rf"^{label}:\s*([\d,]+)", log, re.MULTILINE)
        return int(match[1].replace(",", "")) if match else None

    original, unique, most_frequent = map(count, ("Original samples", "Unique descriptions", "Most frequent description"))
    frequency = (
        {"original": original, "unique": unique, "most_frequent": most_frequent, "source": frequency_path}
        if original and unique and most_frequent and most_frequent <= original and unique <= original else None
    )
    return {"runs": runs, "frequency": frequency}


def score_histogram(experiment_id: str) -> dict:
    run = metrics.E2_RUNS.get(experiment_id)
    unavailable = {"experiment_id": experiment_id, "available": False, "rows": [], "sources": []}
    if not run:
        return unavailable
    attack_path = run["predictions"]
    benign_path = f"results/{run['dir']}/evaluation/benign_test_predictions.parquet"

    def scores(path: str) -> np.ndarray:
        frame = artifacts.read_parquet(path, columns=["anomaly_score"])
        if frame is None:
            return np.array([], dtype=float)
        values = frame["anomaly_score"].to_numpy(dtype=float)
        return values[np.isfinite(values) & (values >= 0)]

    attack, benign = scores(attack_path), scores(benign_path)
    combined = np.concatenate((attack, benign))
    if not len(combined):
        return unavailable
    positive = combined[combined > 0]
    if len(positive):
        # Round extrema outward to powers of ten; never export exact per-event scores.
        decade = math.floor(math.log10(float(positive.min())))
        upper = max(decade + 1, math.ceil(math.log10(float(positive.max()))))
        edges = np.r_[0, np.logspace(decade, upper, 32)]
    else:
        edges = np.array([0.0, 1.0])
    attack_counts = np.histogram(attack, bins=edges)[0]
    benign_counts = np.histogram(benign, bins=edges)[0]
    return {
        "experiment_id": experiment_id, "available": True,
        "sources": [path for path, values in ((attack_path, attack), (benign_path, benign)) if len(values)],
        "attack_total": int(len(attack)), "benign_total": int(len(benign)),
        "rows": [
            {
                "lower": float(edges[index]), "upper": float(edges[index + 1]),
                "attack_count": int(a) if len(attack) else None,
                "benign_count": int(b) if len(benign) else None,
            }
            for index, (a, b) in enumerate(zip(attack_counts, benign_counts))
        ],
    }
