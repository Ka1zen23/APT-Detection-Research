from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

import yaml

from app.services import artifacts


def _load(name: str, default: Any) -> Any:
    return artifacts.read_json(f"web/content/{name}", default)


def experiment_registry() -> list[dict[str, Any]]:
    payload = _load("experiments.json", {"experiments": []})
    return payload.get("experiments", [])


def roadmap() -> dict[str, Any]:
    payload = _load("roadmap.json", {"milestones": []})
    milestones = payload.get("milestones", [])
    counts: dict[str, int] = {}
    for milestone in milestones:
        status = milestone.get("status", "planned")
        counts[status] = counts.get(status, 0) + 1
    payload["counts"] = counts
    payload["total"] = len(milestones)
    payload["next_milestone"] = next(
        (m for m in milestones if m.get("status") == "next"), None
    )
    return payload


def findings() -> list[dict[str, Any]]:
    return _load("findings.json", {"findings": []}).get("findings", [])


def limitations() -> list[dict[str, Any]]:
    return _load("limitations.json", {"limitations": []}).get("limitations", [])


def methodology() -> dict[str, Any]:
    return _load("methodology.json", {})


def objectives() -> list[dict[str, Any]]:
    return _load("objectives.json", {"objectives": []}).get("objectives", [])


def research_status() -> dict[str, Any]:
    return _load("research_status.json", {})


def architecture() -> dict[str, Any]:
    return _load("architecture.json", {})


def ablation_examples() -> dict[str, Any]:
    return _load("ablation_examples.json", {})


def _parse_journal(path) -> dict[str, Any] | None:
    raw = artifacts.read_text(f"web/content/journal/{path.name}")
    if raw is None:
        return None
    title = path.stem
    summary = ""
    body = raw
    meta: dict[str, Any] = {}
    if raw.startswith("---"):
        parts = raw.split("---", 2)
        if len(parts) == 3:
            try:
                meta = yaml.safe_load(parts[1]) or {}
            except yaml.YAMLError:
                meta = {}
            body = parts[2].lstrip("\n")
    title = str(meta.get("title", title))
    summary = str(meta.get("summary", ""))
    slug = path.stem
    return {
        "slug": slug,
        "date": str(meta.get("date", slug)),
        "title": title,
        "summary": summary,
        "status": str(meta.get("status", "unknown")),
        "experiments": meta.get("experiments", []),
        "body": body,
        "artifact": f"web/content/journal/{path.name}",
    }


def journal() -> list[dict[str, Any]]:
    directory = artifacts.resolve_allowed("web/content/journal")
    if not directory.is_dir():
        return []
    entries = []
    for path in sorted(directory.glob("*.md"), reverse=True):
        entry = _parse_journal(path)
        if entry:
            entries.append(entry)
    return entries


def reports() -> list[dict[str, Any]]:
    payload = _load("reports.json", {"reports": []})
    docs = {item["key"]: item for item in artifacts.document_metadata()}
    results = []
    for report in payload.get("reports", []):
        item = dict(report)
        key = item.get("document_key")
        if key and key in docs:
            item["available"] = docs[key]["status"] == "available"
            item["artifact"] = docs[key]["artifact"]
            item["status"] = "available" if item["available"] else "unavailable"
        elif key:
            item["available"] = False
            item["status"] = "unavailable"
        results.append(item)
    return results


def _parse_requirements() -> dict[str, str]:
    text = artifacts.read_text("requirements.txt") or ""
    versions: dict[str, str] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "==" not in line:
            continue
        name, version = line.split("==", 1)
        versions[name.split("[")[0]] = version
    return versions


PACKAGE_LABELS = {
    "torch": "PyTorch",
    "transformers": "Hugging Face Transformers",
    "sentence-transformers": "Sentence Transformers",
    "pandas": "Pandas",
    "numpy": "NumPy",
    "scikit-learn": "Scikit-learn",
    "pyarrow": "PyArrow",
    "matplotlib": "Matplotlib",
    "jupyterlab": "JupyterLab",
}


def environment() -> dict[str, Any]:
    versions = _parse_requirements()
    packages = [
        {
            "name": PACKAGE_LABELS.get(name, name),
            "package": name,
            "version": versions.get(name),
            "recorded": versions.get(name) is not None,
        }
        for name in PACKAGE_LABELS
    ]
    summaries = []
    for experiment, relative in [
        ("E2-A", "results/e2-v2-minilm-standard/training_summary.json"),
        ("E2-B", "results/e2b-unique/training_summary.json"),
        ("E2-C", "results/e2c-weighted/training_summary.json"),
        ("E2-D", "results/e2d-unique-matched/training_summary.json"),
        ("E5-A", "results/e5a-operation-only/training_summary.json"),
        ("E5-B", "results/e5b-operation-entities/training_summary.json"),
        ("E5-C", "results/e5c-full-provenance/training_summary.json"),
    ]:
        summary = artifacts.read_json(relative)
        if summary:
            summaries.append(
                {
                    "experiment": experiment,
                    "seed": summary.get("seed"),
                    "gpu": summary.get("gpu"),
                    "torch_version": summary.get("torch_version"),
                    "elapsed_seconds": summary.get("elapsed_seconds"),
                    "artifact": relative,
                }
            )

    split = artifacts.read_json("data/splits/cicapt-iiot/split_summary.json", {}) or {}
    return {
        "host": {
            "operating_system": "Ubuntu 24.04.5 LTS on WSL2",
            "host_os": "Windows host with WSL2",
            "gpu": "NVIDIA GeForce RTX 4060 (8 GB VRAM)",
            "python": "3.12.3",
            "cuda": "12.8",
        },
        "packages": packages,
        "runs": summaries,
        "seeds": {"current_experiments": [42], "planned_reproducibility": [42, 123, 456]},
        "partitions": split,
        "missing_reproducibility": [
            "Encoder revision / commit hash is not recorded in artifacts.",
            "Dataset content hash is not stored alongside split manifests.",
            "Only one random seed (42) is available for trained models.",
            "Exact CUDA/cuDNN runtime versions beyond the PyTorch build are not recorded.",
            "Ablation event-level Parquet outputs are not retained; only summaries, predictions and logs remain.",
            "No independent attack-scenario validation set exists.",
            "GPU determinism is not demonstrated; seeds alone do not guarantee bitwise reproducibility.",
        ],
        "source_artifact": "requirements.txt; training_summary.json files; data/splits/cicapt-iiot/split_summary.json",
    }
