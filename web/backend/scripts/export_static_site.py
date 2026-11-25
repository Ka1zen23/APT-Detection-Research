#!/usr/bin/env python3
"""Export aggregate dashboard data for the static Vercel deployment.

This exporter deliberately excludes event-level provenance. It writes only
aggregate metrics, charts, findings and allowlisted documents into the
frontend's public directory. No event text, node IDs or event-level scores are
included.

Usage (from the repository root):
    python web/backend/scripts/export_static_site.py
"""

from __future__ import annotations

import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parents[1]
FRONTEND_PUBLIC = REPO_ROOT / "web" / "frontend" / "public"
DATA_ROOT = FRONTEND_PUBLIC / "data"
ARTIFACT_ROOT = FRONTEND_PUBLIC / "artifacts"

sys.path.insert(0, str(BACKEND_DIR))

from app import __version__  # noqa: E402
from app.config import API_PREFIX, ROOT  # noqa: E402
from app.services import artifacts, content, curves, dataset as dataset_service, metrics, visualisations  # noqa: E402

CURVE_MODELS = [
    "B1",
    "B2",
    "B3",
    "B4",
    "B5",
    "E2-A",
    "E2-B",
    "E2-C",
    "E2-D",
    "E5-A",
    "E5-B",
    "E5-C",
]

THRESHOLD_MODELS = ["E2-A", "E2-B", "E2-C", "E2-D"]

PUBLIC_ABLATION_EXAMPLE = {
    "event_context": (
        "Illustrative redacted event. Real provenance values, file paths and "
        "entity names are excluded from the public snapshot."
    ),
    "event_id": "redacted",
    "phase": "example",
    "source": "Redacted illustrative template",
    "representations": [
        {
            "id": "E5-A",
            "label": "Operation only",
            "description": "Operations: execve; load; load; load.",
            "contains": ["System operation names"],
            "omits": ["Process attributes", "Artifact attributes", "Directed relationships"],
        },
        {
            "id": "E5-B",
            "label": "Operations and entities",
            "description": (
                "Operations: execve; load; load; load. "
                "Entities: Artifact; type: file; path: /example/config; permissions: 755. "
                "Process; name: service-a; executable: /usr/bin/service; UID: 1000; EUID: 1000."
            ),
            "contains": ["System operation names", "Process attributes", "Artifact attributes"],
            "omits": ["Explicit directed relationships"],
        },
        {
            "id": "E5-C",
            "label": "Full provenance",
            "description": (
                "Relationships: P1 was triggered by P2; operation: execve. "
                "P1 used A1; operation: load. "
                "Entities: P1: Process; name: service-a; executable: /usr/bin/service; "
                "UID: 1000; EUID: 1000. P2: Process; name: service-launcher; "
                "executable: /bin/sh; UID: 0; EUID: 0. "
                "A1: Artifact; type: file; path: /example/config; permissions: 755."
            ),
            "contains": [
                "System operation names",
                "Process attributes",
                "Artifact attributes",
                "Explicit directed relationships",
            ],
            "omits": [],
        },
    ],
}


def utc_now() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def meta() -> dict[str, Any]:
    return {
        "generated_at": utc_now(),
        "last_artifact_update": artifacts.last_artifact_update(),
        "data_mode": "static_snapshot",
        "warnings": [
            "Static aggregate snapshot. Event-level provenance is intentionally excluded."
        ],
    }


def envelope(data: Any) -> dict[str, Any]:
    return {"data": data, "meta": meta()}


def write_json(relative: str, data: Any) -> None:
    path = DATA_ROOT / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(envelope(data), indent=2) + "\n", encoding="utf-8")


