from __future__ import annotations

from typing import Any

import pandas as pd

from app.services import artifacts, content

ATTACK_TEST_TOTAL = 100_892
BENIGN_TEST_TOTAL = 21_357

E2_RUNS = {
    "E2-A": {
        "dir": "e2-v2-minilm-standard",
        "label": "Original frequency-preserving",
        "predictions": "results/e2-v2-minilm-standard/evaluation/attack_test_predictions.parquet",
        "validation_predictions": "results/e2-v2-minilm-standard/validation_predictions.parquet",
    },
    "E2-B": {
        "dir": "e2b-unique",
        "label": "Unique-description training",
        "predictions": "results/e2b-unique/evaluation/attack_test_predictions.parquet",
        "validation_predictions": "results/e2b-unique/validation_predictions.parquet",
    },
    "E2-C": {
        "dir": "e2c-weighted",
        "label": "Frequency-weighted training",
        "predictions": "results/e2c-weighted/evaluation/attack_test_predictions.parquet",
        "validation_predictions": "results/e2c-weighted/validation_predictions.parquet",
    },
    "E2-D": {
        "dir": "e2d-unique-matched",
        "label": "Approximately matched-update unique-description",
        "predictions": "results/e2d-unique-matched/evaluation/attack_test_predictions.parquet",
        "validation_predictions": "results/e2d-unique-matched/validation_predictions.parquet",
    },
}

BASELINE_RUNS = {
    "B1": {
        "artifact_id": "B1_exact_novelty",
        "label": "Exact-description novelty",
        "predictions": "results/baselines/B1_exact_novelty/attack_test_predictions.parquet",
    },
    "B2": {
        "artifact_id": "B2_tfidf_isolation_forest",
        "label": "TF-IDF with Isolation Forest",
        "predictions": "results/baselines/B2_tfidf_isolation_forest/attack_test_predictions.parquet",
    },
    "B3": {
        "artifact_id": "B3_minilm_pca",
        "label": "MiniLM with PCA",
        "predictions": "results/baselines/B3_minilm_pca/attack_test_predictions.parquet",
    },
    "B4": {
        "artifact_id": "B4_minilm_isolation_forest",
        "label": "MiniLM with Isolation Forest",
        "predictions": "results/baselines/B4_minilm_isolation_forest/attack_test_predictions.parquet",
    },
}

ABLATION_RUNS = {
    "B5": {
        "label": "Operation-frequency baseline",
        "predictions": "results/ablation_comparison/operation_frequency/attack_test_predictions.parquet",
    },
    "E5-A": {
        "label": "Provenance ablation — operation only",
        "predictions": "results/e5a-operation-only/evaluation/attack_test_predictions.parquet",
    },
    "E5-B": {
        "label": "Provenance ablation — operations and entities",
        "predictions": "results/e5b-operation-entities/evaluation/attack_test_predictions.parquet",
    },
    "E5-C": {
        "label": "Provenance ablation — full provenance",
        "predictions": "results/e5c-full-provenance/evaluation/attack_test_predictions.parquet",
    },
}

THRESHOLD_SOURCE = "results/autoencoder_comparison/threshold_comparison.csv"


def _registry() -> dict[str, dict[str, Any]]:
    return {e["id"]: e for e in content.experiment_registry()}


def _float(value: Any) -> float | None:
    try:
        if value is None or pd.isna(value):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _int(value: Any) -> int | None:
    try:
        if value is None or pd.isna(value):
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _base_row(meta: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": meta["id"],
        "name": meta.get("name", meta["id"]),
        "group": meta.get("group", "other"),
        "kind": meta.get("kind", "model"),
        "status": meta.get("status", "planned"),
        "representation": meta.get("representation"),
        "encoder": meta.get("encoder"),
        "algorithm": meta.get("algorithm"),
        "research_question": meta.get("research_question"),
        "hypothesis": meta.get("hypothesis"),
        "seed": meta.get("seed"),
        "roc_auc": None,
        "average_precision": None,
        "recall": None,
        "precision": None,
        "f1": None,
        "true_positives": None,
        "false_positives": None,
        "false_negatives": None,
        "true_negatives": None,
        "benign_fpr": None,
        "attack_fpr": None,
        "contextual_recall": None,
        "threshold": None,
        "threshold_percentile": None,
        "training_seconds": None,
        "operating_point": None,
        "availability": {"status": "missing", "artifact": None, "note": "No measured model metrics artifact."},
    }


