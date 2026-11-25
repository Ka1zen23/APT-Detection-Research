#!/usr/bin/env python3
"""Generate the deployment dataset profile from raw CICAPT-IIoT CSVs.

The output contains only aggregate distributions and missing-value counts. It
contains no raw event text, so it can be committed and used by the container
image when data/raw/ is excluded.

Usage (from the repository root):
    python web/backend/scripts/build_dataset_profile.py
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.config import CONTENT_DIR  # noqa: E402
from app.services.dataset import _raw_profile  # noqa: E402


def main() -> int:
    profile = _raw_profile()
    if not profile.get("rows"):
        raise SystemExit(
            "Raw provenance files were not found. Place the CICAPT-IIoT CSVs "
            "under data/raw/cicapt-iiot/Provenance_Logs/ first."
        )

    payload = {
        "schema_version": 1,
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "source": [
            "data/raw/cicapt-iiot/Provenance_Logs/Phase1_Provenance.csv",
            "data/raw/cicapt-iiot/Provenance_Logs/Phase2_Provenance.csv",
        ],
        **profile,
    }
    CONTENT_DIR.mkdir(parents=True, exist_ok=True)
    output = CONTENT_DIR / "dataset_profile.json"
    output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {output.relative_to(REPO_ROOT)}")
    print(
        f"rows={profile['total_rows']} missing_columns={len(profile['missing'])} "
        f"types={len(profile['types'])} operations={len(profile['operations'])}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
