from __future__ import annotations

from app.services import dataset


def test_precomputed_dataset_profile_matches_expected_counts() -> None:
    profile = dataset._profile_from_content()
    assert profile is not None
    assert profile["rows"] == {"phase1": 222_120, "phase2": 196_735}
    assert profile["total_rows"] == 418_855
    assert profile["operation_total"] == 418_855
    assert next(item for item in profile["types"] if item["name"] == "Process")["count"] == 34_717
    assert next(
        item for item in profile["missing"] if item["column"] == "local address"
    )["missing"] == 418_855


def test_profile_is_used_when_raw_files_are_unavailable(monkeypatch) -> None:
    monkeypatch.setattr(dataset, "_mtime_key", lambda relative: None)
    profile = dataset._raw_profile()
    assert profile["total_rows"] == 418_855
    assert profile["rows"]["phase2"] == 196_735