def model_rows() -> list[dict[str, Any]]:
    registry = _registry()
    rows: dict[str, dict[str, Any]] = {}

    baseline = artifacts.read_csv("results/baselines/baseline_comparison.csv")
    baseline_summary = artifacts.read_json("results/baselines/baseline_summary.json", []) or []
    summary_by_id = {item.get("experiment"): item for item in baseline_summary}
    if baseline is not None:
        for _, record in baseline.iterrows():
            artifact_id = str(record["experiment"])
            exp_id = next(
                (key for key, spec in BASELINE_RUNS.items() if spec["artifact_id"] == artifact_id),
                None,
            )
            if exp_id is None:
                continue
            meta = registry.get(exp_id, {"id": exp_id, "name": BASELINE_RUNS[exp_id]["label"], "group": "baseline"})
            row = _base_row(meta)
            tp = _int(record.get("tp"))
            fp = _int(record.get("fp"))
            fn = _int(record.get("fn"))
            row.update(
                {
                    "roc_auc": _float(record.get("roc_auc")),
                    "average_precision": _float(record.get("average_precision")),
                    "precision": _float(record.get("precision")),
                    "recall": _float(record.get("recall")),
                    "f1": _float(record.get("f1")),
                    "true_positives": tp,
                    "false_positives": fp,
                    "false_negatives": fn,
                    "true_negatives": ATTACK_TEST_TOTAL - (tp or 0) - (fp or 0) - (fn or 0),
                    "benign_fpr": _float(record.get("benign_fpr")),
                    "attack_fpr": _float(record.get("attack_fpr")),
                    "contextual_recall": _float(record.get("contextual_recall")),
                    "threshold": _float(record.get("threshold")),
                    "threshold_percentile": 99.0 if exp_id != "B1" else None,
                    "operating_point": "Binary novelty rule" if exp_id == "B1" else "Validation P99",
                    "training_seconds": _float(
                        (summary_by_id.get(artifact_id) or {}).get("elapsed_seconds")
                    ),
                    "availability": {
                        "status": "available",
                        "artifact": "results/baselines/baseline_comparison.csv",
                        "note": None,
                    },
                }
            )
            rows[exp_id] = row

    ranking = artifacts.read_csv("results/autoencoder_comparison/ranking_summary.csv")
    thresholds = artifacts.read_csv(THRESHOLD_SOURCE)
    if ranking is not None and thresholds is not None:
        for _, record in ranking.iterrows():
            exp_id = str(record["experiment"])
            meta = registry.get(exp_id, {"id": exp_id, "name": E2_RUNS[exp_id]["label"], "group": "autoencoder"})
            row = _base_row(meta)
            p99 = thresholds[(thresholds["experiment"] == exp_id) & (thresholds["percentile"] == 99.0)]
            point = p99.iloc[0] if len(p99) else None
            tp = _int(point.get("original_tp")) if point is not None else None
            fp = _int(point.get("original_fp")) if point is not None else None
            fn = _int(point.get("original_fn")) if point is not None else None
            row.update(
                {
                    "roc_auc": _float(record.get("roc_auc")),
                    "average_precision": _float(record.get("average_precision")),
                    "precision": _float(point.get("original_precision")) if point is not None else None,
                    "recall": _float(point.get("original_recall")) if point is not None else None,
                    "f1": _float(point.get("original_f1")) if point is not None else None,
                    "true_positives": tp,
                    "false_positives": fp,
                    "false_negatives": fn,
                    "true_negatives": _int(point.get("original_tn")) if point is not None else None,
                    "benign_fpr": _float(point.get("benign_fpr")) if point is not None else None,
                    "attack_fpr": _float(point.get("original_fpr")) if point is not None else None,
                    "contextual_recall": _float(point.get("contextual_recall")) if point is not None else None,
                    "threshold": _float(point.get("threshold")) if point is not None else None,
                    "threshold_percentile": 99.0,
                    "operating_point": "Validation P99 (primary experimental operating point)",
                    "availability": {
                        "status": "available",
                        "artifact": "results/autoencoder_comparison/ranking_summary.csv; threshold_comparison.csv",
                        "note": None,
                    },
                }
            )
            run = E2_RUNS.get(exp_id)
            if run:
                summary = artifacts.read_json(f"results/{run['dir']}/training_summary.json", {}) or {}
                row["training_seconds"] = _float(summary.get("elapsed_seconds"))
                row["seed"] = summary.get("seed", meta.get("seed"))
            rows[exp_id] = row

    ablation = artifacts.read_csv("results/ablation_comparison/ablation_comparison.csv")
    if ablation is not None:
        for _, record in ablation.iterrows():
            exp_id = str(record["experiment"])
            if exp_id == "B5-Frequency":
                exp_id = "B5"
            if exp_id not in ABLATION_RUNS:
                continue
            meta = registry.get(exp_id, {"id": exp_id, "name": ABLATION_RUNS[exp_id]["label"], "group": "ablation"})
            row = _base_row(meta)
            tp = _int(record.get("true_positives"))
            fp = _int(record.get("false_positives"))
            fn = 70 - (tp or 0)
            row.update(
                {
                    "roc_auc": _float(record.get("roc_auc")),
                    "average_precision": _float(record.get("average_precision")),
                    "precision": _float(record.get("precision")),
                    "recall": _float(record.get("recall")),
                    "f1": _float(record.get("f1")),
                    "true_positives": tp,
                    "false_positives": fp,
                    "false_negatives": fn,
                    "true_negatives": ATTACK_TEST_TOTAL - (tp or 0) - (fp or 0) - fn,
                    "benign_fpr": _float(record.get("benign_fpr")),
                    "attack_fpr": _float(record.get("attack_fpr")),
                    "contextual_recall": _float(record.get("contextual_recall")),
                    "threshold": _float(record.get("threshold")),
                    "threshold_percentile": 99.0,
                    "operating_point": "Validation P99" if exp_id != "B5" else "Validation P99 (frequency baseline)",
                    "availability": {
                        "status": "available",
                        "artifact": "results/ablation_comparison/ablation_comparison.csv",
                        "note": None,
                    },
                }
            )
            if exp_id.startswith("E5"):
                ablation_dirs = {
                    "E5-A": "e5a-operation-only",
                    "E5-B": "e5b-operation-entities",
                    "E5-C": "e5c-full-provenance",
                }
                summary = artifacts.read_json(
                    f"results/{ablation_dirs[exp_id]}/training_summary.json",
                    {},
                ) or {}
                row["training_seconds"] = _float(summary.get("elapsed_seconds"))
                row["seed"] = summary.get("seed", 42)
            rows[exp_id] = row

    order = ["B1", "B2", "B3", "B4", "B5", "E2-A", "E2-B", "E2-C", "E2-D", "E5-A", "E5-B", "E5-C"]
    result = [rows[key] for key in order if key in rows]
    for index, row in enumerate(result, start=1):
        row["rank"] = index
    return result


