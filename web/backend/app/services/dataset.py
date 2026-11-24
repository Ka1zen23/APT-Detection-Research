from __future__ import annotations

import threading
import time
from datetime import datetime, timezone
from typing import Any

import pandas as pd

from app.services import artifacts, metrics

_LOCK = threading.RLock()
_PROFILE_CACHE: dict[str, Any] = {}
_INDEX_CACHE: dict[str, Any] = {}
_SUMMARY_CACHE: dict[str, Any] = {}


def _mtime_key(relative: str) -> tuple[int, int] | None:
    try:
        path = artifacts.resolve_allowed(relative)
        stat = path.stat()
        return stat.st_mtime_ns, stat.st_size
    except (OSError, PermissionError):
        return None


def _raw_profile() -> dict[str, Any]:
    keys = {
        "phase1": _mtime_key("data/raw/cicapt-iiot/Provenance_Logs/Phase1_Provenance.csv"),
        "phase2": _mtime_key("data/raw/cicapt-iiot/Provenance_Logs/Phase2_Provenance.csv"),
    }
    with _LOCK:
        if _PROFILE_CACHE.get("keys") == keys:
            return _PROFILE_CACHE["value"]

    missing: dict[str, int] = {}
    types: dict[str, int] = {}
    operations: dict[str, int] = {}
    rows: dict[str, int] = {}

    for phase in ("phase1", "phase2"):
        path = artifacts.raw_phase_path(phase)
        total = 0
        for chunk in pd.read_csv(path, chunksize=50_000, low_memory=False):
            total += len(chunk)
            for column, count in chunk.isna().sum().items():
                missing[column] = missing.get(column, 0) + int(count)
            for value, count in chunk["type"].value_counts(dropna=False).items():
                label = "<missing>" if pd.isna(value) else str(value)
                types[label] = types.get(label, 0) + int(count)
            for value, count in chunk["operation"].value_counts(dropna=False).items():
                label = "<missing>" if pd.isna(value) else str(value)
                operations[label] = operations.get(label, 0) + int(count)
        rows[phase] = total

    total_rows = sum(rows.values())
    missing_rows = [
        {
            "column": column,
            "missing": count,
            "total": total_rows,
            "percent": (count / total_rows * 100.0) if total_rows else 0.0,
        }
        for column, count in missing.items()
    ]
    missing_rows.sort(key=lambda item: item["missing"], reverse=True)

    def to_items(mapping: dict[str, int], limit: int | None = None) -> list[dict[str, Any]]:
        items = sorted(mapping.items(), key=lambda item: item[1], reverse=True)
        if limit:
            items = items[:limit]
        return [{"name": name, "count": count} for name, count in items]

    value = {
        "rows": rows,
        "total_rows": total_rows,
        "missing": missing_rows,
        "types": to_items(types),
        "operations": to_items(operations, limit=20),
        "operation_total": sum(operations.values()),
    }
    with _LOCK:
        _PROFILE_CACHE["keys"] = keys
        _PROFILE_CACHE["value"] = value
    return value


def _tactics() -> dict[str, list[dict[str, Any]]]:
    frame = artifacts.read_parquet(
        "data/processed/cicapt-iiot-v2/phase2_events.parquet",
        columns=["original_tactics", "contextual_tactics"],
    )
    if frame is None:
        return {"original": [], "contextual": []}

    def count_column(column: str) -> list[dict[str, Any]]:
        counts: dict[str, int] = {}
        for values in frame[column]:
            if values is None:
                continue
            for value in values:
                if value:
                    counts[str(value)] = counts.get(str(value), 0) + 1
        return [
            {"name": name, "count": count}
            for name, count in sorted(counts.items(), key=lambda item: item[1], reverse=True)
        ]

    return {"original": count_column("original_tactics"), "contextual": count_column("contextual_tactics")}


def _node_types() -> list[dict[str, Any]]:
    frames = []
    for phase in ("phase1", "phase2"):
        frame = artifacts.read_parquet(
            f"data/processed/cicapt-iiot-v2/{phase}_nodes.parquet",
            columns=["node_type"],
        )
        if frame is not None:
            frames.append(frame)
    if not frames:
        return []
    combined = pd.concat(frames, ignore_index=True)
    counts = combined["node_type"].value_counts()
    return [{"name": str(name), "count": int(count)} for name, count in counts.items()]


