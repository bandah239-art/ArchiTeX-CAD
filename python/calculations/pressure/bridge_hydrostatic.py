"""Bridge pier hydrostatic pressure and buoyancy."""

from __future__ import annotations

import math
from typing import Any

from calculations.pressure._common import depth_table, finish, round_value, step


def calculate_bridge_hydrostatic(payload: dict[str, Any]) -> dict[str, Any]:
    b = float(payload.get("width", payload.get("pier_width", 1.5)))
    h = float(payload.get("water_depth", payload.get("h", 8.0)))
    gamma_w = float(payload.get("gamma_w", 9.81))
    scour = float(payload.get("scour_depth", 0))
    n_vert = float(payload.get("N_total", 0))
    submerged_vol = float(payload.get("submerged_volume", b * h * 1.0))

    h_eff = h + scour
    p_base = gamma_w * h_eff
    f = 0.5 * gamma_w * h_eff * h_eff * b
    y_r = h_eff / 3.0
    fb = gamma_w * submerged_vol
    n_net = n_vert - fb if n_vert > 0 else 0

    steps = [
        step(1, "Hydrostatic at base", "p = γw × h", f"γw={gamma_w}; h={h_eff}", f"p_base = {round_value(p_base, 1)} kPa", "kPa", "Hydrostatic"),
        step(2, "Resultant per metre", "F = ½·γw·h²·b", f"b={b}", f"F = {round_value(f, 1)} kN/m", "kN/m", "Triangular distribution"),
        step(3, "Resultant height", "yR = h/3 from base", f"h/3", f"yR = {round_value(y_r, 2)} m", "m", "Hydrostatic"),
    ]
    if n_vert > 0:
        steps.append(step(4, "Buoyancy check", "Fb = γw·Vsub; N_net = N − Fb", f"Fb={round_value(fb,1)}", f"N_net = {round_value(n_net,1)} kN", "kN", "Buoyancy", "pass" if n_net > 0 else "fail"))

    rows = []
    n = max(4, int(h_eff * 2))
    for i in range(n + 1):
        z = h_eff * i / n
        pz = gamma_w * z
        rows.append((round_value(z, 2), round_value(pz, 1), "✓"))

    diagram = {
        "type": "triangular",
        "points": [{"y": z, "pressure": pz} for z, pz, _ in rows],
        "labels": [f"p_base = {round_value(p_base,1)} kPa", f"F = {round_value(f,1)} kN/m"],
        "resultant": {"value": round_value(f, 1), "location": round_value(y_r, 2), "unit": "kN/m"},
        "water_level_m": h_eff,
        "pier_width_m": b,
    }

    warnings = []
    if n_vert > 0 and n_net <= 0:
        warnings.append("Buoyancy exceeds vertical load — uplift check required")

    return finish(
        {
            "p_base_kpa": round_value(p_base, 1),
            "resultant_kN_per_m": round_value(f, 1),
            "resultant_location_m": round_value(y_r, 2),
            "depth_table": depth_table(rows),
        },
        steps,
        diagram,
        warnings=warnings,
    )
