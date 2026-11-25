from __future__ import annotations

import json
from pathlib import Path

PUBLIC = Path(__file__).resolve().parents[2] / "frontend" / "public"
DATA = PUBLIC / "data"
KNOWN_PROVENANCE_MARKERS = (
    "ethtool",
    "/etc/network/if-up",
    "/home/erfan",
    "Telemetry.FailedProfileLocks",
)


def iter_json_files() -> list[Path]:
    return sorted(DATA.rglob("*.json"))


def walk_keys(value):
    if isinstance(value, dict):
        for key, child in value.items():
            yield key
            yield from walk_keys(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_keys(child)


def test_manifest_declares_aggregate_only_snapshot() -> None:
    manifest = json.loads((DATA / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["provenance_included"] is False
    assert manifest["event_explorer_included"] is False


def test_no_event_level_payload_is_exported() -> None:
    assert not (DATA / "dataset-events.json").exists()
    for path in iter_json_files():
        keys = set(walk_keys(json.loads(path.read_text(encoding="utf-8"))))
        assert "node_ids" not in keys, path
        assert "text" not in keys, path


def test_no_known_provenance_strings_in_public_snapshot() -> None:
    for path in PUBLIC.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in {".json", ".txt", ".js", ".html", ".css"}:
            continue
        content = path.read_text(encoding="utf-8", errors="ignore")
        for marker in KNOWN_PROVENANCE_MARKERS:
            assert marker not in content, f"{marker} found in {path}"


def test_report_documents_exclude_preprocessing_samples() -> None:
    payload = json.loads((DATA / "reports.json").read_text(encoding="utf-8"))["data"]
    keys = {item["key"] for item in payload["documents"]}
    assert "preprocessing_summary" not in keys
    assert keys == {
        "baseline_log",
        "dataset_readme",
        "e2d_evaluation_log",
        "e2d_training_log",
        "e5_comparison_log",
    }
