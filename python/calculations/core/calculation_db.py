"""Server-side SQLite persistence for engineer reviews.

Stores per-step reviews so they survive browser reloads, device changes,
and can be shared across the team.
"""

from __future__ import annotations

import json
import sqlite3
import os
from datetime import datetime, timezone
from typing import Any


_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "reviews.db")


def _conn() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(_DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS step_reviews (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id  TEXT NOT NULL DEFAULT 'default',
            calc_module TEXT NOT NULL,
            step_key    TEXT NOT NULL,
            status      TEXT NOT NULL CHECK(status IN ('accepted','overridden','flagged','pending')),
            override_value  TEXT,
            override_reason TEXT,
            flag_note       TEXT,
            engineer_name   TEXT,
            registration_no TEXT,
            reviewed_at     TEXT NOT NULL,
            created_at      TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(project_id, calc_module, step_key)
        )
    """)
    conn.commit()
    return conn


def save_review(
    calc_module: str,
    step_key: str,
    status: str,
    override_value: str = "",
    override_reason: str = "",
    flag_note: str = "",
    engineer_name: str = "",
    registration_no: str = "",
    project_id: str = "default",
) -> dict[str, Any]:
    """Upsert a single step review."""
    now = datetime.now(timezone.utc).isoformat()
    conn = _conn()
    conn.execute(
        """
        INSERT INTO step_reviews
            (project_id, calc_module, step_key, status,
             override_value, override_reason, flag_note,
             engineer_name, registration_no, reviewed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, calc_module, step_key) DO UPDATE SET
            status = excluded.status,
            override_value = excluded.override_value,
            override_reason = excluded.override_reason,
            flag_note = excluded.flag_note,
            engineer_name = excluded.engineer_name,
            registration_no = excluded.registration_no,
            reviewed_at = excluded.reviewed_at
        """,
        (project_id, calc_module, step_key, status,
         override_value, override_reason, flag_note,
         engineer_name, registration_no, now),
    )
    conn.commit()
    conn.close()
    return {"saved": True, "step_key": step_key, "reviewed_at": now}


def save_reviews_batch(
    reviews: list[dict[str, Any]],
    project_id: str = "default",
) -> dict[str, Any]:
    """Upsert multiple step reviews in a single transaction."""
    now = datetime.now(timezone.utc).isoformat()
    conn = _conn()
    count = 0
    for r in reviews:
        conn.execute(
            """
            INSERT INTO step_reviews
                (project_id, calc_module, step_key, status,
                 override_value, override_reason, flag_note,
                 engineer_name, registration_no, reviewed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_id, calc_module, step_key) DO UPDATE SET
                status = excluded.status,
                override_value = excluded.override_value,
                override_reason = excluded.override_reason,
                flag_note = excluded.flag_note,
                engineer_name = excluded.engineer_name,
                registration_no = excluded.registration_no,
                reviewed_at = excluded.reviewed_at
            """,
            (
                project_id,
                r.get("calc_module", ""),
                r.get("step_key", ""),
                r.get("status", "pending"),
                r.get("override_value", ""),
                r.get("override_reason", ""),
                r.get("flag_note", ""),
                r.get("engineer_name", ""),
                r.get("registration_no", ""),
                r.get("reviewed_at", now),
            ),
        )
        count += 1
    conn.commit()
    conn.close()
    return {"saved": count, "timestamp": now}


def load_reviews(
    calc_module: str | None = None,
    project_id: str = "default",
) -> list[dict[str, Any]]:
    """Load all reviews, optionally filtered by calc_module."""
    conn = _conn()
    if calc_module:
        rows = conn.execute(
            """SELECT calc_module, step_key, status,
                      override_value, override_reason, flag_note,
                      engineer_name, registration_no, reviewed_at
               FROM step_reviews
               WHERE project_id = ? AND calc_module = ?
               ORDER BY step_key""",
            (project_id, calc_module),
        ).fetchall()
    else:
        rows = conn.execute(
            """SELECT calc_module, step_key, status,
                      override_value, override_reason, flag_note,
                      engineer_name, registration_no, reviewed_at
               FROM step_reviews
               WHERE project_id = ?
               ORDER BY calc_module, step_key""",
            (project_id,),
        ).fetchall()
    conn.close()
    return [
        {
            "calc_module": r[0],
            "step_key": r[1],
            "status": r[2],
            "override_value": r[3],
            "override_reason": r[4],
            "flag_note": r[5],
            "engineer_name": r[6],
            "registration_no": r[7],
            "reviewed_at": r[8],
        }
        for r in rows
    ]