def model_row(experiment_id: str) -> dict[str, Any] | None:
    return next((row for row in model_rows() if row["id"] == experiment_id), None)


def experiments() -> list[dict[str, Any]]:
    measured = {row["id"]: row for row in model_rows()}
    output = []
    for meta in content.experiment_registry():
        row = dict(measured.get(meta["id"], _base_row(meta)))
        if meta["id"] in measured:
            row["name"] = meta.get("name", row["name"])
            row["research_question"] = meta.get("research_question")
            row["hypothesis"] = meta.get("hypothesis")
            row["status"] = meta.get("status")
        warnings = []
        if meta.get("status") == "completed" and meta.get("kind") == "model" and meta["id"] not in measured:
            warnings.append("Marked completed but no measured metrics artifact was found.")
        row["warnings"] = warnings
        if warnings:
            row["availability"] = {
                "status": "partial",
                "artifact": None,
                "note": warnings[0],
            }
        output.append(row)
    return output


def experiment_detail(experiment_id: str) -> dict[str, Any] | None:
    meta = next((e for e in content.experiment_registry() if e["id"] == experiment_id), None)
    if meta is None:
        return None
    row = model_row(experiment_id)
    detail = dict(meta)
    detail["metrics"] = row
    detail["warnings"] = []
    if meta.get("status") == "completed" and meta.get("kind") == "model" and row is None:
        detail["warnings"].append(
            "This experiment is marked completed but no measured metrics artifact was found."
        )
    detail["artifact_availability"] = [
        {
            "artifact": path,
            "status": "available" if artifacts.exists(path) else "missing",
        }
        for path in meta.get("source_artifacts", [])
    ]
    run_dir = E2_RUNS.get(experiment_id, {}).get("dir")
    if run_dir:
        detail["training_summary"] = artifacts.read_json(
            f"results/{run_dir}/training_summary.json", {}
        )
        detail["evaluation_summary"] = artifacts.read_json(
            f"results/{run_dir}/evaluation/evaluation_summary.json", {}
        )
    if experiment_id in {"E5-A", "E5-B", "E5-C"}:
        directory = {
            "E5-A": "e5a-operation-only",
            "E5-B": "e5b-operation-entities",
            "E5-C": "e5c-full-provenance",
        }[experiment_id]
        detail["training_summary"] = artifacts.read_json(
            f"results/{directory}/training_summary.json", {}
        )
        detail["evaluation_summary"] = artifacts.read_json(
            f"results/{directory}/evaluation/evaluation_summary.json", {}
        )
    detail["figures"] = [
        figure
        for figure in artifacts.figure_manifest()
        if (
            (experiment_id == "E5-A" and figure["run"] == "e5a")
            or (experiment_id == "E5-B" and figure["run"] == "e5b")
            or (experiment_id == "E5-C" and figure["run"] == "e5c")
            or (experiment_id == "E2-A" and figure["run"] == "e2a")
            or (experiment_id == "E2-B" and figure["run"] == "e2b")
            or (experiment_id == "E2-C" and figure["run"] == "e2c")
            or (experiment_id == "E2-D" and figure["run"] == "e2d")
        )
    ]
    return detail


