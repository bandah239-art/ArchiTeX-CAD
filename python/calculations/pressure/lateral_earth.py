"""Lateral earth pressure — Rankine active, passive, at-rest."""

from __future__ import annotations

import math
from typing import Any

from calculations.pressure._common import depth_table, finish, round_value, step


def calculate_lateral_earth(payload: dict[str, Any]) -> dict[str, Any]:
    phi_deg = float(payload.get("phi", payload.get("friction_angle_deg", 30)))
    c = float(payload.get("c", payload.get("cohesion_kpa", 0)))
    gamma = float(payload.get("gamma", payload.get("unit_weight", 18)))
    h = float(payload.get("H", payload.get("height", 5)))
    q_surcharge = float(payload.get("q", payload.get("surcharge", 0)))
    water_depth = payload.get("water_table_depth")
    hw = float(water_depth) if water_depth is not None else h + 1

    phi = math.radians(phi_deg)
    ka = math.tan(math.radians(45 - phi_deg / 2)) ** 2
    kp = math.tan(math.radians(45 + phi_deg / 2)) ** 2
    k0 = 1 - math.sin(phi)
    pa_base = ka * gamma * h - 2 * c * math.sqrt(ka)
    pa_base = max(pa_base, 0)
    pa_force = 0.5 * ka * gamma * h * h + ka * q_surcharge * h
    zc = 2 * c / (gamma * math.sqrt(ka)) if ka > 0 and c > 0 else 0.0
    y_resultant = h / 3.0

    steps = [
        step(1, "Active coefficient", "Ka = tan²(45 − φ/2)", f"φ={phi_deg}°", f"Ka = {round_value(ka, 3)}", "", "Rankine"),
        step(2, "Pressure at base", "pa = Ka·γ·h − 2c√Ka", f"γ={gamma}; h={h}", f"pa = {round_value(pa_base, 1)} kPa", "kPa", "Rankine active"),
        step(3, "Total active force", "Pa = ½·Ka·γ·H² + Ka·q·H", f"H={h}", f"Pa = {round_value(pa_force, 1)} kN/m", "kN/m", "Rankine"),
        step(4, "Resultant location", "yR = H/3 from base", f"H/3", f"yR = {round_value(y_resultant, 2)} m", "m", "Triangular diagram"),
    ]
    if zc > 0:
        steps.append(step(5, "Tension crack depth", "zc = 2c/(γ√Ka)", f"c={c}", f"zc = {round_value(zc, 2)} m", "m", "Cohesive soil"))

    rows = []
    n_slices = max(4, int(h))
    for i in range(n_slices + 1):
        z = h * i / n_slices
        pz = max(0, ka * gamma * z - 2 * c * math.sqrt(ka)) + ka * q_surcharge
        rows.append((round_value(z, 2), round_value(pz, 1), "✓"))

    diagram = {
        "type": "triangular",
        "points": [{"x": 0, "y": z, "pressure": p} for z, p, _ in rows],
        "labels": [f"Pa = {round_value(pa_force,1)} kN/m @ {round_value(y_resultant,2)}m"],
        "resultant": {"value": round_value(pa_force, 1), "location": round_value(y_resultant, 2), "unit": "kN/m"},
        "wall_height_m": h,
        "coefficients": {"Ka": round_value(ka, 3), "Kp": round_value(kp, 3), "K0": round_value(k0, 3)},
    }

    return finish(
        {
            "Ka": round_value(ka, 3),
            "pa_base_kpa": round_value(pa_base, 1),
            "Pa_kN_per_m": round_value(pa_force, 1),
            "resultant_location_m": round_value(y_resultant, 2),
            "depth_table": depth_table(rows),
        },
        steps,
        diagram,
    )
