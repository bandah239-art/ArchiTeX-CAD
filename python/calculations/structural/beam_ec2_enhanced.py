"""
Enhanced Eurocode 2 Beam Design Engine
=======================================
Full clause-referenced design to BS EN 1992-1-1:2004 (EC2) covering all ULS and SLS
checks including torsion, crack width, long-term deflection, BMD/SFD profiles, and
reinforcement scheduling.

Every calculation step carries: clause reference, formula, substitution, numeric
result, unit, and pass/fail/warning/info status — suitable for direct export into
design reports.

Usage
-----
    from calculations.structural.beam_ec2_enhanced import calculate_beam_ec2

    result = calculate_beam_ec2({
        "span": 6.0,
        "support_condition": "simply_supported",
        "dead_load": 20.0,
        "live_load": 10.0,
        "b_w": 300,
        "h": 500,
        "c_nom": 35,
        "fck": 30,
        "fyk": 500,
        "phi_bar": 20,
        "n_bars": 4,
        "phi_link": 10,
        "exposure_class": "XC2",
    })
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

# ---------------------------------------------------------------------------
# EC2 Material / safety constants
# ---------------------------------------------------------------------------
GAMMA_C: float = 1.5      # Partial factor for concrete (EC2 Table 2.1N)
GAMMA_S: float = 1.15     # Partial factor for reinforcement (EC2 Table 2.1N)
ALPHA_CC: float = 0.85    # Long-term coefficient for concrete (EC2 cl.3.1.6)
ES: float = 200_000.0     # Elastic modulus of steel, MPa (EC2 cl.3.2.7)
CRD_C: float = 0.18 / GAMMA_C  # = 0.12  (EC2 cl.6.2.2(1))
K1_TORSION: float = 0.8   # Ribbed bar factor, crack spacing (EC2 cl.7.3.4)
K2_BENDING: float = 0.5   # Strain distribution factor for bending (EC2 cl.7.3.4)
KT: float = 0.4           # kt factor, long-term loading (EC2 cl.7.3.4)
PHI_CREEP: float = 2.5    # Creep coefficient, tropical climate (EC2 Annex B)

# fctm look-up (MPa) — EC2 Table 3.1
_FCTM: dict[int, float] = {
    20: 2.2, 25: 2.6, 28: 2.8, 30: 2.9, 32: 3.0,
    35: 3.2, 40: 3.5, 45: 3.8, 50: 4.1,
}

# Nominal cover minimum by exposure class (mm) — EC2 Table 4.4N
_MIN_COVER: dict[str, int] = {
    "XC1": 25, "XC2": 30, "XC3": 30, "XC4": 35,
}


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _fctm(fck: float) -> float:
    """Return fctm (MPa) from look-up or formula (EC2 Table 3.1)."""
    key = int(fck)
    if key in _FCTM:
        return _FCTM[key]
    # Formula: 0.30×fck^(2/3) for fck ≤ 50
    if fck <= 50:
        return 0.30 * fck ** (2 / 3)
    return 2.12 * math.log(1 + (fck + 8) / 10)


def _ecm(fck: float) -> float:
    """Return Ecm (MPa) — EC2 cl.3.1.3 Table 3.1: Ecm = 22×((fck+8)/10)^0.3 GPa."""
    return 22_000.0 * ((fck + 8) / 10) ** 0.3


def _step(
    step_number: int,
    title: str,
    formula: str,
    substitution: str,
    result: str,
    unit: str = "",
    reference: str = "",
    status: str = "info",
) -> dict[str, Any]:
    """Build a standardised calculation step dict."""
    return {
        "step_number": step_number,
        "title": title,
        "formula": formula,
        "substitution": substitution,
        "result": result,
        "unit": unit,
        "reference": reference,
        "status": status,
    }


def _r(v: float, dp: int = 3) -> str:
    """Format a float to dp decimal places for substitution strings."""
    return f"{v:.{dp}f}"


# ---------------------------------------------------------------------------
# Main calculation function
# ---------------------------------------------------------------------------

def calculate_beam_ec2(inputs: dict[str, Any]) -> dict[str, Any]:
    """
    Full Eurocode 2 beam design.

    Parameters
    ----------
    inputs : dict
        Required keys: span, support_condition, dead_load, live_load,
        b_w, h, c_nom, fck, fyk, phi_bar, n_bars, phi_link, exposure_class.
        Optional keys: b_eff, h_f, w_max, moment_redistribution_pct,
        torsion_ted, fywk (defaults to fyk).

    Returns
    -------
    dict
        Keys: status, summary, steps, bmd_sfd, reinforcement_schedule,
        warnings, errors, timestamp.
    """
    warnings: list[str] = []
    errors: list[str] = []
    steps: list[dict[str, Any]] = []
    sn = 0  # step counter

    # ------------------------------------------------------------------
    # 0.  Parse and validate inputs
    # ------------------------------------------------------------------
    def _get(key: str, default: Any = None) -> Any:
        return inputs.get(key, default)

    L: float = float(_get("span", 0))
    support: str = str(_get("support_condition", "simply_supported"))
    Gk: float = float(_get("dead_load", 0))
    Qk: float = float(_get("live_load", 0))
    bw: float = float(_get("b_w", 0))
    h: float = float(_get("h", 0))
    c_nom: float = float(_get("c_nom", 35))
    fck: float = float(_get("fck", 30))
    fyk: float = float(_get("fyk", 500))
    fywk: float = float(_get("fywk", fyk))
    phi_bar: float = float(_get("phi_bar", 20))
    n_bars: int = int(_get("n_bars", 4))
    phi_link: float = float(_get("phi_link", 10))
    b_eff_input: float | None = _get("b_eff")
    h_f: float = float(_get("h_f", 0))
    w_max: float = float(_get("w_max", 0.3))
    redist_pct: float = float(_get("moment_redistribution_pct", 0))
    torsion_ted: float = float(_get("torsion_ted", 0))
    exposure_class: str = str(_get("exposure_class", "XC2")).upper()

    # Basic dimension checks
    for label, val in [("span", L), ("b_w", bw), ("h", h), ("fck", fck), ("fyk", fyk)]:
        if val <= 0:
            errors.append(f"Invalid input: {label} must be > 0 (got {val})")

    if errors:
        return {
            "status": "fail",
            "summary": {},
            "steps": [],
            "bmd_sfd": {},
            "reinforcement_schedule": [],
            "warnings": warnings,
            "errors": errors,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    # Derived material properties
    fcd: float = ALPHA_CC * fck / GAMMA_C
    fyd: float = fyk / GAMMA_S
    fywd: float = fywk / GAMMA_S
    Ecm: float = _ecm(fck)
    fctm_val: float = _fctm(fck)
    alphae: float = ES / Ecm  # modular ratio

    # Cover adequacy warning
    min_cover = _MIN_COVER.get(exposure_class, 30)
    if c_nom < min_cover:
        warnings.append(
            f"Nominal cover {c_nom} mm is below EC2 minimum {min_cover} mm "
            f"for class {exposure_class} (EC2 Table 4.4N)."
        )

    # ------------------------------------------------------------------
    # STEP 1 — EC0 Load Combination (Table A1.2(B))
    # ------------------------------------------------------------------
    sn += 1
    wu: float = 1.35 * Gk + 1.5 * Qk
    steps.append(_step(
        sn,
        "ULS Load Combination",
        "wu = 1.35·Gk + 1.50·Qk",
        f"wu = 1.35×{_r(Gk, 2)} + 1.50×{_r(Qk, 2)}",
        _r(wu, 3),
        "kN/m",
        "EC0 Table A1.2(B)",
        "info",
    ))

    # ------------------------------------------------------------------
    # STEP 2 — T-beam effective flange width (EC2 cl.5.3.2)
    # ------------------------------------------------------------------
    sn += 1
    # l0 = distance between points of zero moment
    l0_map = {
        "simply_supported": L,
        "continuous": 0.7 * L,
        "cantilever": 2.0 * L,
    }
    l0: float = l0_map.get(support, L)

    if b_eff_input is not None and b_eff_input > 0:
        b_eff: float = float(b_eff_input)
        b_eff_sub = f"b_eff supplied directly = {_r(b_eff, 1)} mm"
        b_eff_note = "User supplied"
    else:
        # Assume total flange each side beyond web = bi (use h_f as proxy geometry)
        bi: float = (b_eff_input or bw) / 2.0 if b_eff_input else bw  # simplified
        beff_i: float = min(0.2 * bi + 0.1 * l0, 0.2 * l0)
        b_eff = bw + 2 * beff_i
        b_eff_sub = (
            f"beff,i = min(0.2×{_r(bi,1)}+0.1×{_r(l0,1)*1000:.0f}, "
            f"0.2×{_r(l0,1)*1000:.0f}) = {_r(beff_i,1)} mm; "
            f"b_eff = {_r(bw,1)} + 2×{_r(beff_i,1)}"
        )
        b_eff_note = "EC2 cl.5.3.2(3)"

    # For rectangular beam, b_eff ≤ bw makes no sense — cap it
    b_eff = max(b_eff, bw)
    steps.append(_step(
        sn,
        "Effective Flange Width (T-beam)",
        "beff = bw + 2·beff,i;  beff,i = min(0.2·bi + 0.1·l0, 0.2·l0, bi)",
        b_eff_sub,
        _r(b_eff, 1),
        "mm",
        b_eff_note,
        "info",
    ))

    # ------------------------------------------------------------------
    # STEP 3 — Moment redistribution (EC2 cl.5.5)
    # ------------------------------------------------------------------
    sn += 1
    delta: float = 1.0 - redist_pct / 100.0
    if redist_pct > 0:
        # Minimum delta: 0.70 for fck ≤ 50
        delta_min = 0.70 if fck <= 50 else 0.80
        if delta < delta_min:
            delta = delta_min
            warnings.append(
                f"Redistribution capped: δ raised to {delta_min} (EC2 cl.5.5(4))."
            )
        redist_status = "info"
        redist_note = f"δ = {_r(delta,3)} (redistribution {redist_pct:.1f}%)"
    else:
        redist_status = "info"
        redist_note = "No redistribution; δ = 1.0"

    steps.append(_step(
        sn,
        "Moment Redistribution Factor",
        "δ = 1 − redistribution%; δ ≥ 0.70 for fck ≤ 50 MPa",
        f"δ = 1 − {redist_pct:.1f}/100 = {_r(delta,3)}",
        _r(delta, 3),
        "—",
        "EC2 Clause 5.5",
        redist_status,
    ))

    # K' depends on redistribution (EC2 cl.5.5(4) / BS NA)
    if redist_pct > 0:
        K_prime: float = 0.60 * delta - 0.18 * delta ** 2 - 0.21
        K_prime = max(K_prime, 0.104)  # lower bound
    else:
        K_prime = 0.167

    # ------------------------------------------------------------------
    # STEP 4 — Ultimate Bending Moment Med
    # ------------------------------------------------------------------
    sn += 1
    coeff_map = {
        "simply_supported": 1 / 8,
        "continuous": 1 / 10,
        "cantilever": 1 / 2,
    }
    coeff: float = coeff_map.get(support, 1 / 8)
    Mu: float = coeff * wu * L ** 2            # kNm (elastic)
    Med: float = delta * Mu                    # kNm (redistributed)

    steps.append(_step(
        sn,
        "Ultimate Design Moment",
        "Mu = coeff·wu·L²;  Med = δ·Mu",
        (
            f"coeff = {coeff:.4f} ({support}); "
            f"Mu = {coeff:.4f}×{_r(wu,3)}×{_r(L,2)}² = {_r(Mu,2)} kNm; "
            f"Med = {_r(delta,3)}×{_r(Mu,2)} = {_r(Med,2)} kNm"
        ),
        _r(Med, 2),
        "kNm",
        "EC2 Clause 5.5 / EC0 A1.2",
        "info",
    ))

    # ------------------------------------------------------------------
    # STEP 5 — Effective depth d
    # ------------------------------------------------------------------
    sn += 1
    d: float = h - c_nom - phi_link - phi_bar / 2.0
    d_status = "pass" if d > 0 else "fail"
    if d <= 0:
        errors.append(f"Effective depth d = {d:.1f} mm ≤ 0. Increase beam depth or reduce cover.")

    steps.append(_step(
        sn,
        "Effective Depth",
        "d = h − c_nom − φ_link − φ_bar/2",
        f"d = {_r(h,1)} − {_r(c_nom,1)} − {_r(phi_link,1)} − {_r(phi_bar/2,1)}",
        _r(d, 1),
        "mm",
        "EC2 Clause 8.3",
        d_status,
    ))

    if d <= 0:
        return _fail_return(steps, warnings, errors)

    # ------------------------------------------------------------------
    # STEP 6 — K factor and K' check
    # ------------------------------------------------------------------
    sn += 1
    Med_Nmm: float = Med * 1e6  # N·mm
    K: float = Med_Nmm / (bw * d ** 2 * fck)
    k_status = "pass" if K <= K_prime else "warning"
    k_note = "" if K <= K_prime else "  [K > K' → compression steel required]"

    steps.append(_step(
        sn,
        "Flexural K Factor",
        "K = Med/(bw·d²·fck);  K' = 0.167 (no redistribution)",
        (
            f"K = {_r(Med_Nmm/1e6,2)}×10⁶/({_r(bw,1)}×{_r(d,1)}²×{_r(fck,1)}) "
            f"= {_r(K,4)};  K' = {_r(K_prime,4)}{k_note}"
        ),
        _r(K, 4),
        "—",
        "EC2 Clause 3.1.7",
        k_status,
    ))

    # ------------------------------------------------------------------
    # STEP 7 — Lever arm z
    # ------------------------------------------------------------------
    sn += 1
    inner = max(0.0, 0.25 - K / 1.134)
    z: float = min(d * (0.5 + math.sqrt(inner)), 0.95 * d)
    z_capped = z >= 0.95 * d
    z_sub = (
        f"z = {_r(d,1)}×[0.5 + √(0.25−{_r(K,4)}/1.134)] = {_r(d*(0.5+math.sqrt(inner)),1)} mm"
        + (f"  → capped at 0.95d = {_r(0.95*d,1)} mm" if z_capped else "")
    )
    if z_capped:
        warnings.append("Lever arm capped at 0.95d (EC2 cl.3.1.7).")

    steps.append(_step(
        sn,
        "Lever Arm",
        "z = d·[0.5 + √(0.25 − K/1.134)],  z ≤ 0.95d",
        z_sub,
        _r(z, 1),
        "mm",
        "EC2 Clause 3.1.7",
        "info",
    ))

    # ------------------------------------------------------------------
    # STEP 8 — Required tension steel As,req
    # ------------------------------------------------------------------
    sn += 1
    As_req: float = Med_Nmm / (0.87 * fyk * z)   # mm²
    As_prov: float = n_bars * math.pi * phi_bar ** 2 / 4.0

    steps.append(_step(
        sn,
        "Required Tension Reinforcement",
        "As,req = Med / (0.87·fyk·z)",
        f"As,req = {_r(Med_Nmm/1e6,2)}×10⁶ / (0.87×{_r(fyk,1)}×{_r(z,1)}) = {_r(As_req,1)} mm²",
        _r(As_req, 1),
        "mm²",
        "EC2 Clause 6.1",
        "info",
    ))

    # ------------------------------------------------------------------
    # STEP 9 — Minimum reinforcement (EC2 cl.9.2.1.1)
    # ------------------------------------------------------------------
    sn += 1
    As_min_a: float = 0.26 * fctm_val * bw * d / fyk
    As_min_b: float = 0.0013 * bw * d
    As_min: float = max(As_min_a, As_min_b)
    as_min_status = "pass" if As_prov >= As_min else "fail"
    if As_prov < As_min:
        errors.append(f"As,prov = {As_prov:.0f} mm² < As,min = {As_min:.0f} mm² (EC2 cl.9.2.1.1).")

    steps.append(_step(
        sn,
        "Minimum Tension Reinforcement",
        "As,min = max(0.26·fctm·bw·d/fyk, 0.0013·bw·d)",
        (
            f"As,min_a = 0.26×{_r(fctm_val,2)}×{_r(bw,1)}×{_r(d,1)}/{_r(fyk,1)} = {_r(As_min_a,1)} mm²; "
            f"As,min_b = 0.0013×{_r(bw,1)}×{_r(d,1)} = {_r(As_min_b,1)} mm²; "
            f"As,min = {_r(As_min,1)} mm²"
        ),
        _r(As_min, 1),
        "mm²",
        "EC2 Clause 9.2.1.1",
        as_min_status,
    ))

    # ------------------------------------------------------------------
    # STEP 10 — Maximum reinforcement (EC2 cl.9.2.1.1)
    # ------------------------------------------------------------------
    sn += 1
    As_max: float = 0.04 * bw * h
    as_max_status = "pass" if As_prov <= As_max else "fail"
    if As_prov > As_max:
        errors.append(f"As,prov = {As_prov:.0f} mm² > As,max = {As_max:.0f} mm² (EC2 cl.9.2.1.1).")

    steps.append(_step(
        sn,
        "Maximum Tension Reinforcement",
        "As,max = 0.04·bw·h",
        f"As,max = 0.04×{_r(bw,1)}×{_r(h,1)} = {_r(As_max,1)} mm²",
        _r(As_max, 1),
        "mm²",
        "EC2 Clause 9.2.1.1",
        as_max_status,
    ))

    # ------------------------------------------------------------------
    # STEP 11 — Compression steel (if K > K')
    # ------------------------------------------------------------------
    sn += 1
    As2_req: float = 0.0
    if K > K_prime:
        d2: float = c_nom + phi_link + phi_bar / 2.0  # depth to comp steel
        # Stress in comp steel (may not yield)
        x_lim: float = (K_prime - 0.167) / 0.0007 + d  # approximate
        # Standard formula:  As2 = (K − K')·fck·bw·d² / (fyd·(d − d2))
        As2_req = (K - K_prime) * fck * bw * d ** 2 / (fyd * (d - d2))
        comp_status = "warning"
        warnings.append(
            f"Compression steel required: As2,req = {As2_req:.0f} mm² "
            "(K > K'; consider increasing beam depth)."
        )
        comp_sub = (
            f"d₂ = {_r(d2,1)} mm; "
            f"As2 = ({_r(K,4)}−{_r(K_prime,4)})×{_r(fck,1)}×{_r(bw,1)}×{_r(d,1)}² "
            f"/ ({_r(fyd,1)}×({_r(d,1)}−{_r(d2,1)})) = {_r(As2_req,1)} mm²"
        )
    else:
        comp_status = "pass"
        comp_sub = f"K = {_r(K,4)} ≤ K' = {_r(K_prime,4)} → no compression steel required"

    steps.append(_step(
        sn,
        "Compression Reinforcement Check",
        "As2,req = (K−K')·fck·bw·d² / (fyd·(d−d₂))  [only when K > K']",
        comp_sub,
        _r(As2_req, 1),
        "mm²",
        "EC2 Clause 3.1.7 / 6.1",
        comp_status,
    ))

    # ------------------------------------------------------------------
    # STEP 12 — Design shear VEd
    # ------------------------------------------------------------------
    sn += 1
    # For UDL: VEd at d from face of support (EC2 cl.6.2.1(8))
    VEd_max: float = wu * L / 2.0   # kN at support
    # Critical shear at d from face:
    VEd: float = VEd_max - wu * (d / 1000.0)

    steps.append(_step(
        sn,
        "Design Shear Force",
        "VEd = wu·L/2 − wu·(d/1000)  [at distance d from face of support]",
        (
            f"VEd,max = {_r(wu,3)}×{_r(L,2)}/2 = {_r(VEd_max,2)} kN; "
            f"VEd = {_r(VEd_max,2)} − {_r(wu,3)}×{_r(d/1000,3)} = {_r(VEd,2)} kN"
        ),
        _r(VEd, 2),
        "kN",
        "EC2 Clause 6.2.1(8)",
        "info",
    ))

    # ------------------------------------------------------------------
    # STEP 13 — Shear capacity without links VRd,c (EC2 cl.6.2.2)
    # ------------------------------------------------------------------
    sn += 1
    rho_l: float = min(As_prov / (bw * d), 0.02)
    k_shear: float = min(2.0, 1.0 + math.sqrt(200.0 / d))
    VRd_c_formula: float = (
        CRD_C * k_shear * (100 * rho_l * fck) ** (1 / 3)
    ) * bw * d / 1000.0                                    # kN
    # Minimum VRd,c (EC2 cl.6.2.2(1)):
    v_min: float = 0.035 * k_shear ** 1.5 * fck ** 0.5
    VRd_c_min: float = v_min * bw * d / 1000.0
    VRd_c: float = max(VRd_c_formula, VRd_c_min)
    vrd_c_status = "pass" if VRd_c >= VEd else "info"

    steps.append(_step(
        sn,
        "Shear Capacity Without Links",
        "VRd,c = [CRd,c·k·(100·ρl·fck)^(1/3)]·bw·d",
        (
            f"ρl = {_r(rho_l,5)}; k = min(2.0, 1+√(200/{_r(d,1)})) = {_r(k_shear,4)}; "
            f"VRd,c = {_r(CRD_C,4)}×{_r(k_shear,4)}×(100×{_r(rho_l,5)}×{_r(fck,1)})^(1/3) "
            f"×{_r(bw,1)}×{_r(d,1)}/1000 = {_r(VRd_c,2)} kN"
        ),
        _r(VRd_c, 2),
        "kN",
        "EC2 Clause 6.2.2",
        vrd_c_status,
    ))

    # ------------------------------------------------------------------
    # STEP 14 — Shear strut angle θ optimisation (EC2 cl.6.2.3)
    # ------------------------------------------------------------------
    sn += 1
    nu: float = 0.6 * (1 - fck / 250)   # EC2 cl.6.2.3(3)
    # Find minimum θ satisfying VRd,max ≥ VEd
    VEd_N: float = VEd * 1000.0  # N
    theta_rad_opt: float = math.radians(45.0)
    for theta_deg_try in range(218, 451):   # 21.8° to 45.0° in 0.1° steps
        theta_try = math.radians(theta_deg_try / 10.0)
        VRd_max_try = 0.36 * bw * d * fck * nu * math.sin(2 * theta_try)
        if VRd_max_try >= VEd_N:
            theta_rad_opt = theta_try
            break

    theta_deg: float = math.degrees(theta_rad_opt)
    VRd_max: float = 0.36 * bw * d * fck * nu * math.sin(2 * theta_rad_opt) / 1000.0  # kN
    strut_status = "pass" if VRd_max >= VEd else "fail"
    if VRd_max < VEd:
        errors.append(
            f"VRd,max = {VRd_max:.2f} kN < VEd = {VEd:.2f} kN. "
            "Increase bw or fck; beam is too small for shear."
        )

    steps.append(_step(
        sn,
        "Shear Strut Angle Optimisation",
        "VRd,max = 0.36·bw·d·fck·ν·sin(2θ)/1000;  21.8° ≤ θ ≤ 45°",
        (
            f"ν = 0.6×(1−{_r(fck,1)}/250) = {_r(nu,4)}; "
            f"Optimal θ = {_r(theta_deg,1)}°; "
            f"VRd,max = 0.36×{_r(bw,1)}×{_r(d,1)}×{_r(fck,1)}×{_r(nu,4)}"
            f"×sin(2×{_r(theta_deg,1)}°)/1000 = {_r(VRd_max,2)} kN"
        ),
        _r(VRd_max, 2),
        "kN",
        "EC2 Clause 6.2.3",
        strut_status,
    ))

    # ------------------------------------------------------------------
    # STEP 15 — Shear link design (EC2 cl.6.2.3)
    # ------------------------------------------------------------------
    sn += 1
    cot_theta: float = 1.0 / math.tan(theta_rad_opt)
    # Asw/s required:
    Asw_per_leg: float = math.pi * phi_link ** 2 / 4.0
    n_legs: int = 2
    Asw_total: float = n_legs * Asw_per_leg    # mm² per spacing

    if VEd > VRd_c:
        # Links are structurally required
        Asw_s_req: float = VEd_N / (0.87 * fywk * z * cot_theta)   # mm²/mm
        s_calc: float = Asw_total / Asw_s_req if Asw_s_req > 0 else 999.0
    else:
        # Minimum links only (EC2 cl.9.2.2)
        rho_w_min: float = 0.08 * math.sqrt(fck) / fywk
        Asw_s_req = rho_w_min * bw
        s_calc = Asw_total / Asw_s_req if Asw_s_req > 0 else 999.0
        warnings.append("VEd ≤ VRd,c — minimum link provision governs (EC2 cl.9.2.2).")

    s_max: float = 0.75 * d   # EC2 cl.9.2.2(6)
    s_design: int = int(min(s_calc, s_max) // 25) * 25   # round down to 25 mm
    s_design = max(s_design, 75)                           # practical minimum

    link_status = "pass"
    steps.append(_step(
        sn,
        "Shear Link Design",
        "Asw/s = VEd/(0.87·fywk·z·cotθ);  s ≤ 0.75d",
        (
            f"Asw/s = {_r(VEd_N/1000,2)}×10³ / (0.87×{_r(fywk,1)}×{_r(z,1)}×{_r(cot_theta,4)}) "
            f"= {_r(Asw_s_req,4)} mm²/mm; "
            f"Asw per section = {_r(Asw_total,1)} mm²; "
            f"s_calc = {_r(s_calc,1)} mm; s_max = 0.75×{_r(d,1)} = {_r(s_max,1)} mm; "
            f"s_design = {s_design} mm"
        ),
        f"{s_design}",
        "mm",
        "EC2 Clause 6.2.3",
        link_status,
    ))

    # ------------------------------------------------------------------
    # STEP 16 — Torsion check (EC2 cl.6.3.1–6.3.3)
    # ------------------------------------------------------------------
    sn += 1
    As_torsion: float = 0.0
    if torsion_ted > 0:
        A_section: float = bw * h            # mm²
        u_section: float = 2 * (bw + h)     # mm
        tef: float = A_section / u_section   # effective wall thickness, mm
        Ak: float = (bw - tef) * (h - tef)  # mm²  — area enclosed by centre-line
        uk: float = 2 * ((bw - tef) + (h - tef))   # mm — perimeter of Ak
        # TRd,max (EC2 cl.6.3.2(4)):
        TRd_max: float = (
            2 * nu * fcd * Ak * tef
            * math.sin(theta_rad_opt) * math.cos(theta_rad_opt)
            / 1e6                            # N·mm → kNm
        )
        # Additional longitudinal steel from torsion (EC2 cl.6.3.2(3)):
        Ted_Nmm: float = torsion_ted * 1e6
        As_torsion = Ted_Nmm * uk / (2 * Ak * 0.87 * fyk)

        # Combined shear + torsion interaction (EC2 cl.6.3.2(4)):
        # TRd,c approximate (EC2 Annex; use conservative = TRd,max/3)
        TRd_c: float = TRd_max / 3.0
        VRd_comb: float = VRd_c
        interaction: float = torsion_ted / TRd_c + VEd / VRd_comb

        tor_status = "pass" if (torsion_ted <= TRd_max and interaction <= 1.0) else "fail"
        if interaction > 1.0:
            errors.append(
                f"Combined shear+torsion interaction ratio = {interaction:.3f} > 1.0 "
                "(EC2 cl.6.3.2(4))."
            )
        tor_sub = (
            f"tef = {_r(A_section,0)}/{_r(u_section,0)} = {_r(tef,1)} mm; "
            f"Ak = {_r(Ak,0)} mm²; uk = {_r(uk,0)} mm; "
            f"TRd,max = {_r(TRd_max,2)} kNm; "
            f"As,tor = {_r(As_torsion,1)} mm²; "
            f"Interaction = {_r(torsion_ted,2)}/{_r(TRd_c,2)} + "
            f"{_r(VEd,2)}/{_r(VRd_comb,2)} = {_r(interaction,3)}"
        )
    else:
        tor_status = "info"
        tor_sub = "TEd = 0; torsion check not required"

    steps.append(_step(
        sn,
        "Torsion Design Check",
        "TRd,max = 2·ν·fcd·Ak·tef·sinθ·cosθ;  As,tor = TEd·uk/(2·Ak·0.87·fyk)",
        tor_sub,
        _r(As_torsion, 1),
        "mm²",
        "EC2 Clause 6.3.1–6.3.3",
        tor_status,
    ))

    # ------------------------------------------------------------------
    # STEP 17 — Crack width (EC2 cl.7.3.4)
    # ------------------------------------------------------------------
    sn += 1
    # SLS moment: quasi-permanent combination ≈ Gk + ψ2·Qk (ψ2=0.3 office)
    psi2: float = 0.3
    Msls: float = (1 / 8) * (Gk + psi2 * Qk) * L ** 2   # kNm (simplified SS)
    Msls_Nmm: float = Msls * 1e6

    # Neutral axis depth at SLS (cracked transformed section)
    # α·As·(d-x) = bw·x²/2  →  x² + 2·α·ρ·d·x - 2·α·ρ·d² = 0
    rho_ten: float = As_prov / (bw * d)
    a_coeff: float = 1.0
    b_coeff: float = 2 * alphae * rho_ten * d
    c_coeff: float = -2 * alphae * rho_ten * d ** 2
    x_sls: float = (-b_coeff + math.sqrt(b_coeff ** 2 - 4 * a_coeff * c_coeff)) / 2.0

    # Cracked second moment of area
    I_cr: float = bw * x_sls ** 3 / 3 + alphae * As_prov * (d - x_sls) ** 2

    # Steel stress at SLS
    sigma_s: float = Msls_Nmm * alphae * (d - x_sls) / I_cr

    # Effective tension area (EC2 cl.7.3.2(3))
    h_cr: float = min(2.5 * (h - d), (h - x_sls) / 3.0, h / 2.0)
    Ac_eff: float = bw * h_cr
    rho_p_eff: float = As_prov / Ac_eff if Ac_eff > 0 else 0.01

    # Crack spacing sr,max (EC2 cl.7.3.4(3))
    sr_max: float = 3.4 * c_nom + 0.425 * K1_TORSION * K2_BENDING * phi_bar / rho_p_eff

    # Mean strain difference εsm − εcm (EC2 cl.7.3.4(2))
    fct_eff: float = fctm_val
    eps_sm_ecm_a: float = (
        sigma_s - KT * fct_eff / rho_p_eff * (1 + alphae * rho_p_eff)
    ) / ES
    eps_sm_ecm_b: float = 0.6 * sigma_s / ES
    eps_sm_ecm: float = max(eps_sm_ecm_a, eps_sm_ecm_b)

    # Crack width
    wk: float = sr_max * eps_sm_ecm

    crack_status = "pass" if wk <= w_max else "fail"
    if wk > w_max:
        errors.append(
            f"Crack width wk = {wk:.3f} mm > w_max = {w_max:.3f} mm (EC2 cl.7.3.4). "
            "Increase As or reduce bar spacing."
        )

    steps.append(_step(
        sn,
        "Crack Width Verification",
        "wk = sr,max·(εsm−εcm);  sr,max = 3.4·c + 0.425·k1·k2·φ/ρp,eff",
        (
            f"σs (SLS) = {_r(sigma_s,1)} MPa; "
            f"ρp,eff = {_r(rho_p_eff,5)}; "
            f"sr,max = 3.4×{_r(c_nom,1)} + 0.425×{K1_TORSION}×{K2_BENDING}×{_r(phi_bar,1)}"
            f"/{_r(rho_p_eff,5)} = {_r(sr_max,1)} mm; "
            f"εsm−εcm = {eps_sm_ecm:.6f}; "
            f"wk = {_r(sr_max,1)}×{eps_sm_ecm:.6f} = {_r(wk,3)} mm  "
            f"(limit {w_max:.2f} mm)"
        ),
        _r(wk, 3),
        "mm",
        "EC2 Clause 7.3.4",
        crack_status,
    ))

    # ------------------------------------------------------------------
    # STEP 18 — Long-term deflection (EC2 cl.7.4.3 + Annex H)
    # ------------------------------------------------------------------
    sn += 1
    # Uncracked neutral axis (gross section, ignoring steel)
    x0_uncr: float = h / 2.0
    I_uncr: float = bw * h ** 3 / 12.0  # mm⁴ (gross)
    Mcr: float = fctm_val * I_uncr / (h - x0_uncr) / 1e6   # kNm

    # Check if cracked at SLS
    if Msls < Mcr:
        I_eff: float = I_uncr
        cracked_note = f"M_SLS = {_r(Msls,2)} kNm < Mcr = {_r(Mcr,2)} kNm → uncracked"
    else:
        I_eff = I_cr
        cracked_note = f"M_SLS = {_r(Msls,2)} kNm ≥ Mcr = {_r(Mcr,2)} kNm → cracked"

    # Effective E accounting for creep
    Ec_eff: float = Ecm / (1.0 + PHI_CREEP)     # MPa

    # Elastic (short-term) deflection
    if support == "cantilever":
        delta_el: float = wu * (L * 1000) ** 4 / (8.0 * Ec_eff * I_eff) / 1000.0
    else:  # simply_supported or continuous approximation
        delta_el = 5.0 * wu * (L * 1000) ** 4 / (384.0 * Ec_eff * I_eff) / 1000.0

    # Long-term (creep amplified) — simplified EC2 Annex H:
    delta_total: float = delta_el * (1.0 + 0.5 * PHI_CREEP)

    # wu in N/mm for formula: 1 kN/m = 1 N/mm
    # Checks
    defl_lim_total: float = L * 1000 / 250.0    # mm  (EC2 cl.7.4.1(4))
    defl_lim_finish: float = L * 1000 / 500.0   # mm  (after finishes)

    defl_status = "pass"
    if delta_total > defl_lim_total:
        defl_status = "fail"
        errors.append(
            f"Long-term deflection δ_total = {delta_total:.1f} mm > L/250 = {defl_lim_total:.1f} mm."
        )
    elif delta_el > defl_lim_finish:
        defl_status = "warning"
        warnings.append(
            f"Elastic deflection δ_el = {delta_el:.1f} mm > L/500 = {defl_lim_finish:.1f} mm "
            "(post-finish limit, EC2 cl.7.4.1(4))."
        )

    defl_l_over_n = (L * 1000) / delta_total if delta_total > 0 else 999.0

    steps.append(_step(
        sn,
        "Long-term Deflection",
        "δ_el = 5·wu·L⁴/(384·Ec,eff·Ieff);  δ_total = δ_el·(1+0.5·φ)",
        (
            f"{cracked_note}; "
            f"Ec,eff = {_r(Ecm,0)}/(1+{PHI_CREEP}) = {_r(Ec_eff,0)} MPa; "
            f"I_eff = {I_eff:.3e} mm⁴; "
            f"δ_el = {_r(delta_el,1)} mm; "
            f"φ = {PHI_CREEP}; "
            f"δ_total = {_r(delta_el,1)}×(1+0.5×{PHI_CREEP}) = {_r(delta_total,1)} mm  "
            f"(limit L/250 = {_r(defl_lim_total,1)} mm)"
        ),
        _r(delta_total, 1),
        "mm",
        "EC2 Clause 7.4.3 / Annex H",
        defl_status,
    ))

    # ------------------------------------------------------------------
    # STEP 19 — BMD and SFD data (11-point profile)
    # ------------------------------------------------------------------
    sn += 1
    n_pts = 11
    x_vals: list[float] = [round(i * L / (n_pts - 1), 4) for i in range(n_pts)]
    bmd: list[float] = []
    sfd: list[float] = []

    for x in x_vals:
        if support == "simply_supported":
            mx = wu * x * (L - x) / 2.0
            vx = wu * L / 2.0 - wu * x
        elif support == "cantilever":
            mx = -wu * (L - x) ** 2 / 2.0
            vx = wu * (L - x)
        else:  # continuous — simplified
            mx = wu * x * (L - x) / 2.0 - Mu / 10.0
            vx = wu * L / 2.0 - wu * x
        bmd.append(round(mx, 3))
        sfd.append(round(vx, 3))

    steps.append(_step(
        sn,
        "BMD and SFD Profile (11-point)",
        "M(x) = wu·x·(L−x)/2;  V(x) = wu·L/2 − wu·x  [SS case]",
        f"11 points from x=0 to x={L} m; wu = {_r(wu,3)} kN/m",
        f"max M = {max(bmd):.2f} kNm at midspan",
        "kNm / kN",
        "EC2 — Analysis",
        "info",
    ))

    # ------------------------------------------------------------------
    # STEP 20 — Reinforcement schedule
    # ------------------------------------------------------------------
    sn += 1
    bar_label: str = f"T{int(phi_bar)}"
    As_prov_sched: float = round(As_prov, 1)

    # Link area
    link_area_each: float = math.pi * phi_link ** 2 / 4.0
    link_label: str = f"R{int(phi_link)}" if fywk <= 250 else f"T{int(phi_link)}"

    # Clear spacing between tension bars
    total_bar_width: float = n_bars * phi_bar + (n_bars - 1) * 25.0
    beam_available: float = bw - 2 * c_nom - 2 * phi_link
    spacing_clear: float = (
        (beam_available - n_bars * phi_bar) / max(n_bars - 1, 1)
    )
    if spacing_clear < max(phi_bar, 20.0):
        warnings.append(
            f"Clear bar spacing = {spacing_clear:.0f} mm may be < max(φ, 20 mm) "
            "(EC2 cl.8.2). Check bar arrangement."
        )

    rebar_schedule = [
        {
            "bar": bar_label,
            "n": n_bars,
            "layer": "tension (bottom)",
            "area_mm2": As_prov_sched,
            "cover_to_link_mm": c_nom,
        },
        {
            "bar": link_label,
            "n": n_legs,
            "layer": f"links @ {s_design} mm c/c",
            "area_mm2": round(n_legs * link_area_each, 1),
            "cover_to_link_mm": c_nom,
        },
    ]

    prov_status = "pass" if As_prov >= As_req and As_prov >= As_min else "fail"
    steps.append(_step(
        sn,
        "Reinforcement Schedule",
        "As,prov = n·π·φ²/4",
        (
            f"{n_bars}×{bar_label}: As,prov = {_r(As_prov_sched,1)} mm²  "
            f"[req {_r(As_req,1)} mm², min {_r(As_min,1)} mm²]; "
            f"Clear spacing = {_r(spacing_clear,1)} mm; "
            f"Links: {n_legs}×{link_label} @ {s_design} mm"
        ),
        _r(As_prov_sched, 1),
        "mm²",
        "EC2 Clause 8.2 / 9.2",
        prov_status,
    ))

    # ------------------------------------------------------------------
    # Overall status
    # ------------------------------------------------------------------
    if errors:
        overall_status = "fail"
    elif warnings:
        overall_status = "warning"
    else:
        overall_status = "pass"

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    summary: dict[str, Any] = {
        "effective_flange_width_mm": round(b_eff, 1),
        "ultimate_moment_knm": round(Mu, 2),
        "redistributed_moment_knm": round(Med, 2),
        "shear_force_kn": round(VEd, 2),
        "k_factor": round(K, 4),
        "k_prime": round(K_prime, 4),
        "lever_arm_mm": round(z, 1),
        "effective_depth_mm": round(d, 1),
        "steel_required_mm2": round(As_req, 1),
        "steel_provided_mm2": round(As_prov, 1),
        "steel_minimum_mm2": round(As_min, 1),
        "steel_maximum_mm2": round(As_max, 1),
        "compression_steel_mm2": round(As2_req, 1),
        "bar_provision": f"{n_bars}×T{int(phi_bar)} ({As_prov:.0f} mm²)",
        "shear_link_spacing_mm": s_design,
        "shear_strut_angle_deg": round(theta_deg, 1),
        "vrd_c_kn": round(VRd_c, 2),
        "vrd_max_kn": round(VRd_max, 2),
        "crack_width_mm": round(wk, 3),
        "crack_width_limit_mm": w_max,
        "crack_width_status": "pass" if wk <= w_max else "fail",
        "sls_steel_stress_mpa": round(sigma_s, 1),
        "long_term_deflection_mm": round(delta_total, 2),
        "elastic_deflection_mm": round(delta_el, 2),
        "deflection_l_over_n": round(defl_l_over_n, 0),
        "deflection_limit_l_250_mm": round(defl_lim_total, 1),
        "creep_factor": PHI_CREEP,
        "torsion_steel_additional_mm2": round(As_torsion, 1),
        "fck_mpa": fck,
        "fyk_mpa": fyk,
        "fcd_mpa": round(fcd, 2),
        "fyd_mpa": round(fyd, 2),
        "ecm_mpa": round(Ecm, 0),
        "fctm_mpa": round(fctm_val, 2),
        "design_code": "EC2 (BS EN 1992-1-1:2004)",
        "structural_design": f"RC Beam {int(bw)}×{int(h)} mm, {support.replace('_',' ').title()}, L={L} m",
    }

    return {
        "status": overall_status,
        "summary": summary,
        "steps": steps,
        "bmd_sfd": {
            "x_m": x_vals,
            "bmd_knm": bmd,
            "sfd_kn": sfd,
        },
        "reinforcement_schedule": rebar_schedule,
        "warnings": warnings,
        "errors": errors,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Internal helper for early-exit on fatal errors
# ---------------------------------------------------------------------------

def _fail_return(
    steps: list[dict[str, Any]],
    warnings: list[str],
    errors: list[str],
) -> dict[str, Any]:
    return {
        "status": "fail",
        "summary": {},
        "steps": steps,
        "bmd_sfd": {},
        "reinforcement_schedule": [],
        "warnings": warnings,
        "errors": errors,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Quick self-test (run directly: python beam_ec2_enhanced.py)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import json

    sample = {
        "span": 6.0,
        "support_condition": "simply_supported",
        "dead_load": 20.0,
        "live_load": 10.0,
        "b_w": 300.0,
        "h": 500.0,
        "c_nom": 35.0,
        "fck": 30.0,
        "fyk": 500.0,
        "phi_bar": 20.0,
        "n_bars": 4,
        "phi_link": 10.0,
        "exposure_class": "XC2",
        "w_max": 0.3,
        "moment_redistribution_pct": 0,
        "torsion_ted": 0.0,
    }

    result = calculate_beam_ec2(sample)
    print(f"\nOverall status : {result['status'].upper()}")
    print(f"Errors  : {result['errors']}")
    print(f"Warnings: {result['warnings']}")
    print(f"\nSummary:")
    for k, v in result["summary"].items():
        print(f"  {k:<40s}: {v}")
    print(f"\nSteps ({len(result['steps'])} total):")
    for s in result["steps"]:
        flag = f"[{s['status'].upper()}]"
        print(f"  {s['step_number']:>2}. {s['title']:<45s} {flag}  → {s['result']} {s['unit']}")
    print(f"\nBMD peak = {max(result['bmd_sfd']['bmd_knm']):.2f} kNm")
    print(f"SFD peak = {max(result['bmd_sfd']['sfd_kn']):.2f} kN")
    print(f"\nReinforcement schedule:")
    for r in result["reinforcement_schedule"]:
        print(f"  {r}")
