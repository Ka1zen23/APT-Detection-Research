"""Small, read-only excerpts for the local provenance viewer."""

from __future__ import annotations

import csv
import math
from typing import Any

from app.config import ROOT
from app.services import artifacts

EDGE_TYPES = {"Used", "WasGeneratedBy", "WasDerivedFrom", "WasTriggeredBy"}
GRAPH_EDGE_LIMIT = 24


def _label(value: str | None) -> int | None:
    return int(value) if value in {"0", "1"} else None


def _timestamp(value: str | None) -> float | None:
    try:
        number = float(value) if value else None
        return number if number is not None and math.isfinite(number) else None
    except ValueError:
        return None


def _node(row: dict[str, str], identifier: str) -> dict[str, Any]:
    subtype = row.get("subtype", "").lower()
    network = bool(row.get("remote address") or row.get("local address")) or "socket" in subtype or "network" in subtype
    kind = "process" if row["type"] == "Process" else "network" if network else "artifact"
    node_label = row.get("name") if kind == "process" else row.get("path", "").replace("\\", "/").rsplit("/", 1)[-1]
    # Keep local graph metadata bounded; commands and full paths are not needed to read link directions.
    return {
        "id": identifier,
        "kind": kind,
        "label": (node_label or row.get("subtype") or kind.title())[:80],
        "annotation": _label(row.get("label")),
        "metadata": {
            key: row[field][:80]
            for key, field in (("Source type", "type"), ("Subtype", "subtype"), ("PID", "pid"), ("Protocol", "protocol"))
            if row.get(field)
        },
    }


def event_graph(phase: str, event_id: str) -> dict[str, Any] | None:
    if phase not in {"phase1", "phase2"}:
        return None
    path = artifacts.raw_phase_path(phase)
    edges: list[dict[str, Any]] = []
    total = 0
    positives = 0
    with path.open(encoding="utf-8", newline="") as source:
        for row in csv.DictReader(source):
            if row["event id"] != event_id or row["type"] not in EDGE_TYPES:
                continue
            total += 1
            positives += row["label"] == "1"
            if len(edges) >= GRAPH_EDGE_LIMIT or not row["from"] or not row["to"]:
                continue
            edges.append({
                "id": f"edge-{total}",
                "source": row["from"],
                "target": row["to"],
                "relation": row["type"],
                "operation": row["operation"][:80] or None,
                "timestamp": _timestamp(row["time"]),
                "annotation": _label(row["label"]),
            })
    if not total:
        return None

    identifiers = dict.fromkeys(endpoint for edge in edges for endpoint in (edge["source"], edge["target"]))
    nodes = {}
    if identifiers:
        with path.open(encoding="utf-8", newline="") as source:
            for row in csv.DictReader(source):
                if row["id"] in identifiers and row["type"] in {"Process", "Artifact"}:
                    nodes[row["id"]] = _node(row, row["id"])
                    if len(nodes) == len(identifiers):
                        break
    missing = [identifier for identifier in identifiers if identifier not in nodes]
    return {
        "phase": phase, "event_id": event_id, "edge_count": total,
        "original_positive_edges": positives,
        "limited": total != len(edges), "unresolved_nodes": len(missing),
        "nodes": [nodes.get(identifier, {
            "id": identifier, "kind": "unknown", "label": "Unresolved endpoint", "annotation": None, "metadata": {},
        }) for identifier in identifiers],
        "edges": edges,
        "source": str(path.relative_to(ROOT)),
    }


def matched_representation_events() -> dict[str, Any] | None:
    source = "data/processed/cicapt-iiot-ablation/operation_only/phase2_events.parquet"
    events = artifacts.read_parquet(source, columns=["event_id", "original_label", "text"])
    partitions = artifacts.read_parquet("data/splits/cicapt-iiot/event_split_manifest.parquet", columns=["event_id", "phase", "split"])
    if events is None or partitions is None:
        return None
    test_ids = set(partitions.loc[(partitions["phase"] == "phase2") & (partitions["split"] == "attack_test"), "event_id"].astype(str))
    test = events[events["event_id"].astype(str).isin(test_ids)].dropna(subset=["text"])
    positive = test[test["original_label"] == 1]
    negative = test[test["original_label"] == 0]
    candidate = positive[positive["text"].isin(negative["text"])].sort_values("event_id")
    if candidate.empty:
        return None
    chosen = candidate.iloc[0]
    match = negative[negative["text"] == chosen["text"]].sort_values("event_id").iloc[0]
    return {
        "phase": "phase2", "partition": "attack_test",
        "operation_description": str(chosen["text"]),
        "positive_event_id": str(chosen["event_id"]),
        "negative_event_id": str(match["event_id"]),
        "source": source,
    }
