"""Earned Value Management engine — PV from baseline, AC from approved certificates."""

from __future__ import annotations

import math
from datetime import datetime
from typing import Any

from government.portfolio_database import (
    get_baseline_programme,
    get_certificates,
    get_project_raw,
    get_snapshots,
)

LIFECYCLE_STATUSES = (
    "feasibility",
    "design",
    "tender",
    "construction",
    "defects",
    "closed",
    "active",  # legacy alias → construction
    "complete",
    "suspended",
)

EVM_ALERT_THRESHOLD = 0.85


def _parse_date(d: str) -> datetime | None:
    if not d:
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(d[:10], fmt)
        except ValueError:
            continue
    return None


def _months_elapsed(commencement: str, as_of: str | None = None) -> int:
    start = _parse_date(commencement)
    if not start:
        return 0
    end = _parse_date(as_of) if as_of else datetime.now()
    if not end:
        return 0
    return max(0, (end.year - start.year) * 12 + end.month - start.month)


def _months_between(start: str, end: str) -> int:
    s, e = _parse_date(start), _parse_date(end)
    if not s or not e:
        return 12
    return max(1, (e.year - s.year) * 12 + e.month - s.month)


def _logistic_planned_pct(month: int, total_months: int) -> float:
    t = month / max(total_months, 1)
    return 100 / (1 + math.exp(-10 * (t - 0.5)))


def cumulative_approved_ac(project_id: str) -> float:
    """AC = cumulative net certified from approved/paid certificates."""
    certs = get_certificates(project_id)
    approved = [c for c in certs if c.get("status") in ("approved", "paid", "ready_for_payment")]
    if not approved:
        return 0.0
    latest = max(approved, key=lambda c: int(c.get("certificate_no") or 0))
    return float(latest.get("cumulative_certified") or 0)


def planned_value_at_month(project: dict[str, Any], month: int) -> float:
    budget = float(project.get("contract_value_usd") or 0)
    baseline = get_baseline_programme(project["id"])
    if baseline:
        row = next((b for b in baseline if int(b["month_index"]) == month), None)
        if row:
            return budget * float(row["planned_pct"]) / 100
    total = _months_between(project.get("commencement_date", ""), project.get("original_completion", ""))
    pct = _logistic_planned_pct(month, total)
    return budget * pct / 100


def compute_evm_enhanced(project_id: str) -> dict[str, Any]:
    project = get_project_raw(project_id)
    if not project:
        return {}

    snapshots = get_snapshots(project_id)
    budget = float(project.get("contract_value_usd") or 0)
    latest = snapshots[-1] if snapshots else None
    as_of = latest.get("snapshot_date") if latest else None
    actual_pct = float(latest["completion_pct"]) if latest else float(project.get("completion_pct") or 0)

    month = _months_elapsed(project.get("commencement_date", ""), as_of)
    pv = planned_value_at_month(project, month)
    ev = budget * actual_pct / 100
    ac = cumulative_approved_ac(project_id)
    if ac <= 0 and latest:
        ac = float(latest.get("expenditure_usd") or 0)

    cpi = ev / ac if ac > 0 else 1.0
    spi = ev / pv if pv > 0 else 1.0
    eac = budget / cpi if cpi > 0 else budget
    vac = budget - eac
    etc = max(0, eac - ac)

    status = "ON TRACK"
    if cpi < EVM_ALERT_THRESHOLD or spi < EVM_ALERT_THRESHOLD:
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
        "ETC": round(etc, 0),
        "VAC": round(vac, 0),
        "status": status,
        "forecast_overrun_usd": round(max(0, eac - budget), 0),
        "reporting_month": month,
        "completion_pct": round(actual_pct, 1),
    }


def evm_monthly_series(project_id: str) -> list[dict[str, Any]]:
    """Monthly PV / EV / AC series for S-curve and EVM chart."""
    project = get_project_raw(project_id)
    if not project:
        return []

    budget = float(project.get("contract_value_usd") or 0)
    total_months = _months_between(project.get("commencement_date", ""), project.get("original_completion", ""))
    snapshots = get_snapshots(project_id)
    certs = get_certificates(project_id)
    approved = [c for c in certs if c.get("status") in ("approved", "paid", "ready_for_payment")]

    series: list[dict[str, Any]] = []
    for m in range(total_months + 1):
        pv = planned_value_at_month(project, m)
        snap = next((s for s in snapshots if _months_elapsed(project.get("commencement_date", ""), s.get("snapshot_date")) == m), None)
        ev = budget * float(snap["completion_pct"]) / 100 if snap else 0.0

        ac = 0.0
        for c in approved:
            cm = _months_elapsed(project.get("commencement_date", ""), c.get("approved_date") or c.get("submitted_date"))
            if cm <= m:
                ac = max(ac, float(c.get("cumulative_certified") or 0))

        series.append({
            "month": m,
            "PV": round(pv, 0),
            "EV": round(ev, 0),
            "AC": round(ac, 0),
            "planned_pct": round(pv / budget * 100, 1) if budget else 0,
            "actual_pct": round(ev / budget * 100, 1) if budget and ev else 0,
        })

    return series
