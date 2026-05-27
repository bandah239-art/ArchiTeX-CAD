"""
EC2 Crack Width — EN 1992-1-1:2004 Section 7.3.

Computes the design crack width wk for reinforced concrete members under
bending or direct tension.

wk = sr,max × (εsm - εcm)                          (EC2 Eq. 7.8)

where:
  sr,max  = maximum crack spacing (Eq. 7.11 or 7.14)
  εsm     = mean strain in reinforcement (Eq. 7.9)
  εcm     = mean strain in concrete between cracks (Eq. 7.9)
"""

from __future__ import annotations

import math
from typing import Any


def run_crack_width(
    # Section geometry
    b_mm: float = 300.0,          # width (mm)
    h_mm: float = 500.0,          # total depth (mm)
    d_mm: float | None = None,    # effective depth (mm), defaults to h - cover - bar_dia/2
    cover_mm: float = 35.0,       # nominal cover to stirrups (mm)
    # Reinforcement
    bar_dia_mm: float = 16.0,     # main bar diameter (mm)
    n_bars: int = 3,              # number of main tension bars
    # Materials
    fck_mpa: float = 30.0,        # characteristic compressive strength (MPa)
    fyk_mpa: float = 500.0,       # characteristic yield strength (MPa)
    Es_gpa: float = 200.0,        # steel modulus (GPa)
    # Loading
    M_knm: float = 80.0,          # applied bending moment (kNm) — serviceability
    N_kn: float = 0.0,            # axial force (kN), positive = tension
    # Control
    wk_limit_mm: float = 0.3,     # crack width limit (mm), EC2 Table 7.1N XC1: 0.4, XC2+: 0.3
    bond_condition: str = "good",  # "good" or "poor"
) -> dict[str, Any]:
    """Return EC2 crack width calculation with full step breakdown."""

    Es = Es_gpa * 1e3   # MPa
    Ecm = 22_000.0 * ((fck_mpa + 8.0) / 10.0) ** 0.3   # MPa (EC2 Eq. 3.1)
    alpha_e = Es / Ecm   # modular ratio

    # Bar area
    As = n_bars * math.pi * (bar_dia_mm / 2.0) ** 2   # mm²

    # Effective depth
    stirrup_dia = 8.0  # assume 8mm stirrup
    if d_mm is None:
        d = h_mm - cover_mm - stirrup_dia - bar_dia_mm / 2.0
    else:
        d = float(d_mm)

    # Neutral axis depth for cracked section (bending only, first approximation)
    # From: b*x²/2 = α_e * As * (d - x)  → quadratic
    # n = α_e * As;  b*x²/2 + n*x - n*d = 0
    n = alpha_e * As
    x = (-n + math.sqrt(n**2 + 2.0 * b_mm * n * d)) / b_mm   # mm, cracked NA

    # Cracked section moment of inertia
    I_cr = (b_mm * x**3) / 3.0 + alpha_e * As * (d - x)**2   # mm⁴

    # Steel stress under serviceability moment (and axial if any)
    M_nmm = M_knm * 1e6   # Nmm
    N_n = N_kn * 1e3       # N
    sigma_s = (M_nmm / I_cr) * alpha_e * (d - x) + N_n / As   # MPa

    # --- εsm - εcm  (EC2 Eq. 7.9) ---
    # fct,eff = fctm for t ≥ 28 days
    fctm = 0.30 * fck_mpa ** (2.0 / 3.0) if fck_mpa <= 50.0 else 2.12 * math.log(1 + (fck_mpa + 8.0) / 10.0)
    fct_eff = fctm

    # Effective tension area Act (EC2 §7.3.2)
    # h_c,eff = min(2.5*(h-d), (h-x)/3, h/2)
    hc_eff = min(2.5 * (h_mm - d), (h_mm - x) / 3.0, h_mm / 2.0)
    Act = b_mm * hc_eff   # mm²

    rho_p_eff = As / Act

    kt = 0.4 if True else 0.6   # kt = 0.4 long-term; 0.6 short-term

    eps_sm_minus_cm = max(
        (sigma_s - kt * fct_eff / rho_p_eff * (1.0 + alpha_e * rho_p_eff)) / Es,
        0.6 * sigma_s / Es,
    )

    # --- Maximum crack spacing sr,max (EC2 Eq. 7.11) ---
    k1 = 0.8 if bond_condition.lower() == "good" else 1.6
    k2 = 0.5   # bending (k2 = 0.5); pure tension would be 1.0
    k3 = 3.4
    k4 = 0.425
    sr_max = k3 * cover_mm + k1 * k2 * k4 * bar_dia_mm / rho_p_eff   # mm

    # Design crack width
    wk = sr_max * eps_sm_minus_cm   # mm

    status = "pass" if wk <= wk_limit_mm else "fail"

    steps = [
        {
            "step_number": 1,
            "title": "Section & Material Properties",
            "formula": "Ecm = 22000·[(fck+8)/10]^0.3  |  αe = Es/Ecm",
            "substitution": f"Ecm = {Ecm:.0f} MPa  |  αe = {alpha_e:.2f}",
            "result": f"As = {As:.0f} mm²  |  d = {d:.1f} mm",
            "unit": "mm / mm²",
            "reference": "EC2 §3.1.3 & §7.3",
        },
        {
            "step_number": 2,
            "title": "Cracked Neutral Axis (NA)",
            "formula": "b·x²/2 = αe·As·(d-x)",
            "substitution": f"300·x²/2 = {alpha_e:.2f}·{As:.0f}·({d:.1f}-x)",
            "result": f"x = {x:.1f} mm  |  Icr = {I_cr:.3e} mm⁴",
            "unit": "mm",
            "reference": "EC2 Cracked Section Analysis",
        },
        {
            "step_number": 3,
            "title": "Steel Stress at Serviceability",
            "formula": "σs = (M/Icr)·αe·(d-x) + N/As",
            "substitution": f"σs = ({M_knm}×10⁶/{I_cr:.3e})·{alpha_e:.2f}·{d-x:.1f} + {N_kn}×1000/{As:.0f}",
            "result": f"σs = {sigma_s:.1f} MPa",
            "unit": "MPa",
            "reference": "EC2 §7.3.4",
        },
        {
            "step_number": 4,
            "title": "Effective Tension Area & Reinforcement Ratio",
            "formula": "hc,eff = min(2.5(h-d), (h-x)/3, h/2)  |  ρp,eff = As/Ac,eff",
            "substitution": f"hc,eff = min(2.5·{h_mm-d:.1f}, {(h_mm-x)/3:.1f}, {h_mm/2:.1f}) = {hc_eff:.1f} mm",
            "result": f"Ac,eff = {Act:.0f} mm²  |  ρp,eff = {rho_p_eff:.4f}",
            "unit": "mm²",
            "reference": "EC2 §7.3.2",
        },
        {
            "step_number": 5,
            "title": "Mean Strain Difference (εsm - εcm)",
            "formula": "(σs - kt·(fct,eff/ρp,eff)·(1+αe·ρp,eff)) / Es  ≥  0.6σs/Es",
            "substitution": f"kt={kt}, fctm={fctm:.2f} MPa, Es={Es:.0f} MPa",
            "result": f"εsm - εcm = {eps_sm_minus_cm:.6f}",
            "unit": "-",
            "reference": "EC2 Eq. 7.9",
        },
        {
            "step_number": 6,
            "title": "Maximum Crack Spacing sr,max",
            "formula": "sr,max = k3·c + k1·k2·k4·φ/ρp,eff",
            "substitution": f"k3={k3}, c={cover_mm}, k1={k1}, k2={k2}, k4={k4}, φ={bar_dia_mm}, ρp,eff={rho_p_eff:.4f}",
            "result": f"sr,max = {sr_max:.1f} mm",
            "unit": "mm",
            "reference": "EC2 Eq. 7.11",
        },
        {
            "step_number": 7,
            "title": "Design Crack Width wk",
            "formula": "wk = sr,max × (εsm - εcm)",
            "substitution": f"wk = {sr_max:.1f} × {eps_sm_minus_cm:.6f}",
            "result": f"wk = {wk:.3f} mm  ({'≤' if wk <= wk_limit_mm else '>'} {wk_limit_mm} mm limit)",
            "unit": "mm",
            "reference": "EC2 Eq. 7.8",
        },
    ]

    warnings = []
    if sigma_s > 0.8 * fyk_mpa:
        warnings.append(f"Steel stress σs = {sigma_s:.0f} MPa > 0.8fyk = {0.8*fyk_mpa:.0f} MPa")
    if wk > wk_limit_mm:
        warnings.append(f"Crack width wk = {wk:.3f} mm exceeds limit {wk_limit_mm} mm")

    return {
        "status": status,
        "summary": {
            "b_mm": b_mm,
            "h_mm": h_mm,
            "d_mm": round(d, 1),
            "As_mm2": round(As, 0),
            "Ecm_mpa": round(Ecm, 0),
            "alpha_e": round(alpha_e, 3),
            "x_mm": round(x, 1),
            "sigma_s_mpa": round(sigma_s, 1),
            "fctm_mpa": round(fctm, 2),
            "hc_eff_mm": round(hc_eff, 1),
            "rho_p_eff": round(rho_p_eff, 5),
            "eps_sm_minus_cm": round(eps_sm_minus_cm, 7),
            "sr_max_mm": round(sr_max, 1),
            "wk_mm": round(wk, 4),
            "wk_limit_mm": wk_limit_mm,
            "utilisation_pct": round(wk / wk_limit_mm * 100, 1),
        },
        "steps": steps,
        "warnings": warnings,
        "errors": [],
    }
