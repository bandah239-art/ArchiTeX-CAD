"""Road Geometric Design (Super-elevation calculations)."""

from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value

def calculate_geometric_design(inputs: dict[str, Any]) -> dict[str, Any]:
    design_speed_kmh = float(inputs.get("design_speed_kmh", 80))
    radius_m = float(inputs.get("radius_m", 300))
    max_superelevation = float(inputs.get("max_superelevation_pct", 8.0)) / 100.0
    side_friction = float(inputs.get("side_friction_factor", 0.14))
    
    # Formula: e + f = V^2 / (127 * R)
    # Required e:
    required_e = (design_speed_kmh ** 2) / (127 * radius_m) - side_friction
    
    # Limit to max superelevation
    design_e = min(required_e, max_superelevation)
    design_e_pct = design_e * 100
    
    status = "pass"
    warnings = []
    
    if required_e > max_superelevation:
        status = "fail"
        warnings.append(f"Required super-elevation ({round_value(required_e*100, 1)}%) exceeds maximum allowed ({round_value(max_superelevation*100, 1)}%). Increase radius or reduce speed.")
    elif required_e < 0:
        # Crossfall handles it
        design_e = 0.02 # default normal crossfall
        design_e_pct = 2.0
        warnings.append("No super-elevation required. Normal cross-fall applies.")
    
    steps = [
        {
            "step_number": 1,
            "title": "Super-elevation Requirement",
            "formula": "e + f = V² / (127·R)",
            "substitution": f"e = {design_speed_kmh}² / (127 × {radius_m}) - {side_friction}",
            "result": f"e = {round_value(required_e, 3)}",
            "unit": "",
            "reference": "AASHTO Geometric Design",
            "status": "info",
        },
        {
            "step_number": 2,
            "title": "Design Super-elevation",
            "formula": "e_design = min(e_required, e_max)",
            "substitution": f"min({round_value(required_e*100, 1)}%, {round_value(max_superelevation*100, 1)}%)",
            "result": f"{round_value(design_e_pct, 1)}",
            "unit": "%",
            "reference": "Design Value",
            "status": status,
        }
    ]

    return {
        "status": status,
        "summary": {
            "design_speed_kmh": design_speed_kmh,
            "radius_m": radius_m,
            "required_e_pct": round_value(required_e * 100, 1),
            "design_e_pct": round_value(design_e_pct, 1),
        },
        "steps": steps,
        "warnings": warnings,
        "errors": ["Radius too small for design speed"] if status == "fail" else [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
