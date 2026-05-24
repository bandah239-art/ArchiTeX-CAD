"""Offline geo intelligence cache for field use."""

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

CACHE_DIR = Path(__file__).resolve().parent / "cache"
CACHE_TTL_HOURS = 168  # 7 days


def _cache_key(endpoint: str, lat: float, lon: float, extra: str = "") -> str:
    raw = f"{endpoint}:{round(lat, 4)}:{round(lon, 4)}:{extra}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _cache_path(key: str) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return CACHE_DIR / f"{key}.json"


def get_cached(endpoint: str, lat: float, lon: float, extra: str = "") -> dict[str, Any] | None:
    key = _cache_key(endpoint, lat, lon, extra)
    path = _cache_path(key)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        cached_at = datetime.fromisoformat(data.get("cached_at", "2000-01-01"))
        age_h = (datetime.now(timezone.utc) - cached_at.replace(tzinfo=timezone.utc)).total_seconds() / 3600
        if age_h > CACHE_TTL_HOURS:
            return None
        return data.get("payload")
    except (json.JSONDecodeError, ValueError, OSError):
        return None


def set_cached(endpoint: str, lat: float, lon: float, payload: dict[str, Any], extra: str = "") -> str:
    key = _cache_key(endpoint, lat, lon, extra)
    path = _cache_path(key)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "cached_at": datetime.now(timezone.utc).isoformat(),
                "endpoint": endpoint,
                "latitude": lat,
                "longitude": lon,
                "payload": payload,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return str(path)


def cache_status() -> dict[str, Any]:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    files = list(CACHE_DIR.glob("*.json"))
    total_bytes = sum(f.stat().st_size for f in files)
    return {
        "cache_dir": str(CACHE_DIR),
        "entries": len(files),
        "size_kb": round(total_bytes / 1024, 1),
        "ttl_hours": CACHE_TTL_HOURS,
    }


def clear_cache() -> int:
    count = 0
    if CACHE_DIR.exists():
        for f in CACHE_DIR.glob("*.json"):
            f.unlink(missing_ok=True)
            count += 1
    return count
