"""
Black Cotton Soil (Expansive Clay) Assessment — Enhanced
==========================================================
Covers:
- Swell pressure estimation (Komornik & David 1969; IS 2720 Part 41)
- GPS-based zone detection for Zambia Black Cotton Soil corridors
- Lime stabilisation comparison at 3%, 5%, 7% (UCS increase, swell reduction)
- Foundation treatment recommendations
- ZMW treatment cost estimate per m²

Usage
-----
    from calculations.geotechnical.black_cotton_enhanced import calculate_black_cotton_assessment_enhanced

    result = calculate_black_cotton_assessment_enhanced({
        "LL_pct": 75,         # Liquid Limit %
        "PL_pct": 28,         # Plastic Limit %
        "PI_pct": 47,         # Plasticity Index %
        "swell_pressure_kpa": 120.0,   # measured (optional; if 0 → estimated)
        "depth_to_rock_m": 6.0,
        "GWT_m": 3.5,
        "dry_unit_weight_knm3": 15.0,
        "proposed_foundation": "isolated",   # "isolated", "raft", "pile", "strip"
        "B_m": 1.5,            # footing width
        "Df_m": 1.2,           # foundation depth
        "latitude": -13.5,     # for GPS zone detection
        "longitude": 28.5,
        "treatment": "lime",   # "lime", "cement", "sand_replacement", "none"
    })
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

# ---------------------------------------------------------------------------
# Zambia Black Cotton Soil zones (GPS bounding boxes — approximate)
# ---------------------------------------------------------------------------
ZAMBIA_BCS_ZONES: list[dict] = [
    {
        "name": "Kafue Flats — Lusaka to Mazabuka",
        "lat_min": -16.5, "lat_max": -14.5,
        "lon_min": 27.5, "lon_max": 29.0,
        "severity": "severe",
    },
    {
        "name": "Kabwe — Central Province",
        "lat_min": -14.8, "lat_max": -13.5,
        "lon_min": 28.0, "lon_max": 29.5,
        "severity": "moderate",
    },
    {
        "name": "Eastern Province (Chipata – Lundazi corridor)",
        "lat_min": -13.5, "lat_max": -11.5,
        "lon_min": 31.5, "lon_max": 33.5,
        "severity": "moderate",
    },
    {
        "name": "Southern Province (Choma – Livingstone)",
        "lat_min": -18.5, "lat_max": -15.5,
        "lon_min": 25.5, "lon_max": 27.5,
        "severity": "high",
    },
    {
        "name": "Copperbelt — Ndola area",
        "lat_min": -13.5, "lat_max": -12.5,
        "lon_min": 27.5, "lon_max": 29.0,
        "severity": "low",
    },
]

# Lime treatment effectiveness (based on literature + Zambia road studies)
LIME_TREATMENT = {
    3: {"ucs_factor": 1.5, "swell_reduction_pct": 40, "pi_reduction_pct": 30},
    5: {"ucs_factor": 2.5, "swell_reduction_pct": 65, "pi_reduction_pct": 50},
    7: {"ucs_factor": 3.5, "swell_reduction_pct": 80, "pi_reduction_pct": 65},
}

# ZMW treatment cost rates
ZMW_TREATMENT_RATES: dict[str, float] = {
    "lime_3pct_zmw_m2":           85.0,
    "lime_5pct_zmw_m2":          135.0,
    "lime_7pct_zmw_m2":          185.0,
    "cement_5pct_zmw_m2":        150.0,
    "sand_replacement_300mm_zmw_m2": 120.0,
    "granular_blanket_200mm_zmw_m2": 95.0,
    "geotextile_zmw_m2":           45.0,
}


def _step(ref: str, formula: str, subs: str, result: float, unit: str,
          status: str = "info", note: str = "") -> dict[str, Any]:
    return {
        "reference": ref, "formula": formula, "substitution": subs,
        "result": round(result, 4), "unit": unit, "status": status, "note": note,
    }


def _swell_pressure_komornik(LL: float, gamma_d: float, w: float = None) -> float:
    """
    Komornik & David (1969) empirical:
    log(Ps) = 2.132 + 0.0208·LL + 0.000665·γd − 0.0269·w
    Ps in kg/cm²; γd in kg/m³; LL in %; w = moisture content %
    Returns kPa.
    """
    gamma_d_kgm3 = gamma_d * 1000.0 / 9.81  # kN/m³ → kg/m³
    w_use = w if w is not None else 20.0  # default moisture
    log_ps = 2.132 + 0.0208 * LL + 0.000665 * gamma_d_kgm3 - 0.0269 * w_use
    Ps_kgcm2 = 10.0 ** log_ps
    return Ps_kgcm2 * 98.07   # kPa


def _swelling_potential_chen(PI: float) -> tuple[str, float]:
    """Chen (1975) classification from PI."""
    if PI < 15:
        return "low", 1.0
    elif PI < 25:
        return "medium", 2.0
    elif PI < 35:
        return "high", 3.0
    else:
        return "very_high", 4.0


def _gps_zone_check(lat: float | None, lon: float | None) -> dict:
    if lat is None or lon is None:
        return {"zone": "unknown", "severity": "unknown", "in_bcs_zone": False}
    for zone in ZAMBIA_BCS_ZONES:
        if zone["lat_min"] <= lat <= zone["lat_max"] and zone["lon_min"] <= lon <= zone["lon_max"]:
            return {"zone": zone["name"], "severity": zone["severity"], "in_bcs_zone": True}
    return {"zone": "Not in known BCS corridor", "severity": "low", "in_bcs_zone": False}


def _treatment_comparison(swell_kpa: float, PI: float, base_ucs_kpa: float = 200.0) -> list[dict]:
    comparison = []
    for lime_pct, data in LIME_TREATMENT.items():
        sw_red = swell_kpa * (1.0 - data["swell_reduction_pct"] / 100.0)
        pi_red = PI * (1.0 - data["pi_reduction_pct"] / 100.0)
        ucs_new = base_ucs_kpa * data["ucs_factor"]
        comparison.append({
            "lime_pct": lime_pct,
            "swell_pressure_after_kpa": round(sw_red, 1),
            "swell_reduction_pct": data["swell_reduction_pct"],
            "pi_after": round(pi_red, 1),
            "pi_reduction_pct": data["pi_reduction_pct"],
            "ucs_after_kpa": round(ucs_new, 0),
            "ucs_gain_factor": data["ucs_factor"],
            "cost_zmw_m2": ZMW_TREATMENT_RATES[f"lime_{lime_pct}pct_zmw_m2"],
        })
    return comparison


def _foundation_recommendation(swell_kpa: float, Df: float, GWT: float,
                                proposed: str, severity: str) -> str:
    """Return treatment and foundation design recommendation string."""
    recs = []
    if swell_kpa > 200:
        recs.append("Piled foundation recommended — swell pressure exceeds 200 kPa (pile tips below active zone)")
    elif swell_kpa > 100:
        recs.append("Raft foundation or deep strip footing ≥1.5m below active zone recommended")
    elif swell_kpa > 50:
        recs.append("Isolated pads with grade beam — use 5% lime stabilisation over 300mm depth")
    else:
        recs.append("Conventional shallow foundation acceptable with lime/cement stabilisation")

    if GWT < Df + 1.5:
        recs.append(f"GWT at {GWT}m is within 1.5m of foundation — subsurface drainage required")

    if severity in ("severe", "high"):
        recs.append("Provide granular blanket 200mm + geotextile separator beneath floor slab")
        recs.append("Include expansion joints in floor slab @ 3m c/c maximum")

    return "; ".join(recs)


def calculate_black_cotton_assessment_enhanced(inputs: dict[str, Any]) -> dict[str, Any]:
    steps: list[dict] = []
    warnings: list[str] = []
    errors: list[str] = []

    try:
        LL = float(inputs.get("LL_pct", 60.0))
        PL = float(inputs.get("PL_pct", 25.0))
        PI = float(inputs.get("PI_pct", LL - PL))
        gamma_d = float(inputs.get("dry_unit_weight_knm3", 15.0))
        swell_measured = float(inputs.get("swell_pressure_kpa", 0.0))
        depth_rock = float(inputs.get("depth_to_rock_m", 8.0))
        GWT = float(inputs.get("GWT_m", 5.0))
        proposed = inputs.get("proposed_foundation", "isolated")
        B = float(inputs.get("B_m", 1.5))
        Df = float(inputs.get("Df_m", 1.0))
        lat = inputs.get("latitude")
        lon = inputs.get("longitude")
        treatment = inputs.get("treatment", "lime")

        # GPS zone check
        gps_info = _gps_zone_check(lat, lon)
        steps.append(_step(
            "Zambia BCS Map", "GPS zone lookup",
            f"lat={lat}, lon={lon} → zone='{gps_info['zone']}', severity={gps_info['severity']}",
            1.0 if gps_info["in_bcs_zone"] else 0.0, "–",
            status="warning" if gps_info["in_bcs_zone"] else "info",
            note=gps_info["zone"],
        ))

        # Swell classification
        potential, risk_factor = _swelling_potential_chen(PI)
        steps.append(_step(
            "Chen (1975)", "Swelling potential from PI",
            f"PI={PI:.1f}% → potential={potential}, risk_factor={risk_factor}",
            PI, "%",
            status="warning" if potential in ("high", "very_high") else "info",
        ))

        # Swell pressure
        if swell_measured > 0:
            swell_kpa = swell_measured
            steps.append(_step(
                "Measured", "Swell pressure from oedometer test",
                f"Ps_measured={swell_kpa:.1f} kPa",
                swell_kpa, "kPa",
            ))
        else:
            swell_kpa = _swell_pressure_komornik(LL, gamma_d)
            steps.append(_step(
                "Komornik & David (1969)", "log Ps = 2.132 + 0.0208·LL + 0.000665·γd − 0.0269·w",
                f"LL={LL}%, γd={gamma_d}kN/m³ → Ps={swell_kpa:.1f} kPa",
                swell_kpa, "kPa",
                note="Estimated; oedometer test recommended for detailed design",
            ))

        # Active zone depth
        active_zone_m = min(depth_rock, max(1.5, LL / 20.0 + 0.5))
        steps.append(_step(
            "IS 2720 Part 41", "Active zone depth estimate",
            f"LL={LL}% → active zone ≈ {active_zone_m:.1f}m",
            active_zone_m, "m",
        ))

        # Heave estimate
        delta_e = 0.1  # typical change in void ratio for expansive clays
        heave_mm = active_zone_m * 1000.0 * delta_e * (swell_kpa / 200.0)
        steps.append(_step(
            "Volumetric approach", "Heave = H × Δe / (1+e₀) × (Ps/200)",
            f"H={active_zone_m}m, Ps={swell_kpa:.0f}kPa → heave≈{heave_mm:.0f}mm",
            heave_mm, "mm",
            status="fail" if heave_mm > 50 else "warning" if heave_mm > 25 else "info",
        ))

        # Foundation bearing under swelling
        net_bearing = swell_kpa - (gamma_d * Df)
        if net_bearing > 0:
            warnings.append(f"Net uplift force on foundation: {net_bearing:.1f} kPa — anchor pads to prevent heave")

        # Foundation recommendation
        foundation_rec = _foundation_recommendation(swell_kpa, Df, GWT, proposed, gps_info["severity"])
        steps.append(_step(
            "BRE Digest 240", "Foundation recommendation for expansive soils",
            foundation_rec, swell_kpa, "kPa", status="info",
        ))

        # Lime treatment comparison
        lime_comparison = _treatment_comparison(swell_kpa, PI)
        recommended_lime_pct = 5 if swell_kpa > 100 else 3

        # Treatment cost
        area_m2 = B * 4.0 * 4.0  # typical pad area + surround
        treatment_cost_zmw = ZMW_TREATMENT_RATES.get(f"lime_{recommended_lime_pct}pct_zmw_m2", 135.0) * area_m2
        treatment_cost_zmw += ZMW_TREATMENT_RATES["granular_blanket_200mm_zmw_m2"] * area_m2
        if gps_info["severity"] in ("severe", "high"):
            treatment_cost_zmw += ZMW_TREATMENT_RATES["geotextile_zmw_m2"] * area_m2

        # Classification severity
        if PI > 45 or swell_kpa > 200:
            severity_class = "extreme"
        elif PI > 35 or swell_kpa > 100:
            severity_class = "high"
        elif PI > 25 or swell_kpa > 50:
            severity_class = "moderate"
        else:
            severity_class = "low"

        if severity_class in ("extreme", "high"):
            warnings.append(f"Black Cotton Soil severity={severity_class} — specialist geotechnical investigation required before design")

        return {
            "status": "warning" if severity_class in ("extreme", "high") else "pass",
            "summary": {
                "LL_pct": LL,
                "PL_pct": PL,
                "PI_pct": round(PI, 1),
                "swelling_potential": potential,
                "risk_factor": risk_factor,
                "swell_pressure_kpa": round(swell_kpa, 1),
                "active_zone_m": round(active_zone_m, 1),
                "heave_estimate_mm": round(heave_mm, 1),
                "severity_class": severity_class,
                "gps_zone": gps_info["zone"],
                "gps_severity": gps_info["severity"],
                "in_bcs_corridor": gps_info["in_bcs_zone"],
                "recommended_lime_pct": recommended_lime_pct,
                "treatment_cost_zmw": round(treatment_cost_zmw, 0),
                "foundation_recommendation": foundation_rec,
            },
            "lime_comparison": lime_comparison,
            "steps": steps,
            "warnings": warnings,
            "errors": errors,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as exc:
        return {
            "status": "error", "summary": {}, "lime_comparison": [],
            "steps": steps, "warnings": warnings, "errors": [str(exc)],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
