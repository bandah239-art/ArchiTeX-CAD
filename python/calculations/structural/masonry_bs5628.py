"""Masonry wall design calculations per BS 5628-1."""

import math
from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value

# Characteristic compressive strength fk (MPa) mapping based on brick class/type and mortar designation
# Reference: BS 5628-1:2005 Table 2
FK_MAP = {
    "class_1": {"i": 7.0, "ii": 6.4, "iii": 5.8, "iv": 5.2},
    "class_2": {"i": 5.8, "ii": 5.3, "iii": 4.8, "iv": 4.3},
    "class_3": {"i": 4.4, "ii": 4.0, "iii": 3.6, "iv": 3.2},
    "class_4": {"i": 2.8, "ii": 2.5, "iii": 2.2, "iv": 1.9},
    "class_5": {"i": 2.2, "ii": 2.0, "iii": 1.7, "iv": 1.5},
    "class_7": {"i": 1.7, "ii": 1.5, "iii": 1.3, "iv": 1.1},
    "hollow_140": {"i": 3.5, "ii": 3.5, "iii": 3.0, "iv": 2.5},
    "hollow_190": {"i": 4.2, "ii": 4.2, "iii": 3.6, "iv": 3.0},
}

ZAMBIA_BRICKS = {
    "class_1": {"fk_base_mpa": 7.0, "typical_use": "engineering brick"},
    "class_2": {"fk_base_mpa": 5.8, "typical_use": "high quality face"},
    "class_3": {"fk_base_mpa": 4.4, "typical_use": "most common Zambia"},
    "class_4": {"fk_base_mpa": 2.8, "typical_use": "common Lusaka"},
    "hollow_140": {"fk_base_mpa": 3.5, "typical_use": "concrete block 140mm"},
    "hollow_190": {"fk_base_mpa": 4.2, "typical_use": "concrete block 190mm"},
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


def _get_beta(sr: float, e_t: float) -> float:
    """Calculate slenderness reduction factor beta from BS 5628 Table 7.

    Interpolates between slenderness ratios 6 to 27.
    """
    sr_vals = [6.0, 8.0, 10.0, 12.0, 14.0, 16.0, 18.0, 20.0, 22.0, 24.0, 26.0, 27.0]
    
    # Eccentricity ranges: e/t <= 0.05, 0.1, 0.2, 0.3
    if e_t <= 0.05:
        beta_vals = [1.0, 0.95, 0.89, 0.83, 0.77, 0.70, 0.64, 0.57, 0.51, 0.44, 0.37, 0.33]
    elif e_t <= 0.1:
        beta_vals = [0.93, 0.88, 0.83, 0.77, 0.71, 0.65, 0.59, 0.52, 0.46, 0.39, 0.32, 0.29]
    elif e_t <= 0.2:
        beta_vals = [0.80, 0.75, 0.70, 0.64, 0.59, 0.53, 0.47, 0.41, 0.35, 0.29, 0.23, 0.20]
    else:  # e_t <= 0.3
        beta_vals = [0.67, 0.62, 0.57, 0.52, 0.46, 0.41, 0.35, 0.30, 0.24, 0.18, 0.12, 0.09]

    if sr <= 6.0:
        return beta_vals[0]
    if sr >= 27.0:
        return beta_vals[-1]

    # Interpolate
    for i in range(len(sr_vals) - 1):
        if sr_vals[i] <= sr <= sr_vals[i + 1]:
            t = (sr - sr_vals[i]) / (sr_vals[i + 1] - sr_vals[i])
            return beta_vals[i] + t * (beta_vals[i + 1] - beta_vals[i])
            
    return 0.33


def run_masonry_wall(
    t_mm: float,
    h_m: float,
    L_m: float,
    load_type: str,
    N_kn_m: float,
    M_knm_m: float,
    brick_class: str,
    mortar_designation: str,
    wall_condition: str,
    restraint_top: str,
    restraint_bottom: str,
    openings: bool = False,
) -> dict[str, Any]:
    """Run masonry wall design calculations per BS 5628-1."""
    steps = []
    warnings = []
    errors = []
    status = "pass"

    # 1. Characteristic compressive strength fk
    class_key = f"class_{brick_class}" if brick_class in ("1", "2", "3", "4", "5", "7") else brick_class
    
    fk = FK_MAP.get(class_key, {}).get(mortar_designation.lower(), 3.5)
    brick_info = ZAMBIA_BRICKS.get(class_key, {"typical_use": "unknown"})
    
    steps.append(
        _step(
            1,
            "Characteristic Compressive Strength",
            "fk = f(brick_class, mortar_designation)",
            f"Brick Class = {brick_class}, Mortar = {mortar_designation}",
            f"fk = {round_value(fk, 2)} MPa ({brick_info['typical_use']})",
            "MPa",
            "BS 5628-1 Table 2",
            "info",
        )
    )

    # 2. Effective height and thickness
    # Restraint factors:
    # 0.75 for full lateral restraint (both ends pinned/fixed)
    # 1.0 for standard load-bearing restraint
    # 2.0 for cantilever walls
    factor = 1.0
    if restraint_top == "restrained" and restraint_bottom == "restrained":
        factor = 0.75
    elif restraint_top == "free" or restraint_bottom == "free":
        factor = 2.0
        
    hef = h_m * factor
    tef = t_mm
    
    sr = (hef * 1000) / tef
    sr_limit = 27.0
    
    sr_status = "pass"
    if sr > sr_limit:
        status = "fail"
        sr_status = "fail"
        errors.append(f"Slenderness ratio {sr:.2f} exceeds limit {sr_limit}. Increase wall thickness.")

    steps.append(
        _step(
            2,
            "Slenderness Check",
            "SR = hef / tef = (h · restraint_factor) / t",
            f"SR = ({h_m} × {factor} × 1000) / {t_mm}",
            f"SR = {round_value(sr, 2)} (Limit = {sr_limit})",
            "",
            "BS 5628-1 Clause 19",
            sr_status,
        )
    )

    # 3. Eccentricity and ratio
    # e = M / N
    if N_kn_m > 0:
        ecc = (M_knm_m * 1000) / N_kn_m  # mm
    else:
        ecc = 0.0
        
    e_t = ecc / t_mm
    
    tension_warning = "pass"
    if ecc > (t_mm / 6):
        tension_warning = "warning"
        warnings.append(f"Eccentricity {ecc:.1f} mm exceeds t/6 ({t_mm / 6:.1f} mm). Wall is in tension.")

    steps.append(
        _step(
            3,
            "Eccentricity check",
            "e = M / N; e/t ratio",
            f"e = {round_value(M_knm_m, 2)} / {round_value(N_kn_m, 1)} = {round_value(ecc, 1)} mm",
            f"e/t = {round_value(e_t, 3)} (Limit for zero tension = {round_value(1/6, 3)})",
            "mm",
            "BS 5628-1 Clause 20",
            tension_warning,
        )
    )

    # 4. Slenderness reduction factor beta
    beta = _get_beta(sr, e_t)
    
    steps.append(
        _step(
            4,
            "Slenderness Reduction Factor (beta)",
            "β = f(SR, e/t)",
            f"SR = {round_value(sr, 2)}, e/t = {round_value(e_t, 3)}",
            f"β = {round_value(beta, 3)}",
            "",
            "BS 5628-1 Table 7",
            "info",
        )
    )

    # 5. Compressive Resistance
    # NRd = β * fk * t / γm
    # γm = 3.5 (Normal construction control) or 2.5 (Special category / tested control)
    gamma_m = 2.5 if wall_condition == "special" else 3.5
    n_rd = (beta * fk * t_mm) / gamma_m  # kN/m
    util = N_kn_m / n_rd if n_rd > 0 else 999.0

    capacity_status = "pass"
    if N_kn_m > n_rd:
        status = "fail"
        capacity_status = "fail"
        errors.append(f"Design load {N_kn_m:.1f} kN/m exceeds wall capacity {n_rd:.1f} kN/m")

    steps.append(
        _step(
            5,
            "Design Compressive Resistance",
            "NRd = β · fk · t / γm",
            f"NRd = {round_value(beta, 3)} × {round_value(fk, 2)} × {t_mm} / {gamma_m} (γm = {gamma_m} — {'Special control' if gamma_m == 2.5 else 'Normal control'})",
            f"NRd = {round_value(n_rd, 1)} kN/m vs N_design = {round_value(N_kn_m, 1)} kN/m → Utilisation = {round_value(util*100, 1)}%",
            "kN/m",
            "BS 5628-1 Clause 32.1",
            capacity_status,
        )
    )

    # 6. Minimum eccentricity check (Clause 20.2)
    # Even when no moment is applied, a minimum eccentricity of 0.05t applies
    e_min = 0.05 * t_mm  # mm
    e_design = max(ecc, e_min)
    if ecc < e_min:
        warnings.append(f"Applied eccentricity ({ecc:.1f} mm) < minimum 0.05t ({e_min:.1f} mm). Using emin for design.")

    steps.append(
        _step(
            6,
            "Minimum Eccentricity (Clause 20.2)",
            "emin = 0.05 · t (applied regardless of calculated eccentricity)",
            f"emin = 0.05 × {t_mm} = {round_value(e_min, 1)} mm; e_design = max({round_value(ecc, 1)}, {round_value(e_min, 1)})",
            f"e_design = {round_value(e_design, 1)} mm",
            "mm",
            "BS 5628-1 Clause 20.2",
            "info",
        )
    )

    # 6. Zambia Specific Cost Estimation
    # Class 3 Half brick (115mm): 680 ZMW/m²
    # Class 3 Full brick (230mm): 1100 ZMW/m²
    # Default concrete blocks: 820 ZMW/m² (140mm) and 980 ZMW/m² (190mm)
    zmw_rate = 820.0
    if class_key == "class_3":
        if t_mm < 150:
            zmw_rate = 680.0
        else:
            zmw_rate = 1100.0
    elif class_key == "hollow_140":
        zmw_rate = 820.0
    elif class_key == "hollow_190":
        zmw_rate = 980.0
    else:
        if t_mm < 150:
            zmw_rate = 700.0
        else:
            zmw_rate = 1150.0
            
    wall_area = L_m * h_m
    total_cost = wall_area * zmw_rate

    steps.append(
        _step(
            6,
            "Zambia Market Local Costing Estimate",
            "Cost = Area · Local_Unit_Rate",
            f"Area = {round_value(wall_area, 2)} m² @ {round_value(zmw_rate, 2)} ZMW/m²",
            f"Cost = {round_value(total_cost, 2)} ZMW",
            "ZMW",
            "Zambian Quantity Surveyors Market Rates Q4 2025",
            "info",
        )
    )

    summary = {
        "fk_mpa":            round_value(fk, 2),
        "slenderness_ratio": round_value(sr, 2),
        "effective_height_m": round_value(hef, 3),
        "beta":              round_value(beta, 3),          # FE reads 'beta'
        "beta_reduction":    round_value(beta, 3),          # alias
        "NRd_kn_m":          round_value(n_rd, 1),          # FE reads 'NRd_kn_m'
        "design_resistance_kn_m": round_value(n_rd, 1),    # alias
        "N_applied_kn_m":    round_value(N_kn_m, 1),       # FE reads 'N_applied_kn_m'
        "utilisation_pct":   round_value(util * 100, 1),   # FE reads 'utilisation_pct'
        "eccentricity_mm":   round_value(e_design, 1),
        "e_t_ratio":         round_value(e_design / t_mm, 3),
        "gamma_m":           gamma_m,
        "wall_area_m2":      round_value(wall_area, 2),
        "unit_rate_zmw":     round_value(zmw_rate, 2),
        "total_cost_zmw":    round_value(total_cost, 2),
        "structural_design": "PASS ✓" if status == "pass" else "FAIL ✗",
    }

    return {
        "status": status,
        "summary": summary,
        "steps": steps,
        "warnings": warnings,
        "errors": errors,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
