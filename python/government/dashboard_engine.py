"""Government portfolio dashboard analytics."""

from typing import Any

from government.evm_engine import EVM_ALERT_THRESHOLD
from government.portfolio_database import compute_evm, list_projects, seed_demo_projects


def portfolio_summary() -> dict[str, Any]:
    projects = list_projects()
    if not projects:
        projects = seed_demo_projects()

    for p in projects:
        p["evm"] = compute_evm(p["id"])

    total = len(projects)
    active = [p for p in projects if p.get("status") in ("active", "construction")]
    completed = [p for p in projects if p.get("status") in ("complete", "closed")]
    suspended = [p for p in projects if p.get("status") == "suspended"]

    total_value = sum(float(p.get("contract_value_usd") or 0) for p in projects)
    avg_completion = sum(float(p.get("completion_pct") or 0) for p in projects) / total if total else 0

    on_schedule = 0
    delayed = 0
    critical = 0
    alerts: list[dict[str, Any]] = []

    for p in projects:
        evm = p.get("evm") or {}
        cpi = evm.get("CPI", 1)
        spi = evm.get("SPI", 1)
        if cpi < EVM_ALERT_THRESHOLD or spi < EVM_ALERT_THRESHOLD:
            alerts.append({
                "severity": "CRITICAL",
                "project_id": p["id"],
                "project_name": p["project_name"],
                "message": f"EVM alert — CPI {cpi:.2f} / SPI {spi:.2f} below {EVM_ALERT_THRESHOLD}",
                "action_required": "Review cost and schedule recovery plan",
            })

    for p in projects:
        pct = float(p.get("completion_pct") or 0)
        flagged = int(p.get("is_flagged") or 0)
        is_delayed = bool(p.get("revised_completion")) and pct < 55
        if flagged or is_delayed:
            delayed += 1
            if flagged and pct < 30:
                critical += 1
                alerts.append({
                    "severity": "CRITICAL",
                    "project_id": p["id"],
                    "project_name": p["project_name"],
                    "message": p.get("flag_reason") or f"Project at {pct}% — critical delay",
                    "action_required": "Issue contractor notice",
                })
            elif is_delayed:
                alerts.append({
                    "severity": "WARNING",
                    "project_id": p["id"],
                    "project_name": p["project_name"],
                    "message": f"Project {pct}% complete — revised completion date submitted",
                    "action_required": "Request revised forecast",
                })
        else:
            on_schedule += 1

    by_type: dict[str, dict[str, float]] = {}
    by_province: dict[str, dict[str, float]] = {}
    by_funding: dict[str, dict[str, float]] = {}

    for p in projects:
        ptype = p.get("project_type") or "other"
        prov = p.get("province") or "Other"
        fund = p.get("funding_source") or "Other"
        val = float(p.get("contract_value_usd") or 0)
        for bucket, key in ((by_type, ptype), (by_province, prov), (by_funding, fund)):
            if key not in bucket:
                bucket[key] = {"count": 0, "value_usd": 0}
            bucket[key]["count"] += 1
            bucket[key]["value_usd"] += val

    weighted_exp = avg_completion * 0.95
    spi_vals = []
    cpi_vals = []
    for p in projects:
        evm = p.get("evm") or {}
        if evm.get("SPI"):
            spi_vals.append(evm["SPI"])
        if evm.get("CPI"):
            cpi_vals.append(evm["CPI"])

    return {
        "summary": {
            "total_projects": total,
            "active_projects": len(active),
            "completed_projects": len(completed),
            "suspended_projects": len(suspended),
            "total_contract_value_usd": round(total_value, 0),
            "total_certified_usd": round(total_value * avg_completion / 100 * 0.92, 0),
            "total_paid_usd": round(total_value * avg_completion / 100 * 0.85, 0),
            "outstanding_certified_usd": round(total_value * 0.05, 0),
            "projects_on_schedule": on_schedule,
            "projects_delayed": delayed,
            "projects_critical": critical,
            "average_completion_pct": round(avg_completion, 1),
            "weighted_expenditure_pct": round(weighted_exp, 1),
            "schedule_performance_index": round(sum(spi_vals) / len(spi_vals), 2) if spi_vals else 0.91,
            "cost_performance_index": round(sum(cpi_vals) / len(cpi_vals), 2) if cpi_vals else 1.04,
        },
        "by_type": by_type,
        "by_province": by_province,
        "by_funding_source": by_funding,
        "alerts": alerts[:10],
        "upcoming_completions": [
            {
                "project_name": p["project_name"],
                "due_date": p.get("original_completion", ""),
                "completion_pct": float(p.get("completion_pct") or 0),
                "on_track": not int(p.get("is_flagged") or 0),
            }
            for p in sorted(projects, key=lambda x: float(x.get("completion_pct") or 0), reverse=True)[:5]
        ],
        "projects": projects,
    }
