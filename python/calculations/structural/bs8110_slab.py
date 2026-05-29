"""BS 8110 Slab Design Calculations."""

import math
from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value, slab_bar_spacing
from calculations.structural.fire_and_anchorage import (
    check_slab_fire,
    anchorage_length,
    lap_length,
)


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


# BS 8110 Table 3.13: Moment coefficients for simply supported two-way slabs
SS_RATIOS = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2.0]
SS_BETA_SX = [0.062, 0.074, 0.084, 0.093, 0.099, 0.104, 0.113, 0.118]
SS_BETA_SY = [0.062, 0.062, 0.062, 0.062, 0.062, 0.062, 0.062, 0.062]

# BS 8110 Table 3.14: Moment coefficients for restrained two-way slabs (four edges continuous)
REST_RATIOS = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2.0]
REST_BETA_SX = [0.035, 0.040, 0.045, 0.049, 0.052, 0.055, 0.059, 0.062]
REST_BETA_SY = [0.035, 0.035, 0.035, 0.035, 0.035, 0.035, 0.035, 0.035]


def run_bs8110_slab(
    lx_m: float,
    ly_m: float,
    support_condition: str,
    h_mm: float,
    cover_mm: float,
    bar_dia_mm: float,
    fcu_mpa: float,
    fy_mpa: float,
    n_knm2: float,
    slab_type: str,
    fire_period_hours: float = 1.0,
) -> dict[str, Any]:
    """Run slab design calculations per BS 8110-1:1997."""
    steps = []
    warnings = []
    errors = []
    status = "pass"
    B = 1000.0  # per meter run width

    # 1. Effective depth dx and dy
    # Assume 10mm bars if not specified
    dx = h_mm - cover_mm - (bar_dia_mm / 2)
    # y-direction sits on top of x-direction
    dy = dx - bar_dia_mm
    
    steps.append(
        _step(
            1,
            "Effective Depth",
            "dx = h - cover - φ/2; dy = dx - φ",
            f"dx = {h_mm} - {cover_mm} - {bar_dia_mm}/2 = {round_value(dx, 1)} mm",
            f"dx = {round_value(dx, 1)} mm; dy = {round_value(dy, 1)} mm",
            "mm",
            "BS 8110-1:1997 §3.4.4.1",
            "info",
        )
    )

    # 2. Moments Calculation
    span_ratio = ly_m / lx_m if lx_m > 0 else 1.0
    
    if slab_type == "one_way":
        coeff = 1 / 8 if support_condition == "simply_supported" else 1 / 12
        coeff_label = "L²/8" if support_condition == "simply_supported" else "L²/12"
        msx = n_knm2 * (lx_m ** 2) * coeff
        msy = 0.0
        
        steps.append(
            _step(
                2,
                "Bending Moments (One-way)",
                f"Msx = n·{coeff_label}",
                f"Msx = {round_value(n_knm2, 2)} × {lx_m}² × {coeff}",
                f"Msx = {round_value(msx, 1)} kNm/m; Msy = 0 kNm/m",
                "kNm/m",
                "BS 8110-1:1997 §3.5.2",
                "info",
            )
        )
    else:
        # Two-way simply supported or restrained
        if slab_type == "two_way_simply_supported":
            beta_sx = _interpolate(span_ratio, SS_RATIOS, SS_BETA_SX)
            beta_sy = _interpolate(span_ratio, SS_RATIOS, SS_BETA_SY)
            table_ref = "BS 8110 Table 3.13"
        else:  # two_way_restrained
            beta_sx = _interpolate(span_ratio, REST_RATIOS, REST_BETA_SX)
            beta_sy = _interpolate(span_ratio, REST_RATIOS, REST_BETA_SY)
            table_ref = "BS 8110 Table 3.14"

        msx = beta_sx * n_knm2 * (lx_m ** 2)
        msy = beta_sy * n_knm2 * (lx_m ** 2)

        steps.append(
            _step(
                2,
                "Bending Moments (Two-way)",
                "Msx = βsx·n·lx²; Msy = βsy·n·lx²",
                f"βsx = {round_value(beta_sx, 3)}, βsy = {round_value(beta_sy, 3)}, lx = {lx_m} m",
                f"Msx = {round_value(msx, 1)} kNm/m; Msy = {round_value(msy, 1)} kNm/m",
                "kNm/m",
                table_ref,
                "info",
            )
        )

    # 3. Steel design (x-direction)
    # Kx = Msx / (fcu * b * dx^2)
    kx = (msx * 1e6) / (fcu_mpa * B * (dx ** 2))
    kx_limit = 0.156
    
    if kx > kx_limit:
        status = "fail"
        errors.append(f"Short span Kx = {kx:.4f} exceeds limit 0.156. Increase slab thickness.")
        zx = 0.95 * dx
        as_x = 0.0
    else:
        zx = dx * min(0.95, 0.5 + math.sqrt(0.25 - kx / 0.9))
        as_x = (msx * 1e6) / (0.87 * fy_mpa * zx)

    steps.append(
        _step(
            3,
            "Tension Steel — Short Span (x-direction)",
            "Kx = Msx / (fcu·b·dx²); zx = dx·min(0.95, 0.5 + √(0.25 - K/0.9)); Asx = Msx / (0.87·fy·zx)",
            f"Kx = {round_value(kx, 4)}, zx = {round_value(zx, 1)} mm",
            f"Asx,req = {round_value(as_x, 0)} mm²/m",
            "mm²/m",
            "BS 8110-1:1997 §3.4.4.4",
            "pass" if kx <= kx_limit else "fail",
        )
    )

    # 4. Steel design (y-direction)
    as_y = 0.0
    if slab_type != "one_way":
        ky = (msy * 1e6) / (fcu_mpa * B * (dy ** 2))
        if ky > kx_limit:
            status = "fail"
            errors.append(f"Long span Ky = {ky:.4f} exceeds limit 0.156. Increase slab thickness.")
            zy = 0.95 * dy
        else:
            zy = dy * min(0.95, 0.5 + math.sqrt(0.25 - ky / 0.9))
            as_y = (msy * 1e6) / (0.87 * fy_mpa * zy)
            
        steps.append(
            _step(
                4,
                "Tension Steel — Long Span (y-direction)",
                "Ky = Msy / (fcu·b·dy²); zy = dy·min(0.95, 0.5 + √(0.25 - K/0.9)); Asy = Msy / (0.87·fy·zy)",
                f"Ky = {round_value(ky, 4)}, zy = {round_value(zy, 1)} mm",
                f"Asy,req = {round_value(as_y, 0)} mm²/m",
                "mm²/m",
                "BS 8110-1:1997 §3.4.4.4",
                "pass" if ky <= kx_limit else "fail",
            )
        )
    else:
        steps.append(
            _step(
                4,
                "Tension Steel — Long Span (y-direction)",
                "N/A",
                "One-way slab — distributing steel only",
                "Asy = N/A",
                "",
                "BS 8110-1:1997 §3.5.2",
                "info",
            )
        )

    # 5. Minimum steel check
    # BS 8110 Table 3.25: minimum tension reinforcement
    # High yield (fy = 460/500): 0.13% Ac (0.0013*b*h)
    # Mild steel (fy = 250): 0.24% Ac (0.0024*b*h)
    as_min = (0.0013 if fy_mpa >= 460 else 0.0024) * B * h_mm
    
    as_x_final = max(as_x, as_min)
    as_y_final = max(as_y, as_min) if slab_type != "one_way" else as_min
    
    steps.append(
        _step(
            5,
            "Minimum Steel Check",
            "As,min = 0.13% bh (for Grade 460) or 0.24% bh (for Grade 250)",
            f"As,min = {round_value(as_min, 0)} mm²/m; Asx,req = {round_value(as_x, 0)} mm²/m",
            f"Asx,final = {round_value(as_x_final, 0)} mm²/m; Asy,final = {round_value(as_y_final, 0)} mm²/m",
            "mm²/m",
            "BS 8110-1:1997 §3.12.5.3 Table 3.25",
            "pass",
        )
    )

    # 6. Spacing check
    # spacing <= min(3h, 750mm) or 250mm for tension reinforcement
    s_max = min(3 * h_mm, 250.0)
    spacing_x, provided_x, provision_x = slab_bar_spacing(as_x_final, int(bar_dia_mm))
    
    spacing_status = "pass"
    if spacing_x > s_max:
        spacing_status = "warning"
        warnings.append(f"Bar spacing ({spacing_x} mm) exceeds s_max = {s_max} mm")
        
    provision_y = "N/A"
    if slab_type != "one_way":
        spacing_y, provided_y, provision_y = slab_bar_spacing(as_y_final, int(bar_dia_mm))
        if spacing_y > s_max:
            spacing_status = "warning"
            warnings.append(f"y-direction bar spacing ({spacing_y} mm) exceeds s_max = {s_max} mm")

    steps.append(
        _step(
            6,
            "Spacing Check",
            "s_max = min(3h, 250 mm)",
            f"s_max = {s_max} mm",
            f"Short span: {provision_x}; Long span: {provision_y}",
            "mm",
            "BS 8110-1:1997 §3.12.11",
            spacing_status,
        )
    )

    # 7. Deflection check (L/d)
    basic_ratio = 20.0 if support_condition == "simply_supported" else 26.0

    # Tension modification factor
    fs = (2 / 3) * fy_mpa * (as_x / provided_x) if provided_x > 0 else 0
    m_bd2 = (msx * 1e6) / (B * (dx ** 2))
    tension_mf = min(2.0, max(0.1, 0.55 + (477 - fs) / (120 * (0.9 + m_bd2))))

    allowable_span_d = basic_ratio * tension_mf
    actual_span_d = (lx_m * 1000) / dx

    defl_status = "pass"
    if actual_span_d > allowable_span_d:
        status = "fail"
        defl_status = "fail"
        errors.append(
            f"Actual span/depth ratio ({round_value(actual_span_d, 1)}) > allowable "
            f"({round_value(allowable_span_d, 1)}). Increase slab depth."
        )

    steps.append(
        _step(
            7,
            "Deflection Check (Span/Depth)",
            "allowable_L/d = basic_ratio · MF_tension",
            f"basic = {basic_ratio}, fs = {round_value(fs, 0)} N/mm², MF_tension = {round_value(tension_mf, 2)}",
            f"Allowable L/d = {round_value(allowable_span_d, 1)} vs Actual L/d = {round_value(actual_span_d, 1)}",
            "",
            "BS 8110-1:1997 §3.5.7 Table 3.10",
            defl_status,
        )
    )

    # 8. Shear check at d from support (one-way slabs per §3.5.5) ─────────────
    # For one-way slabs shear governs at d from face of support:
    # V_d = n × (lx/2 − dx/1000)  [kN/m]
    # v = V_d / (b × dx) where b = 1000 mm/m
    v_shear_kn_m = n_knm2 * (lx_m / 2.0 - dx / 1000.0)
    v_shear = (v_shear_kn_m * 1000) / (B * dx)  # N/mm²

    # vc using provided_x
    pt_as = min(3.0, (100 * provided_x) / (B * dx))
    d_factor = max(1.0, (400 / dx) ** 0.25)
    fcu_factor = (min(40.0, fcu_mpa) / 25) ** (1 / 3)
    vc_slab = (0.79 / 1.25) * (pt_as ** (1 / 3)) * d_factor * fcu_factor

    shear_status_slab = "pass"
    if v_shear > min(0.8 * math.sqrt(fcu_mpa), 5.0):
        shear_status_slab = "fail"
        status = "fail"
        errors.append(
            f"Slab shear v = {round_value(v_shear, 3)} N/mm² exceeds absolute maximum. "
            "Increase slab thickness."
        )
    elif v_shear > vc_slab:
        shear_status_slab = "warning"
        warnings.append(
            f"Slab shear v = {round_value(v_shear, 3)} N/mm² > vc = {round_value(vc_slab, 3)} N/mm². "
            "Slabs normally have no links — increase depth."
        )

    steps.append(
        _step(
            8,
            "Shear Check at d from Support",
            "Vd = n·(Lx/2 − d); v = Vd/(b·d); vc = (0.79/1.25)·ρt^(1/3)·(400/d)^0.25·(fcu/25)^(1/3)",
            f"Vd = {round_value(n_knm2, 2)}×({lx_m}/2 − {round_value(dx/1000, 3)}) = {round_value(v_shear_kn_m, 2)} kN/m",
            f"v = {round_value(v_shear, 3)} N/mm²; vc = {round_value(vc_slab, 3)} N/mm² — "
            f"{'✓ OK' if shear_status_slab == 'pass' else '⚠ Exceeds vc — increase depth'}",
            "N/mm²",
            "BS 8110-1:1997 §3.5.5 / §3.4.5 Table 3.8",
            shear_status_slab,
        )
    )

    # 9. Hogging moments for restrained two-way slabs (§3.5.3.4) ─────────────
    # For restrained slabs, support (hogging) moments ≈ 4/3 × span moments
    msx_hog = 0.0
    msy_hog = 0.0
    if slab_type == "two_way_restrained":
        msx_hog = (4.0 / 3.0) * msx
        msy_hog = (4.0 / 3.0) * msy
        # Hogging steel at short span support
        kx_hog = (msx_hog * 1e6) / (fcu_mpa * B * (dx ** 2))
        zx_hog = dx * min(0.95, 0.5 + math.sqrt(max(0.0, 0.25 - kx_hog / 0.9)))
        as_x_hog = (msx_hog * 1e6) / (0.87 * fy_mpa * zx_hog)
        hog_str = (
            f"Msx_hog = {round_value(msx_hog, 1)} kNm/m; "
            f"Msy_hog = {round_value(msy_hog, 1)} kNm/m; "
            f"Asx_hog = {round_value(as_x_hog, 0)} mm²/m (top steel at support)"
        )
        steps.append(
            _step(
                9,
                "Hogging Moments at Continuous Supports (§3.5.3.4)",
                "Mx_hog ≈ (4/3)·Msx_span; design top steel at support",
                f"(4/3) × {round_value(msx, 1)} kNm/m = {round_value(msx_hog, 1)} kNm/m",
                hog_str,
                "kNm/m",
                "BS 8110-1:1997 §3.5.3.4 / Table 3.15",
                "info",
            )
        )
    else:
        as_x_hog = 0.0

    # 10. Fire Resistance (BS 8110 §3.3 / Tables 3.4) ─────────────────────────
    fire_slab_st, fire_slab_msg, req_slab_cover, req_slab_thick = check_slab_fire(
        cover_mm, h_mm, fire_period_hours, support_condition
    )
    if fire_slab_st == "fail":
        status = "fail"
        errors.append(f"Fire resistance {fire_period_hours}h: {fire_slab_msg}")

    steps.append(
        _step(
            10,
            f"Fire Resistance Check ({fire_period_hours}h rating)",
            "Min cover and min slab thickness from BS 8110 Table 3.4",
            f"Required: cover ≥ {req_slab_cover} mm, h ≥ {req_slab_thick} mm "
            f"(provided: cover = {cover_mm:.0f} mm, h = {h_mm:.0f} mm)",
            fire_slab_msg,
            "",
            "BS 8110-1:1997 §3.3.6 Table 3.4",
            fire_slab_st,
        )
    )

    # 11. Anchorage & Lap Lengths ─────────────────────────────────────────────
    la_slab = anchorage_length(bar_dia_mm, fy_mpa, fcu_mpa, "tension")
    lap_slab = lap_length(bar_dia_mm, fy_mpa, fcu_mpa, "tension")

    steps.append(
        _step(
            11,
            "Anchorage & Lap Lengths",
            "La = (φ/4)·(fy/fbu); fbu = 0.5·√fcu; Lap = 1.4·La",
            f"φ = {bar_dia_mm:.0f} mm; fy = {fy_mpa} MPa; fcu = {fcu_mpa} MPa",
            f"Anchorage length = {round_value(la_slab, 0):.0f} mm; "
            f"Tension lap = {round_value(lap_slab, 0):.0f} mm "
            f"(both directions; provide at splices and supports)",
            "mm",
            "BS 8110-1:1997 §3.12.8.3 / §3.12.8.10",
            "info",
        )
    )

    # 12. Long-term Deflection (creep) ─────────────────────────────────────────
    # Slab creep factor: ξ ≈ 2 (no compression steel in slab)
    creep_slab = 2.0
    ec_slab_gpa = 25.0 if fcu_mpa <= 30 else 28.0
    i_slab_m4 = (1000 * dx ** 3) / (12 * 1e12)  # per metre width, mm⁴ → m⁴
    w_slab_kn_m = n_knm2 * lx_m  # total UDL per metre strip
    delta_slab_inst = (5 * w_slab_kn_m * (lx_m ** 4) * 1e3) / (384 * ec_slab_gpa * 1e6 * i_slab_m4)
    delta_slab_lt = delta_slab_inst * (1 + creep_slab)
    slab_defl_limit = (lx_m * 1000) / 250.0
    slab_lt_status = "pass" if delta_slab_lt <= slab_defl_limit else "warning"
    if delta_slab_lt > slab_defl_limit:
        warnings.append(
            f"Long-term slab deflection {round_value(delta_slab_lt, 1)} mm may exceed L/250 = "
            f"{round_value(slab_defl_limit, 1)} mm. Review with actual Ec and cracked section."
        )

    steps.append(
        _step(
            12,
            "Long-term Deflection (Creep, §3.4.6.3)",
            "δ_lt = δ_inst·(1+ξ); ξ = 2.0; δ_inst = 5wL⁴/(384EcI); limit = L/250",
            f"ξ = {creep_slab}; Ec = {ec_slab_gpa} GPa; "
            f"w = {round_value(w_slab_kn_m, 2)} kN/m²×lx",
            f"δ_lt ≈ {round_value(delta_slab_lt, 1)} mm vs limit L/250 = "
            f"{round_value(slab_defl_limit, 1)} mm",
            "mm",
            "BS 8110-1:1997 §3.4.6.3",
            slab_lt_status,
        )
    )

    # 13. ZMW Cost Estimate ────────────────────────────────────────────────────
    # Lusaka Q4 2025 benchmarks for in-situ RC slab
    zmw_concrete_m3 = 920.0     # C25 flat slab pour per m³
    zmw_steel_tonne = 21_000.0  # Y-bars / BRC mesh equivalent per tonne
    zmw_formwork_m2 = 340.0     # soffit formwork per m²

    slab_area_m2 = lx_m * ly_m
    slab_vol_m3 = slab_area_m2 * (h_mm / 1000)
    # Total steel (both ways, top and bottom)
    steel_area_total_mm2_m = as_x_final + as_y_final + as_x_hog
    steel_kg = steel_area_total_mm2_m * lx_m * 7850e-6  # mm²/m × m × density factor

    cost_slab_concrete = slab_vol_m3 * zmw_concrete_m3
    cost_slab_steel = (steel_kg / 1000) * zmw_steel_tonne
    cost_slab_formwork = slab_area_m2 * zmw_formwork_m2
    cost_slab_total = cost_slab_concrete + cost_slab_steel + cost_slab_formwork
    cost_per_m2 = cost_slab_total / slab_area_m2 if slab_area_m2 > 0 else 0.0

    steps.append(
        _step(
            13,
            "ZMW Material Cost Estimate",
            "Cost = Vol_c·Rate_c + Steel_kg/1000·Rate_s + Area·Rate_fw",
            f"Slab {lx_m}×{ly_m} m, h={h_mm} mm; Vol = {round_value(slab_vol_m3, 3)} m³; "
            f"Steel ≈ {round_value(steel_kg, 1)} kg; Formwork {round_value(slab_area_m2, 2)} m²",
            f"Total ≈ ZMW {round_value(cost_slab_total, 0):,.0f} "
            f"(≈ ZMW {round_value(cost_per_m2, 0):,.0f}/m² — "
            f"concrete {round_value(cost_slab_concrete, 0):,.0f} + "
            f"steel {round_value(cost_slab_steel, 0):,.0f} + "
            f"formwork {round_value(cost_slab_formwork, 0):,.0f})",
            "ZMW",
            "Zambian QS benchmarks Q4 2025 — Lusaka",
            "info",
        )
    )

    summary = {
        "lx_m":                     round_value(lx_m, 2),
        "ly_m":                     round_value(ly_m, 2),
        "span_ratio":               round_value(span_ratio, 2),
        "design_load_knm2":         round_value(n_knm2, 2),
        "moment_short_span_knm":    round_value(msx, 1),
        "moment_long_span_knm":     round_value(msy, 1) if slab_type != "one_way" else 0.0,
        "hogging_short_span_knm":   round_value(msx_hog, 1),
        "hogging_long_span_knm":    round_value(msy_hog, 1),
        "steel_required_x_mm2":     round_value(as_x_final, 0),
        "steel_required_y_mm2":     round_value(as_y_final, 0) if slab_type != "one_way" else 0.0,
        "provision_short_span":     provision_x,
        "provision_long_span":      provision_y,
        "shear_stress_mpa":         round_value(v_shear, 3),
        "concrete_shear_cap_mpa":   round_value(vc_slab, 3),
        "allowable_span_d":         round_value(allowable_span_d, 1),
        "actual_span_d":            round_value(actual_span_d, 1),
        "slab_area_m2":             round_value(slab_area_m2, 2),
        "concrete_volume_m3":       round_value(slab_vol_m3, 3),
        "total_cost_zmw":           round_value(cost_slab_total, 0),
        "cost_per_m2_zmw":          round_value(cost_per_m2, 0),
        "fire_period_hours":        fire_period_hours,
        "fire_resistance":          fire_slab_st,
        "anchorage_mm":             round_value(la_slab, 0),
        "lap_length_mm":            round_value(lap_slab, 0),
        "long_term_deflection_mm":  round_value(delta_slab_lt, 1),
        "deflection_limit_mm":      round_value(slab_defl_limit, 1),
        "structural_design":        "PASS ✓" if status == "pass" else "FAIL ✗",
    }

    return {
        "status": status,
        "summary": summary,
        "steps": steps,
        "warnings": warnings,
        "errors": errors,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
