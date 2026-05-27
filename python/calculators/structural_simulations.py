"""Structural modality simulation functions for visualisation in the frontend."""

import math
from pydantic import BaseModel


# ─── Beam BMD / SFD / Deflection ────────────────────────────────────────────

class BeamSimRequest(BaseModel):
    span_m: float = 6.0
    udl_kn_m: float = 25.0          # total unfactored UDL (DL + LL) kN/m
    support: str = "simply_supported"  # simply_supported | cantilever | fixed_fixed
    fck_mpa: float = 30.0
    width_mm: float = 300.0
    depth_mm: float = 500.0


def simulate_beam_bmd_sfd(req: BeamSimRequest) -> dict:
    w = req.udl_kn_m
    L = req.span_m
    support = req.support

    # Concrete E from Eurocode 2
    E_kpa = 22_000.0 * (req.fck_mpa / 10.0) ** 0.3 * 1_000.0   # kN/m²
    b = req.width_mm / 1_000.0   # m
    d = req.depth_mm / 1_000.0   # m
    I_m4 = b * d**3 / 12.0
    EI = E_kpa * I_m4             # kN·m²

    n = 51
    points = []
    for i in range(n):
        x = L * i / (n - 1)

        if support == "cantilever":
            V = w * (L - x)
            M = -w * (L - x) ** 2 / 2.0
            delta_m = (w / (24.0 * EI)) * (6.0 * L**2 * x**2 - 4.0 * L * x**3 + x**4)
        elif support == "fixed_fixed":
            RA = w * L / 2.0
            M0 = w * L**2 / 12.0    # hogging at supports
            V = RA - w * x
            M = -M0 + RA * x - w * x**2 / 2.0
            delta_m = (w * x**2 * (L - x) ** 2) / (24.0 * EI)
        else:   # simply_supported (default)
            RA = w * L / 2.0
            V = RA - w * x
            M = RA * x - w * x**2 / 2.0
            delta_m = (w / (24.0 * EI)) * (L**3 * x - 2.0 * L * x**3 + x**4)

        points.append({
            "x": round(x, 3),
            "shear_kn": round(V, 2),
            "moment_knm": round(M, 2),
            "deflection_mm": round(delta_m * 1000.0, 3),
        })

    # Analytic extremes
    if support == "cantilever":
        M_max = w * L**2 / 2.0
        V_max = w * L
        delta_max_mm = (w * L**4 / (8.0 * EI)) * 1000.0
        reactions = [{"label": "R_A (fixed)", "value": round(w * L, 2), "unit": "kN"},
                     {"label": "M_A (fixed)", "value": round(-w * L**2 / 2.0, 2), "unit": "kNm"}]
    elif support == "fixed_fixed":
        M_max = w * L**2 / 12.0   # at supports (hogging)
        V_max = w * L / 2.0
        delta_max_mm = (w * L**4 / (384.0 * EI)) * 1000.0
        reactions = [{"label": "R_A = R_B", "value": round(w * L / 2.0, 2), "unit": "kN"},
                     {"label": "M_A = M_B", "value": round(-w * L**2 / 12.0, 2), "unit": "kNm"}]
    else:
        M_max = w * L**2 / 8.0
        V_max = w * L / 2.0
        delta_max_mm = (5.0 * w * L**4 / (384.0 * EI)) * 1000.0
        reactions = [{"label": "R_A = R_B", "value": round(w * L / 2.0, 2), "unit": "kN"}]

    return {
        "status": "ok",
        "points": points,
        "reactions": reactions,
        "summary": {
            "support": support,
            "span_m": L,
            "udl_kn_m": w,
            "M_max_knm": round(M_max, 2),
            "V_max_kn": round(V_max, 2),
            "delta_max_mm": round(delta_max_mm, 3),
            "EI_kn_m2": round(EI, 0),
        },
    }


# ─── Foundation Bearing Pressure Distribution ────────────────────────────────

class FoundationPressureRequest(BaseModel):
    B_m: float = 2.0      # foundation width (m)
    L_m: float = 2.0      # foundation length (m)
    P_kn: float = 800.0   # column vertical load (kN)
    Mx_knm: float = 0.0   # moment about X-axis (bending in L direction)
    My_knm: float = 0.0   # moment about Y-axis (bending in B direction)


def simulate_foundation_pressure(req: FoundationPressureRequest) -> dict:
    B, L_f, P = req.B_m, req.L_m, req.P_kn
    Mx, My = req.Mx_knm, req.My_knm

    A = B * L_f
    Ix = B * L_f**3 / 12.0   # second moment about x (L direction)
    Iy = L_f * B**3 / 12.0   # second moment about y (B direction)

    n = 12
    grid: list[list[float]] = []
    q_max = -1e9
    q_min =  1e9

    for j in range(n):
        row: list[float] = []
        y = -L_f / 2.0 + L_f * j / (n - 1)   # in L direction
        for i in range(n):
            x = -B / 2.0 + B * i / (n - 1)    # in B direction
            q = P / A + My * x / Iy + Mx * y / Ix
            row.append(round(q, 1))
            q_max = max(q_max, q)
            q_min = min(q_min, q)
        grid.append(row)

    ex = abs(My / P) if P != 0 else 0.0
    ey = abs(Mx / P) if P != 0 else 0.0
    kern_b = B / 6.0
    kern_l = L_f / 6.0
    within_kern = ex <= kern_b and ey <= kern_l

    return {
        "status": "ok",
        "grid": grid,
        "B_m": B,
        "L_m": L_f,
        "n": n,
        "summary": {
            "q_max_kpa": round(q_max, 1),
            "q_min_kpa": round(q_min, 1),
            "q_avg_kpa": round(P / A, 1),
            "ex_m": round(ex, 3),
            "ey_m": round(ey, 3),
            "tension_zone": q_min < 0,
            "within_kern": within_kern,
            "B_m": B,
            "L_m": L_f,
        },
    }
