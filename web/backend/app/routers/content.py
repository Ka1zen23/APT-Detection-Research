from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.deps import envelope
from app.services import artifacts, content

router = APIRouter(tags=["research documentation"])


@router.get("/findings")
def findings() -> dict:
    items = content.findings()
    return envelope({"findings": items, "count": len(items)})


@router.get("/findings/{finding_id}")
def finding(finding_id: str) -> dict:
    item = next((f for f in content.findings() if f["id"].lower() == finding_id.lower()), None)
    if item is None:
        raise HTTPException(status_code=404, detail="Finding not found")
    return envelope(item)


@router.get("/roadmap")
def roadmap() -> dict:
    return envelope(content.roadmap())


@router.get("/journal")
def journal() -> dict:
    entries = content.journal()
    return envelope(
        {
            "entries": [
                {key: value for key, value in entry.items() if key != "body"}
                for entry in entries
            ]
        }
    )


@router.get("/journal/{slug}")
def journal_entry(slug: str) -> dict:
    entry = next((item for item in content.journal() if item["slug"] == slug), None)
    if entry is None:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return envelope(entry)


@router.get("/reports")
def reports() -> dict:
    items = content.reports()
    return envelope(
        {
            "reports": items,
            "available": len([item for item in items if item.get("available")]),
            "documents": artifacts.document_metadata(),
        }
    )


@router.get("/environment")
def environment() -> dict:
    return envelope(content.environment())


@router.get("/methodology")
def methodology() -> dict:
    return envelope(content.methodology())


@router.get("/limitations")
def limitations() -> dict:
    items = content.limitations()
    counts: dict[str, int] = {}
    for item in items:
        counts[item.get("severity", "unknown")] = counts.get(item.get("severity", "unknown"), 0) + 1
    return envelope({"limitations": items, "counts": counts})


@router.get("/architecture")
def architecture() -> dict:
    return envelope(content.architecture())
