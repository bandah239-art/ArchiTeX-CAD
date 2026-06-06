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
    certificate_ref TEXT,
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
    paid_date TEXT,
    approved_by_engineer TEXT,
    approved_by_client TEXT
);

CREATE TABLE IF NOT EXISTS baseline_programme (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id),
    month_index INTEGER,
    planned_pct REAL,
    planned_value_usd REAL
);

CREATE TABLE IF NOT EXISTS status_change_log (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id),
    old_status TEXT,
    new_status TEXT,
    changed_by TEXT,
    notes TEXT,
    changed_at TEXT
);
"""


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _conn() as conn:
        conn.executescript(SCHEMA)
        _migrate_schema(conn)


def _migrate_schema(conn: sqlite3.Connection) -> None:
    """Add columns introduced after initial deploy."""
    cols = {row[1] for row in conn.execute("PRAGMA table_info(payment_certificates)").fetchall()}
    if "certificate_ref" not in cols:
        conn.execute("ALTER TABLE payment_certificates ADD COLUMN certificate_ref TEXT")
    if "approved_by_engineer" not in cols:
        conn.execute("ALTER TABLE payment_certificates ADD COLUMN approved_by_engineer TEXT")
    if "approved_by_client" not in cols:
        conn.execute("ALTER TABLE payment_certificates ADD COLUMN approved_by_client TEXT")


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
    status = data.get("status", "construction")
    if status == "active":
        status = "construction"
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
                data.get("currency", "ZMW"),
                data.get("funding_source", "GRZ"),
                data.get("contractor_name", ""),
                data.get("consultant_name", ""),
                data.get("contract_date", ""),
                data.get("commencement_date", ""),
                data.get("original_completion", ""),
                data.get("revised_completion", ""),
                data.get("actual_completion", ""),
                status,
                float(data.get("completion_pct", 0)),
                int(data.get("is_flagged", 0)),
                data.get("flag_reason", ""),
                now,
                now,
            ),
        )
        conn.execute(
            """INSERT INTO status_change_log (id, project_id, old_status, new_status, changed_by, notes, changed_at)
               VALUES (?,?,?,?,?,?,?)""",
            (f"LOG-{uuid.uuid4().hex[:8]}", pid, "", status, data.get("changed_by", "system"), "Project registered", now),
        )
    ensure_baseline_programme(pid)
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
    if filters.get("funding_source"):
        query += " AND funding_source = ?"
        params.append(filters["funding_source"])
    if filters.get("search"):
        query += " AND (project_name LIKE ? OR project_code LIKE ? OR contractor_name LIKE ?)"
        term = f"%{filters['search']}%"
        params.extend([term, term, term])
    if filters.get("min_value_usd") is not None:
        query += " AND contract_value_usd >= ?"
        params.append(float(filters["min_value_usd"]))
    if filters.get("max_value_usd") is not None:
        query += " AND contract_value_usd <= ?"
        params.append(float(filters["max_value_usd"]))
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
    existing = get_project_raw(project_id)
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
    if "status" in updates and updates["status"] == "active":
        updates["status"] = "construction"
    if not updates:
        return get_project(project_id)
    if "status" in updates and updates["status"] != existing.get("status"):
        log_status_change(
            project_id,
            str(existing.get("status") or ""),
            str(updates["status"]),
            data.get("changed_by", "user"),
            data.get("status_notes", ""),
        )
    updates["updated_at"] = _now()
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    with _conn() as conn:
        conn.execute(
            f"UPDATE projects SET {set_clause} WHERE id = ?",
            (*updates.values(), project_id),
        )
    if any(k in updates for k in ("commencement_date", "original_completion", "contract_value_usd")):
        ensure_baseline_programme(project_id, force=True)
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
                id, project_id, certificate_no, certificate_ref, period_from, period_to, works_value,
                materials_on_site, gross_amount, retention_pct, retention_amount, net_certificate,
                cumulative_certified, balance_to_complete, status, submitted_date, approved_date, paid_date,
                approved_by_engineer, approved_by_client
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                cid,
                project_id,
                int(data.get("certificate_no", 1)),
                data.get("certificate_ref", ""),
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
                data.get("approved_by_engineer", ""),
                data.get("approved_by_client", ""),
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
    from government.evm_engine import compute_evm_enhanced
    return compute_evm_enhanced(project_id)


def log_status_change(
    project_id: str,
    old_status: str,
    new_status: str,
    changed_by: str = "user",
    notes: str = "",
) -> dict[str, Any]:
    init_db()
    lid = f"LOG-{uuid.uuid4().hex[:8]}"
    now = _now()
    with _conn() as conn:
        conn.execute(
            """INSERT INTO status_change_log (id, project_id, old_status, new_status, changed_by, notes, changed_at)
               VALUES (?,?,?,?,?,?,?)""",
            (lid, project_id, old_status, new_status, changed_by, notes, now),
        )
        row = conn.execute("SELECT * FROM status_change_log WHERE id = ?", (lid,)).fetchone()
    return dict(row) if row else {}


def get_status_log(project_id: str) -> list[dict[str, Any]]:
    init_db()
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM status_change_log WHERE project_id = ? ORDER BY changed_at DESC",
            (project_id,),
        ).fetchall()
    return _rows_to_list(rows)


def ensure_baseline_programme(project_id: str, force: bool = False) -> list[dict[str, Any]]:
    """Generate S-curve baseline programme (monthly planned %)."""
    import math
    init_db()
    existing = get_baseline_programme(project_id)
    if existing and not force:
        return existing

    project = get_project_raw(project_id)
    if not project:
        return []

    def _months_between(start: str, end: str) -> int:
        from government.evm_engine import _months_between as mb
        return mb(start, end)

    total = _months_between(project.get("commencement_date", ""), project.get("original_completion", ""))
    budget = float(project.get("contract_value_usd") or 0)

    with _conn() as conn:
        if force:
            conn.execute("DELETE FROM baseline_programme WHERE project_id = ?", (project_id,))
        rows = []
        for m in range(total + 1):
            t = m / max(total, 1)
            pct = 100 / (1 + math.exp(-10 * (t - 0.5)))
            bid = f"BL-{uuid.uuid4().hex[:8]}"
            val = budget * pct / 100
            conn.execute(
                """INSERT INTO baseline_programme (id, project_id, month_index, planned_pct, planned_value_usd)
                   VALUES (?,?,?,?,?)""",
                (bid, project_id, m, round(pct, 2), round(val, 0)),
            )
            rows.append({"id": bid, "project_id": project_id, "month_index": m, "planned_pct": pct, "planned_value_usd": val})
    return rows


def get_baseline_programme(project_id: str) -> list[dict[str, Any]]:
    init_db()
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM baseline_programme WHERE project_id = ? ORDER BY month_index",
            (project_id,),
        ).fetchall()
    return _rows_to_list(rows)


def update_certificate_status(
    project_id: str,
    certificate_id: str,
    status: str,
    approved_by: str = "",
    role: str = "engineer",
) -> dict[str, Any] | None:
    init_db()
    now = _now()
    with _conn() as conn:
        row = conn.execute(
            "SELECT * FROM payment_certificates WHERE id = ? AND project_id = ?",
            (certificate_id, project_id),
        ).fetchone()
        if not row:
            return None
        cert = dict(row)
        updates: dict[str, Any] = {"status": status}
        if role == "engineer" and approved_by:
            updates["approved_by_engineer"] = approved_by
            if status == "engineer_approved":
                updates["status"] = "engineer_approved"
        if role == "client" and approved_by:
            updates["approved_by_client"] = approved_by
            if status in ("approved", "ready_for_payment"):
                updates["status"] = "ready_for_payment"
                updates["approved_date"] = now[:10]
        if status == "paid":
            updates["paid_date"] = now[:10]
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(
            f"UPDATE payment_certificates SET {set_clause} WHERE id = ?",
            (*updates.values(), certificate_id),
        )
        updated = conn.execute("SELECT * FROM payment_certificates WHERE id = ?", (certificate_id,)).fetchone()
    return dict(updated) if updated else None


def export_register_csv(filters: dict[str, Any] | None = None) -> str:
    """Ministry-format CSV export of project register."""
    import csv
    import io
    projects = list_projects(filters)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Reference", "Project Name", "Province", "District", "Sector", "Status",
        "Contract Value (USD)", "Contract Value (Local)", "Currency", "Funding Source",
        "Contractor", "Consultant", "Commencement", "Completion", "Completion %",
        "GPS Lat", "GPS Lon", "CPI", "SPI", "EVM Status",
    ])
    for p in projects:
        evm = compute_evm(p["id"])
        writer.writerow([
            p.get("project_code", ""),
            p.get("project_name", ""),
            p.get("province", ""),
            p.get("district", ""),
            p.get("project_type", ""),
            p.get("status", ""),
            p.get("contract_value_usd", 0),
            p.get("contract_value_local", 0),
            p.get("currency", "ZMW"),
            p.get("funding_source", ""),
            p.get("contractor_name", ""),
            p.get("consultant_name", ""),
            p.get("commencement_date", ""),
            p.get("original_completion", ""),
            p.get("completion_pct", 0),
            p.get("gps_lat", ""),
            p.get("gps_lon", ""),
            evm.get("CPI", ""),
            evm.get("SPI", ""),
            evm.get("status", ""),
        ])
    return buf.getvalue()


def _compute_evm_legacy(project_id: str) -> dict[str, Any]:
    """Legacy heuristic EVM — kept for reference only."""
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
            "status": "construction",
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
            "status": "construction",
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
            "status": "construction",
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
        ensure_baseline_programme(pid)
    return created
