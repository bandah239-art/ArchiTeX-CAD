"""Wind load calculations (simplified)."""

from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value


def calculate_wind_loads(inputs: dict[str, Any]) -> dict[str, Any]:
    vb = inputs.get("basic_wind_speed", 25)
    height = inputs.get("building_height", 10)
    terrain = inputs.get("terrain_category", "II")

    z0_map = {"0": 0.003, "I": 0.01, "II": 0.05, "III": 0.3, "IV": 1.0}
    z0 = z0_map.get(terrain, 0.05)
    z_min = 2.0
    z = max(height, z_min)

    kr = 0.234 * z0 ** 0.07
    cr = kr * (z / z0) ** 0.07
    qp = 0.613 * cr ** 2 * vb ** 2 / 1000  # kN/m²
    wk = qp * inputs.get("pressure_coefficient", 0.8)

    steps = [
        {
            "step_number": 1,
            "title": "Peak Velocity Pressure",
            "formula": "qp = 0.613·cr²·vb²",
            "substitution": f"cr = {round_value(cr, 3)}, vb = {vb} m/s",
            "result": f"qp = {round_value(qp, 3)} kN/m²",
            "unit": "kN/m²",
            "reference": "Eurocode 1: Part 1-4",
            "status": "info",
        },
        {
            "step_number": 2,
            "title": "Wind Load",
            "formula": "wk = qp·cp",
            "substitution": f"wk = {round_value(qp, 3)} × {inputs.get('pressure_coefficient', 0.8)}",
            "result": f"wk = {round_value(wk, 3)} kN/m²",
            "unit": "kN/m²",
            "reference": "Eurocode 1: Part 1-4",
            "status": "info",
        },
    ]

    return {
        "status": "pass",
        "summary": {
            "peak_velocity_pressure_knm2": round_value(qp, 3),
            "wind_load_knm2": round_value(wk, 3),
            "terrain_category": terrain,
        },
        "steps": steps,
        "warnings": [],
        "errors": [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
