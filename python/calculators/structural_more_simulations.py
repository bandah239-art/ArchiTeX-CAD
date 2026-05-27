from __future__ import annotations

import math
from typing import Literal
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class SlabSimRequest(BaseModel):
    span_lx_m: float = Field(default=4.0, gt=0)
    span_ly_m: float = Field(default=5.0, gt=0)
    dead_load_kn_m2: float = Field(default=5.0, ge=0)
    live_load_kn_m2: float = Field(default=3.0, ge=0)
    depth_mm: float = Field(default=175.0, gt=0)
    fck_mpa: float = Field(default=30.0, gt=0)
    fyk_mpa: float = Field(default=500.0, gt=0)
    slab_type: Literal["two_way", "one_way"] = "two_way"
    support_condition: Literal["simply_supported", "fixed_fixed"] = "simply_supported"


class PMSimRequest(BaseModel):
    width_mm: float = Field(default=300.0, gt=0)
    depth_mm: float = Field(default=300.0, gt=0)
    fck_mpa: float = Field(default=30.0, gt=0)
    fyk_mpa: float = Field(default=500.0, gt=0)
    axial_load_kn: float = Field(default=850.0)
    moment_major_knm: float = Field(default=45.0, ge=0)


class WindFacadeRequest(BaseModel):
    basic_wind_speed: float = Field(default=45.0, gt=0)
    building_height: float = Field(default=12.0, gt=0)
    building_width: float = Field(default=20.0, gt=0)
    building_length: float = Field(default=30.0, gt=0)
    exposure_category: Literal["B", "C", "D"] = "B"


# ---------------------------------------------------------------------------
# 1. Slab moment / deflection simulation
# ---------------------------------------------------------------------------

def simulate_slab_moments(req: SlabSimRequest) -> dict:
    # Ensure lx <= ly
    lx = req.span_lx_m
    ly = req.span_ly_m
    if lx > ly:
        lx, ly = ly, lx

    n = 1.35 * req.dead_load_kn_m2 + 1.5 * req.live_load_kn_m2  # kN/m²
    r = lx / ly  # <= 1

    # Moments
    Msx = Msy = 0.0
    M_support_x = M_support_y = 0.0

    if req.slab_type == "two_way":
        n_x = n / (1.0 + r ** 4)
        n_y = n * r ** 4 / (1.0 + r ** 4)

        if req.support_condition == "simply_supported":
            Msx = n_x * lx ** 2 / 8.0
            Msy = n_y * ly ** 2 / 8.0
            M_support_x = 0.0
            M_support_y = 0.0
        else:  # fixed_fixed
            Msx_full = n_x * lx ** 2 / 8.0
            Msy_full = n_y * ly ** 2 / 8.0
            Msx = Msx_full / 3.0
            Msy = Msy_full / 3.0
            M_support_x = 2.0 * Msx_full / 3.0
            M_support_y = 2.0 * Msy_full / 3.0

        n_eff = n_x  # load component on short span used for deflection
    else:
        # one_way – treat as beam spanning lx
        n_eff = n
        n_x = n
        n_y = 0.0
        if req.support_condition == "simply_supported":
            Msx = n * lx ** 2 / 8.0
            M_support_x = 0.0
        else:  # fixed_fixed
            Msx = n * lx ** 2 / 24.0
            M_support_x = n * lx ** 2 / 12.0
        Msy = 0.0
        M_support_y = 0.0

    # Elastic stiffness
    fck = req.fck_mpa
    E_kpa = 22000.0 * (fck / 10.0) ** 0.3 * 1000.0  # kPa
    h = req.depth_mm / 1000.0  # m
    I = h ** 3 / 12.0  # m⁴ per m width
    EI = E_kpa * I  # kN·m²/m

    # Deflection profile – 30 points along lx
    n_pts = 30
    x_vals: list[float] = []
    defl_mm: list[float] = []

    for i in range(n_pts):
        xi = lx * i / (n_pts - 1)
        x_vals.append(round(xi, 5))

        if req.support_condition == "simply_supported":
            # δ(x) = w*x*(L³ - 2*L*x² + x³) / (24*EI)
            delta_m = n_eff * xi * (lx ** 3 - 2.0 * lx * xi ** 2 + xi ** 3) / (24.0 * EI)
        else:
            # fixed_fixed: δ(x) = w*x²*(L-x)² / (24*EI)
            delta_m = n_eff * xi ** 2 * (lx - xi) ** 2 / (24.0 * EI)

        defl_mm.append(round(delta_m * 1000.0, 4))

    max_deflection_mm = max(defl_mm)
    span_limit_mm = lx / 250.0 * 1000.0  # mm

    return {
        "x_m": x_vals,
        "deflection_mm": defl_mm,
        "Msx_knm": round(Msx, 4),
        "Msy_knm": round(Msy, 4),
        "M_support_x_knm": round(M_support_x, 4),
        "M_support_y_knm": round(M_support_y, 4),
        "max_deflection_mm": round(max_deflection_mm, 4),
        "span_limit_mm": round(span_limit_mm, 4),
        "passes_deflection": bool(max_deflection_mm <= span_limit_mm),
        "n_design": round(n, 4),
    }


# ---------------------------------------------------------------------------
# 2. P-M interaction diagram simulation
# ---------------------------------------------------------------------------

