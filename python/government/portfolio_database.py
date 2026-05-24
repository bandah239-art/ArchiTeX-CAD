"""Government project portfolio SQLite database."""

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DB_PATH = Path(__file__).resolve().parent / "portfolio.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    project_name TEXT NOT NULL,
    project_code TEXT UNIQUE,
    project_type TEXT,
    country_code TEXT,
    province TEXT,
    district TEXT,
    constituency TEXT,
    gps_lat REAL,
    gps_lon REAL,
    contract_value_usd REAL,
    contract_value_local REAL,
    currency TEXT,
    funding_source TEXT,
    contractor_name TEXT,
    consultant_name TEXT,
    contract_date TEXT,
    commencement_date TEXT,
    original_completion TEXT,
    revised_completion TEXT,
    actual_completion TEXT,
    status TEXT,
    completion_pct REAL,
    is_flagged INTEGER DEFAULT 0,
    flag_reason TEXT,
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS progress_snapshots (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id),
    snapshot_date TEXT,
    completion_pct REAL,
    expenditure_usd REAL,
    expenditure_pct REAL,
    milestones_achieved TEXT,
    milestones_pending TEXT,
    issues_reported TEXT,
    variations_logged TEXT,
    certificate_no TEXT,
    certified_amount REAL,
    certified_by TEXT,
    photo_count INTEGER DEFAULT 0,
    report_narrative TEXT,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS budget_items (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id),
    item_code TEXT,
    description TEXT,
    budget_usd REAL,
    committed_usd REAL,
    spent_usd REAL,
    forecast_usd REAL,
    variance_usd REAL,
    variance_pct REAL,
    category TEXT
);

CREATE TABLE IF NOT EXISTS variations (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id),
    variation_no TEXT,
    description TEXT,
    value_usd REAL,
    direction TEXT,
    status TEXT,
    submitted_date TEXT,
    approved_date TEXT,
    approved_by TEXT,
    reason TEXT
);

CREATE TABLE IF NOT EXISTS contractors (
    id TEXT PRIMARY KEY,
    company_name TEXT,
    registration_no TEXT,
    country TEXT,
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    classification TEXT,
    active_projects INTEGER,
    performance_score REAL
);

CREATE TABLE IF NOT EXISTS payment_certificates (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id),
    certificate_no INTEGER,
    period_from TEXT,
    period_to TEXT,
    works_value REAL,
    materials_on_site REAL,
    gross_amount REAL,
    retention_pct REAL,
    retention_amount REAL,
    net_certificate REAL,
    cumulative_certified REAL,
    balance_to_complete REAL,
    status TEXT,
    submitted_date TEXT,
    approved_date TEXT,
    paid_date TEXT
);
"""


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _conn() as conn:
        conn.executescript(SCHEMA)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row else None


def _rows_to_list(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(r) for r in rows]


def create_project(data: dict[str, Any]) -> dict[str, Any]:
    init_db()
    pid = data.get("id") or f"PRJ-{uuid.uuid4().hex[:8].upper()}"
    now = _now()
    with _conn() as conn:
        conn.execute(
            """INSERT INTO projects (
                id, project_name, project_code, project_type, country_code, province, district,
                constituency, gps_lat, gps_lon, contract_value_usd, contract_value_local,
                currency, funding_source, contractor_name, consultant_name, contract_date,
                commencement_date, original_completion, revised_completion, actual_completion,
                status, completion_pct, is_flagged, flag_reason, created_at, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                pid,
                data["project_name"],
                data.get("project_code", pid),
                data.get("project_type", "building"),
                data.get("country_code", "ZM"),
                data.get("province", ""),
                data.get("district", ""),
                data.get("constituency", ""),
                data.get("gps_lat"),
                data.get("gps_lon"),
                float(data.get("contract_value_usd", 0)),
                float(data.get("contract_value_local", 0)),
                data.get("currency", "USD"),
                data.get("funding_source", "GRZ"),
                data.get("contractor_name", ""),
                data.get("consultant_name", ""),
                data.get("contract_date", ""),
                data.get("commencement_date", ""),
                data.get("original_completion", ""),
                data.get("revised_completion", ""),
                data.get("actual_completion", ""),
                data.get("status", "active"),
                float(data.get("completion_pct", 0)),
                int(data.get("is_flagged", 0)),
                data.get("flag_reason", ""),
                now,
                now,
            ),
        )
    return get_project(pid) or {}


