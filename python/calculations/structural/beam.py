"""Beam design calculations per Eurocode 2."""

import math
from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value, select_bar_diameter
from calculations.utils.validators import validate_beam_inputs

# Eurocode 2 constants
K_PRIME = 0.167  # Limit for no compression steel
GAMMA_C = 1.5
GAMMA_S = 1.15
ALPHA_CC = 0.85
ETA = 0.85
CRD_C = 0.18 / GAMMA_C

# Cover by exposure class (mm)
COVER_MAP = {
    "XC1": 25,
    "XC2": 30,
    "XC3": 30,
    "XC4": 35,
}

# fctm by concrete grade (MPa)
FCTM_MAP = {25: 2.6, 30: 2.9, 35: 3.2, 40: 3.5}

# Moment coefficients by support condition
MOMENT_COEFF = {
    "simply_supported": 1 / 8,
    "continuous_end": 1 / 10,
    "continuous_internal": 1 / 12,
    "cantilever": 1 / 2,
}


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


def calculate_beam(inputs: dict[str, Any]) -> dict[str, Any]:
    """Run full Eurocode 2 beam design calculation."""
    validate_beam_inputs(inputs)

    span = inputs["span"]
    support = inputs.get("support_condition", "simply_supported")
    gk = inputs["dead_load"]
    qk = inputs["imposed_load"]
    b = inputs["width"]
    h = inputs["depth"]
    fck = inputs["fck"]
    fyk = inputs["fyk"]
    exposure = inputs.get("exposure_class", "XC1")
    design_code = inputs.get("design_code", "Eurocode2")

    steps: list[dict[str, Any]] = []
    warnings: list[str] = []
    errors: list[str] = []
    overall_status = "pass"

    # Step 1: Load combinations
    wu = 1.35 * gk + 1.5 * qk
    steps.append(
        _step(
            1,
            "Calculate Ultimate Design Load",
            "wu = 1.35·Gk + 1.5·Qk",
            f"wu = 1.35({gk}) + 1.5({qk})",
            f"wu = {round_value(wu, 2)} kN/m",
            "kN/m",
            "Eurocode 0: Table A1.2(B)",
            "info",
        )
    )

    # Step 2: Ultimate bending moment
    coeff = MOMENT_COEFF.get(support, 1 / 8)
    mu = wu * span**2 * coeff
    coeff_label = {
        "simply_supported": "L²/8",
        "continuous_end": "L²/10",
        "continuous_internal": "L²/12",
        "cantilever": "L²/2",
    }.get(support, "L²/8")

    steps.append(
        _step(
            2,
            "Calculate Ultimate Bending Moment",
            f"Mu = wu·{coeff_label}",
            f"Mu = {round_value(wu, 2)} × {span}² × {coeff}",
            f"Mu = {round_value(mu, 2)} kNm",
            "kNm",
            "Eurocode 2: Clause 6.1",
            "info",
        )
    )

    # Step 3: Effective depth
    c_nom = COVER_MAP.get(exposure, 25)
    delta_c_dev = 10
    c_nom_total = c_nom + delta_c_dev
    phi_link = 8
    phi_bar = 16
    d = h - c_nom_total - phi_link - phi_bar / 2

    steps.append(
        _step(
            3,
            "Calculate Effective Depth",
            "d = h - c_nom - φ_link - φ_bar/2",
            f"d = {h} - {c_nom_total} - {phi_link} - {phi_bar / 2}",
            f"d = {round_value(d, 1)} mm",
            "mm",
            "Eurocode 2: Clause 4.4.1",
            "info",
        )
    )

    # Step 4: K factor
    mu_nmm = mu * 1e6
    fcd = ALPHA_CC * fck / GAMMA_C
    k = mu_nmm / (b * d**2 * fck)
    k_status = "pass" if k <= K_PRIME else "fail"
    if k > K_PRIME:
        overall_status = "fail"
        errors.append(f"K factor {round_value(k, 4)} exceeds K' = {K_PRIME}. Compression steel required.")

    steps.append(
        _step(
            4,
            "Calculate K Factor",
            "K = Mu / (b·d²·fck)",
            f"K = {round_value(mu_nmm, 0)} / ({b} × {round_value(d, 1)}² × {fck})",
            f"K = {round_value(k, 4)} {'✓' if k <= K_PRIME else '✗'} (< {K_PRIME})",
            "",
            "Eurocode 2: Clause 6.1",
            k_status,
        )
    )

    # Step 5: Lever arm
    z_calc = d * (0.5 + math.sqrt(0.25 - k / 1.134))
    z = min(z_calc, 0.95 * d)

    steps.append(
        _step(
            5,
            "Calculate Lever Arm",
            "z = d·[0.5 + √(0.25 - K/1.134)]",
            f"z = {round_value(d, 1)} × [0.5 + √(0.25 - {round_value(k, 4)}/1.134)]",
            f"z = {round_value(z, 1)} mm (≤ 0.95d = {round_value(0.95 * d, 1)} mm)",
            "mm",
            "Eurocode 2: Clause 6.1",
            "info",
        )
    )

    # Step 6: Tension steel area
    as_req = mu_nmm / (0.87 * fyk * z)
    _, bar_provision = select_bar_diameter(as_req)

    steps.append(
        _step(
            6,
            "Calculate Required Tension Steel",
            "As,req = Mu / (0.87·fyk·z)",
            f"As,req = {round_value(mu_nmm, 0)} / (0.87 × {fyk} × {round_value(z, 1)})",
            f"As,req = {round_value(as_req, 0)} mm² — Provide: {bar_provision}",
            "mm²",
            "Eurocode 2: Clause 6.1",
            "info",
        )
    )

    # Step 7: Minimum steel check
    fctm = FCTM_MAP.get(fck, 2.9)
    as_min_1 = 0.26 * fctm * b * d / fyk
    as_min_2 = 0.0013 * b * d
    as_min = max(as_min_1, as_min_2)
    min_status = "pass" if as_req >= as_min else "fail"
    if as_req < as_min:
        overall_status = "fail"
        errors.append(f"Required steel {round_value(as_req, 0)} mm² below minimum {round_value(as_min, 0)} mm²")

    steps.append(
        _step(
            7,
            "Minimum Steel Check",
            "As,min = max(0.26·fctm·b·d/fyk, 0.0013·b·d)",
            f"As,min = max({round_value(as_min_1, 0)}, {round_value(as_min_2, 0)})",
            f"As,min = {round_value(as_min, 0)} mm² — As,req = {round_value(as_req, 0)} mm² {'✓' if as_req >= as_min else '✗'}",
            "mm²",
            "Eurocode 2: Clause 9.2.1.1",
            min_status,
        )
    )

    # Step 8: Maximum steel check
    as_max = 0.04 * b * h
    max_status = "pass" if as_req <= as_max else "fail"
    if as_req > as_max:
        overall_status = "fail"
        errors.append(f"Required steel exceeds maximum {round_value(as_max, 0)} mm²")

    steps.append(
        _step(
            8,
            "Maximum Steel Check",
            "As,max = 0.04·b·h",
            f"As,max = 0.04 × {b} × {h}",
            f"As,max = {round_value(as_max, 0)} mm² — As,req = {round_value(as_req, 0)} mm² {'✓' if as_req <= as_max else '✗'}",
            "mm²",
            "Eurocode 2: Clause 9.2.1.1",
            max_status,
        )
    )

    # Step 9: Shear design
    if support == "cantilever":
        ved = wu * span
    else:
        ved = wu * span / 2

    ved_n = ved * 1000
    v_ed = ved_n / (b * d)
    k_shear = min(2.0, 1 + math.sqrt(200 / d))
    rho_l = as_req / (b * d)
    v_rd_c = CRD_C * k_shear * (100 * rho_l * fck) ** (1 / 3) * 1000  # N/mm² → check in MPa scale
    v_rd_c_mpa = v_rd_c / 1000 * 1000  # Convert to comparable units
    v_rd_c_kn = v_rd_c_mpa * b * d / 1000

    shear_links_required = v_ed > v_rd_c_mpa
    if shear_links_required:
        link_spacing = max(50, min(300, int(0.75 * d)))
        link_note = f"H8 @ {link_spacing} c/c"
        shear_status = "warning"
        warnings.append("Shear links required — design links per EC2 Clause 6.2.3")
    else:
        link_note = "None required"
        shear_status = "pass"

    steps.append(
        _step(
            9,
            "Shear Design",
            "VEd = wu·L/2; vEd = VEd/(b·d); vRd,c = CRd,c·k·(100·ρl·fck)^(1/3)",
            f"VEd = {round_value(wu, 2)} × {span}/2 = {round_value(ved, 2)} kN",
            f"vEd = {round_value(v_ed, 3)} N/mm²; vRd,c = {round_value(v_rd_c_mpa, 3)} N/mm² — Links: {link_note}",
            "kN",
            "Eurocode 2: Clause 6.2.2",
            shear_status,
        )
    )

    # Step 10: Deflection check
    span_depth = (span * 1000) / h
    basic_ratio = 26  # Simply supported basic ratio from Table 7.4N
    if support == "continuous_end" or support == "continuous_internal":
        basic_ratio = 30
    elif support == "cantilever":
        basic_ratio = 7

    defl_status = "pass" if span_depth <= basic_ratio else "fail"
    if span_depth > basic_ratio:
        overall_status = "fail" if overall_status == "pass" else overall_status
        errors.append(f"Span/depth ratio {round_value(span_depth, 1)} exceeds allowable {basic_ratio}")

    steps.append(
        _step(
            10,
            "Deflection Check (Span/Depth Ratio)",
            "L/h ≤ basic ratio (Table 7.4N)",
            f"L/h = ({span} × 1000) / {h}",
            f"L/h = {round_value(span_depth, 1)} {'✓' if span_depth <= basic_ratio else '✗'} (≤ {basic_ratio})",
            "",
            "Eurocode 2: Table 7.4N",
            defl_status,
        )
    )

    # Parse provided steel area from bar provision
    provided_area = as_req
    try:
        parts = bar_provision.split("(")
        if len(parts) > 1:
            provided_area = float(parts[1].replace("mm²)", "").strip())
    except (ValueError, IndexError):
        pass

    summary = {
        "ultimate_moment_knm": round_value(mu, 2),
        "shear_force_kn": round_value(ved, 2),
        "k_factor": round_value(k, 4),
        "lever_arm_mm": round_value(z, 1),
        "steel_required_mm2": round_value(as_req, 0),
        "steel_provided_mm2": round_value(provided_area, 0),
        "bar_provision": bar_provision,
        "shear_capacity_kn": round_value(v_rd_c_kn, 2),
        "links_required": link_note,
        "span_depth_ratio": round_value(span_depth, 1),
        "design_code": design_code,
        "structural_design": "PASS ✓" if overall_status == "pass" else "FAIL ✗",
    }

    return {
        "status": overall_status,
        "summary": summary,
        "steps": steps,
        "warnings": warnings,
        "errors": errors,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
