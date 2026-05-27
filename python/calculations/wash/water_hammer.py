"""
Water Hammer (Joukowsky equation) — transient pressure surge analysis.

Covers:
  - Joukowsky pressure rise: ΔP = ρ·c·ΔV
  - Wave speed c in pipe:  c = √(K/ρ) / √(1 + K·D/(E·t))
  - Critical closing time Tc = 2L/c
  - Pressure envelope along pipe (method of characteristics, simplified)
  - Surge protection recommendations (air vessel, surge tank, PRV)

References:
  Joukowsky (1898); Wylie & Streeter (1993) "Fluid Transients in Systems"
"""

from __future__ import annotations

import math
from typing import Any

# Water properties at 20°C
RHO_WATER = 998.0   # kg/m³
K_WATER = 2.15e9    # bulk modulus (Pa)


def wave_speed(
    D_mm: float,
    t_mm: float,
    E_pipe_gpa: float,
    K_fluid: float = K_WATER,
    rho_fluid: float = RHO_WATER,
) -> float:
    """
    Pressure wave speed c (m/s) in a thin-walled elastic pipe.
    c = √(K/ρ / (1 + K·D/(E·t)))
    """
    D = D_mm / 1000.0     # m
    t = t_mm / 1000.0     # m
    E = E_pipe_gpa * 1e9  # Pa
    c_sq = (K_fluid / rho_fluid) / (1.0 + K_fluid * D / (E * t))
    return math.sqrt(max(c_sq, 0.0))


def joukowsky_pressure(
    c: float,
    delta_v: float,
    rho: float = RHO_WATER,
) -> float:
    """Joukowsky pressure rise ΔP = ρ·c·|ΔV| (Pa)."""
    return rho * c * abs(delta_v)


def critical_close_time(L: float, c: float) -> float:
    """Critical valve closure time Tc = 2L/c (s). Faster = sudden closure."""
    return 2.0 * L / max(c, 1e-6)


def pressure_envelope(
    L_m: float,
    c: float,
    V0: float,
    rho: float,
    H_static: float,
    n_sections: int = 20,
) -> dict[str, list[float]]:
    """
    Simplified pressure envelope along pipe after sudden valve closure.
    Returns peak head (m) at n_sections points from pump to valve.
    Uses wave reflection — pressure wave travels from valve back to reservoir.
    """
    dx = L_m / n_sections
    x_pts = [i * dx for i in range(n_sections + 1)]
    dH = joukowsky_pressure(c, V0, rho) / (rho * 9.81)  # pressure rise in m head

    # Max head: at valve = H_static + dH; reduces linearly toward reservoir
    # (simplified first-reflection envelope)
    h_max = []
    h_min = []
    for x in x_pts:
        frac = x / L_m  # 0 at reservoir, 1 at valve
        h_max.append(round(H_static + dH * frac, 2))
        h_min.append(round(H_static - dH * frac, 2))

    return {"x_m": [round(x, 2) for x in x_pts], "H_max_m": h_max, "H_min_m": h_min}