def _representation_stats() -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    frame = artifacts.read_csv("results/eda/ablation/representation_statistics.csv")
    if frame is None:
        return [], [], []
    rows = []
    duplicates = []
    truncation = []
    for _, record in frame.iterrows():
        events = int(record["events"])
        unique = int(record["unique_descriptions"])
        row = {
            "variant": str(record["variant"]),
            "split": str(record["split"]),
            "events": events,
            "unique_descriptions": unique,
            "mean_tokens": float(record["mean_tokens"]),
            "p95_tokens": float(record["p95_tokens"]),
            "maximum_tokens": int(record["maximum_tokens"]),
            "over_token_limit": int(record["over_token_limit"]),
            "original_positives": int(record["original_positives"]),
            "contextual_positives": int(record["contextual_positives"]),
            "seen_in_training": int(record["seen_in_training"]),
            "original_positives_seen": int(record["original_positives_seen"]),
            "contextual_positives_seen": int(record["contextual_positives_seen"]),
        }
        rows.append(row)
        duplicates.append(
            {
                "variant": row["variant"],
                "split": row["split"],
                "events": events,
                "unique": unique,
                "duplicates": events - unique,
                "duplicate_percent": ((events - unique) / events * 100.0) if events else 0.0,
            }
        )
        truncation.append(
            {
                "variant": row["variant"],
                "split": row["split"],
                "events": events,
                "over_token_limit": row["over_token_limit"],
                "truncation_percent": (row["over_token_limit"] / events * 100.0) if events else 0.0,
                "maximum_tokens": row["maximum_tokens"],
                "mean_tokens": row["mean_tokens"],
            }
        )
    return rows, duplicates, truncation


def _timeline() -> list[dict[str, Any]]:
    manifest = artifacts.read_parquet(
        "data/splits/cicapt-iiot/event_split_manifest.parquet",
        columns=["phase", "event_id", "timestamp", "split"],
    )
    if manifest is None:
        return []
    frame = manifest.copy()
    frame["date"] = pd.to_datetime(frame["timestamp"], unit="s", utc=True).dt.strftime("%Y-%m-%d")
    pivot = (
        frame.groupby(["date", "split"], observed=True)
        .size()
        .unstack(fill_value=0)
    )
    output = []
    for date, record in pivot.iterrows():
        item = {"date": str(date), "total": int(record.sum())}
        for split in ("train", "validation", "benign_test", "attack_test"):
            item[split] = int(record.get(split, 0))
        output.append(item)
    return output


