"""BS 8110 Beam Design Calculations."""

import math
from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value
from calculations.utils.validators import validate_material_grades, validate_cover_feasibility
from calculations.structural.fire_and_anchorage import (
    check_beam_fire,
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


def run_bs8110_beam(
    b_mm: float,
    h_mm: float,
    cover_mm: float,
    bar_dia_mm: float,
    n_bars_tension: int,
    n_bars_compression: int,
    link_dia_mm: float,
    link_spacing_mm: float,
    fcu_mpa: float,
    fy_mpa: float,
    M_knm: float,
    V_kn: float,
    span_m: float,
    support_condition: str,
    fire_period_hours: float = 1.0,
) -> dict[str, Any]:
    """Run beam design calculation per BS 8110-1:1997."""
    # ── Pre-calculation validation ────────────────────────────────────────────
    validate_material_grades(fcu_mpa, fy_mpa)
    d = validate_cover_feasibility(cover_mm, h_mm, bar_dia_mm, link_dia_mm)

    steps = []
    warnings = []
    errors = []
    status = "pass"

    # ── Step 1: Effective depth d ─────────────────────────────────────────────
    # d already computed and validated above
    steps.append(
        _step(
            1,
            "Effective Depth",
            "d = h − cover − φ_link − φ_bar/2",
            f"d = {h_mm} − {cover_mm} − {link_dia_mm} − {bar_dia_mm}/2",
            f"d = {round_value(d, 1)} mm",
            "mm",
            "BS 8110-1:1997 §3.4.4",
            "info",
        )
    )

    # ── Step 2: Provided steel areas ──────────────────────────────────────────
    as_prov = n_bars_tension * math.pi * (bar_dia_mm / 2) ** 2
    as_comp_prov = n_bars_compression * math.pi * (bar_dia_mm / 2) ** 2

    # ── Step 3: Flexure check (K-factor method) ───────────────────────────────
    m_nmm = M_knm * 1e6
    K = m_nmm / (fcu_mpa * b_mm * (d ** 2))
    K_limit = 0.156

    flexure_status = "pass"
    if K <= K_limit:
        z = d * min(0.95, 0.5 + math.sqrt(0.25 - K / 0.9))
        as_req = m_nmm / (0.87 * fy_mpa * z)
        comp_steel_note = "None (singly reinforced)"
        flexure_res = f"z = {round_value(z, 1)} mm; As,req = {round_value(as_req, 0)} mm²"
    else:
        flexure_status = "warning"
        warnings.append(f"K = {K:.4f} > 0.156. Compression steel required.")
        z = 0.775 * d
        d_prime = cover_mm + link_dia_mm + (bar_dia_mm / 2)
        as_comp_req = (K - 0.156) * fcu_mpa * b_mm * (d ** 2) / (0.87 * fy_mpa * (d - d_prime))
        as_req = (0.156 * fcu_mpa * b_mm * (d ** 2)) / (0.87 * fy_mpa * z) + as_comp_req
        comp_steel_note = f"Required: {round_value(as_comp_req, 0)} mm²"
        if as_comp_prov < as_comp_req:
            status = "fail"
            flexure_status = "fail"
            errors.append(
                f"Compression steel provided ({round_value(as_comp_prov, 0)} mm²) < required "
                f"({round_value(as_comp_req, 0)} mm²)"
            )
        flexure_res = (
            f"Doubly reinforced — z = {round_value(z, 1)} mm; As,req = {round_value(as_req, 0)} mm²; "
            f"As',req = {comp_steel_note}"
        )

    steps.append(
        _step(
            2,
            "Flexural Design (K-factor)",
            "K = M / (fcu·b·d²); z = d·min(0.95, 0.5 + √(0.25 − K/0.9))",
            f"K = {round_value(m_nmm, 0)} / ({fcu_mpa}×{b_mm}×{round_value(d, 1)}²) = {round_value(K, 4)}",
            f"K = {round_value(K, 4)} (limit {K_limit}) → {flexure_res}",
            "",
            "BS 8110-1:1997 §3.4.4.4",
            flexure_status,
        )
    )

    # ── Step 3: Moment capacity check ─────────────────────────────────────────
    m_capacity = 0.87 * fy_mpa * as_prov * z / 1e6
    capacity_status = "pass" if m_capacity >= M_knm else "fail"
    if m_capacity < M_knm:
        status = "fail"
        errors.append(
            f"Moment capacity ({round_value(m_capacity, 1)} kNm) < ultimate moment "
            f"({round_value(M_knm, 1)} kNm)"
        )

    steps.append(
        _step(
            3,
            "Moment Capacity",
            "M_cap = 0.87·fy·As,prov·z",
            f"0.87 × {fy_mpa} × {round_value(as_prov, 0)} × {round_value(z, 1)} / 10⁶",
            f"M_cap = {round_value(m_capacity, 1)} kNm vs M_ult = {round_value(M_knm, 1)} kNm",
            "kNm",
            "BS 8110-1:1997 §3.4.4.4",
            capacity_status,
        )
    )

    # ── Step 4: Min / Max Steel (BS 8110 Table 3.25) ──────────────────────────
    # Minimum tension steel: 100·As / (b·h) ≥ 0.13% (fy ≥ 460) or 0.24% (fy = 250)
    min_steel_ratio = 0.0013 if fy_mpa >= 460 else 0.0024
    as_min = min_steel_ratio * b_mm * h_mm
    # Maximum steel: 4% of gross section
    as_max = 0.04 * b_mm * h_mm

    min_steel_status = "pass"
    if as_prov < as_min:
        min_steel_status = "fail"
        status = "fail"
        errors.append(
            f"Provided tension steel ({round_value(as_prov, 0)} mm²) < minimum required "
            f"({round_value(as_min, 0)} mm²). Add more bars."
        )

    max_steel_status = "pass"
    if as_prov > as_max:
        max_steel_status = "fail"
        status = "fail"
        errors.append(
            f"Provided tension steel ({round_value(as_prov, 0)} mm²) > 4% limit "
            f"({round_value(as_max, 0)} mm²). Increase section size."
        )

    overall_steel_status = "fail" if (min_steel_status == "fail" or max_steel_status == "fail") else "pass"
    steps.append(
        _step(
            4,
            "Min/Max Steel Area (Table 3.25)",
            "As_min = 0.13%·b·h (fy≥460) or 0.24%·b·h (fy=250); As_max = 4%·b·h",
            f"fy = {fy_mpa} MPa → min_ratio = {min_steel_ratio*100:.2f}%; "
            f"As_min = {round_value(as_min, 0)} mm²; As_max = {round_value(as_max, 0)} mm²",
            f"As,prov = {round_value(as_prov, 0)} mm² — Min {'✓' if min_steel_status=='pass' else '✗'}; "
            f"Max {'✓' if max_steel_status=='pass' else '✗'}",
            "mm²",
            "BS 8110-1:1997 Table 3.25 / §3.12.6.1",
            overall_steel_status,
        )
    )

    # ── Step 5: Shear stress v, concrete capacity vc, and link design ─────────
    v = (V_kn * 1000) / (b_mm * d)  # N/mm²

    pt_as = min(3.0, (100 * as_prov) / (b_mm * d))
    d_factor = max(1.0, (400 / d) ** 0.25)
    fcu_factor = (min(40.0, fcu_mpa) / 25) ** (1 / 3)
    vc = (0.79 / 1.25) * (pt_as ** (1 / 3)) * d_factor * fcu_factor

    v_max = min(0.8 * math.sqrt(fcu_mpa), 5.0)

    # fyv for links: capped at 460 MPa (BS 8110 §3.4.5.2)
    fyv = min(fy_mpa, 460.0)

    # Provided Asv/sv (2-leg links assumed)
    asv_provided = 2 * math.pi * (link_dia_mm / 2) ** 2
    asv_sv_prov = asv_provided / link_spacing_mm  # mm²/mm

    shear_status = "pass"
    if v > v_max:
        status = "fail"
        shear_status = "fail"
        errors.append(
            f"Shear stress v = {v:.3f} N/mm² exceeds max allowable "
            f"v_max = {v_max:.3f} N/mm². Increase section size."
        )
        link_requirement = "Section inadequate — increase size"
        asv_sv_req = None
    elif v > vc + 0.4:
        shear_status = "warning"
        # Full design links: Asv/sv = b·(v − vc) / (0.87·fyv)
        asv_sv_req = b_mm * (v - vc) / (0.87 * fyv)
        link_requirement = "Full design links required"
        if asv_sv_prov < asv_sv_req:
            shear_status = "fail"
            status = "fail"
            errors.append(
                f"Shear link provision Asv/sv = {round_value(asv_sv_prov, 3)} mm²/mm < "
                f"required {round_value(asv_sv_req, 3)} mm²/mm. Reduce link spacing."
            )
    else:
        # Nominal links: Asv/sv = 0.4·b / (0.87·fyv) regardless of v
        asv_sv_req = 0.4 * b_mm / (0.87 * fyv)
        link_requirement = "Nominal links only"
        if asv_sv_prov < asv_sv_req:
            shear_status = "warning"
            warnings.append(
                f"Nominal link Asv/sv = {round_value(asv_sv_prov, 3)} mm²/mm < "
                f"minimum {round_value(asv_sv_req, 3)} mm²/mm."
            )

    asv_req_str = round_value(asv_sv_req, 3) if asv_sv_req is not None else "N/A"
    steps.append(
        _step(
            5,
            "Shear Check & Link Design",
            "v = V/(b·d); vc = (0.79/1.25)·(ρ_t)^(1/3)·(400/d)^0.25·(fcu/25)^(1/3); "
            "Asv/sv = b·(v−vc)/(0.87·fyv)",
            f"v = {round_value(v, 3)} N/mm²; vc = {round_value(vc, 3)} N/mm²; "
            f"Asv/sv_req = {asv_req_str} mm²/mm; Asv/sv_prov = {round_value(asv_sv_prov, 3)} mm²/mm",
            f"{link_requirement} — Asv/sv_prov = {round_value(asv_sv_prov, 3)} mm²/mm "
            f"(φ{int(link_dia_mm)} @ {int(link_spacing_mm)} mm, 2-leg)",
            "N/mm²",
            "BS 8110-1:1997 §3.4.5 Tables 3.7–3.8",
            shear_status,
        )
    )

    # ── Step 6: Deflection check (Span/Depth with modification factors) ───────
    basic_ratio_map = {
        "simply_supported": 20.0,
        "continuous_end": 26.0,
        "continuous_internal": 26.0,
        "continuous": 26.0,
        "cantilever": 7.0,
    }
    basic_ratio = basic_ratio_map.get(support_condition, 20.0)

    # Tension MF: fs = (2/3)·fy·(As_req/As_prov); MF = 0.55 + (477-fs)/(120·(0.9+M/bd²)) ≤ 2.0
    fs = (2 / 3) * fy_mpa * (as_req / as_prov)
    m_bd2 = m_nmm / (b_mm * (d ** 2))
    tension_mf = min(2.0, max(0.1, 0.55 + (477 - fs) / (120 * (0.9 + m_bd2))))

    # Compression MF: MF = 1 + (100·ρc') / (3 + 100·ρc') ≤ 1.5
    rho_c = as_comp_prov / (b_mm * d)
    compression_mf = min(1.5, 1 + (100 * rho_c) / (3 + 100 * rho_c))

    allowable_span_d = basic_ratio * tension_mf * compression_mf
    actual_span_d = (span_m * 1000) / d

    defl_status = "pass"
    if actual_span_d > allowable_span_d:
        status = "fail"
        defl_status = "fail"
        errors.append(
            f"Actual span/depth ({round_value(actual_span_d, 1)}) > allowable limit "
            f"({round_value(allowable_span_d, 1)}). Increase depth."
        )

    steps.append(
        _step(
            6,
            "Deflection Check (Span/Depth)",
            "L/d ≤ basic_ratio · MF_tension · MF_compression",
            f"basic = {basic_ratio}; fs = {round_value(fs, 0)} N/mm²; "
            f"MF_t = {round_value(tension_mf, 2)}; MF_c = {round_value(compression_mf, 2)}",
            f"Allowable L/d = {round_value(allowable_span_d, 1)} vs Actual = {round_value(actual_span_d, 1)}",
            "",
            "BS 8110-1:1997 §3.4.6 Table 3.10",
            defl_status,
        )
    )

    # ── Step 7: Crack control (bar spacing ≤ 300 mm) ──────────────────────────
    if n_bars_tension > 1:
        clear_spacing = (
            (b_mm - 2 * cover_mm - 2 * link_dia_mm - bar_dia_mm) / (n_bars_tension - 1)
        )
    else:
        clear_spacing = b_mm - 2 * cover_mm - 2 * link_dia_mm

    crack_status = "pass"
    if clear_spacing > 300:
        crack_status = "warning"
        warnings.append(
            f"Bar clear spacing ({round_value(clear_spacing, 0)} mm) > 300 mm. "
            "Section may fail crack control per Table 3.30."
        )

    steps.append(
        _step(
            7,
            "Crack Control",
            "Clear bar spacing ≤ 300 mm (fy ≤ 460 MPa)",
            f"clear_s = ({b_mm} − 2×{cover_mm} − 2×{link_dia_mm} − {bar_dia_mm}) / ({n_bars_tension} − 1)",
            f"Clear spacing = {round_value(clear_spacing, 0)} mm {'✓' if clear_spacing <= 300 else '✗ EXCEEDS 300 mm'}",
            "mm",
            "BS 8110-1:1997 §3.12.11 / Table 3.30",
            crack_status,
        )
    )

    # ── Step 8: Fire Resistance (BS 8110 §3.3, Tables 3.4 & 3.5) ────────────
    fire_st, fire_msg, req_cover_fire, req_width_fire = check_beam_fire(
        cover_mm, b_mm, fire_period_hours, support_condition
    )
    if fire_st == "fail":
        status = "fail"
        errors.append(f"Fire resistance {fire_period_hours}h: {fire_msg}")

    steps.append(
        _step(
            8,
            f"Fire Resistance Check ({fire_period_hours}h rating)",
            "Min cover and min beam width from BS 8110 Table 3.5",
            f"Required: cover ≥ {req_cover_fire} mm, width ≥ {req_width_fire} mm "
            f"(provided: cover = {cover_mm:.0f} mm, b = {b_mm:.0f} mm)",
            f"{fire_msg}",
            "",
            "BS 8110-1:1997 §3.3.6 Table 3.5",
            fire_st,
        )
    )

    # ── Step 9: Anchorage & Lap Lengths (BS 8110 §3.12.8) ─────────────────────
    la_tension = anchorage_length(bar_dia_mm, fy_mpa, fcu_mpa)
    la_comp = anchorage_length(bar_dia_mm, fy_mpa, fcu_mpa, zone="compression")
    lap_t = lap_length(bar_dia_mm, fy_mpa, fcu_mpa)
    lap_c = lap_length(bar_dia_mm, fy_mpa, fcu_mpa, zone="compression")

    steps.append(
        _step(
            9,
            "Anchorage & Lap Lengths",
            "La = (φ/4)·(fy/fbu); fbu = β·√fcu; Lap_t = 1.4·La; Lap_c = La",
            f"φ = {bar_dia_mm:.0f}mm; fy = {fy_mpa} MPa; fcu = {fcu_mpa} MPa; "
            f"fbu_t = {0.5*math.sqrt(fcu_mpa):.2f} MPa; fbu_c = {0.63*math.sqrt(fcu_mpa):.2f} MPa",
            f"Anchorage (tension) = {round_value(la_tension, 0):.0f} mm; "
            f"Anchorage (compression) = {round_value(la_comp, 0):.0f} mm; "
            f"Tension lap = {round_value(lap_t, 0):.0f} mm; "
            f"Compression lap = {round_value(lap_c, 0):.0f} mm",
            "mm",
            "BS 8110-1:1997 §3.12.8.3 / §3.12.8.10",
            "info",
        )
    )

    # ── Step 10: Long-term Deflection (creep multiplier) ───────────────────────
    # BS 8110 §3.4.6.3: additional long-term deflection ≈ creep × instantaneous
    # Creep factor ξ = 2.0 for ρ'=0 (no comp steel), reducing to 1.0 as ρ'/ρ → 0.5+
    rho_prime_ratio = min(1.0, as_comp_prov / max(as_prov, 1.0))
    creep_factor = 2.0 - rho_prime_ratio  # simplified; ranges 1.0–2.0
    # Instantaneous mid-span deflection for UDL: δ_inst = 5wL⁴/(384EI)
    # E_c for C25: 25 GPa; I_eff ≈ b·d³/12 (cracked, simplified)
    ec_gpa = 25.0 if fcu_mpa <= 30 else 28.0
    i_eff_m4 = (b_mm * d ** 3) / (12 * 1e12)  # m⁴ (converting mm⁴)
    w_kn_m = (M_knm * 8) / (span_m ** 2)  # back-calculate UDL from moment (simplification)
    delta_inst_mm = (5 * w_kn_m * (span_m ** 4) * 1e3) / (384 * ec_gpa * 1e6 * i_eff_m4)
    delta_lt_mm = delta_inst_mm * (1 + creep_factor)
    # Deflection limit: span/250 for total deflection
    delta_limit_mm = (span_m * 1000) / 250.0
    defl_lt_status = "pass" if delta_lt_mm <= delta_limit_mm else "warning"
    if delta_lt_mm > delta_limit_mm:
        warnings.append(
            f"Long-term deflection {round_value(delta_lt_mm, 1)} mm may exceed span/250 = "
            f"{round_value(delta_limit_mm, 1)} mm. Verify with full elastic analysis."
        )

    steps.append(
        _step(
            10,
            "Long-term Deflection Estimate (§3.4.6.3)",
            "δ_lt = δ_inst · (1 + ξ); ξ = 2 − ρ'/ρ; δ_inst = 5wL⁴/(384EcI); limit = L/250",
            f"ξ = {round_value(creep_factor, 2)}; Ec = {ec_gpa} GPa; "
            f"δ_inst ≈ {round_value(delta_inst_mm, 2)} mm",
            f"δ_long-term ≈ {round_value(delta_lt_mm, 1)} mm vs limit L/250 = "
            f"{round_value(delta_limit_mm, 1)} mm",
            "mm",
            "BS 8110-1:1997 §3.4.6.3 / Table 3.10",
            defl_lt_status,
        )
    )

    # ── Step 11: ZMW Cost Estimate (Lusaka Q4 2025) ───────────────────────────
    zmw_concrete_m3 = 950.0    # C25 ready-mix per m³
    zmw_steel_tonne = 21_000.0  # Y-bars (deformed) per tonne
    zmw_formwork_m2 = 380.0    # soffit + sides per m²

    beam_vol_m3 = (b_mm / 1000) * (h_mm / 1000) * span_m
    steel_tonnes = (as_prov + as_comp_prov) * span_m * 7850e-9  # kg/mm²·mm·m → tonne
    formwork_m2 = span_m * ((b_mm / 1000) + 2 * (h_mm / 1000))  # soffit + 2 sides

    cost_concrete = beam_vol_m3 * zmw_concrete_m3
    cost_steel = steel_tonnes * zmw_steel_tonne
    cost_formwork = formwork_m2 * zmw_formwork_m2
    cost_total_zmw = cost_concrete + cost_steel + cost_formwork

    steps.append(
        _step(
            11,
            "ZMW Material Cost Estimate",
            "Cost = Vol_c·Rate_c + Steel_t·Rate_s + Area_fw·Rate_fw",
            f"Concrete {round_value(beam_vol_m3, 3)} m³ @ ZMW {zmw_concrete_m3}/m³; "
            f"Steel {round_value(steel_tonnes*1000, 1)} kg @ ZMW {zmw_steel_tonne}/t; "
            f"Formwork {round_value(formwork_m2, 2)} m² @ ZMW {zmw_formwork_m2}/m²",
            f"Total ≈ ZMW {round_value(cost_total_zmw, 0):,.0f} "
            f"(concrete {round_value(cost_concrete, 0):,.0f} + steel {round_value(cost_steel, 0):,.0f} + "
            f"formwork {round_value(cost_formwork, 0):,.0f})",
            "ZMW",
            "Zambian QS benchmarks Q4 2025 — Lusaka",
            "info",
        )
    )

    summary = {
        "effective_depth_mm":            round_value(d, 1),
        "steel_required_mm2":            round_value(as_req, 0),
        "steel_provided_mm2":            round_value(as_prov, 0),
        "steel_min_mm2":                 round_value(as_min, 0),
        "steel_max_mm2":                 round_value(as_max, 0),
        "k_factor":                      round_value(K, 4),
        "lever_arm_mm":                  round_value(z, 1),
        "moment_capacity_knm":           round_value(m_capacity, 1),
        "shear_stress_mpa":              round_value(v, 3),
        "concrete_shear_capacity_mpa":   round_value(vc, 3),
        "asv_sv_required":               round_value(asv_sv_req, 3) if asv_sv_req else 0.0,
        "asv_sv_provided":               round_value(asv_sv_prov, 3),
        "link_requirement":              link_requirement,
        "basic_span_d":                  round_value(basic_ratio, 1),
        "tension_mf":                    round_value(tension_mf, 2),
        "compression_mf":                round_value(compression_mf, 2),
        "allowable_span_d":              round_value(allowable_span_d, 1),
        "actual_span_d":                 round_value(actual_span_d, 1),
        "clear_bar_spacing_mm":          round_value(clear_spacing, 0),
        "fire_period_hours":             fire_period_hours,
        "fire_resistance":               fire_st,
        "anchorage_tension_mm":          round_value(la_tension, 0),
        "lap_tension_mm":                round_value(lap_t, 0),
        "anchorage_compression_mm":      round_value(la_comp, 0),
        "long_term_deflection_mm":       round_value(delta_lt_mm, 1),
        "deflection_limit_mm":           round_value(delta_limit_mm, 1),
        "concrete_volume_m3":            round_value(beam_vol_m3, 3),
        "steel_mass_kg":                 round_value(steel_tonnes * 1000, 1),
        "formwork_area_m2":              round_value(formwork_m2, 2),
        "total_cost_zmw":                round_value(cost_total_zmw, 0),
        "structural_design":             "PASS ✓" if status == "pass" else "FAIL ✗",
    }

    return {
        "status": status,
        "summary": summary,
        "steps": steps,
        "warnings": warnings,
        "errors": errors,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
