"""SQLite-backed marketplace for materials, labour, equipment and carbon credits.

Real persistence layer (replaces the previous hardcoded listing stub). Supports
create / list / filter / get / delete plus first-run seeding so the UI is never
empty on a fresh install.
"""

from __future__ import annotations

import os
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any

_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "marketplace.db")

_VALID_TYPES = {"material", "labour", "equipment", "carbon_credit", "service"}

_SEED: list[dict[str, Any]] = [
    {"type": "material", "title": "C25 Concrete Supply", "price_usd": 95, "unit": "m³", "region": "ZM", "supplier": "Lafarge Zambia"},
    {"type": "material", "title": "Y12 Rebar (per tonne)", "price_usd": 850, "unit": "tonne", "region": "ZM", "supplier": "Trade Kings Steel"},
    {"type": "labour", "title": "Mason Crew (8hr)", "price_usd": 120, "unit": "day", "region": "ZM", "supplier": "BuildRight Labour"},
    {"type": "equipment", "title": "Excavator Hire", "price_usd": 450, "unit": "day", "region": "ZM", "supplier": "Zambia Plant Hire"},
    {"type": "carbon_credit", "title": "Verified Carbon Offset", "price_usd": 12, "unit": "tCO2e", "region": "ZM", "supplier": "Miombo Carbon"},
]


def _conn() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS listings (
            id          TEXT PRIMARY KEY,
            type        TEXT NOT NULL,
            title       TEXT NOT NULL,
            price_usd   REAL NOT NULL,
            unit        TEXT NOT NULL,
            region      TEXT NOT NULL DEFAULT 'ZM',
            supplier    TEXT,
            description TEXT,
            active      INTEGER NOT NULL DEFAULT 1,
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """
    )
    conn.commit()
    return conn


def _seed_if_empty(conn: sqlite3.Connection) -> None:
    count = conn.execute("SELECT COUNT(*) FROM listings").fetchone()[0]
    if count == 0:
        for row in _SEED:
            create_listing(row, conn=conn)


def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    d = dict(row)
    d["active"] = bool(d["active"])
    return d


def create_listing(listing: dict[str, Any], conn: sqlite3.Connection | None = None) -> dict[str, Any]:
    own = conn is None
    conn = conn or _conn()
    try:
        ltype = str(listing.get("type", "material"))
        if ltype not in _VALID_TYPES:
            raise ValueError(f"Invalid listing type '{ltype}'. Allowed: {sorted(_VALID_TYPES)}")
        price = float(listing.get("price_usd", 0))
        if price < 0:
            raise ValueError("price_usd must be >= 0")
        lid = listing.get("id") or f"L-{uuid.uuid4().hex[:10]}"
        conn.execute(
            """
            INSERT INTO listings (id, type, title, price_usd, unit, region, supplier, description, active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            ON CONFLICT(id) DO UPDATE SET
                type=excluded.type, title=excluded.title, price_usd=excluded.price_usd,
                unit=excluded.unit, region=excluded.region, supplier=excluded.supplier,
                description=excluded.description
            """,
            (
                lid, ltype, str(listing.get("title", "Untitled")), price,
                str(listing.get("unit", "unit")), str(listing.get("region", "ZM")),
                listing.get("supplier"), listing.get("description"),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM listings WHERE id = ?", (lid,)).fetchone()
        return _row_to_dict(row)
    finally:
        if own:
            conn.close()


def list_listings(
    region: str | None = None,
    listing_type: str | None = None,
    q: str | None = None,
    max_price: float | None = None,
) -> dict[str, Any]:
    conn = _conn()
    try:
        _seed_if_empty(conn)
        sql = "SELECT * FROM listings WHERE active = 1"
        params: list[Any] = []
        if region:
            sql += " AND region = ?"
            params.append(region)
        if listing_type:
            sql += " AND type = ?"
            params.append(listing_type)
        if q:
            sql += " AND (title LIKE ? OR supplier LIKE ?)"
            params += [f"%{q}%", f"%{q}%"]
        if max_price is not None:
            sql += " AND price_usd <= ?"
            params.append(max_price)
        sql += " ORDER BY type, price_usd"
        rows = [_row_to_dict(r) for r in conn.execute(sql, params).fetchall()]
        return {
            "status": "complete",
            "engine": "sqlite_marketplace",
            "count": len(rows),
            "filters": {"region": region, "type": listing_type, "q": q, "max_price": max_price},
            "listings": rows,
        }
    finally:
        conn.close()


def get_listing(listing_id: str) -> dict[str, Any] | None:
    conn = _conn()
    try:
        row = conn.execute("SELECT * FROM listings WHERE id = ?", (listing_id,)).fetchone()
        return _row_to_dict(row) if row else None
    finally:
        conn.close()


def delete_listing(listing_id: str) -> dict[str, Any]:
    conn = _conn()
    try:
        cur = conn.execute("UPDATE listings SET active = 0 WHERE id = ?", (listing_id,))
        conn.commit()
        return {"status": "complete", "deleted": cur.rowcount > 0, "id": listing_id}
    finally:
        conn.close()
