"""Verification tests for Blueprint 8 — Government, Documents, Mobile calcs."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from government.dashboard_engine import portfolio_summary
from government.payment_certificates import generate_certificate
from government.portfolio_database import DB_PATH, init_db, seed_demo_projects
from mobile.quick_calculators import concrete_mix

PASS = 0
FAIL = 0


def check(label: str, ok: bool, detail: str = "") -> None:
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"  PASS  {label}" + (f" — {detail}" if detail else ""))
    else:
        FAIL += 1
        print(f"  FAIL  {label}" + (f" — {detail}" if detail else ""))


def test_portfolio() -> None:
    print("\n=== Government Portfolio Dashboard ===")
    if DB_PATH.exists():
        DB_PATH.unlink()
    init_db()
    seed_demo_projects()
    result = portfolio_summary()
    s = result["summary"]
    check("Total value USD 8M", s["total_contract_value_usd"] == 8_000_000, f"USD {s['total_contract_value_usd']:,.0f}")
    check("On schedule 2", s["projects_on_schedule"] == 2, str(s["projects_on_schedule"]))
    check("Delayed 1", s["projects_delayed"] == 1, str(s["projects_delayed"]))
    check("Avg completion 60%", abs(s["average_completion_pct"] - 60) < 0.5, f"{s['average_completion_pct']}%")
    critical = [a for a in result.get("alerts", []) if a.get("severity") == "CRITICAL"]
    check("No critical alerts", len(critical) == 0, f"{len(critical)} critical")


def test_payment_certificate() -> None:
    print("\n=== Payment Certificate ===")
    init_db()
    projects = seed_demo_projects()
    if not projects:
        from government.portfolio_database import list_projects
        projects = list_projects()
    road = next(p for p in projects if p.get("project_type") == "road")
    result = generate_certificate(road["id"], {
        "contract_value_usd": 5_000_000,
        "previous_cumulative_gross_usd": 2_500_000,
        "works_value_usd": 380_000,
        "materials_on_site_usd": 45_000,
        "retention_pct": 10,
    })
    c = result["calculations"]
    check("Cumulative gross USD 2,925,000", c["cumulative_gross_usd"] == 2_925_000)
    check("Retention USD 292,500", c["retention_usd"] == 292_500)
    check("Cumulative net USD 2,632,500", c["cumulative_net_usd"] == 2_632_500)
    check("Previous net USD 2,250,000", c["previous_net_usd"] == 2_250_000)
    check("Certificate USD 382,500", c["certificate_amount_usd"] == 382_500)
    check("% complete 58.5%", abs(c["pct_complete"] - 58.5) < 0.1, f"{c['pct_complete']}%")


def test_mobile_concrete() -> None:
    print("\n=== Mobile Quick Calculator ===")
    r = concrete_mix("C25", 5.0)
    check("Cement 17.5 bags", r["cement_bags_50kg"] == 17.5, str(r["cement_bags_50kg"]))
    check("Sand 0.75 m3", r["sand_m3"] == 0.75, str(r["sand_m3"]))
    check("Aggregate 1.50 m3", r["aggregate_m3"] == 1.50, str(r["aggregate_m3"]))
    check("Water 292 litres", 290 <= r["water_litres"] <= 295, str(r["water_litres"]))


if __name__ == "__main__":
    print("InfraAfrica Blueprint 8 Verification")
    test_portfolio()
    test_payment_certificate()
    test_mobile_concrete()
    print(f"\n{'=' * 40}")
    print(f"Results: {PASS} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)