def summary() -> dict[str, Any]:
    keys = tuple(
        _mtime_key(relative)
        for relative in (
            "data/processed/cicapt-iiot-v2/phase1_events.parquet",
            "data/processed/cicapt-iiot-v2/phase2_events.parquet",
            "data/splits/cicapt-iiot/split_summary.json",
            "results/eda/ablation/representation_statistics.csv",
            "results/e2d-unique-matched/evaluation/evaluation_summary.json",
        )
    )
    with _LOCK:
        if _SUMMARY_CACHE.get("keys") == keys and "value" in _SUMMARY_CACHE:
            return _SUMMARY_CACHE["value"]

    split = artifacts.read_json("data/splits/cicapt-iiot/split_summary.json", {}) or {}
    phase1 = artifacts.read_parquet(
        "data/processed/cicapt-iiot-v2/phase1_events.parquet",
        columns=["original_label", "contextual_label"],
    )
    phase2 = artifacts.read_parquet(
        "data/processed/cicapt-iiot-v2/phase2_events.parquet",
        columns=["original_label", "contextual_label"],
    )
    phase1_events = int(len(phase1)) if phase1 is not None else 0
    phase2_events = int(len(phase2)) if phase2 is not None else 0
    original_positives = int(phase2["original_label"].sum()) if phase2 is not None else 0
    contextual_positives = int(phase2["contextual_label"].sum()) if phase2 is not None else 0

    node_total = 0
    for phase in ("phase1", "phase2"):
        frame = artifacts.read_parquet(
            f"data/processed/cicapt-iiot-v2/{phase}_nodes.parquet", columns=["node_id"]
        )
        if frame is not None:
            node_total += len(frame)

    raw = _raw_profile()
    edge_total = sum(
        item["count"]
        for item in raw["types"]
        if item["name"] not in {"Process", "Artifact"}
    )
    counts = {
        "raw_records": sum(raw["rows"].values()),
        "phase1_raw_records": raw["rows"].get("phase1", 0),
        "phase2_raw_records": raw["rows"].get("phase2", 0),
        "nodes": node_total,
        "edges": edge_total,
        "events": phase1_events + phase2_events,
        "phase1_events": phase1_events,
        "phase2_events": phase2_events,
        "original_positives": original_positives,
        "contextual_positives": contextual_positives,
        "attack_prevalence_percent": (original_positives / phase2_events * 100.0) if phase2_events else 0.0,
    }

    partitions = []
    for name in ("train", "validation", "benign_test", "attack_test"):
        item = split.get(name, {})
        partitions.append(
            {
                "name": name,
                "records": int(item.get("records", 0)),
                "unique_descriptions": int(item.get("unique_descriptions", 0)),
                "start_timestamp": item.get("start_timestamp"),
                "end_timestamp": item.get("end_timestamp"),
            }
        )

    rep, duplicates, truncation = _representation_stats()
    e2d_eval = artifacts.read_json(
        "results/e2d-unique-matched/evaluation/evaluation_summary.json", {}
    ) or {}
    overlap_detail = e2d_eval.get("attack_test", {}).get("description_overlap", {})

    class_balance = [
        {"partition": "Training", "records": 99665, "positives": 0, "note": "Benign only"},
        {"partition": "Validation", "records": 21357, "positives": 0, "note": "Benign calibration"},
        {"partition": "Benign test", "records": 21357, "positives": 0, "note": "Benign only"},
        {
            "partition": "Attack test",
            "records": 100892,
            "positives": original_positives,
            "contextual_positives": contextual_positives,
            "note": "Original prevalence ≈0.0694%",
        },
    ]

    result = {
        "counts": counts,
        "partitions": partitions,
        "class_balance": class_balance,
        "node_types": _node_types(),
        "record_types": raw["types"],
        "edge_types": [
            item
            for item in raw["types"]
            if item["name"] not in {"Process", "Artifact"}
        ],
        "operations": raw["operations"],
        "operations_total": raw["operation_total"],
        "tactics": _tactics(),
        "timeline": _timeline(),
        "missing_values": raw["missing"],
        "representation": rep,
        "duplicates": duplicates,
        "truncation": truncation,
        "overlap": {
            "training_vs_validation": {"matching": 18890, "percent": 88.45},
            "training_vs_benign_test": {"matching": 18857, "percent": 88.29},
            "training_vs_attack_test": {"matching": 80100, "percent": 79.39},
            "attack_test_seen": overlap_detail.get("seen", {}).get("records"),
            "attack_test_unseen": overlap_detail.get("unseen", {}).get("records"),
            "seen_positives": overlap_detail.get("seen", {}).get("positives"),
            "unseen_positives": overlap_detail.get("unseen", {}).get("positives"),
        },
        "sources": [
            "data/processed/cicapt-iiot-v2/phase1_events.parquet",
            "data/processed/cicapt-iiot-v2/phase2_events.parquet",
            "data/splits/cicapt-iiot/split_summary.json",
            "results/eda/dataset_inspection.txt",
            "results/eda/ablation/representation_statistics.csv",
            "results/e2d-unique-matched/evaluation/evaluation_summary.json",
        ],
    }
    with _LOCK:
        _SUMMARY_CACHE["keys"] = keys
        _SUMMARY_CACHE["value"] = result
    return result


# ---------- Event explorer ----------


