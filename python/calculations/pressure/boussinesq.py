"""Boussinesq stress distribution under foundations."""

from __future__ import annotations

import math
from typing import Any

from calculations.utils.formatters import round_value
from calculations.pressure._common import depth_table, finish, step


def _sigma_z_point(q: float, z: float, a: float) -> float:
    if z <= 0:
        return q
    r2 = a * a
    z2 = z * z
    denom = (r2 + z2) ** 1.5
    influence = 1 - z2 * z / denom if denom > 0 else 0
    return q * influence


def calculate_boussinesq(payload: dict[str, Any]) -> dict[str, Any]:
    q = float(payload.get("q", payload.get("bearing_pressure", 200)))
    b = float(payload.get("B", payload.get("width", 2.5)))
    l = float(payload.get("L", payload.get("length", 3.0)))
    z_check = float(payload.get("z", payload.get("depth", 0.3)))
    use_21 = payload.get("use_2_1", True)

    if use_21:
        sigma_z = q * b * l / ((b + z_check) * (l + z_check)) if (b + z_check) > 0 else q
        method = "2:1 distribution"
    else:
        a_eff = math.sqrt(b * l / math.pi)
        sigma_z = _sigma_z_point(q, z_check, a_eff)
        method = "Boussinesq influence factor"

    z_sig = 2 * min(b, l)
    steps = [
        step(1, "Surface pressure", "q at foundation level", f"q={q}", f"q = {round_value(q,1)} kPa", "kPa", method),
        step(2, "Stress at depth", method, f"z={z_check}m", f"σz = {round_value(sigma_z,1)} kPa", "kPa", "Boussinesq"),
        step(3, "Stress bulb depth", "z_significant ≈ 2B", f"2×{min(b,l)}", f"z ≈ {round_value(z_sig,2)} m", "m", "10% q rule"),
    ]

    rows = []
    for i in range(6):
        z = z_sig * i / 5
        sz = q * b * l / ((b + z) * (l + z)) if (b + z) > 0 and (l + z) > 0 else 0
        rows.append((round_value(z, 2), round_value(sz, 1), "✓" if sz > 0.1 * q else "—"))

    diagram = {
        "type": "contour",
        "points": [{"depth_m": z, "pressure_kpa": sz} for z, sz, _ in rows],
        "labels": [f"σz @ {z_check}m = {round_value(sigma_z,1)} kPa"],
        "resultant": {"value": round_value(sigma_z, 1), "location": z_check, "unit": "kPa"},
        "footprint": {"B": b, "L": l},
    }

    return finish(
        {"sigma_z_kpa": round_value(sigma_z, 1), "significant_depth_m": round_value(z_sig, 2), "depth_table": depth_table(rows)},
        steps,
        diagram,
    )
