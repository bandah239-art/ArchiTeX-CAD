"""Pavement layer pressure distribution."""

from __future__ import annotations

import math
from typing import Any

from calculations.utils.formatters import round_value
from calculations.pressure._common import depth_table, finish, step


def _sigma_under_flexible(p0: float, z: float, a: float) -> float:
    if z <= 0:
        return p0
    return p0 * (1 - z ** 3 / (a * a + z * z) ** 1.5)


def calculate_pavement_pressure(payload: dict[str, Any]) -> dict[str, Any]:
    p_kn = float(payload.get("P", payload.get("axle_load", 80)))
    p0 = float(payload.get("p0", payload.get("tyre_pressure_kpa", 552)))
    n_contact = int(payload.get("n_contact_points", payload.get("tyre_contacts", 4)))
    p_contact = p_kn / max(n_contact, 1)
    asphalt = float(payload.get("asphalt_depth", payload.get("asphalt_mm", 100))) / 1000.0
    base = float(payload.get("base_depth", payload.get("base_mm", 200))) / 1000.0
    cbr = float(payload.get("CBR", payload.get("cbr", 6)))

    # Contact radius per tyre: a = √(P_contact / (π·p0)), P in kN, p0 in kPa → metres
    a = math.sqrt(p_contact / (math.pi * p0)) if p0 > 0 else 0.1
    z_asphalt = asphalt
    z_base = asphalt + base
    s_asphalt = _sigma_under_flexible(p0, z_asphalt, a)
    s_base = _sigma_under_flexible(p0, z_base, a)
    s_sub = _sigma_under_flexible(p0, z_base + 0.15, a)
    limit = 0.45 * cbr

    steps = [
        step(1, "Contact radius", "a = √(P_contact/(π·p0))", f"P_axle={p_kn}kN; n={n_contact}; P_contact={round_value(p_contact,1)}kN", f"a = {round_value(a*1000,0)} mm", "mm", "Tyre contact"),
        step(2, "Stress at asphalt base", "σz from Boussinesq", f"z={z_asphalt*1000}mm", f"σz = {round_value(s_asphalt,0)} kPa", "kPa", "Elastic layer"),
        step(3, "Stress at subbase", f"z={z_base*1000}mm", "", f"σz = {round_value(s_base,0)} kPa", "kPa", "Elastic layer"),
        step(4, "Subgrade check", "σz ≤ 0.45·CBR", f"limit={round_value(limit,0)}", "PASS" if s_sub <= limit else "FAIL", "", "Subgrade"),
    ]

    rows = [
        (0, p0, "✓"),
        (z_asphalt * 1000, s_asphalt, "✓"),
        (z_base * 1000, s_base, "✓"),
        (z_base * 1000 + 150, s_sub, "✓" if s_sub <= limit else "✗"),
    ]

    diagram = {
        "type": "contour",
        "points": [
            {"depth_m": d / 1000 if d > 3 else d, "pressure_kpa": p} for d, p, _ in rows
        ],
        "labels": [f"a = {round_value(a*1000,0)} mm"],
        "resultant": {"value": s_sub, "location": "subgrade", "unit": "kPa"},
    }

    return finish(
        {
            "contact_radius_mm": round_value(a * 1000, 0),
            "sigma_asphalt_kpa": round_value(s_asphalt, 0),
            "sigma_subgrade_kpa": round_value(s_sub, 0),
            "subgrade_limit_kpa": round_value(limit, 0),
            "depth_table": depth_table([(d / 1000 if d > 3 else d, p, st) for d, p, st in rows]),
        },
        steps,
        diagram,
        status="pass" if s_sub <= limit else "fail",
    )
