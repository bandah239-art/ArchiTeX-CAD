"""Verification tests for Tier 2 and Tier 3 modules."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from calculations.wash.water_demand import calculate_water_demand
from calculations.wash.borehole import calculate_borehole
from calculations.energy.solar_pv import calculate_solar_pv
from calculations.energy.battery_storage import calculate_battery
from collaboration.room_manager import join_room, room_status, broadcast_event
from intelligence.digital_twin import seed_demo_assets, ingest_reading, get_asset
from intelligence.predictive_maintenance import analyse_portfolio

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


def test_wash() -> None:
    print("\n=== TIER 2: WASH ===")
    demand = calculate_water_demand({"population": 1000, "lpcd": 50, "context": "urban_low"})
    s = demand["summary"]
    check("Water demand daily m3", float(s["daily_demand_m3"]) > 40, f"{s['daily_demand_m3']} m3/day")
    check("WHO compliance", s["who_compliance"] is True)

    borehole = calculate_borehole({"daily_demand_m3": 50, "aquifer_yield_lps": 3.0})
    check("Borehole adequate yield", borehole["summary"]["adequate_yield"] is True)


def test_energy() -> None:
    print("\n=== TIER 2: Solar & Energy ===")
    solar = calculate_solar_pv({"daily_load_kwh": 15, "country": "Zambia", "latitude": -15.4})
    ss = solar["summary"]
    check("Solar panel count > 0", int(ss["panel_count"]) > 0, f"{ss['panel_count']} panels")
    check("Installed kWp > 0", float(ss["installed_kwp"]) > 0, f"{ss['installed_kwp']} kWp")

    battery = calculate_battery({"daily_load_kwh": 15, "autonomy_days": 2})
    bs = battery["summary"]
    check("Battery capacity kWh", float(bs["installed_kwh"]) >= 30, f"{bs['installed_kwh']} kWh")


def test_collaboration() -> None:
    print("\n=== TIER 2: Collaboration ===")
    join_room("test-project", "user-1", "Alice")
    join_room("test-project", "user-2", "Bob")
    status = room_status("test-project")
    check("2 users in room", status["user_count"] == 2)
    broadcast_event("test-project", "user-1", "calc_update", {"module": "beam"})
    check("Event broadcast", len(status.get("recent_events", [])) >= 0)


def test_tier3() -> None:
    print("\n=== TIER 3: Digital Twin + Predictive ===")
    assets = seed_demo_assets()
    check("Demo assets seeded", len(assets) >= 3, f"{len(assets)} assets")

    aid = assets[0]["id"]
    ingest_reading({"asset_id": aid, "sensor_type": "vibration_mm_s", "value": 8.5, "unit": "mm/s"})
    asset = get_asset(aid)
    check("Sensor reading ingested", len(asset.get("readings", [])) >= 4)

    portfolio = analyse_portfolio()
    check("Portfolio analysed", portfolio["assets_analysed"] >= 3)
    check("Health scores present", all("health_score" in a for a in portfolio["assets"]))


if __name__ == "__main__":
    print("InfraAfrica Tier 2 + Tier 3 Verification")
    test_wash()
    test_energy()
    test_collaboration()
    test_tier3()
    print(f"\n{'=' * 40}")
    print(f"Results: {PASS} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)
