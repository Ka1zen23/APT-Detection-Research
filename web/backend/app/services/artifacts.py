from __future__ import annotations

import json
import threading
import time
from pathlib import Path
from typing import Any

import pandas as pd

from app.config import (
    CONTENT_DIR,
    PROCESSED_DIR,
    RAW_DIR,
    RESULTS_DIR,
    SPLITS_DIR,
    resolve_allowed,
)

_CACHE: dict[str, tuple[tuple[int, int], Any]] = {}
_LOCK = threading.RLock()
_LAST_UPDATE_CACHE: tuple[float, str | None] | None = None

SCAN_ROOTS = (
    RESULTS_DIR,
    CONTENT_DIR,
    SPLITS_DIR,
    PROCESSED_DIR,
    RAW_DIR,
)

FIGURE_RUNS: dict[str, Path] = {
    "e2a": RESULTS_DIR / "e2-v2-minilm-standard",
    "e2b": RESULTS_DIR / "e2b-unique",
    "e2c": RESULTS_DIR / "e2c-weighted",
    "e2d": RESULTS_DIR / "e2d-unique-matched",
    "e5a": RESULTS_DIR / "e5a-operation-only",
    "e5b": RESULTS_DIR / "e5b-operation-entities",
    "e5c": RESULTS_DIR / "e5c-full-provenance",
}

DOCUMENTS: dict[str, dict[str, str]] = {
    "dataset_readme": {
        "title": "CICAPT-IIoT provenance log readme",
        "path": "data/raw/cicapt-iiot/Provenance_Logs/Readme.txt",
        "description": "Original dataset readme describing the two provenance collection phases.",
        "category": "dataset",
    },
    "preprocessing_summary": {
        "title": "V2 preprocessing summary",
        "path": "results/eda/preprocessing_summary_v2.txt",
        "description": "Event reconstruction, node counts and sample verbalisations for CICAPT-IIoT.",
        "category": "experimental-summary",
    },
    "e5_comparison_log": {
        "title": "E5 provenance ablation comparison log",
        "path": "results/ablation_comparison/comparison_log.txt",
        "description": "Measured comparison of B5, E5-A, E5-B and E5-C.",
        "category": "experimental-summary",
    },
    "e2d_training_log": {
        "title": "E2-D matched-update training log",
        "path": "results/e2d-unique-matched/training_log.txt",
        "description": "Epoch-level training log for the leading E2-D autoencoder.",
        "category": "experimental-summary",
    },
    "e2d_evaluation_log": {
        "title": "E2-D evaluation log",
        "path": "results/e2d-unique-matched/evaluation/evaluation_log.txt",
        "description": "Original and contextual label evaluation, per-tactic recall and inference timing.",
        "category": "experimental-summary",
    },
    "e2_threshold_log": {
        "title": "E2 threshold sensitivity log",
        "path": "results/e2-v2-minilm-standard/threshold_analysis/analysis_log.txt",
        "description": "Retrospective percentile analysis for the original E2 autoencoder.",
        "category": "experimental-summary",
    },
    "baseline_log": {
        "title": "Baseline experiments log",
        "path": "results/baselines/baseline_log.txt",
        "description": "Measured B1-B4 baseline results and comparison table.",
        "category": "experimental-summary",
    },
    "e5c_training_log": {
        "title": "E5-C full-provenance training log",
        "path": "results/ablation_comparison/logs/E5-C_training.txt",
        "description": "Training log for the full-provenance ablation configuration.",
        "category": "experimental-summary",
    },
}


def _stat_key(path: Path) -> tuple[int, int]:
    stat = path.stat()
    return stat.st_mtime_ns, stat.st_size


def _cached(relative: str, loader, cache_key: str | None = None) -> Any:
    path = resolve_allowed(relative)
    key = _stat_key(path)
    cache_id = cache_key or relative
    with _LOCK:
        cached = _CACHE.get(cache_id)
        if cached and cached[0] == key:
            return cached[1]
    value = loader(path)
    with _LOCK:
        _CACHE[cache_id] = (key, value)
    return value


def exists(relative: str) -> bool:
    try:
        return resolve_allowed(relative).is_file()
    except PermissionError:
        return False


