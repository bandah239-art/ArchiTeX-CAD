"""BS 8110 Column Design Calculations."""

import math
from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value
from calculations.utils.validators import validate_material_grades
from calculations.structural.fire_and_anchorage import check_column_fire, anchorage_length


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


def _beta_biaxial(n_ratio: float) -> float:
    """Interpolate β from BS 8110 Table 3.22 for biaxial bending."""
    # N/(fcu·Ag) → β
    table = [(0.0, 1.00), (0.1, 0.88), (0.2, 0.77), (0.3, 0.65),
             (0.4, 0.53), (0.5, 0.42), (0.6, 0.30)]
    n_ratio = max(0.0, min(0.6, n_ratio))
    for i in range(len(table) - 1):
        x0, y0 = table[i]
        x1, y1 = table[i + 1]
        if x0 <= n_ratio <= x1:
            t = (n_ratio - x0) / (x1 - x0)
            return y0 + t * (y1 - y0)
    return 0.30


def run_bs8110_column(
    b_mm: float,
    h_mm: float,
    cover_mm: float,
    bar_dia_mm: float,
    n_bars: int,
    fcu_mpa: float,
    fy_mpa: float,
    N_kn: float,
    Mx_knm: float,
    My_knm: float,
    le_x_m: float,
    le_y_m: float,
    support_condition: str,
    link_dia_mm: float | None = None,
    link_spacing_mm: float | None = None,
    fire_period_hours: float = 1.0,
) -> dict[str, Any]:
    """Run column design calculations per BS 8110-1:1997."""
    validate_material_grades(fcu_mpa, fy_mpa)
    steps = []
    warnings = []
    errors = []
    status = "pass"

    # Resolve optional link parameters — used throughout for geometry
    _link_dia = link_dia_mm if link_dia_mm is not None else max(6.0, bar_dia_mm / 4)
    _links_defaulted = link_dia_mm is None

    # ── Step 1: Reinforcement & Section Properties ────────────────────────────
    asc = n_bars * math.pi * (bar_dia_mm / 2) ** 2
    ag = b_mm * h_mm
    ac = ag - asc
    rho_pct = 100.0 * asc / ag

    # Min/max steel: §3.12.6.2
    asc_min = 0.004 * ag   # 0.4% of Ag
    asc_max = 0.06 * ag    # 6% of Ag

    steel_status = "pass"
    if asc < asc_min:
        steel_status = "fail"
        status = "fail"
        errors.append(
            f"Steel area {round_value(asc, 0)} mm² < minimum 0.4% Ag = {round_value(asc_min, 0)} mm². Add bars."
        )
    if asc > asc_max:
        steel_status = "fail"
        status = "fail"
        errors.append(
            f"Steel area {round_value(asc, 0)} mm² > maximum 6% Ag = {round_value(asc_max, 0)} mm². Reduce bars."
        )

    steps.append(
        _step(
            1,
            "Reinforcement Area & Steel Limits",
            "Asc = n·π·(φ/2)²; ρ = Asc/Ag; As_min = 0.4%·Ag; As_max = 6%·Ag",
            f"Asc = {n_bars}×π×({bar_dia_mm}/2)² = {round_value(asc, 0)} mm²; "
            f"As_min = {round_value(asc_min, 0)} mm²; As_max = {round_value(asc_max, 0)} mm²",
            f"Asc = {round_value(asc, 0)} mm² (ρ = {round_value(rho_pct, 2)}%) — "
            f"Min {'✓' if asc >= asc_min else '✗'}; Max {'✓' if asc <= asc_max else '✗'}",
            "mm²",
            "BS 8110-1:1997 §3.12.6.2",
            steel_status,
        )
    )

    # ── Step 2: Slenderness Classification ───────────────────────────────────
    lambda_x = (le_x_m * 1000) / h_mm
    lambda_y = (le_y_m * 1000) / b_mm
    is_slender_x = lambda_x >= 15.0
    is_slender_y = lambda_y >= 15.0
    is_slender = is_slender_x or is_slender_y
    col_type = "SLENDER" if is_slender else "SHORT"

    steps.append(
        _step(
            2,
            "Slenderness Classification",
            "λx = lex/h; λy = ley/b (short braced: λ < 15)",
            f"λx = {round_value(le_x_m*1000, 0)}/{h_mm} = {round_value(lambda_x, 2)}; "
            f"λy = {round_value(le_y_m*1000, 0)}/{b_mm} = {round_value(lambda_y, 2)}",
            f"Column is {col_type}",
            "",
            "BS 8110-1:1997 §3.8.1.3",
            "info",
        )
    )

    # ── Step 3: Minimum Eccentricity & Design Moments ─────────────────────────
    # BS 8110 §3.8.2.4: emin = max(h/20, 20 mm); applied to minor axis
    emin_mm = max(h_mm / 20.0, 20.0)
    m_min_knm = N_kn * emin_mm / 1e3   # kNm

    # Additional moments for slender columns: Madd = N·(1/2000)·λ²·dimension
    madd_x = N_kn * (1 / 2000) * (lambda_x ** 2) * (h_mm / 1000) if is_slender_x else 0.0
    madd_y = N_kn * (1 / 2000) * (lambda_y ** 2) * (b_mm / 1000) if is_slender_y else 0.0

    # Total design moments (applied + slenderness + minimum eccentricity)
    mx_total = max(Mx_knm + madd_x, m_min_knm)
    my_total = max(My_knm + madd_y, m_min_knm)

    steps.append(
        _step(
            3,
            "Min Eccentricity & Total Design Moments",
            "emin = max(h/20, 20 mm); M_min = N·emin; Madd = N·(1/2000)·λ²·h",
            f"emin = max({h_mm}/20, 20) = {round_value(emin_mm, 1)} mm; "
            f"M_min = {N_kn}×{round_value(emin_mm, 1)}/1000 = {round_value(m_min_knm, 2)} kNm; "
            f"Madd,x = {round_value(madd_x, 1)}, Madd,y = {round_value(madd_y, 1)} kNm",
            f"Mx,design = {round_value(mx_total, 1)} kNm; My,design = {round_value(my_total, 1)} kNm",
            "kNm",
            "BS 8110-1:1997 §3.8.2.4 / §3.8.3",
            "info",
        )
    )

    # ── Step 4: Axial Capacity ────────────────────────────────────────────────
    # N_cap = 0.4·fcu·Ac + 0.8·Asc·fy  (Eq 35, pure axial short column)
    n_capacity = (0.4 * fcu_mpa * ac + 0.8 * asc * fy_mpa) / 1000
    util_n = N_kn / n_capacity if n_capacity > 0 else 999.0

    axial_status = "pass"
    if N_kn > n_capacity:
        axial_status = "fail"
        status = "fail"
        errors.append(
            f"Design axial load ({round_value(N_kn, 1)} kN) > column capacity "
            f"({round_value(n_capacity, 1)} kN)"
        )

    steps.append(
        _step(
            4,
            "Axial Load Capacity",
            "N_cap = 0.4·fcu·Ac + 0.8·Asc·fy",
            f"= 0.4×{fcu_mpa}×{round_value(ac, 0)} + 0.8×{round_value(asc, 0)}×{fy_mpa}",
            f"N_cap = {round_value(n_capacity, 1)} kN; Utilisation = {round_value(util_n*100, 1)}%",
            "kN",
            "BS 8110-1:1997 Eq 35",
            axial_status,
        )
    )

    # ── Step 5: Biaxial Bending — Equivalent Uniaxial Method (§3.8.4.5) ──────
    # Effective depths
    d_h = h_mm - cover_mm - _link_dia - bar_dia_mm / 2   # effective depth in h direction
    d_b = b_mm - cover_mm - _link_dia - bar_dia_mm / 2   # effective depth in b direction
    h_prime = d_h
    b_prime = d_b

    # β from Table 3.22
    n_ratio = (N_kn * 1000) / (fcu_mpa * ag)
    beta = _beta_biaxial(n_ratio)

    # Bending capacities (simplified with balanced reinforcement contribution)
    d_prime = cover_mm + _link_dia + bar_dia_mm / 2
    mux = (
        0.156 * fcu_mpa * b_mm * (d_h ** 2)
        + 0.87 * fy_mpa * (asc / 2) * (d_h - d_prime)
    ) / 1e6
    muy = (
        0.156 * fcu_mpa * h_mm * (d_b ** 2)
        + 0.87 * fy_mpa * (asc / 2) * (d_b - d_prime)
    ) / 1e6

    # Equivalent uniaxial moment per §3.8.4.5
    if h_prime > 0 and b_prime > 0:
        if mx_total / h_prime >= my_total / b_prime:
            # Design about X-axis using equivalent M_x'
            m_equiv = mx_total + beta * (h_prime / b_prime) * my_total
            axis_str = "X (Mx' = Mx + β·(h'/b')·My)"
            m_cap_used = mux
        else:
            # Design about Y-axis using equivalent M_y'
            m_equiv = my_total + beta * (b_prime / h_prime) * mx_total
            axis_str = "Y (My' = My + β·(b'/h')·Mx)"
            m_cap_used = muy
    else:
        m_equiv = max(mx_total, my_total)
        axis_str = "dominant axis"
        m_cap_used = max(mux, muy)

    util_m = m_equiv / m_cap_used if m_cap_used > 0 else 999.0
    biaxial_status = "pass"
    if m_equiv > m_cap_used:
        biaxial_status = "fail"
        status = "fail"
        errors.append(
            f"Equivalent uniaxial moment M' = {round_value(m_equiv, 1)} kNm > "
            f"capacity M_cap = {round_value(m_cap_used, 1)} kNm"
        )

    steps.append(
        _step(
            5,
            "Biaxial Bending (Equivalent Uniaxial, §3.8.4.5)",
            "β from Table 3.22; M' = Mx + β·(h'/b')·My or My + β·(b'/h')·Mx",
            f"N/(fcu·Ag) = {round_value(n_ratio, 3)} → β = {round_value(beta, 2)}; "
            f"Mux = {round_value(mux, 1)} kNm; Muy = {round_value(muy, 1)} kNm",
            f"Governing axis: {axis_str}; M' = {round_value(m_equiv, 1)} kNm vs "
            f"M_cap = {round_value(m_cap_used, 1)} kNm (util = {round_value(util_m*100, 1)}%)",
            "kNm",
            "BS 8110-1:1997 §3.8.4.5 Table 3.22",
            biaxial_status,
        )
    )

    # ── Step 6: Link Spacing & Diameter Check ────────────────────────────────
    # Max link spacing = min(12·φ_main, 300 mm) per §3.12.7.1
    max_link_spacing = min(12 * bar_dia_mm, 300.0)
    min_link_dia = max(6.0, bar_dia_mm / 4)

    # Resolve spacing sentinel
    link_spacing_eff = link_spacing_mm if link_spacing_mm is not None else max_link_spacing

    link_status = "pass"
    if link_spacing_eff > max_link_spacing:
        link_status = "fail"
        status = "fail"
        errors.append(
            f"Link spacing {link_spacing_eff:.0f} mm > max allowed {max_link_spacing:.0f} mm "
            f"(12×φ{bar_dia_mm:.0f} = {12*bar_dia_mm:.0f} mm). Reduce spacing."
        )
    if _link_dia < min_link_dia:
        link_status = "fail"
        status = "fail"
        errors.append(
            f"Link diameter {_link_dia:.0f} mm < minimum {min_link_dia:.0f} mm "
            f"(max(6, φ_main/4)). Use larger links."
        )

    link_note = " (defaults used — provide actual links to verify)" if _links_defaulted else ""
    steps.append(
        _step(
            6,
            "Link Spacing & Diameter Check",
            "sv_max = min(12·φ_main, 300 mm); φ_link ≥ max(6 mm, φ_main/4)",
            f"sv_max = min(12×{bar_dia_mm:.0f}, 300) = {max_link_spacing:.0f} mm; "
            f"min φ_link = {min_link_dia:.0f} mm{link_note}",
            f"Links: φ{_link_dia:.0f} @ {link_spacing_eff:.0f} mm — "
            f"Spacing {'✓' if link_spacing_eff <= max_link_spacing else '✗'}; "
            f"Diameter {'✓' if _link_dia >= min_link_dia else '✗'}",
            "mm",
            "BS 8110-1:1997 §3.12.7.1",
            link_status,
        )
    )

    overall_util = max(util_n, util_m)

    # ── Step 7: Fire Resistance & Anchorage ───────────────────────────────────
    fire_col_st, fire_col_msg, req_col_cover, req_col_dim = check_column_fire(
        cover_mm, b_mm, h_mm, fire_period_hours
    )
    if fire_col_st == "fail":
        status = "fail"
        errors.append(f"Fire resistance {fire_period_hours}h: {fire_col_msg}")

    la_main = anchorage_length(bar_dia_mm, fy_mpa, fcu_mpa, "compression")
    la_tension_col = anchorage_length(bar_dia_mm, fy_mpa, fcu_mpa, "tension")

    steps.append(
        _step(
            7,
            f"Fire Resistance & Anchorage ({fire_period_hours}h)",
            "Min cover & dimension from BS 8110 Table 3.5; La_comp = (φ/4)·(fy/fbu)",
            f"Required: cover ≥ {req_col_cover} mm, min_dim ≥ {req_col_dim} mm; "
            f"La_comp = {round_value(la_main, 0):.0f} mm; La_tension = {round_value(la_tension_col, 0):.0f} mm",
            f"Fire: {fire_col_msg}; Lap (compression) = {round_value(la_main, 0):.0f} mm",
            "mm",
            "BS 8110-1:1997 §3.3.6 Table 3.5 / §3.12.8",
            fire_col_st,
        )
    )

    # ── Step 8: ZMW Cost Estimate ─────────────────────────────────────────────
    # Column height approximation: use le_x_m as storey height proxy
    storey_h_m = le_x_m
    zmw_concrete_m3 = 1_050.0   # C25 in-situ column, includes formwork labour
    zmw_steel_tonne = 21_000.0  # Y-bars per tonne
    zmw_formwork_m2 = 420.0     # column formwork (4 faces) per m²

    col_vol_m3 = (b_mm / 1000) * (h_mm / 1000) * storey_h_m
    col_steel_kg = asc * storey_h_m * 7850e-6  # mm² × m × 7850 kg/m³ × 1e-6 m²/mm²
    col_formwork_m2 = 2 * ((b_mm + h_mm) / 1000) * storey_h_m

    cost_col_concrete = col_vol_m3 * zmw_concrete_m3
    cost_col_steel = (col_steel_kg / 1000) * zmw_steel_tonne
    cost_col_formwork = col_formwork_m2 * zmw_formwork_m2
    cost_col_total = cost_col_concrete + cost_col_steel + cost_col_formwork

    steps.append(
        _step(
            8,
            "ZMW Material Cost Estimate",
            "Cost = Vol_c·Rate_c + Steel_kg/1000·Rate_s + Area_fw·Rate_fw",
            f"Concrete {round_value(col_vol_m3, 3)} m³ @ ZMW {zmw_concrete_m3}/m³; "
            f"Steel {round_value(col_steel_kg, 1)} kg @ ZMW {zmw_steel_tonne}/t; "
            f"Formwork {round_value(col_formwork_m2, 2)} m² @ ZMW {zmw_formwork_m2}/m²",
            f"Total ≈ ZMW {round_value(cost_col_total, 0):,.0f} per storey "
            f"(concrete {round_value(cost_col_concrete, 0):,.0f} + "
            f"steel {round_value(cost_col_steel, 0):,.0f} + "
            f"formwork {round_value(cost_col_formwork, 0):,.0f})",
            "ZMW",
            "Zambian QS benchmarks Q4 2025 — Lusaka",
            "info",
        )
    )

    summary = {
        "asc_mm2":                   round_value(asc, 0),
        "asc_min_mm2":               round_value(asc_min, 0),
        "asc_max_mm2":               round_value(asc_max, 0),
        "rho_pct":                   round_value(rho_pct, 2),
        "ac_mm2":                    round_value(ac, 0),
        "column_type":               col_type,
        "slenderness_x":             round_value(lambda_x, 2),
        "slenderness_y":             round_value(lambda_y, 2),
        "emin_mm":                   round_value(emin_mm, 1),
        "m_min_knm":                 round_value(m_min_knm, 2),
        "additional_moment_x_knm":   round_value(madd_x, 1),
        "additional_moment_y_knm":   round_value(madd_y, 1),
        "mx_design_knm":             round_value(mx_total, 1),
        "my_design_knm":             round_value(my_total, 1),
        "axial_capacity_kn":         round_value(n_capacity, 1),
        "axial_utilisation":         round_value(util_n, 2),
        "beta_biaxial":              round_value(beta, 2),
        "equivalent_moment_knm":     round_value(m_equiv, 1),
        "moment_capacity_x_knm":     round_value(mux, 1),
        "moment_capacity_y_knm":     round_value(muy, 1),
        "moment_utilisation":        round_value(util_m, 2),
        "overall_utilisation":       round_value(overall_util, 2),
        "link_dia_mm":               _link_dia,
        "link_spacing_mm":           link_spacing_eff,
        "max_link_spacing_mm":       max_link_spacing,
        "concrete_volume_m3":        round_value(col_vol_m3, 3),
        "steel_mass_kg":             round_value(col_steel_kg, 1),
        "total_cost_zmw":            round_value(cost_col_total, 0),
        "fire_period_hours":         fire_period_hours,
        "fire_resistance":           fire_col_st,
        "anchorage_compression_mm":  round_value(la_main, 0),
        "structural_design":         "PASS ✓" if status == "pass" else "FAIL ✗",
    }

    return {
        "status": status,
        "summary": summary,
        "steps": steps,
        "warnings": warnings,
        "errors": errors,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
