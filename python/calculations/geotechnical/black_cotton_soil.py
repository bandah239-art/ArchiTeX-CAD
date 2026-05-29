"""Geotechnical expansive soil (Black Cotton) analysis module."""

import math
from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value


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


def run_black_cotton_assessment(
    LL_pct: float,
    PL_pct: float,
    PI_pct: float,
    swell_pressure_kpa: float,
    depth_to_rock_m: float,
    GWT_m: float,
    dry_unit_weight_knm3: float,
    proposed_foundation: str,
    B_m: float,
    Df_m: float,
    soil_profile: dict[str, Any] = None,
) -> dict[str, Any]:
    """Run geotechnical assessment for structures built on expansive black cotton soil."""
    steps = []
    warnings = []
    errors = []
    status = "pass"

    if soil_profile is None:
        soil_profile = {}

    clay_content = float(soil_profile.get("clay_content_pct", 45.0))
    wn = float(soil_profile.get("natural_moisture_pct", 18.0))
    cu = float(soil_profile.get("undrained_cohesion_kpa", 50.0))  # kPa

    # ── Step 1: Classification & Swell Potential ──────────────────────────────
    # USCS A-line: PI = 0.73(LL - 20)
    a_line = 0.73 * (LL_pct - 20)
    if LL_pct >= 50:
        classification = "CH" if PI_pct >= a_line else "MH"
    else:
        classification = "CL" if PI_pct >= a_line else "ML"

    classification_long = "CH expansive clay" if classification == "CH" else f"{classification} clay/silt"

    # Seed-Woodburn swell potential Sp = 2.16e-3 × PI^2.44 × (γd/γw)³
    gamma_w = 9.81
    density_ratio = dry_unit_weight_knm3 / gamma_w
    swell_potential = 2.16e-3 * (PI_pct ** 2.44) * (density_ratio ** 3)

    # Activity = PI / (%clay - 5)
    clay_denominator = max(1.0, clay_content - 5.0)
    activity = PI_pct / clay_denominator
    mineral = "Montmorillonite" if activity > 1.25 else "Illite/Kaolinite"

    # Swell pressure: Ps = 0.45 × (LL/wn)² × γd/γw × 15
    calculated_swell_pressure = 0.45 * ((LL_pct / max(1.0, wn)) ** 2) * density_ratio * 15.0
    final_swell_pressure = swell_pressure_kpa if swell_pressure_kpa > 0 else calculated_swell_pressure

    # Risk level from Van der Merwe / Chen criteria
    if PI_pct > 32 or final_swell_pressure > 150:
        risk_level = "very_high"
        risk_color = "fail"
    elif PI_pct > 23 or final_swell_pressure > 80:
        risk_level = "high"
        risk_color = "warning"
    elif PI_pct > 12 or final_swell_pressure > 30:
        risk_level = "moderate"
        risk_color = "info"
    else:
        risk_level = "low"
        risk_color = "pass"

    steps.append(
        _step(
            1,
            "USCS Classification & Clay Mineralogy",
            "A-line = 0.73(LL - 20); Activity = PI / (%clay - 5)",
            f"PI = {PI_pct}, A-line = {round_value(a_line, 1)}, Clay % = {clay_content}",
            f"Class: {classification_long}; Activity: {round_value(activity, 2)} ({mineral})",
            "",
            "ASTM D2487 / Van der Merwe Grid",
            "info",
        )
    )

    steps.append(
        _step(
            2,
            "Swell Potential & Pressure Estimation",
            "Sp = 2.16×10⁻³ · PI^2.44 · (γd/γw)³; Ps_est = 0.45 · (LL/wn)² · γd/γw · 15",
            f"PI = {PI_pct}, γd = {dry_unit_weight_knm3} kN/m³, wn = {wn}%",
            f"Sp = {round_value(swell_potential, 2)}%; Ps = {round_value(final_swell_pressure, 1)} kPa → Risk: {risk_level.upper()}",
            "%",
            "Seed & Woodward (1962) / Chen Expansive Soils",
            risk_color,
        )
    )

    # ── Step 3: Active Zone Depth & Heave Magnitude ───────────────────────────
    # Active moisture zone: empirical depth in Lusaka; capped at depth-to-rock
    z_act = max(2.5, min(GWT_m, depth_to_rock_m - 0.3))   # m
    # Volumetric swell strain εs = Sp / 100
    eps_swell = swell_potential / 100.0
    # Predicted total heave Δh = εs × z_act (full swell to active depth)
    heave_mm = eps_swell * z_act * 1000.0  # mm
    # Differential heave: edge drying > centre (55% of total is typical)
    differential_heave_mm = heave_mm * 0.55

    steps.append(
        _step(
            3,
            "Active Zone Depth & Predicted Heave",
            "z_act = max(2.5, min(GWT, H_rock − 0.3)); Δh = εs · z_act · 1000; εs = Sp/100",
            f"Sp = {round_value(swell_potential, 2)}%, GWT = {GWT_m} m, depth_to_rock = {depth_to_rock_m} m → z_act = {round_value(z_act, 1)} m",
            f"Total heave Δh = {round_value(heave_mm, 0)} mm; Differential Δh = {round_value(differential_heave_mm, 0)} mm (55% edge factor)",
            "mm",
            "Chen (1988) Expansive Soils / Lusaka empirical data",
            risk_color,
        )
    )

    # ── Step 4: Lime Stabilisation ────────────────────────────────────────────
    # lime_pct = max(2%, 0.5·(PI - 20)/10 + 3%)
    lime_pct = max(2.0, 0.5 * (PI_pct - 20.0) / 10.0 + 3.0) if PI_pct > 20 else 2.0
    treated_pi = min(PI_pct, 15.0)
    swell_drop = 85.0 if PI_pct > 20 else 0.0

    # Bags per m³ based on dry density
    dry_density_kg_m3 = (dry_unit_weight_knm3 * 1000) / 9.81
    lime_kg_m3 = (lime_pct / 100.0) * dry_density_kg_m3
    bags_per_m3 = lime_kg_m3 / 25.0         # 25 kg bags (Zambia standard)
    zmw_bag_price = 145.0                    # ZMW per 25 kg bag, Lusaka Q4 2025
    lime_cost_zmw_m3 = bags_per_m3 * zmw_bag_price

    steps.append(
        _step(
            4,
            "Lime Stabilization Requirements",
            "Lime% = max(2%, 0.5·(PI−20)/10 + 3%); Bags/m³ = (Lime%·ρd) / 25 kg",
            f"PI = {PI_pct}, ρd = {round_value(dry_density_kg_m3, 0)} kg/m³",
            f"Target lime = {round_value(lime_pct, 1)}% by wt ({round_value(bags_per_m3, 1)} bags/m³) → Cost: {round_value(lime_cost_zmw_m3, 2)} ZMW/m³",
            "bags/m³",
            "ZABS / RDA Soil Treatment Standards",
            "info",
        )
    )

    # ── Foundation Options ────────────────────────────────────────────────────
    ranked_options: list[dict[str, str]] = []

    if risk_level == "low":
        ranked_options.append({
            "name": "Strip/Pad Footings on Sand Blanket",
            "description": (
                "Conventional footings. Replace top 300 mm below base with compacted clean sand. "
                "Lay DPC membrane."
            ),
            "pros": "Lowest cost, simple to build",
            "cons": "Only suitable for PI < 12 and low swell pressure",
            "cost_indicator": "ZMW 250–400/m²",
        })

    elif risk_level == "moderate":
        ranked_options.append({
            "name": "Sand Cushion & Pad Footings",
            "description": (
                "Excavate 600 mm below footing base. Replace with clean sand compacted to 95% MDD. "
                "DPC membrane + perimeter apron."
            ),
            "pros": "Moderate cost, eliminates top expansive layer",
            "cons": "Fails if moisture ingress from sides not controlled",
            "cost_indicator": "ZMW 400–600/m²",
        })
        ranked_options.append({
            "name": "Stiffened Raft Slab",
            "description": (
                "Reinforced raft on 150 mm sand bed. Deep edge beams (450 mm) resist differential "
                f"heave (predicted Δh_diff = {round_value(differential_heave_mm, 0)} mm). "
                "Winkler spring ks for design."
            ),
            "pros": "Resists differential movement, no point loads on expansive soil",
            "cons": "Higher cost, needs careful joint/drainage detailing",
            "cost_indicator": "ZMW 750–950/m²",
        })

    else:  # high or very_high
        ranked_options.append({
            "name": "Bored Piers + Suspended Ground Beam & Slab",
            "description": (
                f"Anchor piers Ø300–600 mm through active zone (z_act = {round_value(z_act, 1)} m) "
                "into stable dry soil or rock. Suspend RC ground beam 150–200 mm above soil. "
                "Infill non-structural."
            ),
            "pros": "Eliminates heave load entirely; most reliable for CH soils",
            "cons": "Highest cost, requires specialist driller",
            "cost_indicator": "ZMW 1,200–1,800/m²",
        })
        ranked_options.append({
            "name": "Heavy Stiffened Raft (min 350 mm ribs)",
            "description": (
                f"Raft with deep ribs (350–500 mm) on 150 mm sand bed. 1.5 m wide perimeter concrete "
                f"apron prevents edge drying. Target differential heave = {round_value(differential_heave_mm, 0)} mm "
                f"(total Δh = {round_value(heave_mm, 0)} mm)."
            ),
            "pros": "Proven in Lusaka high-density residential, no specialist plant",
            "cons": "Requires strict moisture control during dry season",
            "cost_indicator": "ZMW 900–1,200/m²",
        })
        ranked_options.append({
            "name": f"Lime Stabilisation ({round_value(lime_pct, 1)}% hydrated lime)",
            "description": (
                f"Mix {round_value(lime_pct, 1)}% hydrated lime into top {round_value(z_act, 1)} m of subgrade. "
                f"Cure for 7 days minimum before loading. Reduces PI from {PI_pct} to ~15, "
                f"cutting swell potential by ~{round_value(swell_drop, 0)}%."
            ),
            "pros": "Reduces swell potential by 85%, enables lighter superstructure foundation",
            "cons": "Quality control critical — must reach PI target. Lime source availability in Zambia varies",
            "cost_indicator": f"ZMW {round_value(lime_cost_zmw_m3, 0):.0f}/m³ ({round_value(bags_per_m3, 1)} bags/m³)",
        })

    # ── Step 5: Raft Design & Winkler Modulus ─────────────────────────────────
    # ks = 40 × qu;  qu = 2 × cu  (bearing capacity factor for raft)
    qu = 2.0 * cu
    ks = 40.0 * qu

    # Minimum raft thickness from punching shear (simplified, BS 8110 §3.7.6)
    fcu_raft = 25.0
    v_punch_allow = 0.8 * math.sqrt(fcu_raft)
    N_kn = float(soil_profile.get("column_load_kn", 150.0))
    punch_area_m2 = (N_kn * 1000) / (v_punch_allow * 1000) if N_kn > 0 else 0.0
    min_raft_thickness_mm = max(150.0, math.sqrt(punch_area_m2) * 1000 / 4)

    steps.append(
        _step(
            5,
            "Raft Foundation Winkler Modulus",
            "ks = 40 · qu; qu = 2 · cu (safe UBC for raft); t_min from punching shear",
            f"cu = {cu} kPa → qu = {qu} kPa; N_col = {N_kn} kN; fcu = {fcu_raft} MPa",
            f"ks = {round_value(ks, 1)} kPa/m; min raft thickness = {round_value(min_raft_thickness_mm, 0)} mm",
            "kPa/m",
            "Bowles Foundation Analysis Ch. 9 / BS 8110:1997 §3.7.6",
            "info",
        )
    )

    # ── Warnings ──────────────────────────────────────────────────────────────
    if depth_to_rock_m < 2.0:
        warnings.append(
            f"Competent rock is shallow ({depth_to_rock_m} m). "
            "Recommend anchoring concrete piers directly into rock."
        )
    if GWT_m < 1.5:
        warnings.append(
            "High groundwater table. Seasonal swelling/shrinkage cycles will be intensified."
        )
    if heave_mm > 50:
        warnings.append(
            f"Predicted total heave {round_value(heave_mm, 0)} mm exceeds 50 mm tolerance. "
            "Bored pier solution strongly recommended."
        )

    summary = {
        "classification":           classification_long,
        "swell_potential_pct":      round_value(swell_potential, 2),
        "swell_pressure_kpa":       round_value(final_swell_pressure, 1),
        "activity_ratio":           round_value(activity, 2),
        "risk_level":               risk_level,
        "active_zone_depth_m":      round_value(z_act, 1),
        "predicted_heave_mm":       round_value(heave_mm, 0),
        "differential_heave_mm":    round_value(differential_heave_mm, 0),
        "subgrade_modulus_ks_knm3": round_value(ks, 1),
        "min_raft_thickness_mm":    round_value(min_raft_thickness_mm, 0),
        "lime_treatment_pct":       round_value(lime_pct, 1),
        "lime_bags_per_m3":         round_value(bags_per_m3, 1),
        "lime_cost_zmw_m3":         round_value(lime_cost_zmw_m3, 2),
        "proposed_foundation":      proposed_foundation,
        "geotech_design":           "PASS ✓" if status == "pass" else "FAIL ✗",
    }

    return {
        "status": status,
        "summary": summary,
        "steps": steps,
        "warnings": warnings,
        "errors": errors,
        "options": ranked_options,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