# ---------- Thresholds and alert budgets ----------


def thresholds(experiment_id: str) -> dict[str, Any] | None:
    frame = artifacts.read_csv(THRESHOLD_SOURCE)
    if frame is None:
        return None
    subset = frame[frame["experiment"] == experiment_id].copy()
    if subset.empty:
        return None
    subset = subset.sort_values("percentile")
    rows = []
    for _, record in subset.iterrows():
        percentile = _float(record["percentile"]) or 0.0
        rows.append(
            {
                "percentile": percentile,
                "threshold": _float(record["threshold"]),
                "validation_fpr": _float(record["validation_fpr"]),
                "benign_false_positives": _int(record["benign_fp"]),
                "benign_fpr": _float(record["benign_fpr"]),
                "true_positives": _int(record["original_tp"]),
                "false_positives": _int(record["original_fp"]),
                "true_negatives": _int(record["original_tn"]),
                "false_negatives": _int(record["original_fn"]),
                "total_alerts": _int(record["original_alerts"]),
                "precision": _float(record["original_precision"]),
                "recall": _float(record["original_recall"]),
                "f1": _float(record["original_f1"]),
                "attack_fpr": _float(record["original_fpr"]),
                "contextual_true_positives": _int(record["contextual_tp"]),
                "contextual_recall": _float(record["contextual_recall"]),
                "exploratory": percentile >= 99.95,
            }
        )
    return {
        "experiment_id": experiment_id,
        "source": THRESHOLD_SOURCE,
        "primary_percentile": 99.0,
        "note": "P99.95 and above were examined retrospectively after attack-test inspection and are exploratory, not independently validated deployment thresholds.",
        "rows": rows,
    }


def alert_budgets(experiment_id: str) -> dict[str, Any] | None:
    if experiment_id in E2_RUNS:
        source = "results/autoencoder_comparison/alert_budget_comparison.csv"
    elif experiment_id in {"E5-A", "E5-B", "E5-C"}:
        source = "results/ablation_comparison/alert_budget_comparison.csv"
    else:
        return None
    frame = artifacts.read_csv(source)
    if frame is None:
        return None
    subset = frame[frame["experiment"] == experiment_id].sort_values("alert_budget")
    if subset.empty:
        return None
    rows = []
    for _, record in subset.iterrows():
        rows.append(
            {
                "budget": _int(record["alert_budget"]),
                "expected_true_positives": _float(record["expected_tp"]),
                "minimum_true_positives": _int(record["minimum_tp"]),
                "maximum_true_positives": _int(record["maximum_tp"]),
                "expected_precision": _float(record["expected_precision"]),
                "expected_recall": _float(record["expected_recall"]),
                "minimum_recall": _float(record.get("minimum_recall")) if "minimum_recall" in record else None,
                "maximum_recall": _float(record.get("maximum_recall")) if "maximum_recall" in record else None,
            }
        )
    return {
        "experiment_id": experiment_id,
        "source": source,
        "rows": rows,
        "note": "Only measured budget points are returned. No intermediate budgets are interpolated.",
    }