def _event_index() -> pd.DataFrame:
    keys = {
        "phase1": _mtime_key("data/processed/cicapt-iiot-v2/phase1_events.parquet"),
        "phase2": _mtime_key("data/processed/cicapt-iiot-v2/phase2_events.parquet"),
        "manifest": _mtime_key("data/splits/cicapt-iiot/event_split_manifest.parquet"),
        "predictions": _mtime_key(
            "results/e2d-unique-matched/evaluation/attack_test_predictions.parquet"
        ),
    }
    with _LOCK:
        cached = _INDEX_CACHE.get("value")
        if cached is not None and _INDEX_CACHE.get("keys") == keys:
            return cached

    frames = []
    columns = [
        "phase",
        "event_id",
        "timestamp",
        "edge_count",
        "text",
        "original_label",
        "contextual_label",
        "original_tactics",
        "contextual_tactics",
    ]
    for phase in ("phase1", "phase2"):
        frame = artifacts.read_parquet(
            f"data/processed/cicapt-iiot-v2/{phase}_events.parquet", columns=columns
        )
        if frame is None:
            continue
        frames.append(frame)

    if not frames:
        return pd.DataFrame()

    events = pd.concat(frames, ignore_index=True)
    events["event_id"] = events["event_id"].astype(str)
    events["phase"] = events["phase"].astype(str)
    events["timestamp"] = pd.to_numeric(events["timestamp"], errors="coerce")

    manifest = artifacts.read_parquet(
        "data/splits/cicapt-iiot/event_split_manifest.parquet",
        columns=["phase", "event_id", "split"],
    )
    if manifest is not None:
        manifest = manifest.copy()
        manifest["event_id"] = manifest["event_id"].astype(str)
        manifest["phase"] = manifest["phase"].astype(str)
        events = events.merge(manifest, on=["phase", "event_id"], how="left", validate="one_to_one")
    else:
        events["split"] = None

    predictions = artifacts.read_parquet(
        "results/e2d-unique-matched/evaluation/attack_test_predictions.parquet",
        columns=["phase", "event_id", "anomaly_score", "prediction", "seen_in_training"],
    )
    if predictions is not None:
        predictions = predictions.copy()
        predictions["event_id"] = predictions["event_id"].astype(str)
        predictions["phase"] = predictions["phase"].astype(str)
        predictions = predictions.rename(
            columns={
                "anomaly_score": "reference_score",
                "prediction": "reference_prediction",
                "seen_in_training": "reference_seen",
            }
        )
        events = events.merge(
            predictions,
            on=["phase", "event_id"],
            how="left",
            validate="one_to_one",
        )
    else:
        events["reference_score"] = None
        events["reference_prediction"] = None
        events["reference_seen"] = None

    with _LOCK:
        _INDEX_CACHE["keys"] = keys
        _INDEX_CACHE["value"] = events
    return events


def _to_list(value: Any) -> list[str]:
    if value is None:
        return []
    try:
        if isinstance(value, float) and pd.isna(value):
            return []
    except (TypeError, ValueError):
        pass
    try:
        return [str(item) for item in value if str(item)]
    except TypeError:
        return []