def read_json(relative: str, default: Any = None) -> Any:
    if not exists(relative):
        return default
    try:
        return _cached(relative, lambda p: json.loads(p.read_text(encoding="utf-8")))
    except (OSError, json.JSONDecodeError):
        return default


def read_csv(relative: str, default: pd.DataFrame | None = None) -> pd.DataFrame | None:
    if not exists(relative):
        return default
    try:
        return _cached(relative, lambda p: pd.read_csv(p))
    except (OSError, pd.errors.ParserError, pd.errors.EmptyDataError):
        return default


def read_parquet(
    relative: str,
    columns: list[str] | None = None,
    default: pd.DataFrame | None = None,
) -> pd.DataFrame | None:
    if not exists(relative):
        return default
    cache_key = f"{relative}::cols={','.join(columns) if columns else '*'}"
    try:
        return _cached(
            relative,
            lambda p: pd.read_parquet(p, columns=columns),
            cache_key=cache_key,
        )
    except (OSError, ValueError):
        return default


def read_text(relative: str) -> str | None:
    if not exists(relative):
        return None
    try:
        return _cached(relative, lambda p: p.read_text(encoding="utf-8", errors="replace"))
    except OSError:
        return None


def invalidate() -> None:
    global _LAST_UPDATE_CACHE
    with _LOCK:
        _CACHE.clear()
        _LAST_UPDATE_CACHE = None


def last_artifact_update() -> str | None:
    """Newest mtime among research outputs and maintained content files."""
    global _LAST_UPDATE_CACHE
    now = time.monotonic()
    if _LAST_UPDATE_CACHE and now - _LAST_UPDATE_CACHE[0] < 10:
        return _LAST_UPDATE_CACHE[1]

    newest: float | None = None
    for root in SCAN_ROOTS:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if not path.is_file() or path.suffix.lower() in {".npy", ".pt", ".png"}:
                continue
            if "__pycache__" in path.parts:
                continue
            try:
                mtime = path.stat().st_mtime
            except OSError:
                continue
            if newest is None or mtime > newest:
                newest = mtime

    result = None
    if newest is not None:
        from datetime import datetime, timezone

        result = datetime.fromtimestamp(newest, tz=timezone.utc).isoformat()
    _LAST_UPDATE_CACHE = (now, result)
    return result


def figure_manifest() -> list[dict[str, str]]:
    figures: list[dict[str, str]] = []
    for run, directory in FIGURE_RUNS.items():
        eval_dir = directory / "evaluation"
        if not eval_dir.is_dir():
            continue
        for path in sorted(eval_dir.glob("*.png")):
            figures.append(
                {
                    "key": f"{run}:{path.name}",
                    "run": run,
                    "filename": path.name,
                    "title": path.stem.replace("_", " "),
                }
            )
    return figures


def figure_path(run: str, filename: str) -> Path | None:
    directory = FIGURE_RUNS.get(run)
    if directory is None:
        return None
    if "/" in filename or "\\" in filename or ".." in filename:
        return None
    candidate = (directory / "evaluation" / filename).resolve()
    eval_dir = (directory / "evaluation").resolve()
    if eval_dir not in candidate.parents or candidate.suffix.lower() != ".png":
        return None
    if not candidate.is_file():
        return None
    return candidate


def document_metadata() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for key, meta in DOCUMENTS.items():
        relative = meta["path"]
        available = exists(relative)
        items.append(
            {
                "key": key,
                "title": meta["title"],
                "description": meta["description"],
                "category": meta["category"],
                "artifact": relative,
                "status": "available" if available else "unavailable",
                "media_type": "text/plain",
            }
        )
    return items


def document_path(key: str) -> tuple[Path, dict[str, str]] | None:
    meta = DOCUMENTS.get(key)
    if not meta:
        return None
    path = resolve_allowed(meta["path"])
    if not path.is_file():
        return None
    return path, meta


def raw_phase_path(phase: str) -> Path:
    mapping = {
        "phase1": RAW_DIR / "cicapt-iiot" / "Provenance_Logs" / "Phase1_Provenance.csv",
        "phase2": RAW_DIR / "cicapt-iiot" / "Provenance_Logs" / "Phase2_Provenance.csv",
    }
    if phase not in mapping:
        raise KeyError(phase)
    return mapping[phase]