# ---------- Comparisons ----------


def model_comparison() -> dict[str, Any]:
    rows = model_rows()
    leaderboard = sorted(
        [row for row in rows if row.get("average_precision") is not None],
        key=lambda row: row["average_precision"],
        reverse=True,
    )
    for index, row in enumerate(leaderboard, start=1):
        row["rank"] = index
    return {
        "models": rows,
        "leaderboard": leaderboard,
        "note": "Ranking metrics (ROC-AUC and Average Precision) are threshold-independent. Threshold-based metrics use each model's recorded operating point; these are not necessarily the same threshold.",
    }


OVERLAP_RUNS = {
    "E2-A": "e2-v2-minilm-standard",
    "E2-B": "e2b-unique",
    "E2-C": "e2c-weighted",
    "E2-D": "e2d-unique-matched",
    "E5-A": "e5a-operation-only",
    "E5-B": "e5b-operation-entities",
    "E5-C": "e5c-full-provenance",
}


def description_overlap() -> dict[str, Any]:
    registry = _registry()
    models = []
    sources = []
    for experiment_id, directory in OVERLAP_RUNS.items():
        relative = f"results/{directory}/evaluation/evaluation_summary.json"
        summary = artifacts.read_json(relative, {}) or {}
        overlap = summary.get("attack_test", {}).get("description_overlap")
        if not overlap:
            continue
        sources.append(relative)
        item: dict[str, Any] = {
            "id": experiment_id,
            "name": registry.get(experiment_id, {}).get("name", experiment_id),
        }
        for key in ("seen", "unseen"):
            values = overlap.get(key, {})
            item[key] = {
                "records": values.get("records"),
                "positives": values.get("positives"),
                "alerts": values.get("alerts"),
                "precision": values.get("precision"),
                "recall": values.get("recall"),
                "false_positive_rate": values.get("false_positive_rate"),
                "roc_auc": values.get("roc_auc"),
                "average_precision": values.get("average_precision"),
            }
        models.append(item)
    return {
        "models": models,
        "note": "Seen/unseen is an exact-description overlap diagnostic. Models whose attack test contains no positive events in a subgroup have no defined recall for that subgroup.",
        "source_artifacts": sources,
    }


