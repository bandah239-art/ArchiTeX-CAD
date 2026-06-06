"""
Enhanced AASHTO 1993 Flexible Pavement Design Engine — Zambia Calibrated
==========================================================================
Implements AASHTO Guide for Design of Pavement Structures (1993) with
Zambia-specific climate and material adjustments:

- ESAL calculation: vehicle class counts → axle load equivalency factors
- Structural Number: SN = a1D1 + a2m2D2 + a3m3D3
- Design nomograph (Equation 1.1 — solved iteratively)
- Layer thickness determination from SN components
- Zambia climate modifier (rainfall, temperature effects on subgrade)
- Material quantities and ZMW cost per km

Usage
-----
    from calculations.roads.aashto_pavement_enhanced import calculate_pavement_aashto_enhanced

    result = calculate_pavement_aashto_enhanced({
        "province": "lusaka",
        "aadt_heavy": 250,          # heavy vehicles / day (both directions)
        "aadt_light": 1500,
        "growth_rate_pct": 5.0,
        "design_years": 20,
        "percent_heavy_design_lane": 60,   # % of heavy traffic in design lane
        "subgrade_cbr": 5.0,        # soaked CBR %
        "reliability_pct": 90.0,
        "overall_std_dev": 0.45,
        "initial_psi": 4.5,
        "terminal_psi": 2.5,
        "surface_type": "ac",       # "ac" = asphalt concrete, "gravel", "chip_seal"
        "road_class": "trunk",      # "trunk", "primary", "secondary", "feeder"
    })
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

# ---------------------------------------------------------------------------
# ESAL — Equivalent Single Axle Load factors (AASHTO 1993 Table)
# Approximate LEF per vehicle class (TRL / SATCC standard axle 80 kN)
# ---------------------------------------------------------------------------
VEHICLE_CLASS_LEF: dict[str, float] = {
    "car":              0.0002,
    "minibus":          0.03,
    "light_truck_2ax":  0.5,
    "medium_truck_2ax": 1.2,
    "heavy_truck_2ax":  3.0,
    "semi_trailer_3ax": 3.5,
    "semi_trailer_5ax": 4.0,
    "bus_2ax":          1.8,
    "bus_3ax":          2.5,
    "default_heavy":    3.0,    # default when AADT given without breakdown
}

# ---------------------------------------------------------------------------
# Layer coefficients — AASHTO 1993 (Zambia adjusted)
# ---------------------------------------------------------------------------
LAYER_COEFFICIENTS = {
    "ac_surfacing":       0.42,   # a1 — dense graded AC
    "chip_seal":          0.30,   # a1 — surfacing treatment only
    "cold_mix":           0.20,
    "natural_gravel_sub": 0.12,   # a3 for laterite gravel subbase (Zambia CBR≥15)
    "crushed_gravel_sub": 0.14,   # a3 for crushed gravel CBR≥20
    "crushed_stone_base": 0.18,   # a2 for crushed stone base (CBR≥80)
    "natural_gravel_base": 0.13,  # a2 for natural gravel base CBR≥45
    "lime_stab_subbase":  0.15,
}

DRAINAGE_COEFFICIENTS = {
    "zambia_rainy_season": 0.80,   # m2/m3 — poor drainage due to high rainfall
    "good":                0.95,
    "fair":                0.90,
    "poor":                0.80,
    "very_poor":           0.70,
}

# Zambia: adjust subgrade CBR for soaking (tropical conditions)
ZAMBIA_CBR_MOISTURE_FACTOR: dict[str, float] = {
    "lusaka": 0.85, "southern": 0.85, "eastern": 0.90,
    "northern": 0.90, "copperbelt": 0.88, "central": 0.87,
    "western": 0.88, "luapula": 0.90, "muchinga": 0.88,
    "north_western": 0.90, "default": 0.88,
}

# ZMW rates for pavement construction (2025 — per m² unless stated)
ZMW_PAVEMENT_RATES: dict[str, float] = {
    "ac_50mm_zmw_m2":          220.0,
    "ac_75mm_zmw_m2":          330.0,
    "chip_seal_double_zmw_m2":  65.0,
    "crushed_stone_base_zmw_m3": 380.0,
    "natural_gravel_base_zmw_m3": 180.0,
    "gravel_subbase_zmw_m3":    120.0,
    "subgrade_improvement_zmw_m3": 45.0,
    "earthworks_zmw_m3":         55.0,
    "formation_zmw_km":        850_000.0,
    "drainage_culvert_zmw_km":  250_000.0,
}

# Road widths by class (m)
ROAD_WIDTH = {"trunk": 7.4, "primary": 6.7, "secondary": 6.0, "feeder": 5.5}

# Minimum layer thicknesses (mm) — SATCC/RDA Zambia
MIN_THICKNESS = {"ac": 50, "base": 150, "subbase": 150}


def _step(ref: str, formula: str, subs: str, result: float, unit: str,
          status: str = "info", note: str = "") -> dict[str, Any]:
    return {
        "reference": ref, "formula": formula, "substitution": subs,
        "result": round(result, 4), "unit": unit, "status": status, "note": note,
    }


def _future_esal(aadt_heavy: float, aadt_light: float, growth_pct: float,
                 years: int, lane_factor: float,
                 lef_heavy: float = 3.0, lef_light: float = 0.05) -> tuple[float, list[dict]]:
    """Compound growth ESAL calculation.  Returns (W18_total, esal_schedule)."""
    r = growth_pct / 100.0
    daily_esal = (aadt_heavy * lef_heavy + aadt_light * lef_light) * lane_factor
    # Growth factor GF = [(1+r)^n − 1] / r
    if r > 0:
        GF = ((1.0 + r) ** years - 1.0) / r
    else:
        GF = float(years)
    W18 = daily_esal * 365.0 * GF
    schedule = []
    cumulative = 0.0
    for yr in range(1, years + 1):
        yr_esal = daily_esal * 365.0
        cumulative += yr_esal
        schedule.append({"year": yr, "annual_esal": round(yr_esal, 0), "cumulative_esal": round(cumulative, 0)})
    return W18, schedule


def _aashto_sn_required(W18: float, R: float, S0: float, ΔPSI: float, MR: float) -> float:
    """
    Solve AASHTO Eq.1.1 for SN.
    log10(W18) = ZR×S0 + 9.36×log10(SN+1) − 0.20 + log10(ΔPSI/(4.2−1.5))/(0.40+1094/(SN+1)^5.19) + 2.32×log10(MR) − 8.07
    Solved iteratively by bisection.
    """
    import math
    ZR_table = {50: 0.0, 75: -0.674, 80: -0.842, 85: -1.037, 90: -1.282, 95: -1.645, 99: -2.327}
    ZR = ZR_table.get(int(R), -1.282)
    target = math.log10(max(W18, 1.0))

    def lhs(SN: float) -> float:
        if SN <= 0:
            return -999
        return (ZR * S0
                + 9.36 * math.log10(SN + 1.0)
                - 0.20
                + math.log10(ΔPSI / 2.7) / (0.40 + 1094.0 / (SN + 1.0) ** 5.19)
                + 2.32 * math.log10(MR)
                - 8.07)

    lo, hi = 0.1, 20.0
    for _ in range(60):
        mid = (lo + hi) / 2.0
        if lhs(mid) < target:
            lo = mid
        else:
            hi = mid
    return round((lo + hi) / 2.0, 3)


def _cbr_to_mr(cbr: float) -> float:
    """MR (psi) from CBR: MR = 1500 × CBR (AASHTO 1993)."""
    return 1500.0 * cbr


def calculate_pavement_aashto_enhanced(inputs: dict[str, Any]) -> dict[str, Any]:
    steps: list[dict] = []
    warnings: list[str] = []
    errors: list[str] = []

    try:
        province = inputs.get("province", "default").lower()
        aadt_heavy = float(inputs.get("aadt_heavy", 100.0))
        aadt_light = float(inputs.get("aadt_light", 500.0))
        growth_pct = float(inputs.get("growth_rate_pct", 5.0))
        design_years = int(inputs.get("design_years", 20))
        lane_factor = float(inputs.get("percent_heavy_design_lane", 60.0)) / 100.0
        cbr_raw = float(inputs.get("subgrade_cbr", 5.0))
        reliability = float(inputs.get("reliability_pct", 90.0))
        S0 = float(inputs.get("overall_std_dev", 0.45))
        psi_i = float(inputs.get("initial_psi", 4.5))
        psi_t = float(inputs.get("terminal_psi", 2.5))
        surface_type = inputs.get("surface_type", "ac")
        road_class = inputs.get("road_class", "secondary")

        # Zambia moisture factor
        cbr_factor = ZAMBIA_CBR_MOISTURE_FACTOR.get(province, 0.88)
        cbr_design = cbr_raw * cbr_factor
        steps.append(_step(
            "SATCC / RDA Zambia", "CBR_design = CBR_lab × moisture_factor",
            f"{cbr_raw}% × {cbr_factor} = {cbr_design:.2f}%",
            cbr_design, "%",
            note="Zambia soaked CBR correction for tropical conditions",
        ))

        MR_psi = _cbr_to_mr(cbr_design)
        steps.append(_step(
            "AASHTO 1993", "M_R = 1500 × CBR",
            f"1500 × {cbr_design:.2f} = {MR_psi:.0f} psi",
            MR_psi, "psi",
        ))

        DPSI = psi_i - psi_t
        steps.append(_step(
            "AASHTO Eq.1.1", "ΔPSI = p_i − p_t",
            f"{psi_i} − {psi_t} = {DPSI}",
            DPSI, "–",
        ))

        # ESAL calculation
        W18, esal_schedule = _future_esal(
            aadt_heavy, aadt_light, growth_pct, design_years, lane_factor,
            lef_heavy=VEHICLE_CLASS_LEF["default_heavy"],
            lef_light=VEHICLE_CLASS_LEF["car"] * 0.5 + VEHICLE_CLASS_LEF["minibus"] * 0.5,
        )
        steps.append(_step(
            "AASHTO 1993 Traffic", "W18 = Σ(AADT × LEF × lane_factor) × 365 × GF",
            f"AADT_heavy={aadt_heavy}, r={growth_pct}%, n={design_years}yr → W18={W18:.2e}",
            W18, "ESAL",
        ))

        if W18 < 1e4:
            warnings.append("Very low W18 (<10,000 ESALs) — consider gravel surfacing")
        if W18 > 2e7:
            warnings.append("High traffic loading (>20M ESALs) — consider rigid pavement")

        # Required structural number
        SN_req = _aashto_sn_required(W18, reliability, S0, DPSI, MR_psi)
        steps.append(_step(
            "AASHTO Eq.1.1", "Solve SN from W18, R, S0, ΔPSI, M_R (bisection)",
            f"W18={W18:.2e}, R={reliability}%, MR={MR_psi:.0f}psi → SN_req={SN_req:.3f}",
            SN_req, "–",
            status="info",
        ))

        # Layer design
        a1 = LAYER_COEFFICIENTS["ac_surfacing"] if surface_type == "ac" else LAYER_COEFFICIENTS.get(surface_type, 0.30)
        a2 = LAYER_COEFFICIENTS["crushed_stone_base"]
        a3 = LAYER_COEFFICIENTS["natural_gravel_sub"]
        m2 = DRAINAGE_COEFFICIENTS["zambia_rainy_season"]
        m3 = DRAINAGE_COEFFICIENTS["zambia_rainy_season"]

        # D1 (surface) minimum 50mm AC
        D1_min_in = MIN_THICKNESS["ac"] / 25.4   # to inches
        D1 = max(D1_min_in, 2.0)  # 2" minimum
        SN1 = a1 * D1

        # D2 (base) — remaining SN after surface
        SN_rem2 = SN_req - SN1
        D2_calc = SN_rem2 / (a2 * m2) if SN_rem2 > 0 else 0.0
        D2 = max(D2_calc, MIN_THICKNESS["base"] / 25.4)
        SN2 = a2 * m2 * D2

        # D3 (subbase) — remaining SN after surface + base
        SN_rem3 = SN_req - SN1 - SN2
        D3_calc = SN_rem3 / (a3 * m3) if SN_rem3 > 0 else 0.0
        D3 = max(D3_calc, MIN_THICKNESS["subbase"] / 25.4 if SN_rem3 > 0 else 0.0)
        SN3 = a3 * m3 * D3

        SN_prov = SN1 + SN2 + SN3
        SN_ok = SN_prov >= SN_req

        steps.append(_step(
            "AASHTO 1993 cl.2.3", "SN = a1D1 + a2m2D2 + a3m3D3",
            f"a1={a1}·{D1:.2f}in + a2={a2}·m={m2}·{D2:.2f}in + a3={a3}·m={m3}·{D3:.2f}in = {SN_prov:.3f}",
            SN_prov, "–",
            status="pass" if SN_ok else "fail",
        ))

        # Convert to mm
        D1_mm = round(D1 * 25.4 / 10.0) * 10  # round to 10mm
        D2_mm = round(D2 * 25.4 / 10.0) * 10
        D3_mm = round(D3 * 25.4 / 10.0) * 10

        # Cost estimate per km
        width = ROAD_WIDTH.get(road_class, 6.0)
        surf_rate = ZMW_PAVEMENT_RATES["ac_75mm_zmw_m2"] if D1_mm >= 75 else ZMW_PAVEMENT_RATES["ac_50mm_zmw_m2"]
        if surface_type != "ac":
            surf_rate = ZMW_PAVEMENT_RATES["chip_seal_double_zmw_m2"]

        base_vol_m3km = D2_mm / 1000.0 * width * 1000.0
        sub_vol_m3km = D3_mm / 1000.0 * width * 1000.0

        cost_surface = width * 1000.0 * surf_rate
        cost_base = base_vol_m3km * ZMW_PAVEMENT_RATES["crushed_stone_base_zmw_m3"]
        cost_subbase = sub_vol_m3km * ZMW_PAVEMENT_RATES["gravel_subbase_zmw_m3"]
        cost_formation = ZMW_PAVEMENT_RATES["formation_zmw_km"]
        cost_drainage = ZMW_PAVEMENT_RATES["drainage_culvert_zmw_km"]
        cost_total_km = cost_surface + cost_base + cost_subbase + cost_formation + cost_drainage

        boq = [
            {"item": f"Subbase: natural gravel ({D3_mm}mm)", "qty": round(sub_vol_m3km, 0), "unit": "m³/km", "rate_zmw": ZMW_PAVEMENT_RATES["gravel_subbase_zmw_m3"], "total_zmw": round(cost_subbase, 0)},
            {"item": f"Base course: crushed stone ({D2_mm}mm)", "qty": round(base_vol_m3km, 0), "unit": "m³/km", "rate_zmw": ZMW_PAVEMENT_RATES["crushed_stone_base_zmw_m3"], "total_zmw": round(cost_base, 0)},
            {"item": f"Surfacing: {surface_type.upper()} ({D1_mm}mm)", "qty": round(width * 1000.0, 0), "unit": "m²/km", "rate_zmw": surf_rate, "total_zmw": round(cost_surface, 0)},
            {"item": "Formation earthworks & subgrade", "qty": 1, "unit": "km", "rate_zmw": ZMW_PAVEMENT_RATES["formation_zmw_km"], "total_zmw": round(cost_formation, 0)},
            {"item": "Drainage & culverts (allowance)", "qty": 1, "unit": "km", "rate_zmw": ZMW_PAVEMENT_RATES["drainage_culvert_zmw_km"], "total_zmw": round(cost_drainage, 0)},
        ]

        if not SN_ok:
            errors.append(f"SN_provided={SN_prov:.3f} < SN_required={SN_req:.3f} — increase layer thicknesses")

        return {
            "status": "pass" if SN_ok else "fail",
            "summary": {
                "province": province,
                "road_class": road_class,
                "design_esals_W18": round(W18, 0),
                "subgrade_cbr_design": round(cbr_design, 2),
                "subgrade_MR_psi": round(MR_psi, 0),
                "SN_required": SN_req,
                "SN_provided": round(SN_prov, 3),
                "D1_surface_mm": D1_mm,
                "D2_base_mm": D2_mm,
                "D3_subbase_mm": D3_mm,
                "total_pavement_depth_mm": D1_mm + D2_mm + D3_mm,
                "reliability_pct": reliability,
                "design_years": design_years,
                "cost_zmw_per_km": round(cost_total_km, 0),
            },
            "esal_schedule": esal_schedule,
            "boq": boq,
            "steps": steps,
            "warnings": warnings,
            "errors": errors,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as exc:
        return {
            "status": "error", "summary": {}, "esal_schedule": [], "boq": [],
            "steps": steps, "warnings": warnings, "errors": [str(exc)],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