def run_water_hammer(
    D_mm: float = 200.0,           # pipe diameter (mm)
    t_mm: float = 6.0,            # wall thickness (mm)
    L_m: float = 500.0,           # pipe length (m)
    V0_ms: float = 1.5,           # initial flow velocity (m/s)
    Tc_s: float = 0.0,            # valve closure time (0 = sudden)
    H_static_m: float = 50.0,     # static head at valve (m)
    E_pipe_gpa: float = 200.0,    # pipe elastic modulus (GPa); steel=200, HDPE=0.8, DI=170
    pipe_material: str = "steel", # informational
    K_fluid: float = K_WATER,
    rho_fluid: float = RHO_WATER,
    safety_factor: float = 1.3,
) -> dict[str, Any]:
    """Full water hammer analysis."""

    c = wave_speed(D_mm, t_mm, E_pipe_gpa, K_fluid, rho_fluid)
    Tc_critical = critical_close_time(L_m, c)

    # Instantaneous closure pressure rise
    dP_instant = joukowsky_pressure(c, V0_ms, rho_fluid)
    dH_instant = dP_instant / (rho_fluid * 9.81)

    # If closure time Tc > Tc_critical, pressure rise is reduced (linear approximation)
    if Tc_s <= 0 or Tc_s <= Tc_critical:
        dP_design = dP_instant
        closure_type = "sudden"
    else:
        # Linear (Allievi): ΔP_actual = ΔP_instant × Tc_critical / Tc_s
        dP_design = dP_instant * (Tc_critical / Tc_s)
        closure_type = "controlled"

    dH_design = dP_design / (rho_fluid * 9.81)

    # Maximum pressure at valve
    P_static = rho_fluid * 9.81 * H_static_m
    P_max = P_static + dP_design    # Pa
    H_max = H_static_m + dH_design  # m

    # Minimum (downsurge) — can cause column separation if H_min < 0
    P_min = P_static - dP_design
    H_min = H_static_m - dH_design

    column_separation = H_min < 0.0

    # Design pressure with safety factor
    P_design = P_max * safety_factor
    PN_design = P_design / 1e5  # bar

    # Pressure envelope
    envelope = pressure_envelope(L_m, c, V0_ms, rho_fluid, H_static_m)

    # Surge protection recommendations
    recommendations = []
    if closure_type == "sudden":
        recommendations.append("Install controlled valve to achieve Tc > {:.1f} s (2L/c).".format(Tc_critical))
    if column_separation:
        recommendations.append("CRITICAL: Column separation possible (H_min < 0 m). Install air valve or surge tank.")
    if dH_design > H_static_m * 0.3:
        recommendations.append("Surge exceeds 30% of static head — consider surge vessel or PRV.")
    if H_max > 150.0:
        recommendations.append("Peak head > 150 m — verify pipe pressure rating PN class.")

    steps = [
        {
            "step_number": 1,
            "title": "Pressure Wave Speed",
            "formula": "c = √(K/ρ) / √(1 + K·D/(E·t))",
            "substitution": f"D={D_mm}mm, t={t_mm}mm, E={E_pipe_gpa}GPa",
            "result": f"c = {c:.1f} m/s",
            "unit": "m/s",
            "reference": "Wylie & Streeter §2.1",
        },
        {
            "step_number": 2,
            "title": "Critical Closure Time",
            "formula": "Tc = 2L/c",
            "substitution": f"Tc = 2×{L_m}/{c:.1f}",
            "result": f"Tc = {Tc_critical:.2f} s",
            "unit": "s",
            "reference": "Joukowsky criterion",
        },
        {
            "step_number": 3,
            "title": "Joukowsky Pressure Rise",
            "formula": "ΔP = ρ·c·ΔV  |  ΔH = ΔP/(ρg)",
            "substitution": f"ΔP = {rho_fluid:.0f}×{c:.1f}×{V0_ms}",
            "result": f"ΔP = {dP_instant/1e3:.1f} kPa  |  ΔH = {dH_instant:.1f} m",
            "unit": "kPa / m",
            "reference": "Joukowsky (1898)",
        },
        {
            "step_number": 4,
            "title": "Design Pressure Rise (actual closure)",
            "formula": "ΔP_design = ΔP_instant × Tc_critical/Tc_closure  (if controlled)",
            "substitution": f"Closure type: {closure_type}, Tc_closure={max(Tc_s,0):.2f}s",
            "result": f"ΔP_design = {dP_design/1e3:.1f} kPa  |  ΔH_design = {dH_design:.1f} m",
            "unit": "kPa",
            "reference": "Allievi method",
        },
        {
            "step_number": 5,
            "title": "Peak and Minimum Head at Valve",
            "formula": "H_max = H_static + ΔH  |  H_min = H_static - ΔH",
            "substitution": f"H_static={H_static_m}m, ΔH={dH_design:.1f}m",
            "result": f"H_max = {H_max:.1f} m  |  H_min = {H_min:.1f} m{'  ⚠ COLUMN SEPARATION' if column_separation else ''}",
            "unit": "m",
            "reference": "Pressure envelope",
        },
        {
            "step_number": 6,
            "title": "Design Pressure Rating",
            "formula": "P_design = P_max × SF  →  PN class (bar)",
            "substitution": f"P_max={P_max/1e3:.1f}kPa × SF={safety_factor}",
            "result": f"P_design = {P_design/1e3:.0f} kPa = {PN_design:.1f} bar → PN{math.ceil(PN_design/10)*10}",
            "unit": "bar",
            "reference": "ISO 4427 / EN 12201",
        },
    ]

    pn_class = math.ceil(PN_design / 10) * 10

    return {
        "status": "pass" if not column_separation else "warning",
        "summary": {
            "wave_speed_ms": round(c, 1),
            "Tc_critical_s": round(Tc_critical, 3),
            "closure_type": closure_type,
            "dP_instant_kpa": round(dP_instant / 1e3, 1),
            "dH_instant_m": round(dH_instant, 2),
            "dP_design_kpa": round(dP_design / 1e3, 1),
            "dH_design_m": round(dH_design, 2),
            "H_max_m": round(H_max, 2),
            "H_min_m": round(H_min, 2),
            "column_separation": column_separation,
            "P_design_kpa": round(P_design / 1e3, 0),
            "PN_class_bar": pn_class,
        },
        "steps": steps,
        "warnings": recommendations,
        "errors": [],
        "pressure_envelope": envelope,
    }