def ablation() -> dict[str, Any]:
    rows = model_rows()
    selected = [row for row in rows if row["id"] in {"B5", "E5-A", "E5-B", "E5-C"}]
    stats = artifacts.read_csv("results/eda/ablation/representation_statistics.csv")
    conflicts = artifacts.read_json("results/eda/ablation/representation_conflicts.json", {}) or {}
    budget = artifacts.read_csv("results/ablation_comparison/alert_budget_comparison.csv")

    statistics = []
    if stats is not None:
        for _, record in stats.iterrows():
            statistics.append(
                {
                    "variant": record["variant"],
                    "split": record["split"],
                    "events": _int(record["events"]),
                    "unique_descriptions": _int(record["unique_descriptions"]),
                    "mean_tokens": _float(record["mean_tokens"]),
                    "p95_tokens": _float(record.get("p95_tokens")),
                    "maximum_tokens": _int(record["maximum_tokens"]),
                    "over_token_limit": _int(record["over_token_limit"]),
                    "original_positives": _int(record["original_positives"]),
                    "contextual_positives": _int(record["contextual_positives"]),
                    "seen_in_training": _int(record["seen_in_training"]),
                    "original_positives_seen": _int(record["original_positives_seen"]),
                    "contextual_positives_seen": _int(record["contextual_positives_seen"]),
                }
            )

    budgets = []
    if budget is not None:
        for _, record in budget.iterrows():
            budgets.append(
                {
                    "experiment": record["experiment"],
                    "budget": _int(record["alert_budget"]),
                    "expected_true_positives": _float(record["expected_tp"]),
                    "minimum_true_positives": _int(record["minimum_tp"]),
                    "maximum_true_positives": _int(record["maximum_tp"]),
                    "expected_precision": _float(record["expected_precision"]),
                    "expected_recall": _float(record["expected_recall"]),
                }
            )

    ap_by_id = {row["id"]: row.get("average_precision") for row in selected}
    uplift = None
    if ap_by_id.get("E5-C") and ap_by_id.get("E5-B"):
        uplift = (ap_by_id["E5-C"] / ap_by_id["E5-B"] - 1.0) * 100.0

    e5a_conflict = conflicts.get("operation_only", {}).get("original", {})
    conflicting_negatives = None
    if e5a_conflict.get("conflicting_records") and e5a_conflict.get("conflicting_positives") is not None:
        conflicting_negatives = e5a_conflict["conflicting_records"] - e5a_conflict["conflicting_positives"]

    return {
        "models": selected,
        "statistics": statistics,
        "conflicts": conflicts,
        "budgets": budgets,
        "examples": content.ablation_examples(),
        "derived": {
            "e5c_over_e5b_ap_uplift_percent": uplift,
            "operation_only_conflicting_negative_events": conflicting_negatives,
        },
        "source_artifacts": [
            "results/ablation_comparison/ablation_comparison.csv",
            "results/ablation_comparison/alert_budget_comparison.csv",
            "results/eda/ablation/representation_statistics.csv",
            "results/eda/ablation/representation_conflicts.json",
        ],
    }


# ---------- Overview ----------


def _best(rows: list[dict[str, Any]], key: str) -> dict[str, Any] | None:
    candidates = [row for row in rows if row.get(key) is not None]
    if not candidates:
        return None
    best_value = max(row[key] for row in candidates)
    tied = [row for row in candidates if abs(row[key] - best_value) < 1e-12]
    tied_sorted = sorted(tied, key=lambda row: row.get("average_precision") or 0, reverse=True)
    return {
        "value": best_value,
        "experiment_id": tied_sorted[0]["id"],
        "experiment_ids": [row["id"] for row in tied_sorted],
        "tied_count": len(tied),
    }


def overview() -> dict[str, Any]:
    from app.services import dataset as dataset_service

    rows = model_rows()
    status = content.research_status()
    road = content.roadmap()
    reports = content.reports()
    journal = content.journal()
    findings = content.findings()
    limits = content.limitations()
    registry = content.experiment_registry()

    completed = [e for e in registry if e.get("status") == "completed"]
    in_progress = [e for e in registry if e.get("status") in {"in_progress", "next"}]
    planned = [e for e in registry if e.get("status") == "planned"]
    upcoming = [
        e for e in registry if e.get("status") in {"planned", "next", "in_progress"}
    ]
    dataset_summary = dataset_service.summary()

    leaderboard = sorted(
        [row for row in rows if row.get("average_precision") is not None],
        key=lambda row: row["average_precision"],
        reverse=True,
    )[:6]
    for index, row in enumerate(leaderboard, start=1):
        row["rank"] = index

    return {
        "research": status,
        "dataset": dataset_summary,
        "kpis": {
            "raw_records": dataset_summary["counts"]["raw_records"],
            "events": dataset_summary["counts"]["events"],
            "original_positives": dataset_summary["counts"]["original_positives"],
            "contextual_positives": dataset_summary["counts"]["contextual_positives"],
            "completed_experiments": len(completed),
            "completed_models": len([e for e in completed if e.get("kind") == "model"]),
            "completed_analyses": len([e for e in completed if e.get("kind") == "analysis"]),
            "best_roc_auc": _best(rows, "roc_auc"),
            "best_average_precision": _best(rows, "average_precision"),
            "best_recall": _best(rows, "recall"),
        },
        "leaderboard": leaderboard,
        "roadmap": road,
        "findings": findings,
        "limitations": limits[:5],
        "journal": journal[:1],
        "upcoming": upcoming,
        "counts": {
            "completed": len(completed),
            "in_progress": len(in_progress),
            "planned": len(planned),
            "total_experiments": len(registry),
            "reports_available": len([r for r in reports if r.get("available")]),
        },
        "status": status,
    }
