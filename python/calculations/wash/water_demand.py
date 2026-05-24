"""WASH water demand calculator — African rural/urban contexts."""

from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value

# Litres per capita per day by context (WHO / African standards)
LPCD_DEFAULTS = {
    "rural_basic": 20,
    "rural_improved": 40,
    "urban_low": 50,
    "urban_middle": 80,
    "institutional": 100,
    "commercial": 120,
}


def calculate_water_demand(inputs: dict[str, Any]) -> dict[str, Any]:
    population = int(inputs.get("population", 500))
    lpcd = float(inputs.get("lpcd", LPCD_DEFAULTS.get(inputs.get("context", "urban_low"), 50)))
    context = inputs.get("context", "urban_low")
    peak_factor = float(inputs.get("peak_factor", 2.5))
    storage_days = float(inputs.get("storage_days", 1.0))
    leakage_pct = float(inputs.get("leakage_pct", 15))
    country = inputs.get("country", "Zambia")

    daily_demand = population * lpcd * (1 + leakage_pct / 100)
    peak_demand_lph = daily_demand * peak_factor / 24
    peak_demand_m3h = peak_demand_lph / 1000
    storage_litres = daily_demand * storage_days
    storage_m3 = storage_litres / 1000

    # Tank sizing with 10% freeboard
    tank_m3 = storage_m3 * 1.1

    status = "pass"
    if lpcd < 20:
        status = "warning"

    return {
        "status": status,
        "summary": {
            "population": population,
            "lpcd": lpcd,
            "context": context,
            "country": country,
            "daily_demand_litres": round_value(daily_demand, 0),
            "daily_demand_m3": round_value(daily_demand / 1000, 1),
            "peak_demand_lph": round_value(peak_demand_lph, 0),
            "peak_demand_m3h": round_value(peak_demand_m3h, 2),
            "storage_tank_m3": round_value(tank_m3, 1),
            "storage_days": storage_days,
            "leakage_pct": leakage_pct,
            "who_compliance": lpcd >= 20,
        },
        "steps": [
            {
                "step_number": 1,
                "title": "Daily Water Demand",
                "formula": "Q_d = Population × LPCD × (1 + leakage%)",
                "substitution": f"Q_d = {population} × {lpcd} × {1 + leakage_pct/100:.2f}",
                "result": str(round_value(daily_demand, 0)),
                "unit": "L/day",
                "reference": "WHO Guidelines / African WASH standards",
                "status": "info",
            },
            {
                "step_number": 2,
                "title": "Peak Hourly Demand",
                "formula": "Q_p = Q_d × peak_factor / 24",
                "substitution": f"Q_p = {round_value(daily_demand,0)} × {peak_factor} / 24",
                "result": str(round_value(peak_demand_lph, 0)),
                "unit": "L/hr",
                "reference": "Peak factor for African networks",
                "status": "info",
            },
            {
                "step_number": 3,
                "title": "Storage Tank Volume",
                "formula": "V = Q_d × storage_days / 1000 × 1.1",
                "substitution": f"V = {round_value(daily_demand,0)} × {storage_days} / 1000 × 1.1",
                "result": str(round_value(tank_m3, 1)),
                "unit": "m³",
                "reference": "Storage with 10% freeboard",
                "status": "pass" if status == "pass" else "warning",
            },
        ],
        "warnings": [] if lpcd >= 20 else ["LPCD below WHO minimum 20 L/capita/day for basic access"],
        "errors": [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
