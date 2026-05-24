"""Sewerage and sanitation sizing."""

from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value


def calculate_sewerage(inputs: dict[str, Any]) -> dict[str, Any]:
    population = int(inputs.get("population", 500))
    lpcd = float(inputs.get("lpcd", 80))
    return_factor = float(inputs.get("return_factor", 0.8))
    peak_factor = float(inputs.get("peak_factor", 2.5))
    system_type = inputs.get("system_type", "septic")
    country = inputs.get("country", "Zambia")

    daily_flow_l = population * lpcd * return_factor
    peak_flow_lph = daily_flow_l * peak_factor / 24
    peak_flow_m3d = peak_flow_lph * 24 / 1000

    if system_type == "septic":
        retention_days = 2
        chamber_volume_m3 = (daily_flow_l / 1000) * retention_days * 1.5
        soakaway_area_m2 = (daily_flow_l / 1000) * 0.8
        design = {
            "septic_tank_m3": round_value(chamber_volume_m3, 1),
            "soakaway_area_m2": round_value(soakaway_area_m2, 0),
            "desludging_months": 24,
        }
    else:
        pipe_diameter_mm = 200 if peak_flow_lph < 5000 else 300
        design = {
            "peak_flow_m3_day": round_value(peak_flow_m3d, 1),
            "recommended_pipe_mm": pipe_diameter_mm,
            "manholes_per_100m": 1,
        }

    return {
        "status": "pass",
        "summary": {
            "population": population,
            "system_type": system_type,
            "country": country,
            "daily_flow_litres": round_value(daily_flow_l, 0),
            "peak_flow_lph": round_value(peak_flow_lph, 0),
            **design,
        },
        "steps": [
            {
                "step_number": 1,
                "title": "Daily Sewage Flow",
                "formula": "Q = Pop × LPCD × return_factor",
                "substitution": f"Q = {population} × {lpcd} × {return_factor}",
                "result": str(round_value(daily_flow_l, 0)),
                "unit": "L/day",
                "reference": "WASH flow estimation",
                "status": "info",
            },
        ],
        "warnings": [],
        "errors": [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
