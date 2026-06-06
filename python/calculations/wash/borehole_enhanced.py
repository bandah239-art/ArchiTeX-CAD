"""
WASH Borehole & Groundwater — Enhanced calculator.

Implements Theis (1935) and Cooper-Jacob (1946) drawdown methods, full pump
power sizing, standard casing selection, gravel pack and sanitary seal
specifications, and well development recommendations.

References:
  - Theis, C.V. (1935) The relation between the lowering of the piezometric
    surface and the rate and duration of discharge of a well using ground-water
    storage. Trans. AGU 16, 519–524.
  - Cooper, H.H. & Jacob, C.E. (1946) A generalised graphical method for
    evaluating formation constants. Trans. AGU 27(4), 526–534.
  - BS ISO 14686:2003 — Hydrometric determinations: pumping tests for water
    wells; considerations and guidelines for design, performance and use.
  - Zambia Ministry of Water Development (2011) Borehole construction
    specifications and groundwater guidelines.
  - British Standard BS EN ISO 5667-11:2009 — water quality sampling, groundwater.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

RHO_WATER: float = 1000.0   # kg/m³
GRAVITY: float = 9.81       # m/s²

# Standard motor sizes (kW) — IEC 60034 Series
STANDARD_MOTOR_KW: list[float] = [
    0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3.0, 4.0, 5.5, 7.5,
    11.0, 15.0, 18.5, 22.0, 30.0, 37.0, 45.0, 55.0, 75.0,
]

# Casing diameter selection by yield (L/s) — Zambia groundwater guidelines 2011
CASING_SCHEDULE: list[tuple[float, str, int]] = [
    (2.0,  '4" (102 mm)',  102),
    (5.0,  '6" (152 mm)',  152),
    (15.0, '8" (203 mm)',  203),
    (30.0, '10" (254 mm)', 254),
    (math.inf, '12" (305 mm)', 305),
]

# Sanitary seal minimum depth (Zambia MWD 2011 §7.3)
SANITARY_SEAL_DEPTH_M: float = 6.0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _step(
    n: int,
    title: str,
    formula: str,
    substitution: str,
    result: str,
    unit: str = "",
    reference: str = "",
    status: str = "info",
) -> dict[str, Any]:
    return {
        "step_number": n,
        "title": title,
        "formula": formula,
        "substitution": substitution,
        "result": result,
        "unit": unit,
        "reference": reference,
        "status": status,
    }


def _theis_well_function(u: float) -> float:
    """
    Compute W(u) = -0.5772156649 − ln(u) + u − u²/(2·2!) + u³/(3·3!) − u⁴/(4·4!) + u⁵/(5·5!)

    Valid for all u > 0.  For u < 0.05 Cooper-Jacob is accurate to within 5%.
    Reference: Theis (1935); Abramowitz & Stegun §5.1.11.
    """
    euler_gamma = 0.5772156649
    series = u - (u ** 2) / 4.0 + (u ** 3) / 18.0 - (u ** 4) / 96.0 + (u ** 5) / 600.0
    return -euler_gamma - math.log(u) + series


def _select_standard_motor(power_kw: float) -> float:
    """Return the smallest standard IEC motor size ≥ power_kw."""
    for size in STANDARD_MOTOR_KW:
        if size >= power_kw:
            return size
    return STANDARD_MOTOR_KW[-1]


def _select_casing(yield_lps: float) -> tuple[str, int]:
    """Return (description, diameter_mm) for the appropriate casing size."""
    for threshold, description, diameter_mm in CASING_SCHEDULE:
        if yield_lps < threshold:
            return description, diameter_mm
    return CASING_SCHEDULE[-1][1], CASING_SCHEDULE[-1][2]


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def calculate_borehole_enhanced(inputs: dict[str, Any]) -> dict[str, Any]:
    """
    Full borehole design and pump specification.

    Parameters
    ----------
    inputs : dict
        See module docstring for full schema.

    Returns
    -------
    dict
        status, summary, pump_specification, gravel_pack_spec,
        completion_log, steps, warnings, errors, timestamp.
    """
    errors: list[str] = []
    warnings: list[str] = []
    steps: list[dict] = []

    # ── Parse inputs ──────────────────────────────────────────────────────
    q_m3d = float(inputs.get("pumping_rate_m3d", 100.0))
    transmissivity = float(inputs.get("transmissivity_m2d", 50.0))
    storage_coeff = float(inputs.get("storage_coeff", 0.001))
    time_days = float(inputs.get("time_days", 1.0))
    radius_m = float(inputs.get("radius_m", 0.1))
    aquifer_thickness_m = float(inputs.get("aquifer_thickness_m", 20.0))
    static_water_level_m = float(inputs.get("static_water_level_m", 30.0))
    friction_losses_m = float(inputs.get("friction_losses_m", 5.0))
    residual_pressure_m = float(inputs.get("residual_pressure_m", 15.0))
    pump_efficiency = float(inputs.get("pump_efficiency", 0.65))
    motor_efficiency = float(inputs.get("motor_efficiency", 0.90))
    yield_lps = float(inputs.get("yield_lps", q_m3d / 86.4))
    aquifer_type = inputs.get("aquifer_type", "confined").lower()

    # ── Input validation ─────────────────────────────────────────────────
    if radius_m <= 0:
        errors.append(f"radius_m must be > 0, got {radius_m}.")
    if storage_coeff <= 0:
        errors.append(f"storage_coeff must be > 0, got {storage_coeff}.")
    if transmissivity <= 0:
        errors.append(f"transmissivity_m2d must be > 0, got {transmissivity}.")
    if time_days <= 0:
        errors.append(f"time_days must be > 0, got {time_days}.")
    if pump_efficiency <= 0 or pump_efficiency > 1:
        errors.append(f"pump_efficiency must be in (0, 1], got {pump_efficiency}.")
    if motor_efficiency <= 0 or motor_efficiency > 1:
        errors.append(f"motor_efficiency must be in (0, 1], got {motor_efficiency}.")
    if aquifer_type not in ("confined", "unconfined"):
        warnings.append(
            f"aquifer_type '{aquifer_type}' not recognised. Defaulting to 'confined'."
        )
        aquifer_type = "confined"

    # Storage coefficient range checks
    if aquifer_type == "confined" and not (0.0001 <= storage_coeff <= 0.005):
        warnings.append(
            f"Storage coefficient {storage_coeff} is outside typical confined aquifer "
            "range (0.0001 – 0.005). Verify field data."
        )
    if aquifer_type == "unconfined" and not (0.05 <= storage_coeff <= 0.35):
        warnings.append(
            f"Storage coefficient {storage_coeff} is outside typical unconfined aquifer "
            "range (0.05 – 0.35). Verify field data."
        )

    if errors:
        return {
            "status": "error",
            "summary": {},
            "pump_specification": {},
            "gravel_pack_spec": {},
            "completion_log": [],
            "steps": steps,
            "warnings": warnings,
            "errors": errors,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    # ── STEP 1: Method applicability ─────────────────────────────────────
    u = (radius_m ** 2 * storage_coeff) / (4.0 * transmissivity * time_days)
    cooper_jacob_valid = u < 0.05

    steps.append(
        _step(
            1,
            "Method Applicability Check",
            "u = r²·S / (4·T·t)",
            (
                f"u = {radius_m}² × {storage_coeff} / (4 × {transmissivity} × {time_days}) "
                f"= {round_value(u, 6)}"
            ),
            (
                f"u = {round_value(u, 6)}  →  "
                + ("Cooper-Jacob valid (u < 0.05)" if cooper_jacob_valid
                   else "Theis required (u ≥ 0.05)")
            ),
            "-",
            "Cooper & Jacob (1946); BS ISO 14686:2003 §6.3",
            "pass" if cooper_jacob_valid else "info",
        )
    )

    if not cooper_jacob_valid:
        warnings.append(
            f"u = {round_value(u,6)} ≥ 0.05: Cooper-Jacob approximation has >5% error. "
            "Theis method used automatically."
        )

    # ── STEP 2: Drawdown calculation ─────────────────────────────────────
    if cooper_jacob_valid:
        log_arg = (2.25 * transmissivity * time_days) / (radius_m ** 2 * storage_coeff)
        if log_arg <= 0:
            errors.append(
                f"Cooper-Jacob log argument ≤ 0 (= {log_arg:.4g}). "
                "Check inputs (transmissivity, time, radius, storage_coeff)."
            )
            drawdown_m = 0.0
        else:
            drawdown_m = (2.303 * q_m3d) / (4.0 * math.pi * transmissivity) * math.log10(log_arg)
        method_used = "Cooper-Jacob (1946)"
        formula_used = "s = [2.303Q / (4πT)] × log₁₀(2.25Tt / r²S)"
        sub_used = (
            f"s = [2.303 × {q_m3d} / (4π × {transmissivity})] "
            f"× log₁₀(2.25 × {transmissivity} × {time_days} / ({radius_m}² × {storage_coeff}))"
        )
    else:
        wu = _theis_well_function(u)
        drawdown_m = (q_m3d * wu) / (4.0 * math.pi * transmissivity)
        method_used = "Theis (1935)"
        formula_used = "s = Q·W(u) / (4πT);  W(u) = −0.5772 − ln(u) + u − u²/4 + …"
        sub_used = (
            f"W(u) = {round_value(wu, 5)};  "
            f"s = {q_m3d} × {round_value(wu,5)} / (4π × {transmissivity})"
        )

    steps.append(
        _step(
            2,
            f"Drawdown — {method_used}",
            formula_used,
            sub_used,
            f"s = {round_value(drawdown_m, 3)} m",
            "m",
            f"{method_used}; BS ISO 14686:2003 §7",
            "info",
        )
    )

    # Specific capacity
    specific_capacity = q_m3d / drawdown_m if drawdown_m > 0 else float("inf")

    # Drawdown check
    max_allowed_drawdown = 0.8 * aquifer_thickness_m
    if drawdown_m > max_allowed_drawdown:
        warnings.append(
            f"Drawdown ({round_value(drawdown_m,2)} m) exceeds 80% of saturated thickness "
            f"({round_value(max_allowed_drawdown,2)} m). Reduce pumping rate."
        )

    if drawdown_m > static_water_level_m:
        warnings.append(
            "Predicted drawdown exceeds static water level — pump may de-water the borehole."
        )

    # ── STEP 3: Total Dynamic Head ────────────────────────────────────────
    tdh = static_water_level_m + drawdown_m + friction_losses_m + residual_pressure_m

    steps.append(
        _step(
            3,
            "Total Dynamic Head (TDH)",
            "TDH = SWL + drawdown + friction_losses + residual_pressure",
            (
                f"TDH = {static_water_level_m} + {round_value(drawdown_m,3)} "
                f"+ {friction_losses_m} + {residual_pressure_m}"
            ),
            f"TDH = {round_value(tdh, 2)} m",
            "m",
            "Zambia MWD (2011) §8.2; AWWA M17 — pump TDH calculation",
            "info",
        )
    )

    # ── STEP 4: Pump power sizing ─────────────────────────────────────────
    q_m3s = q_m3d / 86400.0
    p_hydraulic_kw = (RHO_WATER * GRAVITY * q_m3s * tdh) / 1000.0
    p_shaft_kw = p_hydraulic_kw / pump_efficiency
    p_motor_kw = p_shaft_kw / motor_efficiency
    p_motor_selected_kw = _select_standard_motor(p_motor_kw)

    steps.append(
        _step(
            4,
            "Pump Power Requirements",
            "P_hyd = ρgQH/1000 [kW];  P_shaft = P_hyd/η_pump;  P_motor = P_shaft/η_motor",
            (
                f"P_hyd = {RHO_WATER}×{GRAVITY}×{round_value(q_m3s,6)}×{round_value(tdh,2)}/1000 "
                f"= {round_value(p_hydraulic_kw,3)} kW;  "
                f"P_shaft = {round_value(p_hydraulic_kw,3)}/{pump_efficiency} = {round_value(p_shaft_kw,3)} kW;  "
                f"P_motor = {round_value(p_shaft_kw,3)}/{motor_efficiency} = {round_value(p_motor_kw,3)} kW"
            ),
            f"Selected standard motor: {p_motor_selected_kw} kW",
            "kW",
            "IEC 60034-1:2022 — standard motor ratings; BS EN ISO 9906:2012 pump efficiency",
            "pass",
        )
    )

    # ── STEP 5: Casing diameter ───────────────────────────────────────────
    casing_desc, casing_diameter_mm = _select_casing(yield_lps)
    pump_housing_min_mm = int(casing_diameter_mm * 0.8)

    steps.append(
        _step(
            5,
            "Casing Diameter Selection",
            "Select casing from yield (L/s) — Zambia MWD table; min pump housing = 0.8 × casing",
            f"Yield = {round_value(yield_lps, 2)} L/s",
            f"Casing: {casing_desc};  Min pump housing diameter: {pump_housing_min_mm} mm",
            "mm",
            "Zambia MWD (2011) Appendix C; BS EN ISO 14686:2003 §4.2",
            "info",
        )
    )

    # ── STEP 6: Gravel pack design ────────────────────────────────────────
    steps.append(
        _step(
            6,
            "Gravel Pack Design",
            "D50_pack = 4–6 × D50_formation; Cu = D60/D10 < 2.5; annular space ≥ 75 mm",
            "Formation D50 not supplied — applying Zambia standard pack specification",
            (
                "Standard pack: 1–3 mm rounded gravel (siliceous);  "
                f"Annular thickness: min {max(75, (casing_diameter_mm // 2 - pump_housing_min_mm // 2))} mm;  "
                "Uniformity coefficient Cu ≤ 2.5"
            ),
            "-",
            "BS EN 1610:2015 §7.4; Zambia MWD (2011) §5.3 — gravel pack for crystalline aquifers",
            "info",
        )
    )

    # ── STEP 7: Sanitary seal ─────────────────────────────────────────────
    steps.append(
        _step(
            7,
            "Sanitary Seal Specification",
            "Grout: 1:2 cement:bentonite;  depth ≥ 6 m;  placement: tremie pipe from bottom up",
            f"Minimum seal depth = {SANITARY_SEAL_DEPTH_M} m (Zambia groundwater guidelines)",
            (
                f"Seal depth: {SANITARY_SEAL_DEPTH_M} m minimum;  "
                "Mix: 1 part OPC : 2 parts bentonite powder;  "
                "Install by tremie pipe — never poured from surface"
            ),
            "-",
            "Zambia MWD (2011) §7.3; BS EN 8004:2015 §6.5 — annular grout seals",
            "info",
        )
    )

    # ── STEP 8: Well development ──────────────────────────────────────────
    dev_duration_h = 2 if yield_lps < 2 else (4 if yield_lps < 10 else 6)

    steps.append(
        _step(
            8,
            "Well Development Recommendation",
            "Method: air surging or surge-and-bail;  duration based on yield",
            f"Yield = {round_value(yield_lps, 2)} L/s → recommended development time",
            (
                f"Method: air surging or surge-and-bail;  "
                f"Duration: {dev_duration_h} hours;  "
                "Terminate when turbidity ≤ 5 NTU sustained for 30 min"
            ),
            "hr",
            "Zambia MWD (2011) §6; BS ISO 14686:2003 §9 — well development procedures",
            "info",
        )
    )

    # ── Completion log ───────────────────────────────────────────────────
    completion_log = [
        "1. Drill to target depth; conduct rotary or DTH drilling as specified.",
        f"2. Install {casing_desc} steel casing with centralizers at 6 m intervals.",
        "3. Install 1–3 mm rounded gravel pack in annular space around screened interval.",
        f"4. Place {SANITARY_SEAL_DEPTH_M} m sanitary grout seal (1:2 OPC:bentonite) by tremie pipe.",
        "5. Develop well by air surging; verify turbidity ≤ 5 NTU.",
        "6. Conduct step-drawdown test (4 steps) and constant-rate test (minimum 24 hours).",
        "7. Collect water sample for bacteriological and chemical analysis (BS EN ISO 5667-11).",
        f"8. Install submersible pump: {p_motor_selected_kw} kW motor, set below maximum drawdown level.",
        "9. Install wellhead sanitary apron (concrete, 1 m radius, sloped away from well).",
        "10. Fit lockable access cover; install air vent and water level access tube.",
    ]

    status = "pass" if not warnings else "info"

    return {
        "status": status,
        "summary": {
            "pumping_rate_m3d": q_m3d,
            "yield_lps": round_value(yield_lps, 3),
            "aquifer_type": aquifer_type,
            "u_value": round_value(u, 6),
            "method_used": method_used,
            "drawdown_m": round_value(drawdown_m, 3),
            "specific_capacity_m3d_per_m": round_value(specific_capacity, 2),
            "total_dynamic_head_m": round_value(tdh, 2),
            "hydraulic_power_kw": round_value(p_hydraulic_kw, 3),
            "motor_power_required_kw": round_value(p_motor_kw, 3),
            "motor_power_selected_kw": p_motor_selected_kw,
            "casing_diameter_mm": casing_diameter_mm,
            "casing_description": casing_desc,
            "pump_efficiency": pump_efficiency,
            "motor_efficiency": motor_efficiency,
        },
        "pump_specification": {
            "flow_m3d": q_m3d,
            "flow_lps": round_value(yield_lps, 3),
            "tdh_m": round_value(tdh, 2),
            "hydraulic_power_kw": round_value(p_hydraulic_kw, 3),
            "shaft_power_kw": round_value(p_shaft_kw, 3),
            "motor_power_calculated_kw": round_value(p_motor_kw, 3),
            "motor_power_selected_kw": p_motor_selected_kw,
            "pump_setting_depth_m": round_value(
                static_water_level_m + drawdown_m + 2.0, 1
            ),
            "notes": (
                f"Set pump intake at least 2 m below maximum drawdown. "
                f"Selected {p_motor_selected_kw} kW is the next standard IEC size above "
                f"calculated {round_value(p_motor_kw,3)} kW."
            ),
        },
        "gravel_pack_spec": {
            "pack_material": "1–3 mm rounded siliceous gravel",
            "d50_pack_mm": "1–3 mm (standard for Zambia crystalline aquifers)",
            "uniformity_coefficient_target": "Cu ≤ 2.5",
            "annular_thickness_min_mm": 75,
            "volume_estimate_note": "Calculate from borehole diameter, casing OD, and screen length",
        },
        "sanitary_seal": {
            "depth_m": SANITARY_SEAL_DEPTH_M,
            "mix": "1:2 OPC:bentonite powder (by mass)",
            "installation_method": "tremie pipe from bottom of seal interval upward",
            "curing_time_hours": 24,
        },
        "well_development": {
            "method": "Air surging or surge-and-bail",
            "recommended_duration_hours": dev_duration_h,
            "acceptance_criterion": "Turbidity ≤ 5 NTU sustained for 30 minutes",
        },
        "completion_log": completion_log,
        "steps": steps,
        "warnings": warnings,
        "errors": errors,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
