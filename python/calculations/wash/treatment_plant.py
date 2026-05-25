"""WASH Treatment Plant Sizing."""

from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value

def calculate_treatment_plant(inputs: dict[str, Any]) -> dict[str, Any]:
    # Flow rate Q in m3/hr
    q_m3h = float(inputs.get("flow_rate_m3h", 100))
    q_m3s = q_m3h / 3600.0

    # 1. Coagulation / Flocculation
    detention_time_floc_min = float(inputs.get("floc_detention_min", 30))
    vol_floc_m3 = (q_m3h / 60) * detention_time_floc_min
    g_value = float(inputs.get("velocity_gradient_g", 40)) # s-1
    gt_value = g_value * (detention_time_floc_min * 60)

    # 2. Sedimentation Tank
    sor_m_h = float(inputs.get("surface_overflow_rate_mh", 1.5)) # 1.0 - 2.5 m/h
    detention_time_sed_hr = float(inputs.get("sed_detention_hr", 3)) # 2 - 4 hours
    area_sed_m2 = q_m3h / sor_m_h
    vol_sed_m3 = q_m3h * detention_time_sed_hr

    # 3. Filtration
    filter_type = inputs.get("filter_type", "rapid").lower()
    if filter_type == "slow":
        filtration_rate_mh = float(inputs.get("filtration_rate_mh", 0.2)) # 0.1 - 0.4
    else:
        filtration_rate_mh = float(inputs.get("filtration_rate_mh", 10)) # 5 - 15

    area_filter_m2 = q_m3h / filtration_rate_mh

    # 4. Chlorination
    contact_time_min = float(inputs.get("chlorine_contact_min", 30))
    residual_mgl = float(inputs.get("chlorine_residual_mgl", 0.5))
    ct_value = residual_mgl * contact_time_min # Needs to be >= 15 for WHO Giardia
    vol_chlor_m3 = (q_m3h / 60) * contact_time_min

    status = "pass"
    warnings = []

    if ct_value < 15:
        warnings.append(f"Chlorination CT value {ct_value:.1f} is below WHO minimum 15 mg·min/L")
        status = "warning"
        
    if filter_type == "slow" and not (0.1 <= filtration_rate_mh <= 0.4):
        warnings.append("Slow sand filtration rate should be between 0.1 and 0.4 m/h")
        status = "warning"
    elif filter_type == "rapid" and not (5 <= filtration_rate_mh <= 15):
        warnings.append("Rapid sand filtration rate should be between 5 and 15 m/h")
        status = "warning"

    return {
        "status": status,
        "summary": {
            "flow_rate_m3h": q_m3h,
            "floc_volume_m3": round_value(vol_floc_m3, 1),
            "floc_gt_value": round_value(gt_value, 0),
            "sed_area_m2": round_value(area_sed_m2, 1),
            "sed_volume_m3": round_value(vol_sed_m3, 1),
            "filter_type": filter_type,
            "filter_area_m2": round_value(area_filter_m2, 1),
            "chlorination_volume_m3": round_value(vol_chlor_m3, 1),
            "chlorination_ct": round_value(ct_value, 1),
        },
        "steps": [
            {
                "step_number": 1,
                "title": "Sedimentation Tank Sizing",
                "formula": "Area = Q / SOR",
                "substitution": f"Area = {q_m3h} / {sor_m_h}",
                "result": str(round_value(area_sed_m2, 1)),
                "unit": "m²",
                "reference": "Surface Overflow Rate 1.0-2.5 m/h",
                "status": "info",
            },
            {
                "step_number": 2,
                "title": "Filtration Area",
                "formula": "Area = Q / filtration_rate",
                "substitution": f"Area = {q_m3h} / {filtration_rate_mh}",
                "result": str(round_value(area_filter_m2, 1)),
                "unit": "m²",
                "reference": f"{filter_type.capitalize()} Sand Filter",
                "status": "info",
            },
            {
                "step_number": 3,
                "title": "Chlorination CT Value",
                "formula": "CT = residual × contact_time",
                "substitution": f"CT = {residual_mgl} × {contact_time_min}",
                "result": str(round_value(ct_value, 1)),
                "unit": "mg·min/L",
                "reference": "WHO Giardia inactivation (CT ≥ 15)",
                "status": "pass" if ct_value >= 15 else "fail",
            },
        ],
        "warnings": warnings,
        "errors": [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
