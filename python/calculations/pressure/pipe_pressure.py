"""Pipe network pressure — hoop stress and water hammer."""

from __future__ import annotations

import math
from typing import Any

from calculations.utils.formatters import round_value
from calculations.pressure._common import finish, step


def calculate_pipe_pressure(payload: dict[str, Any]) -> dict[str, Any]:
    p_kpa = float(payload.get("P_node", payload.get("pressure_kpa", 400)))
    d_mm = float(payload.get("D", payload.get("diameter_mm", 110)))
    t_mm = float(payload.get("t", payload.get("wall_thickness_mm", 6)))
    material = str(payload.get("material", "PVC")).upper()
    allow = {"PVC": 10, "HDPE": 8, "STEEL": 140, "CI": 50}.get(material, 10)
    p_mpa = p_kpa / 1000.0
    hoop = p_mpa * d_mm / (2 * t_mm) if t_mm > 0 else 0

    steps = [
        step(1, "Node pressure", "P_node", f"P={p_kpa}", f"{round_value(p_kpa,0)} kPa", "kPa", "Hardy-Cross / static"),
        step(2, "Hoop stress", "σθ = p·D/(2t)", f"D={d_mm}; t={t_mm}", f"σθ = {round_value(hoop,2)} MPa", "MPa", "Thin-wall cylinder"),
        step(3, "Allowable", f"{material} allowable", f"{allow} MPa", "PASS" if hoop <= allow else "FAIL", "", material),
    ]

    diagram = {"type": "arrows", "points": [{"pressure_kpa": p_kpa}], "labels": [f"HGL pressure"], "resultant": {"value": p_kpa, "location": "node", "unit": "kPa"}}

    return finish({"hoop_stress_mpa": round_value(hoop, 2), "allowable_mpa": allow, "node_pressure_kpa": p_kpa}, steps, diagram, status="pass" if hoop <= allow else "fail")
