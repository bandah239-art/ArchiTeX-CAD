"""SQLite persistence store for project workspaces, calculation results, and generated documents."""

import json
import sqlite3
import os
from datetime import datetime, timezone
from typing import Any

_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "projects.db")


def _conn() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(_DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    
    # 1. Projects table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id           TEXT PRIMARY KEY,
            name         TEXT NOT NULL,
            location     TEXT,
            engineer     TEXT,
            eiz_number   TEXT,
            client       TEXT,
            created_date TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    
    # 2. Calculations table
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
    
    # 3. Documents table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id  TEXT NOT NULL,
            filename    TEXT NOT NULL,
            type        TEXT NOT NULL CHECK(type IN ('memo', 'boq', 'drawing')),
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY(project_id) REFERENCES projects(id)
        )
    """)
    
    conn.commit()
    return conn


def save_project(proj: dict[str, Any]) -> dict[str, Any]:
    """Create or update a project record."""
    conn = _conn()
    pid = proj.get("id", "default")
    conn.execute(
        """
        INSERT INTO projects (id, name, location, engineer, eiz_number, client, created_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            location = excluded.location,
            engineer = excluded.engineer,
            eiz_number = excluded.eiz_number,
            client = excluded.client
        """,
        (
            pid,
            proj.get("name", "Untitled Project"),
            proj.get("location", ""),
            proj.get("engineer", ""),
            proj.get("eiz_number", ""),
            proj.get("client", ""),
            proj.get("created_date", datetime.now(timezone.utc).isoformat()),
        ),
    )
    conn.commit()
    conn.close()
    return {"saved": True, "project_id": pid}


def save_calculation(project_id: str, module: str, inputs: dict[str, Any], outputs: dict[str, Any]) -> dict[str, Any]:
    """Save a calculation run result linked to a project."""
    conn = _conn()
    now = datetime.now(timezone.utc).isoformat()
    
    # Auto-create default project if not existing
    conn.execute(
        "INSERT OR IGNORE INTO projects (id, name) VALUES (?, 'Default Project')",
        (project_id,)
    )
    
    # Get current revision for this module
    row = conn.execute(
        "SELECT MAX(revision) FROM calculations WHERE project_id = ? AND module = ?",
        (project_id, module)
    ).fetchone()
    
    rev = 1
    if row and row[0] is not None:
        rev = row[0] + 1
        
    conn.execute(
        """
        INSERT INTO calculations (project_id, module, inputs, outputs, timestamp, revision)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (project_id, module, json.dumps(inputs), json.dumps(outputs), now, rev),
    )
    conn.commit()
    conn.close()
    return {"saved": True, "module": module, "revision": rev, "timestamp": now}


def get_project_summary(project_id: str) -> dict[str, Any]:
    """Get project metadata, calculations history, and aggregated BoQ items."""
    conn = _conn()
    
    # Load project details
    p_row = conn.execute(
        "SELECT id, name, location, engineer, eiz_number, client, created_date FROM projects WHERE id = ?",
        (project_id,)
    ).fetchone()
    
    if not p_row:
        conn.close()
        return {"error": "Project not found"}
        
    project = {
        "id": p_row[0],
        "name": p_row[1],
        "location": p_row[2],
        "engineer": p_row[3],
        "eiz_number": p_row[4],
        "client": p_row[5],
        "created_date": p_row[6]
    }
    
    # Load calculations (only latest revision for each module)
    c_rows = conn.execute(
        """
        SELECT c1.module, c1.inputs, c1.outputs, c1.timestamp, c1.revision
        FROM calculations c1
        INNER JOIN (
            SELECT module, MAX(revision) as max_rev
            FROM calculations
            WHERE project_id = ?
            GROUP BY module
        ) c2 ON c1.module = c2.module AND c1.revision = c2.max_rev
        WHERE c1.project_id = ?
        """,
        (project_id, project_id)
    ).fetchall()
    
    calculations = []
    boq_totals = {
        "concrete_m3": 0.0,
        "rebar_tonnes": 0.0,
        "formwork_m2": 0.0,
        "cost_zmw": 0.0
    }
    
    for row in c_rows:
        module = row[0]
        outputs = json.loads(row[2])
        calculations.append({
            "module": module,
            "inputs": json.loads(row[1]),
            "outputs": outputs,
            "timestamp": row[3],
            "revision": row[4]
        })
        
        # Aggregate costing/BOQ values from outputs if present
        summary = outputs.get("summary", {})
        if "total_cost_zmw" in summary:
            boq_totals["cost_zmw"] += float(summary["total_cost_zmw"])
        elif "gravel_cost_zmw_per_km" in summary:
            boq_totals["cost_zmw"] += float(summary["gravel_cost_zmw_per_km"])
            
        if "steel_required_mm2" in summary:
            # Estimate rebar weight in tonnes from steel area (very rough estimation)
            boq_totals["rebar_tonnes"] += float(summary["steel_required_mm2"]) * 7850 / 1e9
            
    # Load documents
    d_rows = conn.execute(
        "SELECT filename, type, created_at FROM documents WHERE project_id = ?",
        (project_id,)
    ).fetchall()
    
    documents = [
        {"filename": r[0], "type": r[1], "created_at": r[2]}
        for r in d_rows
    ]
    
    conn.close()
    
    return {
        "project": project,
        "calculations": calculations,
        "boq_totals": boq_totals,
        "documents": documents
    }


def save_document_record(project_id: str, filename: str, doc_type: str) -> dict[str, Any]:
    """Register a generated PDF or sheet in the workspace store."""
    conn = _conn()
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT INTO documents (project_id, filename, type, created_at) VALUES (?, ?, ?, ?)",
        (project_id, filename, doc_type, now)
    )
    conn.commit()
    conn.close()
    return {"registered": True, "filename": filename}
