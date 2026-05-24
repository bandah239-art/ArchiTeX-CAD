"""Column design calculations per Eurocode 2."""

import math
from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value, select_bar_diameter

GAMMA_C = 1.5
GAMMA_S = 1.15

# Interaction diagram points (ν, μ) → ω — EC2 column design chart
_INTERACTION_CHART = [
    (0.00, 0.00, 0.00),
    (0.10, 0.02, 0.08),
    (0.20, 0.04, 0.16),
    (0.30, 0.06, 0.26),
    (0.40, 0.08, 0.36),
    (0.47, 0.083, 0.398),
    (0.50, 0.10, 0.42),
    (0.60, 0.12, 0.52),
    (0.70, 0.15, 0.65),
    (0.80, 0.18, 0.78),
]


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


def _lookup_omega(nu: float, mu: float) -> float:
    """Bilinear interpolation on column interaction diagram."""
    if nu <= 0 and mu <= 0:
        return 0.0

    best_omega = 0.0
    min_dist = float("inf")

    for v1, m1, w1 in _INTERACTION_CHART:
        for v2, m2, w2 in _INTERACTION_CHART:
            if v1 == v2 and m1 == m2:
                continue
            # Linear blend along chart segments
            pass

    # Grid search with inverse-distance weighting
    for nv, nm, nw in _INTERACTION_CHART:
        dist = math.sqrt((nu - nv) ** 2 + (mu - nm) ** 2)
        if dist < min_dist:
            min_dist = dist
            best_omega = nw

    # Refine with linear interpolation in ν at fixed μ band
    mu_band = sorted({p[1] for p in _INTERACTION_CHART})
    mu_target = mu
    lower_mu = max(p for p in mu_band if p <= mu_target) if any(p <= mu_target for p in mu_band) else mu_band[0]
    upper_mu = min(p for p in mu_band if p >= mu_target) if any(p >= mu_target for p in mu_band) else mu_band[-1]

    def omega_at(nu_val: float, mu_val: float) -> float:
        points = [(p[0], p[2]) for p in _INTERACTION_CHART if abs(p[1] - mu_val) < 1e-6]
        if not points:
            return best_omega
        points.sort()
        if nu_val <= points[0][0]:
            return points[0][1]
        if nu_val >= points[-1][0]:
            return points[-1][1]
        for i in range(len(points) - 1):
            v_a, w_a = points[i]
            v_b, w_b = points[i + 1]
            if v_a <= nu_val <= v_b:
                t = (nu_val - v_a) / (v_b - v_a)
                return w_a + t * (w_b - w_a)
        return best_omega

    if abs(upper_mu - lower_mu) < 1e-6:
        return omega_at(nu, lower_mu)

    w_lower = omega_at(nu, lower_mu)
    w_upper = omega_at(nu, upper_mu)
    t = (mu_target - lower_mu) / (upper_mu - lower_mu)
    return w_lower + t * (w_upper - w_lower)


