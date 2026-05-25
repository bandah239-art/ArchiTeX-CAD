"""Road Traffic Load (ESAL calculation)."""

from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value

def calculate_traffic_load(inputs: dict[str, Any]) -> dict[str, Any]:
    aadt = float(inputs.get("aadt", 1000))
    growth_rate_pct = float(inputs.get("growth_rate_pct", 4.0))
    design_life_yrs = float(inputs.get("design_life_yrs", 20))
    
    # Axle distributions (simplified for module)
    truck_pct = float(inputs.get("truck_pct", 10.0))
    bus_pct = float(inputs.get("bus_pct", 5.0))
    
    # Vehicle Damage Factors (VDF)
    vdf_truck = float(inputs.get("vdf_truck", 3.0))
    vdf_bus = float(inputs.get("vdf_bus", 1.2))
    
    r = growth_rate_pct / 100.0
    
    # Traffic Growth Factor G
    g_factor = ((1 + r) ** design_life_yrs - 1) / r if r > 0 else design_life_yrs
    
    # Daily ESALs
    daily_esal = (aadt * (truck_pct / 100.0) * vdf_truck) + (aadt * (bus_pct / 100.0) * vdf_bus)
    
    # Cumulative ESALs over design life
    # Considering directional split (0.5) and lane distribution (typically 1.0 for 2-lane road)
    directional_split = float(inputs.get("directional_split", 0.5))
    lane_factor = float(inputs.get("lane_factor", 1.0))
    
    design_esal = daily_esal * 365 * g_factor * directional_split * lane_factor
    design_msa = design_esal / 1_000_000.0

    steps = [
        {
            "step_number": 1,
            "title": "Daily Equivalent Standard Axles",
            "formula": "Daily ESAL = Σ (AADT × %class × VDF)",
            "substitution": f"({aadt} × {truck_pct}% × {vdf_truck}) + ({aadt} × {bus_pct}% × {vdf_bus})",
            "result": f"{round_value(daily_esal, 1)}",
            "unit": "ESAL/day",
            "reference": "Traffic Survey",
            "status": "info",
        },
        {
            "step_number": 2,
            "title": "Growth Factor (G)",
            "formula": "G = [(1+r)^n - 1] / r",
            "substitution": f"G = [(1+{r})^{design_life_yrs} - 1] / {r}",
            "result": f"{round_value(g_factor, 2)}",
            "unit": "",
            "reference": "Compound Growth",
            "status": "info",
        },
        {
            "step_number": 3,
            "title": "Design ESAL (Cumulative)",
            "formula": "ESAL = Daily × 365 × G × Split × LaneFactor",
            "substitution": f"{round_value(daily_esal, 1)} × 365 × {round_value(g_factor, 2)} × {directional_split} × {lane_factor}",
            "result": f"{round_value(design_msa, 2)}",
            "unit": "MSA",
            "reference": "AASHTO / TRL",
            "status": "pass",
        }
    ]

    # Assign traffic class based on TRL Road Note 31
    traffic_class = "T1"
    if design_msa > 30:
        traffic_class = "T8"
    elif design_msa > 15:
        traffic_class = "T7"
    elif design_msa > 10:
        traffic_class = "T6"
    elif design_msa > 3:
        traffic_class = "T5"
    elif design_msa > 1.5:
        traffic_class = "T4"
    elif design_msa > 0.5:
        traffic_class = "T3"
    elif design_msa > 0.3:
        traffic_class = "T2"

    return {
        "status": "pass",
        "summary": {
            "daily_esal": round_value(daily_esal, 1),
            "design_esal_msa": round_value(design_msa, 2),
            "traffic_class_trl": traffic_class,
            "growth_factor": round_value(g_factor, 2),
        },
        "steps": steps,
        "warnings": [],
        "errors": [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
