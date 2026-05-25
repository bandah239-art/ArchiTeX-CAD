"""Tank hydrostatic, hoop tension, overturning and sliding."""

from __future__ import annotations

import math
from typing import Any

from calculations.utils.formatters import round_value
from calculations.pressure._common import finish, step


def calculate_tank_pressure(payload: dict[str, Any]) -> dict[str, Any]:
    gamma_w = float(payload.get("gamma_w", 9.81))
    h = float(payload.get("H", payload.get("height", 4)))
    r = float(payload.get("r", payload.get("radius", 2)))
    w_total = float(payload.get("W_total", payload.get("weight_kN", 500)))
    fw = float(payload.get("Fw", payload.get("wind_force", 50)))
    mu = float(payload.get("mu", 0.5))
    fyk = float(payload.get("fyk", 500))

    p_max = gamma_w * h
    t_hoop = p_max * r
    as_req = t_hoop * 1e6 / (0.87 * fyk) if fyk > 0 else 0
    otm = fw * h / 2
    rm = w_total * r
    fos_ot = rm / otm if otm > 0 else 99
    resist = mu * w_total
    fos_slide = resist / fw if fw > 0 else 99

    steps = [
        step(1, "Wall pressure", "p = γw·H", f"H={h}", f"p_max = {round_value(p_max,1)} kPa", "kPa", "Tank"),
        step(2, "Hoop tension", "T = p·r", f"r={r}", f"T = {round_value(t_hoop,1)} kN/m", "kN/m", "Tank"),
        step(3, "Overturning FOS", "RM/OTM", f"OTM={round_value(otm,1)}", f"FOS = {round_value(fos_ot,2)}", "", "≥1.5", "pass" if fos_ot >= 1.5 else "fail"),
        step(4, "Sliding FOS", "μ·W/Fw", f"Fw={fw}", f"FOS = {round_value(fos_slide,2)}", "", "≥1.5", "pass" if fos_slide >= 1.5 else "fail"),
    ]

    diagram = {
        "type": "triangular",
        "points": [{"y": y, "pressure": gamma_w * y} for y in [0, h / 2, h]],
        "labels": [f"p_max = {round_value(p_max,1)} kPa"],
        "resultant": {"value": round_value(t_hoop, 1), "location": "base", "unit": "kN/m"},
    }

    return finish(
        {"p_max_kpa": round_value(p_max, 1), "hoop_tension_kN_m": round_value(t_hoop, 1), "overturning_fos": round_value(fos_ot, 2), "sliding_fos": round_value(fos_slide, 2)},
        steps,
        diagram,
        status="pass" if fos_ot >= 1.5 and fos_slide >= 1.5 else "warning",
    )
