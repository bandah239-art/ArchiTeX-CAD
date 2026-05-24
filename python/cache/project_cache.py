"""Last-opened project metadata for offline desktop resilience."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

META_PATH = Path(__file__).resolve().parent / "last_project.json"


def save_project_meta(meta: dict[str, Any]) -> dict[str, Any]:
    META_PATH.parent.mkdir(parents=True, exist_ok=True)
    META_PATH.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return {"saved": True, "path": str(META_PATH)}


def load_project_meta() -> dict[str, Any]:
    if not META_PATH.exists():
        return {"status": "empty"}
    return json.loads(META_PATH.read_text(encoding="utf-8"))
