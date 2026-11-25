from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app


@pytest.fixture(scope="session")
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def test_health(client: TestClient) -> None:
    payload = client.get("/api/v1/health").json()["data"]
    assert payload["status"] == "ok"
    assert payload["read_only"] is True
    assert payload["repository_root_exists"] is True


def test_embedding_projection_uses_a_shared_training_basis_and_bounded_sample(client: TestClient, monkeypatch) -> None:
    import math

    endpoint = "/api/v1/dataset/events/embedding-projection"
    response = client.get(endpoint)
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    result = response.json()["data"]
    points = result["points"]
    assert result["partition"] == "attack_test"
    assert result["source_count"] == 100_892
    assert result["source_positive_count"] == sum(point["original_label"] for point in points) == 70
    assert len(points) == len({(point["phase"], point["event_id"]) for point in points}) == 310
    assert result["fit_count"] == 4096 and result["seed"] == 42
    for point in points:
        assert set(point) == {"phase", "event_id", "original_label", "contextual_label", "coordinates"}
        assert set(point["coordinates"]) == {"E5-A", "E5-B", "E5-C"}
        assert all(len(pair) == 2 and all(map(math.isfinite, pair)) for pair in point["coordinates"].values())
    assert len({tuple(point["coordinates"]["E5-A"]) for point in points}) <= 15
    assert len({tuple(point["coordinates"]["E5-C"]) for point in points}) > 15
    assert client.get(endpoint).json()["data"] == result
    validation = client.get(endpoint, params={"split": "validation"}).json()["data"]
    assert validation["variance_ratio"] == result["variance_ratio"]
    assert all(point["phase"] == "phase1" and point["original_label"] == 0 for point in validation["points"])
    assert client.get(endpoint, params={"split": "../train"}).status_code == 422
    monkeypatch.setattr(config, "DEPLOYMENT_MODE", "container")
    assert client.get(endpoint).status_code == 404


def test_training_comparison_exports_recorded_loss_and_bases(client: TestClient) -> None:
    payload = client.get("/api/v1/comparisons/training").json()["data"]
    runs = {run["id"]: run for run in payload["runs"]}
    assert set(runs) == {"E2-A", "E2-B", "E2-C", "E2-D"}
    assert len(runs["E2-D"]["history"]) == 497
    assert runs["E2-D"]["history"][0]["epoch"] == 1
    assert runs["E2-D"]["checkpoint_epoch"] == 479
    assert runs["E2-D"]["completed_updates"] == 25347
    assert runs["E2-D"]["updates_basis"] == "recorded"
    assert runs["E2-A"]["checkpoint_updates"] == 25350
    assert runs["E2-A"]["updates_basis"] == "calculated"
    assert payload["frequency"]["original"] == 99665
    assert payload["frequency"]["unique"] == 13029
    assert payload["frequency"]["most_frequent"] == 72986


def test_score_histogram_exports_bins_and_counts_only(client: TestClient) -> None:
    payload = client.get("/api/v1/experiments/E2-D/score-histogram").json()["data"]
    assert payload["available"] is True
    assert payload["attack_total"] == sum(row["attack_count"] for row in payload["rows"]) == 100_892
    assert payload["benign_total"] == sum(row["benign_count"] for row in payload["rows"]) == 21_357
    assert all(set(row) == {"lower", "upper", "attack_count", "benign_count"} for row in payload["rows"])
    assert all(left["upper"] == right["lower"] for left, right in zip(payload["rows"], payload["rows"][1:]))
    unavailable = client.get("/api/v1/experiments/E7/score-histogram").json()["data"]
    assert unavailable["available"] is False and not unavailable["rows"]


