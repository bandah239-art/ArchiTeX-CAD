"""Calculation result cache — mirrors geo_cache pattern."""

from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any

CACHE_DIR = Path(__file__).resolve().parent / "calc_cache"
TTL_SECONDS = 7 * 24 * 3600


def _key(endpoint: str, payload: dict[str, Any]) -> str:
    raw = json.dumps({"endpoint": endpoint, "payload": payload}, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


def get_cached(endpoint: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / f"{_key(endpoint, payload)}.json"
    if not path.exists():
        return None
    if time.time() - path.stat().st_mtime > TTL_SECONDS:
        path.unlink(missing_ok=True)
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def set_cached(endpoint: str, payload: dict[str, Any], result: dict[str, Any]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / f"{_key(endpoint, payload)}.json"
    path.write_text(json.dumps(result, default=str), encoding="utf-8")


def cache_status() -> dict[str, Any]:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    files = list(CACHE_DIR.glob("*.json"))
    size = sum(f.stat().st_size for f in files)
    return {"entries": len(files), "size_kb": round(size / 1024, 1), "ttl_hours": TTL_SECONDS // 3600}


def clear_cache() -> dict[str, Any]:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    count = 0
    for f in CACHE_DIR.glob("*.json"):
        f.unlink()
        count += 1
    return {"cleared": count}
