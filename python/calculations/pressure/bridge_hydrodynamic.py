"""Hydrodynamic pressure on bridge piers."""

from __future__ import annotations

import math
from typing import Any

from calculations.utils.formatters import round_value
from calculations.pressure._common import finish, step


def calculate_bridge_hydrodynamic(payload: dict[str, Any]) -> dict[str, Any]:
    cd = float(payload.get("Cd", payload.get("drag_coefficient", 0.7)))
    v = float(payload.get("velocity", payload.get("flood_velocity", 2.0)))
    width = float(payload.get("width", 1.5))
    height = float(payload.get("height", 8.0))
    rho_w = 1000.0
    a_proj = width * height
    f = cd * 0.5 * rho_w * v * v * a_proj / 1000.0

    steps = [
        step(1, "Drag force", "F = Cd·½·ρw·v²·A", f"Cd={cd}; v={v}m/s", f"F = {round_value(f,1)} kN", "kN", "Hydrodynamic"),
    ]

    diagram = {
        "type": "arrows",
        "points": [{"x": 0, "y": height / 2, "pressure": round_value(f / height, 1)}],
        "labels": [f"F = {round_value(f,1)} kN"],
        "resultant": {"value": round_value(f, 1), "location": height / 2, "unit": "kN"},
    }

    return finish({"hydrodynamic_force_kN": round_value(f, 1)}, steps, diagram)
