"""Borehole yield and pump sizing."""

from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value


def calculate_borehole(inputs: dict[str, Any]) -> dict[str, Any]:
    aquifer_yield_lps = float(inputs.get("aquifer_yield_lps", 2.5))
    static_level_m = float(inputs.get("static_level_m", 25))
    drawdown_m = float(inputs.get("drawdown_m", 10))
    total_depth_m = float(inputs.get("total_depth_m", 45))
    daily_demand_m3 = float(inputs.get("daily_demand_m3", 50))
    pumping_hours = float(inputs.get("pumping_hours", 8))
    country = inputs.get("country", "Zambia")

    required_lps = (daily_demand_m3 * 1000) / (pumping_hours * 3600)
    safety_factor = 1.3
    design_yield = required_lps * safety_factor

    pump_head_m = static_level_m + drawdown_m + float(inputs.get("delivery_head_m", 15))
    pump_power_kw = (design_yield * pump_head_m * 9.81) / (1000 * 0.65)

    status = "pass" if aquifer_yield_lps >= design_yield else "fail"

    return {
        "status": status,
        "summary": {
            "country": country,
            "aquifer_yield_lps": aquifer_yield_lps,
            "required_yield_lps": round_value(required_lps, 3),
            "design_yield_lps": round_value(design_yield, 3),
            "pump_head_m": round_value(pump_head_m, 1),
            "pump_power_kw": round_value(pump_power_kw, 2),
            "total_depth_m": total_depth_m,
            "adequate_yield": aquifer_yield_lps >= design_yield,
        },
        "steps": [
            {
                "step_number": 1,
                "title": "Required Pumping Rate",
                "formula": "Q = V_d / (t × 3600)",
                "substitution": f"Q = {daily_demand_m3}×1000 / ({pumping_hours}×3600)",
                "result": str(round_value(required_lps, 3)),
                "unit": "L/s",
                "reference": "Borehole yield design",
                "status": "info",
            },
            {
                "step_number": 2,
                "title": "Design Yield with Safety Factor",
                "formula": "Q_d = Q × 1.3",
                "substitution": f"Q_d = {round_value(required_lps,3)} × 1.3",
                "result": str(round_value(design_yield, 3)),
                "unit": "L/s",
                "reference": "30% safety margin",
                "status": "pass" if status == "pass" else "fail",
            },
            {
                "step_number": 3,
                "title": "Pump Power Estimate",
                "formula": "P = Q×H×ρg / (1000×η)",
                "substitution": f"P = {round_value(design_yield,3)}×{pump_head_m}×9.81/(1000×0.65)",
                "result": str(round_value(pump_power_kw, 2)),
                "unit": "kW",
                "reference": "Pump efficiency η=0.65",
                "status": "info",
            },
        ],
        "warnings": [] if status == "pass" else ["Aquifer yield insufficient — consider deeper borehole or alternative source"],
        "errors": [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
