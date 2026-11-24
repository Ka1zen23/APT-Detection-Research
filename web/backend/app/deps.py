from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.services import artifacts


def utc_now() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def envelope(data: Any, warnings: list[str] | None = None) -> dict[str, Any]:
    return {
        "data": data,
        "meta": {
            "generated_at": utc_now(),
            "last_artifact_update": artifacts.last_artifact_update(),
            "data_mode": "live_artifacts",
            "warnings": warnings or [],
        },
    }