def simulate_pm_interaction(req: PMSimRequest) -> dict:
    b = req.width_mm   # mm
    h = req.depth_mm   # mm
    fck = req.fck_mpa
    fyk = req.fyk_mpa

    d_prime = 40.0
    d = h - d_prime

    rho = 0.02
    As_total = rho * b * h  # mm²
    As1 = As_total / 2.0
    As2 = As_total / 2.0

    fcd = fck / 1.5       # MPa
    fyd = min(fyk / 1.15, 435.0)  # MPa
    Es = 200000.0          # MPa
    eps_cu = 0.0035

    n_kn: list[float] = []
    m_knm: list[float] = []

    n_steps = 50
    for i in range(n_steps):
        x = (0.001 + (5.0 - 0.001) * i / (n_steps - 1)) * h  # mm

        hc = min(0.8 * x, h)
        Nc = fcd * hc * b  # N
        arm_c = h / 2.0 - hc / 2.0  # mm

        # Compression steel strain (steel 2 near compression face)
        if x > d_prime:
            eps_s2 = max(0.0, eps_cu * (x - d_prime) / x)
        else:
            eps_s2 = 0.0
        sigma_s2 = min(eps_s2 * Es, fyd)

        # Tension steel strain (steel 1 near tension face)
        eps_s1 = eps_cu * (d - x) / x  # positive = tension
        sigma_s1 = max(min(eps_s1 * Es, fyd), -fyd)

        Ns2 = As2 * sigma_s2  # N (compression)
        Ns1 = As1 * sigma_s1  # N (positive = tension)

        N_val = (Nc + Ns2 - Ns1) / 1000.0  # kN
        M_val = (Nc * arm_c + Ns2 * (h / 2.0 - d_prime) + Ns1 * (d - h / 2.0)) / 1.0e6  # kNm

        n_kn.append(round(N_val, 3))
        m_knm.append(round(abs(M_val), 3))

    # Pure tension point
    N_tension = -As_total * fyd / 1000.0  # kN
    n_kn.append(round(N_tension, 3))
    m_knm.append(0.0)

    # Pure compression (N_max)
    N_max = (fcd * b * h + fyd * As_total) / 1000.0  # kN
    n_kn.append(round(N_max, 3))
    m_knm.append(0.0)

    # Check if design point is within envelope
    design_n = req.axial_load_kn
    design_m = req.moment_major_knm

    # Find max interpolated M for the design N by iterating all segments
    max_m_at_design_n: float = 0.0
    pts = list(zip(n_kn, m_knm))

    for idx in range(len(pts) - 1):
        n0, m0 = pts[idx]
        n1, m1 = pts[idx + 1]
        n_lo = min(n0, n1)
        n_hi = max(n0, n1)
        if n_lo <= design_n <= n_hi and abs(n1 - n0) > 1e-9:
            t = (design_n - n0) / (n1 - n0)
            m_interp = m0 + t * (m1 - m0)
            if m_interp > max_m_at_design_n:
                max_m_at_design_n = m_interp

    within_envelope = bool(design_m <= max_m_at_design_n)

    return {
        "n_kn": n_kn,
        "m_knm": m_knm,
        "design_n_kn": design_n,
        "design_m_knm": design_m,
        "N_max_kn": round(N_max, 3),
        "within_envelope": within_envelope,
        "rho_pct": round(rho * 100.0, 2),
    }


# ---------------------------------------------------------------------------
# 3. Wind facade pressure simulation
# ---------------------------------------------------------------------------

def simulate_wind_facade(req: WindFacadeRequest) -> dict:
    V = req.basic_wind_speed
    H = req.building_height
    W = req.building_width

    # Exposure parameters
    exposure_params = {
        "B": {"alpha": 7.0, "zg": 365.8},
        "C": {"alpha": 9.5, "zg": 274.3},
        "D": {"alpha": 11.5, "zg": 213.4},
    }
    params = exposure_params[req.exposure_category]
    alpha = params["alpha"]
    zg = params["zg"]

    def kz(z: float) -> float:
        z_eff = max(z, 4.6)
        return 2.01 * (z_eff / zg) ** (2.0 / alpha)

    def q_pa(z: float) -> float:
        return 0.613 * kz(z) * V ** 2  # Pa

    Kd = 0.85
    G = 0.85
    Cp_windward = 0.8
    Cp_leeward = -0.5

    n_pts = 20
    z_vals: list[float] = []
    p_windward_kpa: list[float] = []

    dz = H / (n_pts - 1) if n_pts > 1 else H

    for i in range(n_pts):
        zi = H * i / (n_pts - 1)
        z_vals.append(round(zi, 4))
        pw = q_pa(zi) * G * Cp_windward * Kd / 1000.0  # kPa
        p_windward_kpa.append(round(pw, 6))

    # Leeward pressure at roof height (scalar)
    q_H_kpa = 0.613 * kz(H) * V ** 2 / 1000.0  # kPa
    p_leeward_kpa = q_H_kpa * G * abs(Cp_leeward) * Kd  # kPa (positive magnitude)

    peak_windward_kpa = max(p_windward_kpa)

    # Base shear (kN) – integrate windward trapezoidally + leeward uniform
    base_shear_windward = 0.0
    for i in range(len(z_vals) - 1):
        dz_i = z_vals[i + 1] - z_vals[i]
        avg_p = (p_windward_kpa[i] + p_windward_kpa[i + 1]) / 2.0  # kPa
        base_shear_windward += avg_p * W * dz_i  # kN

    base_shear_leeward = p_leeward_kpa * H * W  # kN
    base_shear_kn = base_shear_windward + base_shear_leeward

    return {
        "z_m": z_vals,
        "p_windward_kpa": p_windward_kpa,
        "p_leeward_kpa": round(p_leeward_kpa, 6),
        "peak_windward_kpa": round(peak_windward_kpa, 6),
        "base_shear_kn": round(base_shear_kn, 4),
        "exposure_category": req.exposure_category,
    }