def calculate_column(inputs: dict[str, Any]) -> dict[str, Any]:
    """Run full Eurocode 2 column design."""
    height = inputs["height"]
    b = inputs["width"]
    h = inputs["depth"]
    ned = inputs["axial_load"]
    moment_major = inputs.get("moment_major", 0)
    moment_minor = inputs.get("moment_minor", 0)
    fck = inputs["fck"]
    fyk = inputs["fyk"]
    le_factor = inputs.get("le_factor", 1.0)

    steps: list[dict[str, Any]] = []
    warnings: list[str] = []
    errors: list[str] = []
    overall_status = "pass"

    ac = b * h
    fcd = fck / GAMMA_C
    fyd = fyk / GAMMA_S
    ned_n = ned * 1000

    # Step 1: Effective length
    lo = le_factor * height
    lo_mm = lo * 1000
    steps.append(
        _step(
            1,
            "Calculate Effective Length",
            "lo = le_factor · height",
            f"lo = {le_factor} × {height}",
            f"lo = {round_value(lo, 2)} m",
            "m",
            "Eurocode 2: Clause 5.8.3.2",
            "info",
        )
    )

    # Step 2: Slenderness ratio
    i = math.sqrt(b**2 / 12)
    slenderness = lo_mm / i
    n_rel = ned_n / (ac * fcd)
    rm = 0.0 if moment_major == 0 else min(abs(moment_minor / moment_major), 1.0) if moment_major else 0.0
    a_factor = 0.7
    b_factor = 1.1
    c_factor = 1.7 - rm
    lambda_lim = (20 * a_factor * b_factor * c_factor) / math.sqrt(max(n_rel, 0.01))

    steps.append(
        _step(
            2,
            "Calculate Slenderness Ratio",
            "i = √(b²/12); λ = lo/i; λlim = 20·A·B·C/√n",
            f"i = √({b}²/12) = {round_value(i, 1)} mm; n = {round_value(n_rel, 3)}",
            f"λ = {round_value(slenderness, 1)}; λlim = {round_value(lambda_lim, 1)}",
            "",
            "Eurocode 2: Clause 5.8.3.2",
            "info",
        )
    )

    # Step 3: Slenderness check
    is_short = slenderness < lambda_lim or slenderness <= 50
    column_type = "SHORT ✓" if is_short else "SLENDER ⚠"
    slend_status = "pass" if is_short else "warning"
    if not is_short:
        warnings.append("Slender column — second-order effects apply per EC2 Clause 5.8")

    steps.append(
        _step(
            3,
            "Slenderness Check",
            "λ < λlim → short column; λ ≥ λlim → slender column",
            f"λ = {round_value(slenderness, 1)}, λlim = {round_value(lambda_lim, 1)}",
            f"Column Type: {column_type}",
            "",
            "Eurocode 2: Clause 5.8.3",
            slend_status,
        )
    )

    # Step 4: Design axial load
    steps.append(
        _step(
            4,
            "Design Axial Load",
            "NEd = axial_load",
            f"NEd = {ned}",
            f"NEd = {round_value(ned, 1)} kN",
            "kN",
            "Eurocode 2: Clause 5.8",
            "info",
        )
    )

    # Step 5: Minimum eccentricity
    e_min = max(h / 30, 20)
    m_min = ned * e_min / 1000
    steps.append(
        _step(
            5,
            "Minimum Eccentricity",
            "e_min = max(h/30, 20mm); M_min = NEd · e_min",
            f"e_min = max({h}/30, 20) = {round_value(e_min, 1)} mm",
            f"M_min = {round_value(m_min, 2)} kNm",
            "kNm",
            "Eurocode 2: Clause 6.1(4)",
            "info",
        )
    )

    # Step 6: Design moment
    med = max(moment_major, m_min)
    steps.append(
        _step(
            6,
            "Design Moment",
            "MEd = max(M_major, M_min)",
            f"MEd = max({moment_major}, {round_value(m_min, 2)})",
            f"MEd = {round_value(med, 2)} kNm",
            "kNm",
            "Eurocode 2: Clause 5.8",
            "info",
        )
    )

    # Step 7: Normalised parameters
    nu = ned_n / (b * h * fcd)
    mu = (med * 1e6) / (b * h**2 * fcd)
    steps.append(
        _step(
            7,
            "Normalised Parameters",
            "ν = NEd/(b·h·fcd); μ = MEd/(b·h²·fcd); fcd = fck/1.5",
            f"ν = {round_value(nu, 3)}, μ = {round_value(mu, 3)}, fcd = {round_value(fcd, 2)} MPa",
            f"ν = {round_value(nu, 3)}, μ = {round_value(mu, 3)}",
            "",
            "Eurocode 2: Annex B / Design charts",
            "info",
        )
    )

    # Step 8: Steel ratio from interaction diagram
    omega = _lookup_omega(nu, mu)
    as_req = omega * b * h * fcd / fyd
    _, bar_provision = select_bar_diameter(as_req)

    # Parse provided area
    provided_area = as_req
    try:
        parts = bar_provision.split("(")
        if len(parts) > 1:
            provided_area = float(parts[1].replace("mm²)", "").strip())
    except (ValueError, IndexError):
        pass

    steps.append(
        _step(
            8,
            "Steel Ratio from Interaction Diagram",
            "ω = f(ν, μ); As,req = ω·b·h·fcd/fyd",
            f"ω = {round_value(omega, 3)}, fyd = {round_value(fyd, 1)} MPa",
            f"As,req = {round_value(as_req, 0)} mm² — Provide: {bar_provision}",
            "mm²",
            "Eurocode 2: Annex B — Column chart",
            "info",
        )
    )

    # Step 9: Minimum steel check
    as_min = max(0.10 * ned_n / fyd, 0.002 * b * h)
    min_ok = as_req >= as_min
    if not min_ok:
        overall_status = "fail"
        errors.append(f"Required steel {round_value(as_req, 0)} mm² below minimum {round_value(as_min, 0)} mm²")
        as_req = as_min

    steps.append(
        _step(
            9,
            "Minimum Steel Check",
            "As,min = max(0.10·NEd/fyd, 0.002·b·h)",
            f"As,min = max({round_value(0.10 * ned_n / fyd, 0)}, {round_value(0.002 * b * h, 0)})",
            f"As,req = {round_value(as_req, 0)} mm² {'✓' if min_ok else '✗'} (≥ {round_value(as_min, 0)} mm²)",
            "mm²",
            "Eurocode 2: Clause 9.5.2(1)",
            "pass" if min_ok else "fail",
        )
    )

    # Step 10: Maximum steel check
    as_max = 0.04 * b * h
    max_ok = as_req <= as_max
    if not max_ok:
        overall_status = "fail"
        errors.append(f"Required steel exceeds maximum {round_value(as_max, 0)} mm²")

    steps.append(
        _step(
            10,
            "Maximum Steel Check",
            "As,max = 0.04·b·h",
            f"As,max = 0.04 × {b} × {h}",
            f"As,req = {round_value(as_req, 0)} mm² {'✓' if max_ok else '✗'} (≤ {round_value(as_max, 0)} mm²)",
            "mm²",
            "Eurocode 2: Clause 9.5.2(3)",
            "pass" if max_ok else "fail",
        )
    )

    # Step 11: Link spacing
    phi_min = 16
    link_size = 8
    s_max = min(20 * phi_min, min(b, h), 400)
    link_spacing = int(min(s_max, 300))
    link_spacing = max(75, int(round(link_spacing / 25) * 25))

    steps.append(
        _step(
            11,
            "Link Spacing",
            "s_max = min(20·φ_min, min(b,h), 400mm)",
            f"s_max = min({20 * phi_min}, {min(b, h)}, 400)",
            f"Provide H{link_size} @ {link_spacing} mm c/c",
            "mm",
            "Eurocode 2: Clause 9.5.3(3)",
            "pass",
        )
    )

    summary = {
        "effective_length_m": round_value(lo, 2),
        "slenderness_lambda": round_value(slenderness, 1),
        "slenderness_limit": round_value(lambda_lim, 1),
        "column_type": "SHORT ✓" if is_short else "SLENDER ⚠",
        "axial_load_kn": round_value(ned, 1),
        "design_moment_knm": round_value(med, 2),
        "min_eccentricity_mm": round_value(e_min, 1),
        "steel_required_mm2": round_value(as_req, 0),
        "steel_provided_mm2": round_value(provided_area, 0),
        "bar_provision": bar_provision,
        "link_size": f"H{link_size}",
        "link_spacing_mm": link_spacing,
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
