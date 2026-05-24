"""Digital twin — IoT sensor ingestion and asset state."""

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DB_PATH = Path(__file__).resolve().parent / "twin.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    asset_name TEXT,
    asset_type TEXT,
    project_id TEXT,
    location TEXT,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS sensor_readings (
    id TEXT PRIMARY KEY,
    asset_id TEXT,
    sensor_type TEXT,
    value REAL,
    unit TEXT,
    timestamp TEXT,
    metadata TEXT
);
"""


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def register_asset(data: dict[str, Any]) -> dict[str, Any]:
    aid = data.get("id") or f"AST-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.now(timezone.utc).isoformat()
    with _conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO assets (id, asset_name, asset_type, project_id, location, created_at) VALUES (?,?,?,?,?,?)",
            (aid, data.get("asset_name", aid), data.get("asset_type", "structure"), data.get("project_id", ""), data.get("location", ""), now),
        )
    return get_asset(aid) or {"id": aid}


def ingest_reading(data: dict[str, Any]) -> dict[str, Any]:
    rid = f"SEN-{uuid.uuid4().hex[:8]}"
    now = data.get("timestamp") or datetime.now(timezone.utc).isoformat()
    with _conn() as conn:
        conn.execute(
            "INSERT INTO sensor_readings (id, asset_id, sensor_type, value, unit, timestamp, metadata) VALUES (?,?,?,?,?,?,?)",
            (
                rid,
                data["asset_id"],
                data.get("sensor_type", "generic"),
                float(data["value"]),
                data.get("unit", ""),
                now,
                json.dumps(data.get("metadata", {})),
            ),
        )
    return {"id": rid, "asset_id": data["asset_id"], "value": data["value"], "timestamp": now}


def get_asset(asset_id: str) -> dict[str, Any] | None:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM assets WHERE id = ?", (asset_id,)).fetchone()
        if not row:
            return None
        readings = conn.execute(
            "SELECT * FROM sensor_readings WHERE asset_id = ? ORDER BY timestamp DESC LIMIT 50",
            (asset_id,),
        ).fetchall()
    asset = dict(row)
    asset["readings"] = [dict(r) for r in readings]
    asset["latest"] = asset["readings"][0] if asset["readings"] else None
    return asset


def list_assets(project_id: str = "") -> list[dict[str, Any]]:
    with _conn() as conn:
        if project_id:
            rows = conn.execute("SELECT * FROM assets WHERE project_id = ?", (project_id,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM assets").fetchall()
    return [dict(r) for r in rows]


def seed_demo_assets() -> list[dict[str, Any]]:
    assets = [
        {"asset_name": "Kafue Bridge Pier 3", "asset_type": "bridge", "project_id": "PRJ-ROAD-001", "location": "Kafue River"},
        {"asset_name": "Mongu Hospital Block A", "asset_type": "building", "project_id": "PRJ-BLD-002", "location": "Mongu"},
        {"asset_name": "Choma Water Pump Station", "asset_type": "wash", "project_id": "PRJ-WAT-003", "location": "Choma"},
    ]
    created = []
    for a in assets:
        asset = register_asset(a)
        created.append(asset)
        aid = asset["id"]
        # Seed sensor readings
        ingest_reading({"asset_id": aid, "sensor_type": "vibration_mm_s", "value": 2.1, "unit": "mm/s"})
        ingest_reading({"asset_id": aid, "sensor_type": "temperature_c", "value": 32.5, "unit": "°C"})
        ingest_reading({"asset_id": aid, "sensor_type": "strain_microstrain", "value": 145, "unit": "με"})
    return created