def events(
    *,
    phase: str | None = None,
    split: str | None = None,
    event_id: str | None = None,
    original_label: int | None = None,
    contextual_label: int | None = None,
    tactic: str | None = None,
    min_score: float | None = None,
    max_score: float | None = None,
    prediction: int | None = None,
    seen: bool | None = None,
    timestamp_from: float | None = None,
    timestamp_to: float | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 25,
    sort_by: str = "timestamp",
    sort_order: str = "desc",
) -> dict[str, Any]:
    frame = _event_index()
    if frame.empty:
        return {
            "items": [],
            "page": page,
            "page_size": page_size,
            "total": 0,
            "total_pages": 0,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "filters": {},
        }

    filtered = frame
    if phase:
        filtered = filtered[filtered["phase"] == phase]
    if split:
        filtered = filtered[filtered["split"] == split]
    if event_id:
        query = event_id.strip()
        numeric = pd.to_numeric(pd.Series([query]), errors="coerce").iloc[0]
        if pd.notna(numeric):
            ids = pd.to_numeric(filtered["event_id"], errors="coerce")
            filtered = filtered[ids == numeric]
        else:
            filtered = filtered[
                filtered["event_id"].str.contains(query, case=False, regex=False)
            ]
    if original_label is not None:
        filtered = filtered[filtered["original_label"] == original_label]
    if contextual_label is not None:
        filtered = filtered[filtered["contextual_label"] == contextual_label]
    if tactic:
        mask = filtered["original_tactics"].apply(lambda values: tactic in _to_list(values))
        mask = mask | filtered["contextual_tactics"].apply(
            lambda values: tactic in _to_list(values)
        )
        filtered = filtered[mask]
    if min_score is not None:
        filtered = filtered[filtered["reference_score"] >= min_score]
    if max_score is not None:
        filtered = filtered[filtered["reference_score"] <= max_score]
    if prediction is not None:
        filtered = filtered[filtered["reference_prediction"] == prediction]
    if seen is not None:
        filtered = filtered[filtered["reference_seen"] == seen]
    if timestamp_from is not None:
        filtered = filtered[filtered["timestamp"] >= timestamp_from]
    if timestamp_to is not None:
        filtered = filtered[filtered["timestamp"] <= timestamp_to]
    if search:
        filtered = filtered[
            filtered["text"].str.contains(search, case=False, regex=False, na=False)
        ]

    allowed_sort = {
        "timestamp": "timestamp",
        "event_id": "event_id",
        "anomaly_score": "reference_score",
        "original_label": "original_label",
        "contextual_label": "contextual_label",
        "edge_count": "edge_count",
    }
    sort_column = allowed_sort.get(sort_by, "timestamp")
    ascending = sort_order.lower() == "asc"
    filtered = filtered.sort_values(sort_column, ascending=ascending, na_position="last")

    total = int(len(filtered))
    total_pages = max(1, (total + page_size - 1) // page_size) if total else 0
    page = max(1, min(page, total_pages or 1))
    start = (page - 1) * page_size
    page_frame = filtered.iloc[start : start + page_size]

    items = []
    for _, record in page_frame.iterrows():
        timestamp = record.get("timestamp")
        items.append(
            {
                "phase": str(record.get("phase")),
                "event_id": str(record.get("event_id")),
                "timestamp": float(timestamp) if pd.notna(timestamp) else None,
                "split": record.get("split") if pd.notna(record.get("split")) else None,
                "original_label": int(record["original_label"])
                if pd.notna(record.get("original_label"))
                else None,
                "contextual_label": int(record["contextual_label"])
                if pd.notna(record.get("contextual_label"))
                else None,
                "original_tactics": _to_list(record.get("original_tactics")),
                "contextual_tactics": _to_list(record.get("contextual_tactics")),
                "anomaly_score": float(record["reference_score"])
                if pd.notna(record.get("reference_score"))
                else None,
                "prediction": int(record["reference_prediction"])
                if pd.notna(record.get("reference_prediction"))
                else None,
                "seen_in_training": bool(record["reference_seen"])
                if pd.notna(record.get("reference_seen"))
                else None,
                "edge_count": int(record["edge_count"]) if pd.notna(record.get("edge_count")) else None,
                "text": str(record.get("text")) if pd.notna(record.get("text")) else None,
            }
        )

    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
        "sort_by": sort_by,
        "sort_order": sort_order,
        "filters": {
            "phase": phase,
            "split": split,
            "event_id": event_id,
            "original_label": original_label,
            "contextual_label": contextual_label,
            "tactic": tactic,
            "min_score": min_score,
            "max_score": max_score,
            "prediction": prediction,
            "seen": seen,
            "timestamp_from": timestamp_from,
            "timestamp_to": timestamp_to,
            "search": search,
            "score_model": "E2-D (attack test only)",
        },
    }


def event_detail(phase: str, event_id: str) -> dict[str, Any] | None:
    frame = _event_index()
    if frame.empty:
        return None
    subset = frame[(frame["phase"] == phase) & (frame["event_id"] == event_id)]
    if subset.empty:
        return None
    record = subset.iloc[0]
    return {
        "phase": str(record["phase"]),
        "event_id": str(record["event_id"]),
        "timestamp": float(record["timestamp"]) if pd.notna(record["timestamp"]) else None,
        "split": record.get("split"),
        "original_label": int(record["original_label"]),
        "contextual_label": int(record["contextual_label"]),
        "original_tactics": _to_list(record.get("original_tactics")),
        "contextual_tactics": _to_list(record.get("contextual_tactics")),
        "anomaly_score": float(record["reference_score"])
        if pd.notna(record.get("reference_score"))
        else None,
        "prediction": int(record["reference_prediction"])
        if pd.notna(record.get("reference_prediction"))
        else None,
        "seen_in_training": bool(record["reference_seen"])
        if pd.notna(record.get("reference_seen"))
        else None,
        "edge_count": int(record["edge_count"]) if pd.notna(record.get("edge_count")) else None,
        "text": record.get("text"),
    }