def test_local_provenance_excerpt_preserves_source_directions_and_labels(client: TestClient) -> None:
    import csv

    from app.services import artifacts

    response = client.get("/api/v1/dataset/events/matched-representations")
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    pair = response.json()["data"]
    assert pair["partition"] == "attack_test" and pair["operation_description"]
    assert pair["negative_event_id"] != pair["positive_event_id"]
    with artifacts.raw_phase_path(pair["phase"]).open(encoding="utf-8", newline="") as stream:
        raw = [
            row for row in csv.DictReader(stream)
            if row["event id"] in {pair["negative_event_id"], pair["positive_event_id"]}
            and row["type"] in {"Used", "WasGeneratedBy", "WasDerivedFrom", "WasTriggeredBy"}
        ]
    for field, positive in (("positive_event_id", True), ("negative_event_id", False)):
        event = pair[field]
        response = client.get(f"/api/v1/dataset/events/{pair['phase']}/{event}/graph")
        assert response.status_code == 200
        assert response.headers["Cache-Control"] == "no-store"
        graph = response.json()["data"]
        expected = [row for row in raw if row["event id"] == event]
        assert graph["edge_count"] == len(expected)
        assert bool(graph["original_positive_edges"]) == positive
        assert 0 < len(graph["edges"]) <= 24
        assert {(edge["source"], edge["relation"], edge["target"]) for edge in graph["edges"]} <= {
            (row["from"], row["type"], row["to"]) for row in expected
        }
        assert all("command line" not in node["metadata"] for node in graph["nodes"])


