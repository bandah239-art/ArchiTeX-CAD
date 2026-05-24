"""Government reporting engine."""

from datetime import datetime
from typing import Any

from government.dashboard_engine import portfolio_summary
from government.portfolio_database import list_projects, seed_demo_projects


def _ensure_projects() -> list[dict[str, Any]]:
    projects = list_projects()
    return projects if projects else seed_demo_projects()


def generate_report(report_type: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = payload or {}
    projects = _ensure_projects()
    portfolio = portfolio_summary()
    summary = portfolio["summary"]
    period = payload.get("reporting_period", datetime.now().strftime("%B %Y"))
    country = payload.get("country", "Zambia")
    employer = payload.get("employer", "Ministry of Infrastructure, Housing and Urban Development")

    matrix_rows = []
    for p in projects:
        matrix_rows.append({
            "project": p["project_name"],
            "type": p.get("project_type"),
            "status": p.get("status"),
            "completion_pct": p.get("completion_pct"),
            "contract_usd": p.get("contract_value_usd"),
            "province": p.get("province"),
            "flagged": bool(p.get("is_flagged")),
        })

    base = {
        "status": "complete",
        "report_type": report_type,
        "reporting_period": period,
        "prepared_date": datetime.now().strftime("%Y-%m-%d"),
        "employer": employer,
        "country": country,
        "executive_summary": summary,
        "project_matrix": matrix_rows,
    }

    if report_type == "monthly-progress":
        content = f"""
MONTHLY INFRASTRUCTURE PROGRESS REPORT
{employer}
Republic of {country}

REPORTING PERIOD: {period}
DATE: {base['prepared_date']}

EXECUTIVE SUMMARY
Total Active Projects:    {summary['active_projects']}
Projects On Schedule:     {summary['projects_on_schedule']} ({round(summary['projects_on_schedule']/max(summary['active_projects'],1)*100)}%)
Projects Delayed:         {summary['projects_delayed']}
Projects Critical:        {summary['projects_critical']}
Budget Execution Rate:    {summary['average_completion_pct']}%
Cumulative Certified:     USD {summary['total_certified_usd']:,.0f}

PROJECT STATUS MATRIX
{len(matrix_rows)} projects reported.

RECOMMENDED ACTIONS
- Review {summary['projects_critical']} critical project(s)
- Approve pending payment certificates
- Update revised completion dates for delayed projects
"""
        base["content"] = content.strip()
        return base

    if report_type == "quarterly-summary":
        base["content"] = f"QUARTERLY SUMMARY — {period}\nTotal portfolio value USD {summary['total_contract_value_usd']:,.0f}\n{len(projects)} projects across {len(portfolio['by_province'])} provinces."
        return base

    if report_type == "donor-report":
        wb = portfolio["by_funding_source"].get("World_Bank", {"count": 0, "value_usd": 0})
        afdb = portfolio["by_funding_source"].get("AfDB", {"count": 0, "value_usd": 0})
        base["content"] = f"DONOR REPORT\nWorld Bank: {wb['count']} projects, USD {wb['value_usd']:,.0f}\nAfDB: {afdb['count']} projects, USD {afdb['value_usd']:,.0f}"
        base["donor_sections"] = {"World_Bank": wb, "AfDB": afdb}
        return base

    if report_type == "ministerial-brief":
        base["content"] = f"MINISTERIAL BRIEF — {period}\n{summary['active_projects']} active projects. {summary['projects_critical']} require ministerial attention. Portfolio USD {summary['total_contract_value_usd']:,.0f}."
        return base

    if report_type == "budget-execution":
        base["content"] = f"BUDGET EXECUTION REPORT\nExpenditure rate: {summary['weighted_expenditure_pct']}%\nCPI: {summary['cost_performance_index']}\nSPI: {summary['schedule_performance_index']}"
        return base

    return {"error": f"Unknown report type: {report_type}"}