def copy_figures() -> int:
    count = 0
    for figure in artifacts.figure_manifest():
        source = artifacts.figure_path(figure["run"], figure["filename"])
        if source is None:
            continue
        destination = ARTIFACT_ROOT / "figures" / figure["run"] / figure["filename"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        count += 1
    return count


def write_comparison_visualisations() -> None:
    write_json("comparisons/training.json", visualisations.training())
    for experiment_id in THRESHOLD_MODELS:
        write_json(f"score-histograms/{experiment_id}.json", visualisations.score_histogram(experiment_id))


def copy_documents() -> tuple[int, dict[str, dict[str, Any]]]:
    reports = content.reports()
    keys = sorted(
        {
            report["document_key"]
            for report in reports
            if report.get("available") and report.get("document_key")
        }
    )
    copied: dict[str, dict[str, Any]] = {}
    for key in keys:
        resolved = artifacts.document_path(key)
        if resolved is None:
            continue
        source, info = resolved
        destination = ARTIFACT_ROOT / "documents" / f"{key}.txt"
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        copied[key] = {
            "key": key,
            "title": info["title"],
            "description": info["description"],
            "category": info["category"],
            "artifact": info["path"],
            "status": "available",
            "media_type": "text/plain",
        }
    # Keep the document metadata list consistent with the public report library.
    return len(copied), copied


def main() -> int:
    if not (ROOT / "results").is_dir():
        raise SystemExit("Run this script from a repository containing results/.")

    if DATA_ROOT.exists():
        shutil.rmtree(DATA_ROOT)
    if ARTIFACT_ROOT.exists():
        shutil.rmtree(ARTIFACT_ROOT)
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)

    registry = content.experiment_registry()
    model_comparison = metrics.model_comparison()
    ablation = metrics.ablation()
    ablation["examples"] = PUBLIC_ABLATION_EXAMPLE
    ablation["examples"]["note"] = (
        "This is an illustrative redacted template, not a real provenance event."
    )

    write_json("overview.json", metrics.overview())
    write_json("status.json", content.research_status())
    write_json("objectives.json", {"objectives": content.objectives()})
    write_json("experiments.json", metrics.experiments())
    write_json("comparisons/models.json", model_comparison)
    write_json("comparisons/ablation.json", ablation)
    write_json("comparisons/description-overlap.json", metrics.description_overlap())
    write_comparison_visualisations()
    write_json("dataset-summary.json", dataset_service.summary())
    write_json("findings.json", {"findings": content.findings(), "count": len(content.findings())})
    write_json("roadmap.json", content.roadmap())
    write_json("environment.json", content.environment())
    write_json("methodology.json", content.methodology())
    limitations = content.limitations()
    limitation_counts: dict[str, int] = {}
    for item in limitations:
        severity = item.get("severity", "unknown")
        limitation_counts[severity] = limitation_counts.get(severity, 0) + 1
    write_json(
        "limitations.json",
        {"limitations": limitations, "counts": limitation_counts},
    )
    write_json("architecture.json", content.architecture())
    write_json(
        "health.json",
        {
            "status": "ok",
            "version": __version__,
            "api_prefix": API_PREFIX,
            "repository_root_exists": ROOT.exists(),
            "allowed_artifact_roots": ["results", "web/content"],
            "last_artifact_update": artifacts.last_artifact_update(),
            "checked_at": utc_now(),
            "read_only": True,
            "deployment_mode": "static",
            "auth_required": False,
        },
    )

    for experiment in registry:
        experiment_id = experiment["id"]
        detail = metrics.experiment_detail(experiment_id)
        if detail is not None:
            write_json(f"experiments/{experiment_id}.json", detail)
        row = metrics.model_row(experiment_id)
        write_json(
            f"experiments/{experiment_id}/metrics.json",
            {
                "experiment_id": experiment_id,
                "available": row is not None,
                **({"metrics": row} if row else {"reason": "No measured model metrics."}),
            },
        )
        if detail is not None:
            write_json(
                f"experiments/{experiment_id}/figures.json",
                {"experiment_id": experiment_id, "figures": detail.get("figures", [])},
            )

    for experiment_id in THRESHOLD_MODELS:
        threshold_payload = metrics.thresholds(experiment_id)
        write_json(
            f"thresholds/{experiment_id}.json",
            {"available": True, **threshold_payload}
            if threshold_payload
            else {
                "experiment_id": experiment_id,
                "available": False,
                "reason": "No measured threshold sweep.",
            },
        )
        budget_payload = metrics.alert_budgets(experiment_id)
        write_json(
            f"alert-budgets/{experiment_id}.json",
            {"available": True, **budget_payload}
            if budget_payload
            else {
                "experiment_id": experiment_id,
                "available": False,
                "reason": "No measured alert-budget analysis.",
            },
        )

    for experiment_id in CURVE_MODELS:
        for label in ("original", "contextual"):
            payload = curves.curves(experiment_id, label)
            write_json(f"curves/{experiment_id}-{label}.json", payload)

    journal_entries = content.journal()
    write_json(
        "journal.json",
        {
            "entries": [
                {key: value for key, value in entry.items() if key != "body"}
                for entry in journal_entries
            ]
        },
    )
    for entry in journal_entries:
        write_json(f"journal/{entry['slug']}.json", entry)

    figure_count = copy_figures()
    document_count, public_documents = copy_documents()
    reports = content.reports()
    write_json(
        "reports.json",
        {
            "reports": reports,
            "available": len([item for item in reports if item.get("available")]),
            "documents": list(public_documents.values()),
        },
    )

    manifest = {
        "schema_version": 1,
        "generated_at": utc_now(),
        "last_artifact_update": artifacts.last_artifact_update(),
        "data_mode": "static_snapshot",
        "provenance_included": False,
        "event_explorer_included": False,
        "figures": figure_count,
        "documents": document_count,
        "experiments": len(registry),
        "curve_models": CURVE_MODELS,
    }
    (DATA_ROOT / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"Wrote static snapshot to {DATA_ROOT.relative_to(REPO_ROOT)}")
    print(
        f"experiments={len(registry)} figures={figure_count} documents={document_count} "
        "provenance_included=False"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
