"""SQLite persistence store for project workspaces, calculation results, and generated documents.

Uses WAL mode + atomic write pattern: every mutating operation uses SQLite's own transaction
guarantees.  The DB file is never written partially.

Auto-save snapshots are kept (max 5 per project) so corrupt projects can be recovered.
"""

import json
import sqlite3
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "projects.db")
_AUTOSAVE_MAX = 5  # maximum auto-save snapshots to retain per project


# ── Connection helper ─────────────────────────────────────────────────────────

def _conn() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(_DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")

    conn.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id           TEXT PRIMARY KEY,
            name         TEXT NOT NULL,
            location     TEXT,
            engineer     TEXT,
            eiz_number   TEXT,
            client       TEXT,
            description  TEXT,
            latitude     REAL,
            longitude    REAL,
            status       TEXT DEFAULT 'active',
            contract_value REAL,
            updated_at   TEXT,
            created_date TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS calculations (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id  TEXT NOT NULL,
            module      TEXT NOT NULL,
            inputs      TEXT NOT NULL,
            outputs     TEXT NOT NULL,
            timestamp   TEXT NOT NULL,
            revision    INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY(project_id) REFERENCES projects(id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id  TEXT NOT NULL,
            filename    TEXT NOT NULL,
            type        TEXT NOT NULL CHECK(type IN ('memo','boq','drawing','report','tender')),
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY(project_id) REFERENCES projects(id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS project_autosaves (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id  TEXT NOT NULL,
            snapshot    TEXT NOT NULL,
            saved_at    TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_calc_project ON calculations(project_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_docs_project  ON documents(project_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_autosave_pid  ON project_autosaves(project_id)")
    conn.commit()
    return conn


def integrity_check(conn: sqlite3.Connection) -> bool:
    """Run SQLite integrity_check.  Returns True if the database is healthy."""
    result = conn.execute("PRAGMA integrity_check").fetchone()
    return result is not None and result[0] == "ok"


# ── Projects ──────────────────────────────────────────────────────────────────

def save_project(proj: dict[str, Any]) -> dict[str, Any]:
    """Create or update a project record (atomic upsert inside a WAL transaction)."""
    conn = _conn()
    pid = proj.get("id", "default")
    now = datetime.now(timezone.utc).isoformat()

    with conn:  # BEGIN / COMMIT (or ROLLBACK on exception)
        conn.execute(
            """
            INSERT INTO projects (id, name, location, engineer, eiz_number, client,
                                  description, latitude, longitude, status, contract_value,
                                  updated_at, created_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name           = excluded.name,
                location       = excluded.location,
                engineer       = excluded.engineer,
                eiz_number     = excluded.eiz_number,
                client         = excluded.client,
                description    = excluded.description,
                latitude       = excluded.latitude,
                longitude      = excluded.longitude,
                status         = excluded.status,
                contract_value = excluded.contract_value,
                updated_at     = excluded.updated_at
            """,
            (
                pid,
                proj.get("name", "Untitled Project"),
                proj.get("location", ""),
                proj.get("engineer", ""),
                proj.get("eiz_number", ""),
                proj.get("client", ""),
                proj.get("description"),
                proj.get("latitude"),
                proj.get("longitude"),
                proj.get("status", "active"),
                proj.get("contract_value"),
                now,
                proj.get("created_date", now),
            ),
        )
    conn.close()
    return {"saved": True, "project_id": pid, "updated_at": now}


def auto_save_project(project_id: str, snapshot: dict[str, Any]) -> dict[str, Any]:
    """
    Store a rolling auto-save snapshot (max _AUTOSAVE_MAX per project).
    Older snapshots are pruned automatically.
    """
    conn = _conn()
    now = datetime.now(timezone.utc).isoformat()

    with conn:
        conn.execute(
            "INSERT INTO project_autosaves (project_id, snapshot, saved_at) VALUES (?, ?, ?)",
            (project_id, json.dumps(snapshot), now),
        )
        # Keep only the most recent _AUTOSAVE_MAX snapshots
        conn.execute(
            """
            DELETE FROM project_autosaves
            WHERE project_id = ?
              AND id NOT IN (
                  SELECT id FROM project_autosaves
                  WHERE project_id = ?
                  ORDER BY saved_at DESC
                  LIMIT ?
              )
            """,
            (project_id, project_id, _AUTOSAVE_MAX),
        )
    conn.close()
    return {"auto_saved": True, "project_id": project_id, "saved_at": now}


def get_autosave_snapshots(project_id: str) -> list[dict[str, Any]]:
    """Return the most recent auto-save snapshots for recovery."""
    conn = _conn()
    rows = conn.execute(
        "SELECT id, saved_at, snapshot FROM project_autosaves WHERE project_id = ? ORDER BY saved_at DESC LIMIT ?",
        (project_id, _AUTOSAVE_MAX),
    ).fetchall()
    conn.close()
    return [
        {"id": r[0], "saved_at": r[1], "snapshot": json.loads(r[2])}
        for r in rows
    ]


def list_projects() -> list[dict[str, Any]]:
    """Return all projects ordered by most recently updated."""
    conn = _conn()
    rows = conn.execute(
        """SELECT id, name, location, engineer, eiz_number, client, status,
                  contract_value, updated_at, created_date
           FROM projects ORDER BY COALESCE(updated_at, created_date) DESC"""
    ).fetchall()
    conn.close()
    return [
        {
            "id": r[0], "name": r[1], "location": r[2], "engineer": r[3],
            "eiz_number": r[4], "client": r[5], "status": r[6],
            "contract_value": r[7], "updated_at": r[8], "created_date": r[9],
        }
        for r in rows
    ]


# ── Calculations ──────────────────────────────────────────────────────────────

def save_calculation(
    project_id: str,
    module: str,
    inputs: dict[str, Any],
    outputs: dict[str, Any],
) -> dict[str, Any]:
    """Save a calculation run result linked to a project."""
    conn = _conn()
    now = datetime.now(timezone.utc).isoformat()

    with conn:
        conn.execute(
            "INSERT OR IGNORE INTO projects (id, name) VALUES (?, 'Default Project')",
            (project_id,),
        )
        row = conn.execute(
            "SELECT MAX(revision) FROM calculations WHERE project_id = ? AND module = ?",
            (project_id, module),
        ).fetchone()
        rev = (row[0] or 0) + 1
        conn.execute(
            "INSERT INTO calculations (project_id, module, inputs, outputs, timestamp, revision) VALUES (?, ?, ?, ?, ?, ?)",
            (project_id, module, json.dumps(inputs), json.dumps(outputs), now, rev),
        )
    conn.close()
    return {"saved": True, "module": module, "revision": rev, "timestamp": now}


# ── Project summary ───────────────────────────────────────────────────────────

def get_project_summary(project_id: str) -> dict[str, Any]:
    """Return project metadata, calculation history, and aggregated BoQ totals."""
    conn = _conn()

    p_row = conn.execute(
        """SELECT id, name, location, engineer, eiz_number, client,
                  description, latitude, longitude, status, contract_value, created_date
           FROM projects WHERE id = ?""",
        (project_id,),
    ).fetchone()

    if not p_row:
        conn.close()
        return {"error": "Project not found"}

    project = {
        "id": p_row[0], "name": p_row[1], "location": p_row[2],
        "engineer": p_row[3], "eiz_number": p_row[4], "client": p_row[5],
        "description": p_row[6], "latitude": p_row[7], "longitude": p_row[8],
        "status": p_row[9], "contract_value": p_row[10], "created_date": p_row[11],
    }

    c_rows = conn.execute(
        """
        SELECT c1.module, c1.inputs, c1.outputs, c1.timestamp, c1.revision
        FROM calculations c1
        INNER JOIN (
            SELECT module, MAX(revision) AS max_rev
            FROM calculations WHERE project_id = ? GROUP BY module
        ) c2 ON c1.module = c2.module AND c1.revision = c2.max_rev
        WHERE c1.project_id = ?
        """,
        (project_id, project_id),
    ).fetchall()

    calculations = []
    boq_totals = {"concrete_m3": 0.0, "rebar_tonnes": 0.0, "formwork_m2": 0.0, "cost_zmw": 0.0}

    for row in c_rows:
        outputs = json.loads(row[2])
        calculations.append({
            "module": row[0], "inputs": json.loads(row[1]),
            "outputs": outputs, "timestamp": row[3], "revision": row[4],
        })
        summary = outputs.get("summary", {})
        if "total_cost_zmw" in summary:
            boq_totals["cost_zmw"] += float(summary["total_cost_zmw"])
        elif "gravel_cost_zmw_per_km" in summary:
            boq_totals["cost_zmw"] += float(summary["gravel_cost_zmw_per_km"])
        if "steel_required_mm2" in summary:
            boq_totals["rebar_tonnes"] += float(summary["steel_required_mm2"]) * 7850 / 1e9

    d_rows = conn.execute(
        "SELECT filename, type, created_at FROM documents WHERE project_id = ?",
        (project_id,),
    ).fetchall()
    documents = [{"filename": r[0], "type": r[1], "created_at": r[2]} for r in d_rows]

    conn.close()
    return {"project": project, "calculations": calculations, "boq_totals": boq_totals, "documents": documents}


# ── Documents ─────────────────────────────────────────────────────────────────

def save_document_record(project_id: str, filename: str, doc_type: str) -> dict[str, Any]:
    """Register a generated PDF or sheet in the workspace store."""
    conn = _conn()
    now = datetime.now(timezone.utc).isoformat()
    valid_types = {"memo", "boq", "drawing", "report", "tender"}
    if doc_type not in valid_types:
        doc_type = "report"
    with conn:
        conn.execute(
            "INSERT INTO documents (project_id, filename, type, created_at) VALUES (?, ?, ?, ?)",
            (project_id, filename, doc_type, now),
        )
    conn.close()
    return {"registered": True, "filename": filename}
