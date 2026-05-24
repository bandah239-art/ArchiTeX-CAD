"""Mobile field sync receiver."""

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SYNC_DB = Path(__file__).resolve().parent.parent / "government" / "mobile_sync.db"


def _conn() -> sqlite3.Connection:
    SYNC_DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(SYNC_DB)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """CREATE TABLE IF NOT EXISTS sync_items (
            id TEXT PRIMARY KEY,
            item_type TEXT,
            project_id TEXT,
            payload TEXT,
            priority INTEGER DEFAULT 5,
            received_at TEXT,
            synced INTEGER DEFAULT 1
        )"""
    )
    return conn


def receive_sync_item(payload: dict[str, Any]) -> dict[str, Any]:
    item_id = payload.get("id") or f"SYNC-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    with _conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO sync_items (id, item_type, project_id, payload, priority, received_at) VALUES (?,?,?,?,?,?)",
            (
                item_id,
                payload.get("type", payload.get("item_type", "site_report")),
                payload.get("project_id", ""),
                json.dumps(payload),
                int(payload.get("priority", 5)),
                now,
            ),
        )
    return {"status": "received", "id": item_id, "received_at": now}


def list_sync_items(limit: int = 50) -> list[dict[str, Any]]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM sync_items ORDER BY received_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        try:
            d["payload"] = json.loads(d["payload"])
        except json.JSONDecodeError:
            pass
        result.append(d)
    return result