def list_projects(filters: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    init_db()
    filters = filters or {}
    query = "SELECT * FROM projects WHERE 1=1"
    params: list[Any] = []
    if filters.get("status"):
        query += " AND status = ?"
        params.append(filters["status"])
    if filters.get("province"):
        query += " AND province = ?"
        params.append(filters["province"])
    if filters.get("project_type"):
        query += " AND project_type = ?"
        params.append(filters["project_type"])
    query += " ORDER BY updated_at DESC"
    with _conn() as conn:
        rows = conn.execute(query, params).fetchall()
    return _rows_to_list(rows)


def get_project(project_id: str) -> dict[str, Any] | None:
    init_db()
    with _conn() as conn:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    project = _row_to_dict(row)
    if not project:
        return None
    project["evm"] = compute_evm(project_id)
    return project


def update_project(project_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    init_db()
    existing = get_project(project_id)
    if not existing:
        return None
    fields = [
        "project_name", "project_code", "project_type", "country_code", "province", "district",
        "constituency", "gps_lat", "gps_lon", "contract_value_usd", "contract_value_local",
        "currency", "funding_source", "contractor_name", "consultant_name", "contract_date",
        "commencement_date", "original_completion", "revised_completion", "actual_completion",
        "status", "completion_pct", "is_flagged", "flag_reason",
    ]
    updates = {k: data[k] for k in fields if k in data}
    if not updates:
        return existing
    updates["updated_at"] = _now()
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    with _conn() as conn:
        conn.execute(
            f"UPDATE projects SET {set_clause} WHERE id = ?",
            (*updates.values(), project_id),
        )
    return get_project(project_id)


def add_snapshot(project_id: str, data: dict[str, Any]) -> dict[str, Any]:
    init_db()
    sid = data.get("id") or f"SNP-{uuid.uuid4().hex[:8]}"
    now = _now()
    completion = float(data.get("completion_pct", 0))
    expenditure = float(data.get("expenditure_usd", 0))
    with _conn() as conn:
        conn.execute(
            """INSERT INTO progress_snapshots (
                id, project_id, snapshot_date, completion_pct, expenditure_usd, expenditure_pct,
                milestones_achieved, milestones_pending, issues_reported, variations_logged,
                certificate_no, certified_amount, certified_by, photo_count, report_narrative, created_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                sid,
                project_id,
                data.get("snapshot_date", now[:10]),
                completion,
                expenditure,
                float(data.get("expenditure_pct", 0)),
                json.dumps(data.get("milestones_achieved", [])),
                json.dumps(data.get("milestones_pending", [])),
                json.dumps(data.get("issues_reported", [])),
                json.dumps(data.get("variations_logged", [])),
                data.get("certificate_no", ""),
                float(data.get("certified_amount", 0)),
                data.get("certified_by", ""),
                int(data.get("photo_count", 0)),
                data.get("report_narrative", ""),
                now,
            ),
        )
        conn.execute(
            "UPDATE projects SET completion_pct = ?, updated_at = ? WHERE id = ?",
            (completion, now, project_id),
        )
    return get_snapshots(project_id)[-1]


def get_snapshots(project_id: str) -> list[dict[str, Any]]:
    init_db()
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM progress_snapshots WHERE project_id = ? ORDER BY snapshot_date",
            (project_id,),
        ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        for key in ("milestones_achieved", "milestones_pending", "issues_reported", "variations_logged"):
            try:
                d[key] = json.loads(d[key] or "[]")
            except json.JSONDecodeError:
                d[key] = []
        result.append(d)
    return result


def add_variation(project_id: str, data: dict[str, Any]) -> dict[str, Any]:
    init_db()
    vid = data.get("id") or f"VAR-{uuid.uuid4().hex[:6].upper()}"
    with _conn() as conn:
        conn.execute(
            """INSERT INTO variations (
                id, project_id, variation_no, description, value_usd, direction, status,
                submitted_date, approved_date, approved_by, reason
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (
                vid,
                project_id,
                data.get("variation_no", vid),
                data.get("description", ""),
                float(data.get("value_usd", 0)),
                data.get("direction", "addition"),
                data.get("status", "pending"),
                data.get("submitted_date", _now()[:10]),
                data.get("approved_date", ""),
                data.get("approved_by", ""),
                data.get("reason", ""),
            ),
        )
        row = conn.execute("SELECT * FROM variations WHERE id = ?", (vid,)).fetchone()
    return dict(row) if row else {}


def get_variations(project_id: str) -> list[dict[str, Any]]:
    init_db()
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM variations WHERE project_id = ? ORDER BY submitted_date",
            (project_id,),
        ).fetchall()
    return _rows_to_list(rows)


def add_certificate(project_id: str, data: dict[str, Any]) -> dict[str, Any]:
    init_db()
    cid = data.get("id") or f"CERT-{uuid.uuid4().hex[:8]}"
    with _conn() as conn:
        conn.execute(
            """INSERT INTO payment_certificates (
                id, project_id, certificate_no, period_from, period_to, works_value,
                materials_on_site, gross_amount, retention_pct, retention_amount, net_certificate,
                cumulative_certified, balance_to_complete, status, submitted_date, approved_date, paid_date
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                cid,
                project_id,
                int(data.get("certificate_no", 1)),
                data.get("period_from", ""),
                data.get("period_to", ""),
                float(data.get("works_value", 0)),
                float(data.get("materials_on_site", 0)),
                float(data.get("gross_amount", 0)),
                float(data.get("retention_pct", 10)),
                float(data.get("retention_amount", 0)),
                float(data.get("net_certificate", 0)),
                float(data.get("cumulative_certified", 0)),
                float(data.get("balance_to_complete", 0)),
                data.get("status", "draft"),
                data.get("submitted_date", _now()[:10]),
                data.get("approved_date", ""),
                data.get("paid_date", ""),
            ),
        )
        row = conn.execute("SELECT * FROM payment_certificates WHERE id = ?", (cid,)).fetchone()
    return dict(row) if row else {}


def get_certificates(project_id: str) -> list[dict[str, Any]]:
    init_db()
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM payment_certificates WHERE project_id = ? ORDER BY certificate_no",
            (project_id,),
        ).fetchall()
    return _rows_to_list(rows)


def compute_evm(project_id: str) -> dict[str, Any]:
    project = get_project_raw(project_id)
    if not project:
        return {}
    snapshots = get_snapshots(project_id)
    budget = float(project.get("contract_value_usd") or 0)
    latest = snapshots[-1] if snapshots else None
    actual_pct = float(latest["completion_pct"]) if latest else float(project.get("completion_pct") or 0)
    ac = float(latest["expenditure_usd"]) if latest else budget * actual_pct / 100 * 0.95

    planned_pct = min(actual_pct + 5, 100) if actual_pct < 100 else 100
    pv = budget * planned_pct / 100
    ev = budget * actual_pct / 100
    cpi = ev / ac if ac > 0 else 1.0
    spi = ev / pv if pv > 0 else 1.0
    eac = budget / cpi if cpi > 0 else budget
    vac = budget - eac

    status = "ON TRACK"
    if cpi < 0.90 or spi < 0.90:
        status = "CRITICAL"
    elif cpi < 0.95 or spi < 0.95:
        status = "WARNING"

    return {
        "PV": round(pv, 0),
        "EV": round(ev, 0),
        "AC": round(ac, 0),
        "CV": round(ev - ac, 0),
        "SV": round(ev - pv, 0),
        "CPI": round(cpi, 3),
        "SPI": round(spi, 3),
        "EAC": round(eac, 0),
        "ETC": round(max(0, eac - ac), 0),
        "VAC": round(vac, 0),
        "status": status,
        "forecast_overrun_usd": round(max(0, eac - budget), 0),
    }


def get_project_raw(project_id: str) -> dict[str, Any] | None:
    init_db()
    with _conn() as conn:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    return _row_to_dict(row)


def seed_demo_projects() -> list[dict[str, Any]]:
    """Seed 3 test projects for verification."""
    init_db()
    existing = list_projects()
    if existing:
        return existing
    projects = [
        {
            "project_name": "Ndola-Lusaka Road Section A",
            "project_code": "PRJ-ROAD-001",
            "project_type": "road",
            "province": "Central",
            "contract_value_usd": 5_000_000,
            "funding_source": "World_Bank",
            "status": "active",
            "completion_pct": 60,
            "commencement_date": "2024-01-01",
            "original_completion": "2026-12-31",
            "contractor_name": "Zambia Roads Ltd",
        },
        {
            "project_name": "Mongu District Hospital",
            "project_code": "PRJ-BLD-002",
            "project_type": "building",
            "province": "Western",
            "contract_value_usd": 2_000_000,
            "funding_source": "GRZ",
            "status": "active",
            "completion_pct": 40,
            "commencement_date": "2024-06-01",
            "original_completion": "2025-12-31",
            "revised_completion": "2026-06-30",
            "contractor_name": "BuildCo Zambia",
        },
        {
            "project_name": "Choma Water Supply Upgrade",
            "project_code": "PRJ-WAT-003",
            "project_type": "water_wash",
            "province": "Southern",
            "contract_value_usd": 1_000_000,
            "funding_source": "AfDB",
            "status": "active",
            "completion_pct": 80,
            "commencement_date": "2024-03-01",
            "original_completion": "2026-03-31",
            "contractor_name": "AquaTech Ltd",
        },
    ]
    created = []
    for p in projects:
        proj = create_project(p)
        created.append(proj)
        pid = proj["id"]
        add_snapshot(pid, {
            "completion_pct": p["completion_pct"],
            "expenditure_usd": p["contract_value_usd"] * p["completion_pct"] / 100 * 0.95,
            "expenditure_pct": p["completion_pct"] * 0.95,
        })
    return created
