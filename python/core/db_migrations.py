"""
Lightweight SQLite migration runner for ARCHITEX-CAD.

Each database has a `schema_version` table that tracks the applied migration index.
Migrations are a plain list of SQL strings; to add a new migration, append to the list.

Usage:
    from core.db_migrations import run_migrations, PROJECTS_MIGRATIONS, REVIEWS_MIGRATIONS
    run_migrations(db_path, PROJECTS_MIGRATIONS)
"""

from __future__ import annotations

import sqlite3
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

from core.logging_config import get_logger

log = get_logger("architex.migrations")

# ---------------------------------------------------------------------------
# Migration definitions
# Each entry is a tuple: (description, sql_string_or_list_of_sql_strings)
# ---------------------------------------------------------------------------

PROJECTS_MIGRATIONS: list[tuple[str, str | list[str]]] = [
    (
        "initial schema — projects, calculations, documents",
        [
            """
            CREATE TABLE IF NOT EXISTS projects (
                id           TEXT PRIMARY KEY,
                name         TEXT NOT NULL,
                location     TEXT,
                engineer     TEXT,
                eiz_number   TEXT,
                client       TEXT,
                created_date TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """,
            """
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
            """,
            """
            CREATE TABLE IF NOT EXISTS documents (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id  TEXT NOT NULL,
                filename    TEXT NOT NULL,
                type        TEXT NOT NULL CHECK(type IN ('memo', 'boq', 'drawing', 'report', 'tender')),
                created_at  TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY(project_id) REFERENCES projects(id)
            )
            """,
        ],
    ),
    (
        "add updated_at and description to projects",
        [
            "ALTER TABLE projects ADD COLUMN description TEXT",
            "ALTER TABLE projects ADD COLUMN updated_at  TEXT",
        ],
    ),
    (
        "add GPS coordinates to projects",
        [
            "ALTER TABLE projects ADD COLUMN latitude  REAL",
            "ALTER TABLE projects ADD COLUMN longitude REAL",
        ],
    ),
    (
        "add status and contract_value to projects",
        [
            "ALTER TABLE projects ADD COLUMN status         TEXT DEFAULT 'active'",
            "ALTER TABLE projects ADD COLUMN contract_value REAL",
        ],
    ),
    (
        "add indexes for performance",
        [
            "CREATE INDEX IF NOT EXISTS idx_calculations_project ON calculations(project_id)",
            "CREATE INDEX IF NOT EXISTS idx_documents_project    ON documents(project_id)",
        ],
    ),
]


REVIEWS_MIGRATIONS: list[tuple[str, str | list[str]]] = [
    (
        "initial schema — step_reviews",
        """
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
        """,
    ),
    (
        "add index on project_id, calc_module for faster load",
        "CREATE INDEX IF NOT EXISTS idx_reviews_project_module ON step_reviews(project_id, calc_module)",
    ),
]


GOVERNMENT_MIGRATIONS: list[tuple[str, str | list[str]]] = [
    (
        "initial schema — government portfolio DB",
        [
            """
            CREATE TABLE IF NOT EXISTS projects (
                id              TEXT PRIMARY KEY,
                name            TEXT NOT NULL,
                province        TEXT,
                district        TEXT,
                sector          TEXT,
                contract_value  REAL,
                status          TEXT DEFAULT 'feasibility',
                created_at      TEXT DEFAULT (datetime('now'))
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS snapshots (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id  TEXT NOT NULL,
                period      TEXT NOT NULL,
                pv          REAL,
                ev          REAL,
                ac          REAL,
                recorded_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY(project_id) REFERENCES projects(id)
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS variations (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id  TEXT NOT NULL,
                vo_ref      TEXT,
                description TEXT,
                amount      REAL,
                approved_at TEXT,
                FOREIGN KEY(project_id) REFERENCES projects(id)
            )
            """,
        ],
    ),
    (
        "add funding_source and contractor to projects",
        [
            "ALTER TABLE projects ADD COLUMN funding_source TEXT",
            "ALTER TABLE projects ADD COLUMN contractor     TEXT",
            "ALTER TABLE projects ADD COLUMN consultant     TEXT",
        ],
    ),
]

# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def _ensure_version_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_version (
            version     INTEGER PRIMARY KEY,
            description TEXT,
            applied_at  TEXT NOT NULL
        )
        """
    )
    conn.commit()


def _current_version(conn: sqlite3.Connection) -> int:
    row = conn.execute("SELECT MAX(version) FROM schema_version").fetchone()
    return row[0] or 0


def _backup_before_migration(db_path: str) -> None:
    """Copy the database file to <name>.bak before running any migration."""
    src = Path(db_path)
    if not src.exists():
        return  # nothing to back up yet
    bak = src.with_suffix(".bak")
    try:
        shutil.copy2(src, bak)
        log.info("DB backup created: %s", bak)
    except Exception as exc:
        log.warning("Could not back up %s: %s", db_path, exc)


def run_migrations(
    db_path: str,
    migrations: list[tuple[str, str | list[str]]],
    *,
    backup: bool = True,
) -> int:
    """Apply pending migrations to *db_path*.  Returns number of new migrations applied."""
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")

    _ensure_version_table(conn)
    current = _current_version(conn)
    pending = migrations[current:]  # 0-indexed list, version stored is 1-based count applied

    if not pending:
        conn.close()
        return 0

    if backup:
        _backup_before_migration(db_path)

    applied = 0
    for idx, (description, sql) in enumerate(pending, start=current + 1):
        sqls = [sql] if isinstance(sql, str) else sql
        try:
            for statement in sqls:
                conn.execute(statement)
            conn.execute(
                "INSERT INTO schema_version (version, description, applied_at) VALUES (?, ?, ?)",
                (idx, description, datetime.now(timezone.utc).isoformat()),
            )
            conn.commit()
            applied += 1
            log.info("Migration %d applied: %s", idx, description)
        except sqlite3.OperationalError as exc:
            # Column already exists is acceptable (idempotent ALTER TABLE)
            if "duplicate column" in str(exc).lower() or "already exists" in str(exc).lower():
                conn.execute(
                    "INSERT OR IGNORE INTO schema_version (version, description, applied_at) VALUES (?, ?, ?)",
                    (idx, description + " [skipped — already exists]", datetime.now(timezone.utc).isoformat()),
                )
                conn.commit()
                applied += 1
                log.debug("Migration %d skipped (already applied): %s", idx, exc)
            else:
                log.error("Migration %d FAILED: %s — %s", idx, description, exc, exc_info=True)
                conn.close()
                raise

    conn.close()
    if applied:
        log.info("%s: %d migration(s) applied (now at version %d)", db_path, applied, current + applied)
    return applied


# ---------------------------------------------------------------------------
# Startup hook — call this from main.py lifespan
# ---------------------------------------------------------------------------

def run_all_migrations(data_dir: str) -> None:
    """Run migrations for all ARCHITEX-CAD databases."""
    from pathlib import Path
    base = Path(data_dir)

    run_migrations(str(base / "projects.db"), PROJECTS_MIGRATIONS)
    run_migrations(str(base / "reviews.db"), REVIEWS_MIGRATIONS)

    # Government portfolio DB lives in a different module directory
    gov_db = base.parent / "government" / "portfolio.db"
    if gov_db.parent.exists():
        run_migrations(str(gov_db), GOVERNMENT_MIGRATIONS)
