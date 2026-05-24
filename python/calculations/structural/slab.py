"""Slab design calculations per Eurocode 2 — one-way and two-way."""

import math
from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value, slab_bar_spacing

K_PRIME = 0.167
B = 1000  # design width mm per metre run

# Two-way moment coefficients βsx, βsy (Ms = β·n·lx²) — EC2 coefficient table
_SPAN_RATIOS = [1.0, 1.1, 1.2, 1.25, 1.3, 1.4, 1.5, 1.75, 2.0]
_BETA_SX = [0.122, 0.116, 0.112, 0.108, 0.105, 0.102, 0.098, 0.092, 0.087]
_BETA_SY = [0.122, 0.095, 0.082, 0.076, 0.071, 0.067, 0.063, 0.058, 0.055]

_ONE_WAY_COEFF = {
    "simply_supported": 1 / 8,
    "continuous": 1 / 10,
    "continuous_end": 1 / 10,
    "continuous_internal": 1 / 12,
}

_DEFL_BASIC = {
    "simply_supported": 20,
    "continuous": 26,
    "continuous_end": 26,
    "continuous_internal": 30,
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


def _interpolate(ratio: float, ratios: list[float], values: list[float]) -> float:
    if ratio <= ratios[0]:
        return values[0]
    if ratio >= ratios[-1]:
        return values[-1]
    for i in range(len(ratios) - 1):
        if ratios[i] <= ratio <= ratios[i + 1]:
            t = (ratio - ratios[i]) / (ratios[i + 1] - ratios[i])
            return values[i] + t * (values[i + 1] - values[i])
    return values[-1]


def _design_steel(moment_knm: float, depth_mm: float, fck: float, fyk: float) -> dict[str, float]:
    mu_nmm = moment_knm * 1e6
    k = mu_nmm / (B * depth_mm**2 * fck)
    if k > K_PRIME:
        z = 0.95 * depth_mm
    else:
        z = min(depth_mm * (0.5 + math.sqrt(0.25 - k / 1.134)), 0.95 * depth_mm)
    as_req = mu_nmm / (0.87 * fyk * z)
    return {"k": k, "z": z, "as_req": as_req}


def calculate_slab(inputs: dict[str, Any]) -> dict[str, Any]:
    """Run full Eurocode 2 slab design (one-way or two-way)."""
    slab_type = inputs.get("slab_type", "one_way")
    lx = inputs["span_lx"]
    ly = inputs.get("span_ly", lx)
    gk = inputs["dead_load"]
    qk = inputs["live_load"]
    h = inputs["depth"]
    fck = inputs["fck"]
    fyk = inputs["fyk"]
    support = inputs.get("support_condition", "simply_supported")

    steps: list[dict[str, Any]] = []
    warnings: list[str] = []
    errors: list[str] = []
    overall_status = "pass"

    # Step 1: Design load
    n = 1.35 * gk + 1.5 * qk
    steps.append(
        _step(
            1,
            "Calculate Design Load",
            "n = 1.35·Gk + 1.5·Qk",
            f"n = 1.35({gk}) + 1.5({qk})",
            f"n = {round_value(n, 2)} kN/m²",
            "kN/m²",
            "Eurocode 0: Table A1.2(B)",
            "info",
        )
    )

    # Step 2: Span ratio check
    span_ratio = ly / lx if lx > 0 else 1.0
    is_two_way = slab_type == "two_way" and span_ratio <= 2.0
    if slab_type == "two_way" and span_ratio > 2.0:
        warnings.append(f"ly/lx = {round_value(span_ratio, 2)} > 2.0 — treating as one-way slab")
        is_two_way = False

    ratio_status = "pass" if span_ratio <= 2.0 or not is_two_way else "info"
    steps.append(
        _step(
            2,
            "Span Ratio Check",
            "ly/lx ≤ 2.0 for two-way behaviour",
            f"ly/lx = {ly}/{lx}",
            f"ly/lx = {round_value(span_ratio, 2)} — {'Two-way confirmed ✓' if is_two_way else 'One-way behaviour'}",
            "",
            "Eurocode 2: Slab design",
            ratio_status,
        )
    )

    # Step 3: Bending moments
    if is_two_way:
        beta_sx = _interpolate(span_ratio, _SPAN_RATIOS, _BETA_SX)
        beta_sy = _interpolate(span_ratio, _SPAN_RATIOS, _BETA_SY)
        msx = beta_sx * n * lx**2
        msy = beta_sy * n * lx**2
        moment_formula = "Msx = βsx·n·lx²; Msy = βsy·n·lx²"
        moment_sub = f"βsx = {round_value(beta_sx, 3)}, βsy = {round_value(beta_sy, 3)}, lx = {lx} m"
        moment_result = (
            f"Msx = {round_value(msx, 1)} kNm/m; "
            f"Msy = {round_value(msy, 1)} kNm/m"
        )
        moment_ref = "Eurocode 2: Two-way slab coefficient table"
    else:
        coeff = _ONE_WAY_COEFF.get(support, 1 / 8)
        coeff_label = {
            1 / 8: "lx²/8",
            1 / 10: "lx²/10",
            1 / 12: "lx²/12",
        }.get(coeff, "lx²/8")
        msx = n * lx**2 * coeff
        msy = 0.0
        beta_sx = beta_sy = 0.0
        moment_formula = f"Msx = n·{coeff_label}"
        moment_sub = f"Msx = {round_value(n, 2)} × {lx}² × {coeff}"
        moment_result = f"Msx = {round_value(msx, 1)} kNm/m"
        moment_ref = "Eurocode 2: Clause 6.1"

    steps.append(
        _step(
            3,
            "Calculate Bending Moments",
            moment_formula,
            moment_sub,
            moment_result,
            "kNm/m",
            moment_ref,
            "info",
        )
    )

    # Step 4: Effective depth
    dx = h - 25 - 8
    dy = h - 25 - 8 - 8
    steps.append(
        _step(
            4,
            "Calculate Effective Depth",
            "dx = h - 25 - 8; dy = h - 25 - 8 - 8",
            f"dx = {h} - 33 = {round_value(dx, 0)} mm; dy = {h} - 41 = {round_value(dy, 0)} mm",
            f"dx = {round_value(dx, 0)} mm; dy = {round_value(dy, 0)} mm",
            "mm",
            "Eurocode 2: Clause 4.4.1",
            "info",
        )
    )

    # Step 5: Steel in short span
    steel_x = _design_steel(msx, dx, fck, fyk)
    kx_status = "pass" if steel_x["k"] <= K_PRIME else "fail"
    if steel_x["k"] > K_PRIME:
        overall_status = "fail"
        errors.append("Short span K factor exceeds K' — increase depth or provide compression steel")

    steps.append(
        _step(
            5,
            "Steel Design — Short Span (x-direction)",
            "K = Msx/(1000·dx²·fck); z = dx·[0.5 + √(0.25 - K/1.134)]; Asx = Msx/(0.87·fyk·z)",
            f"K = {round_value(steel_x['k'], 4)}, z = {round_value(steel_x['z'], 1)} mm",
            f"Asx = {round_value(steel_x['as_req'], 0)} mm²/m",
            "mm²/m",
            "Eurocode 2: Clause 6.1",
            kx_status,
        )
    )

    # Step 6: Steel in long span (two-way)
    steel_y = {"k": 0.0, "z": dy, "as_req": 0.0}
    if is_two_way:
        steel_y = _design_steel(msy, dy, fck, fyk)
        ky_status = "pass" if steel_y["k"] <= K_PRIME else "fail"
        if steel_y["k"] > K_PRIME:
            overall_status = "fail"
            errors.append("Long span K factor exceeds K' — increase depth or provide compression steel")
        steps.append(
            _step(
                6,
                "Steel Design — Long Span (y-direction)",
                "K = Msy/(1000·dy²·fck); z = dy·[0.5 + √(0.25 - K/1.134)]; Asy = Msy/(0.87·fyk·z)",
                f"K = {round_value(steel_y['k'], 4)}, z = {round_value(steel_y['z'], 1)} mm",
                f"Asy = {round_value(steel_y['as_req'], 0)} mm²/m",
                "mm²/m",
                "Eurocode 2: Clause 6.1",
                ky_status,
            )
        )
    else:
        steps.append(
            _step(
                6,
                "Steel Design — Long Span (y-direction)",
                "N/A — one-way slab",
                "One-way slab — no long span moment",
                "Asy = N/A",
                "",
                "Eurocode 2: Clause 6.1",
                "info",
            )
        )

    # Step 7: Minimum steel check
    fctm = 0.30 * fck ** (2 / 3)
    as_min_x = max(0.26 * fctm * B * dx / fyk, 0.0013 * B * dx)
    as_min_y = max(0.26 * fctm * B * dy / fyk, 0.0013 * B * dy) if is_two_way else 0.0
    asx = max(steel_x["as_req"], as_min_x)
    asy = max(steel_y["as_req"], as_min_y) if is_two_way else 0.0

    min_x_ok = asx >= as_min_x
    min_status = "pass" if min_x_ok and (not is_two_way or asy >= as_min_y) else "fail"
    if not min_status == "pass":
        overall_status = "fail"

    steps.append(
        _step(
            7,
            "Minimum Steel Check",
            "As,min = max(0.26·fctm·b·d/fyk, 0.0013·b·d); fctm = 0.30·fck^(2/3)",
            f"fctm = {round_value(fctm, 2)} MPa; As,min(x) = {round_value(as_min_x, 0)} mm²/m",
            f"Asx = {round_value(asx, 0)} mm²/m {'✓' if min_x_ok else '✗'}"
            + (f"; Asy = {round_value(asy, 0)} mm²/m" if is_two_way else ""),
            "mm²/m",
            "Eurocode 2: Clause 9.2.1.1",
            min_status,
        )
    )

    # Step 8: Maximum spacing check
    s_max = min(3 * h, 400)
    spacing_x, provided_x, provision_x = slab_bar_spacing(asx)
    spacing_y, provided_y, provision_y = slab_bar_spacing(asy) if is_two_way else (0, 0, "N/A")
    spacing_x_ok = spacing_x <= s_max
    spacing_y_ok = not is_two_way or spacing_y <= s_max
    spacing_status = "pass" if spacing_x_ok and spacing_y_ok else "warning"
    if not spacing_x_ok or not spacing_y_ok:
        warnings.append(f"Bar spacing exceeds s_max = {s_max} mm — reduce spacing or increase bar size")

    steps.append(
        _step(
            8,
            "Maximum Spacing Check",
            "s_max = min(3h, 400mm)",
            f"s_max = min(3×{h}, 400) = {s_max} mm",
            f"Short span: {provision_x} {'✓' if spacing_x_ok else '⚠'}"
            + (f"; Long span: {provision_y} {'✓' if spacing_y_ok else '⚠'}" if is_two_way else ""),
            "mm",
            "Eurocode 2: Clause 9.2.1.1",
            spacing_status,
        )
    )

    # Step 9: Deflection check
    span_depth = (lx * 1000) / h
    basic_ratio = _DEFL_BASIC.get(support, 20)
    rho_x = asx / (B * dx)
    rho_0 = 0.001 * math.sqrt(fck)
    if rho_x < rho_0 and rho_x > 0:
        modification = min(2.0, (rho_0 / rho_x) ** 0.25)
    else:
        modification = 1.0
    allowable_ratio = basic_ratio * modification
    defl_ok = span_depth <= allowable_ratio
    defl_status = "pass" if defl_ok else "fail"
    if not defl_ok:
        overall_status = "fail"
        errors.append(f"Span/depth ratio {round_value(span_depth, 1)} exceeds allowable {round_value(allowable_ratio, 1)}")

    steps.append(
        _step(
            9,
            "Deflection Check (Span/Depth Ratio)",
            "lx/d ≤ basic ratio × modification (Table 7.4N)",
            f"lx/d = ({lx}×1000)/{h} = {round_value(span_depth, 1)}; modified limit = {round_value(allowable_ratio, 1)}",
            f"lx/d = {round_value(span_depth, 1)} {'✓' if defl_ok else '✗'} (≤ {round_value(allowable_ratio, 1)})",
            "",
            "Eurocode 2: Table 7.4N",
            defl_status,
        )
    )

    summary = {
        "design_load_knm2": round_value(n, 2),
        "span_ratio_ly_lx": round_value(span_ratio, 2),
        "slab_behaviour": "two-way" if is_two_way else "one-way",
        "moment_short_span_knm": round_value(msx, 1),
        "moment_long_span_knm": round_value(msy, 1) if is_two_way else "N/A",
        "steel_short_span_mm2": round_value(asx, 0),
        "steel_long_span_mm2": round_value(asy, 0) if is_two_way else "N/A",
        "provision_short_span": provision_x,
        "provision_long_span": provision_y if is_two_way else "N/A",
        "span_depth_ratio": round_value(span_depth, 1),
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
