"""Project tracking: S-curve, EVM, cashflow."""

import math
from datetime import datetime
from typing import Any

from government.evm_engine import EVM_ALERT_THRESHOLD, evm_monthly_series
from government.portfolio_database import (
    add_certificate,
    add_snapshot,
    add_variation,
    compute_evm,
    create_project,
    get_certificates,
    get_project,
    get_project_raw,
    get_snapshots,
    get_status_log,
    get_baseline_programme,
    get_variations,
    list_projects,
    update_project,
)


def _parse_date(d: str) -> datetime | None:
    if not d:
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(d[:10], fmt)
        except ValueError:
            continue
    return None


def _months_between(start: str, end: str) -> int:
    s, e = _parse_date(start), _parse_date(end)
    if not s or not e:
        return 12
    return max(1, (e.year - s.year) * 12 + e.month - s.month)


def generate_s_curve(project_id: str) -> dict[str, Any]:
    project = get_project_raw(project_id)
    if not project:
        return {"error": "Project not found"}
    snapshots = get_snapshots(project_id)
    total_months = _months_between(project.get("commencement_date", ""), project.get("original_completion", ""))
    contract = float(project.get("contract_value_usd") or 0)

    planned = []
    for m in range(total_months + 1):
        t = m / max(total_months, 1)
        planned_pct = 100 / (1 + math.exp(-10 * (t - 0.5)))
        planned.append({
            "month": m,
            "planned_pct": round(planned_pct, 1),
            "planned_expenditure": round(contract * planned_pct / 100, 0),
        })

    actual = []
    for s in snapshots:
        month = _months_between(project.get("commencement_date", ""), s.get("snapshot_date", ""))
        actual.append({
            "month": month,
            "actual_pct": float(s.get("completion_pct") or 0),
            "actual_expenditure": float(s.get("expenditure_usd") or 0),
        })

    spi = 1.0
    if snapshots and planned:
        latest = snapshots[-1]
        months_elapsed = _months_between(project.get("commencement_date", ""), latest.get("snapshot_date", ""))
        idx = min(months_elapsed, len(planned) - 1)
        planned_at = planned[idx]["planned_pct"]
        if planned_at > 0:
            spi = round(float(latest["completion_pct"]) / planned_at, 3)

    evm_series = evm_monthly_series(project_id)
    return {
        "project_id": project_id,
        "planned": planned,
        "actual": actual,
        "evm_series": evm_series,
        "spi": spi,
        "forecast_completion": project.get("revised_completion") or project.get("original_completion"),
    }


def analyse_budget_variance(project_id: str) -> dict[str, Any]:
    return compute_evm(project_id)


def cashflow_projection(project_id: str) -> dict[str, Any]:
    project = get_project_raw(project_id)
    if not project:
        return {"error": "Project not found"}
    contract = float(project.get("contract_value_usd") or 0)
    months = _months_between(project.get("commencement_date", ""), project.get("original_completion", ""))
    monthly = contract / max(months, 1)
    certs = get_certificates(project_id)
    approved = [c for c in certs if c.get("status") in ("approved", "paid", "ready_for_payment")]
    actual_spend = float(approved[-1]["cumulative_certified"]) if approved else 0.0
    elapsed = _months_elapsed(project.get("commencement_date", ""))
    burn = actual_spend / max(elapsed, 1)
    forecast_total = actual_spend + burn * max(0, months - elapsed)
    deficit_alert = forecast_total > contract * 1.05
    return {
        "project_id": project_id,
        "contract_value_usd": contract,
        "months": months,
        "monthly_forecast_usd": round(monthly, 0),
        "actual_spend_usd": round(actual_spend, 0),
        "forecast_to_complete_usd": round(forecast_total, 0),
        "cash_deficit_alert": deficit_alert,
        "cashflow": [
            {"month": m, "planned_disbursement_usd": round(monthly * (m / max(months, 1)), 0)}
            for m in range(1, months + 1)
        ],
    }


def _months_elapsed(commencement: str, as_of: str | None = None) -> int:
    from government.evm_engine import _months_elapsed as me
    return me(commencement, as_of)


def get_project_detail(project_id: str) -> dict[str, Any]:
    project = get_project(project_id)
    if not project:
        return {"error": "Project not found"}
    return {
        **project,
        "snapshots": get_snapshots(project_id),
        "variations": get_variations(project_id),
        "certificates": get_certificates(project_id),
        "status_log": get_status_log(project_id),
        "baseline": get_baseline_programme(project_id),
        "s_curve": generate_s_curve(project_id),
        "evm": analyse_budget_variance(project_id),
        "cashflow": cashflow_projection(project_id),
    }