def test_provenance_excerpt_routes_are_disabled_outside_local_mode(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(config, "DEPLOYMENT_MODE", "container")
    assert client.get("/api/v1/dataset/events/matched-representations").status_code == 404
    assert client.get("/api/v1/dataset/events/phase2/123/graph").status_code == 404


def test_overview_kpis(client: TestClient) -> None:
    data = client.get("/api/v1/overview").json()["data"]
    kpis = data["kpis"]
    assert kpis["raw_records"] == 418_855
    assert kpis["events"] == 243_271
    assert kpis["original_positives"] == 70
    assert kpis["contextual_positives"] == 225
    assert kpis["completed_experiments"] == 14
    assert kpis["best_roc_auc"]["experiment_id"] == "E2-D"
    assert kpis["best_average_precision"]["experiment_id"] == "E2-D"
    assert kpis["best_recall"]["value"] == 1.0
    assert kpis["best_recall"]["tied_count"] >= 1


def test_registry_contains_all_experiments(client: TestClient) -> None:
    items = client.get("/api/v1/experiments").json()["data"]
    ids = {item["id"] for item in items}
    assert {"B1", "B2", "B3", "B4", "B5", "E2-A", "E2-B", "E2-C", "E2-D", "E2-T", "E2-R", "E5-A", "E5-B", "E5-C", "E7"} <= ids
    statuses = {item["id"]: item["status"] for item in items}
    assert statuses["E2-D"] == "completed"
    assert statuses["E7"] == "planned"


def test_experiment_detail_and_metrics(client: TestClient) -> None:
    detail = client.get("/api/v1/experiments/E2-D").json()["data"]
    assert detail["metrics"]["roc_auc"] == pytest.approx(0.9955844387704498)
    assert detail["metrics"]["average_precision"] == pytest.approx(0.10907981276799296)
    assert detail["training_summary"]["seed"] == 42
    assert detail["evaluation_summary"]["attack_test"]["original_label"]["false_positives"] == 8628


def test_threshold_traceability(client: TestClient) -> None:
    payload = client.get("/api/v1/experiments/E2-D/thresholds").json()["data"]
    assert payload["available"] is True
    rows = {row["percentile"]: row for row in payload["rows"]}
    p99 = rows[99.0]
    p9995 = rows[99.95]
    assert p99["false_positives"] == 8628
    assert p99["contextual_recall"] == pytest.approx(0.7733333333333333)
    assert p9995["false_positives"] == 2339
    assert p9995["precision"] == pytest.approx(0.029057700290577002)
    assert p9995["benign_fpr"] == pytest.approx(0.0012642225031605564)
    assert p9995["contextual_recall"] == pytest.approx(0.49333333333333335)
    assert p9995["exploratory"] is True
    assert p99["exploratory"] is False


def test_alert_budgets(client: TestClient) -> None:
    payload = client.get("/api/v1/experiments/E2-D/alert-budgets").json()["data"]
    rows = {row["budget"]: row for row in payload["rows"]}
    assert rows[50]["expected_true_positives"] == 5
    assert rows[500]["expected_true_positives"] == 46
    assert rows[1000]["expected_true_positives"] == 58
    assert rows[500]["minimum_true_positives"] == 46
    assert rows[500]["maximum_true_positives"] == 46


def test_true_curves_are_computed(client: TestClient) -> None:
    payload = client.get("/api/v1/experiments/E2-D/curves?label=original").json()["data"]
    assert payload["available"] is True
    assert payload["computed_roc_auc"] == pytest.approx(0.9955844387704498)
    assert payload["computed_average_precision"] == pytest.approx(0.10907981276799296)
    assert len(payload["roc"]) > 20
    assert len(payload["pr"]) > 20
    assert payload["points"]["roc_raw"] >= len(payload["roc"])


def test_curves_unavailable_for_analysis_experiment(client: TestClient) -> None:
    payload = client.get("/api/v1/experiments/E2-T/curves").json()["data"]
    assert payload["available"] is False


def test_model_comparison(client: TestClient) -> None:
    data = client.get("/api/v1/comparisons/models").json()["data"]
    assert len(data["models"]) == 12
    leader = data["leaderboard"][0]
    assert leader["id"] == "E2-D"
    assert leader["average_precision"] == pytest.approx(0.10907981276799296)
    b5 = next(row for row in data["models"] if row["id"] == "B5")
    assert b5["average_precision"] == pytest.approx(0.00321159845843274)
    assert b5["training_seconds"] is None


def test_description_overlap(client: TestClient) -> None:
    data = client.get("/api/v1/comparisons/description-overlap").json()["data"]
    ids = {row["id"] for row in data["models"]}
    assert {"E2-A", "E2-D", "E5-C"} <= ids
    e2d = next(row for row in data["models"] if row["id"] == "E2-D")
    assert e2d["seen"]["records"] == 80100
    assert e2d["unseen"]["positives"] == 70
    assert e2d["unseen"]["recall"] == 1.0


def test_ablation(client: TestClient) -> None:
    data = client.get("/api/v1/comparisons/ablation").json()["data"]
    assert data["derived"]["operation_only_conflicting_negative_events"] == 8393
    assert data["derived"]["e5c_over_e5b_ap_uplift_percent"] == pytest.approx(16.12, abs=0.02)
    ids = {row["id"] for row in data["models"]}
    assert {"B5", "E5-A", "E5-B", "E5-C"} == ids


def test_dataset_summary(client: TestClient) -> None:
    data = client.get("/api/v1/dataset/summary").json()["data"]
    counts = data["counts"]
    assert counts["raw_records"] == 418_855
    assert counts["nodes"] == 100_059
    assert counts["edges"] == 318_796
    assert counts["events"] == 243_271
    assert counts["phase1_events"] == 142_379
    assert counts["phase2_events"] == 100_892
    assert counts["attack_prevalence_percent"] == pytest.approx(0.06938, abs=0.00001)
    assert [p["records"] for p in data["partitions"]] == [99665, 21357, 21357, 100892]
    assert data["operations_total"] == 418_855


def test_event_pagination_and_filters(client: TestClient) -> None:
    page = client.get("/api/v1/dataset/events?page=1&page_size=5").json()["data"]
    assert page["total"] == 243_271
    assert page["total_pages"] == 48655
    assert len(page["items"]) == 5

    positives = client.get(
        "/api/v1/dataset/events?original_label=1&page_size=100"
    ).json()["data"]
    assert positives["total"] == 70
    assert all(item["original_label"] == 1 for item in positives["items"])

    attack = client.get(
        "/api/v1/dataset/events?split=attack_test&prediction=1&page_size=10"
    ).json()["data"]
    assert attack["total"] == 8698
    assert all(item["prediction"] == 1 for item in attack["items"])

    exact = client.get("/api/v1/dataset/events?event_id=246").json()["data"]
    assert exact["total"] == 1
    assert exact["items"][0]["event_id"] == "246.0"

    dated = client.get(
        "/api/v1/dataset/events?timestamp_from=1701388800&timestamp_to=1701475199&page_size=1"
    ).json()["data"]
    assert 0 < dated["total"] < 243_271
    assert dated["items"][0]["timestamp"] is not None


def test_event_page_size_is_bounded(client: TestClient) -> None:
    response = client.get("/api/v1/dataset/events?page_size=500")
    assert response.status_code == 422


def test_event_detail(client: TestClient) -> None:
    item = client.get("/api/v1/dataset/events/phase2/246.0").json()["data"]
    assert item["event_id"] == "246.0"
    assert item["split"] == "attack_test"
    assert "ethtool" in item["text"]
    assert client.get("/api/v1/dataset/events/phase9/1").status_code == 404


def test_content_endpoints(client: TestClient) -> None:
    findings = client.get("/api/v1/findings").json()["data"]
    assert {f["id"] for f in findings["findings"]} == {"F01", "F02", "F03", "F04", "F05", "F06"}
    roadmap = client.get("/api/v1/roadmap").json()["data"]
    assert roadmap["counts"]["completed"] == 17
    journal = client.get("/api/v1/journal").json()["data"]["entries"]
    assert journal[0]["date"] == "2026-11-25"
    detail = client.get("/api/v1/journal/2026-11-25").json()["data"]
    assert "## Findings" in detail["body"]
    reports = client.get("/api/v1/reports").json()["data"]
    assert reports["available"] >= 5
    limitations = client.get("/api/v1/limitations").json()["data"]
    assert limitations["counts"]["high"] >= 8
    environment = client.get("/api/v1/environment").json()["data"]
    assert environment["host"]["gpu"].startswith("NVIDIA GeForce RTX 4060")
    assert len(environment["missing_reproducibility"]) >= 5


def test_artifact_figure_allowlist(client: TestClient) -> None:
    response = client.get(
        "/api/v1/artifacts/figures/e2d/attack_test_original_label_roc_curve.png"
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert (
        client.get("/api/v1/artifacts/figures/e2d/../../../../etc/passwd").status_code
        in {404, 405}
    )
    assert client.get("/api/v1/artifacts/figures/unknown/file.png").status_code == 404


def test_artifact_document_allowlist(client: TestClient) -> None:
    response = client.get("/api/v1/artifacts/documents/e5_comparison_log")
    assert response.status_code == 200
    assert "BASELINE" in response.text or "E5" in response.text
    assert client.get("/api/v1/artifacts/documents/unknown").status_code == 404
    assert client.get("/api/v1/artifacts/documents/..%2F..%2Fetc%2Fpasswd").status_code == 404


def test_missing_thresholds_are_graceful(client: TestClient) -> None:
    payload = client.get("/api/v1/experiments/B1/thresholds").json()["data"]
    assert payload["available"] is False
    assert payload["reason"]


def test_cache_refresh_is_non_mutating(client: TestClient) -> None:
    payload = client.post("/api/v1/cache/refresh").json()["data"]
    assert payload["refreshed"] is True
    assert payload["filesystem_modified"] is False


def test_health_stays_public_when_api_key_is_configured(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(config, "API_KEY", "test-secret")
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["data"]["auth_required"] is True


def test_protected_routes_require_api_key(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(config, "API_KEY", "test-secret")

    missing = client.get("/api/v1/overview")
    assert missing.status_code == 401
    assert missing.json()["detail"].startswith("A valid X-API-Key")

    wrong = client.get("/api/v1/overview", headers={"X-API-Key": "wrong"})
    assert wrong.status_code == 401

    accepted = client.get(
        "/api/v1/overview", headers={"X-API-Key": "test-secret"}
    )
    assert accepted.status_code == 200
    assert accepted.json()["data"]["kpis"]["events"] == 243_271


def test_image_proxy_and_refresh_require_api_key(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(config, "API_KEY", "test-secret")
    assert (
        client.get("/api/v1/artifacts/figures/e2d/attack_test_original_label_roc_curve.png").status_code
        == 401
    )
    assert client.post("/api/v1/cache/refresh").status_code == 401
    assert (
        client.post(
            "/api/v1/cache/refresh", headers={"X-API-Key": "test-secret"}
        ).status_code
        == 200
    )
