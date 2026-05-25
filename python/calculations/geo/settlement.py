"""Geotechnical settlement calculation (Immediate and Consolidation)."""

from datetime import datetime, timezone
from typing import Any
import math

from calculations.utils.formatters import round_value

def calculate_settlement(inputs: dict[str, Any]) -> dict[str, Any]:
    # Immediate Settlement Inputs
    q = float(inputs.get("applied_pressure_kpa", 150.0))
    b = float(inputs.get("foundation_width_m", 2.0))
    poissons_ratio = float(inputs.get("poissons_ratio", 0.3))
    elastic_modulus_kpa = float(inputs.get("elastic_modulus_kpa", 20000.0))
    shape_factor_is = float(inputs.get("shape_factor_is", 1.0)) # typically 0.88 to 1.12

    # Consolidation Settlement Inputs
    calc_consolidation = bool(inputs.get("calc_consolidation", True))
    cc = float(inputs.get("compression_index_cc", 0.3))
    layer_thickness_h = float(inputs.get("clay_layer_thickness_m", 5.0))
    initial_void_ratio_e0 = float(inputs.get("initial_void_ratio_e0", 0.8))
    initial_stress = float(inputs.get("initial_effective_stress_kpa", 50.0))
    stress_increase = float(inputs.get("stress_increase_kpa", 75.0))

    # Calculate Immediate Settlement
    # Si = q·B·(1-v²)/E · Is
    si_m = (q * b * (1 - poissons_ratio**2) / elastic_modulus_kpa) * shape_factor_is
    si_mm = si_m * 1000.0

    steps = [
        {
            "step_number": 1,
            "title": "Immediate Settlement",
            "formula": "Si = q·B·(1-v²)/E · Is",
            "substitution": f"Si = {q}·{b}·(1-{poissons_ratio}²)/{elastic_modulus_kpa} · {shape_factor_is}",
            "result": str(round_value(si_mm, 2)),
            "unit": "mm",
            "reference": "Elastic Theory",
            "status": "info",
        }
    ]

    sc_mm = 0.0
    if calc_consolidation:
        # Sc = (Cc·H)/(1+e0) · log10((σ0'+Δσ)/σ0')
        sc_m = (cc * layer_thickness_h) / (1 + initial_void_ratio_e0) * math.log10((initial_stress + stress_increase) / initial_stress)
        sc_mm = sc_m * 1000.0
        
        steps.append({
            "step_number": 2,
            "title": "Consolidation Settlement",
            "formula": "Sc = (Cc·H)/(1+e0) · log10((σ0'+Δσ)/σ0')",
            "substitution": f"Sc = ({cc}·{layer_thickness_h})/(1+{initial_void_ratio_e0}) · log10(({initial_stress}+{stress_increase})/{initial_stress})",
            "result": str(round_value(sc_mm, 2)),
            "unit": "mm",
            "reference": "Terzaghi 1D Consolidation",
            "status": "info",
        })

    total_settlement = si_mm + sc_mm
    
    # Check against allowable
    allowable = float(inputs.get("allowable_settlement_mm", 25.0))
    status = "pass"
    if total_settlement > allowable:
        status = "fail"

    steps.append({
        "step_number": len(steps) + 1,
        "title": "Total Settlement Check",
        "formula": "Stotal = Si + Sc",
        "substitution": f"Stotal = {round_value(si_mm, 2)} + {round_value(sc_mm, 2)}",
        "result": str(round_value(total_settlement, 2)),
        "unit": "mm",
        "reference": f"Allowable: {allowable} mm",
        "status": status,
    })

    return {
        "status": status,
        "summary": {
            "immediate_settlement_mm": round_value(si_mm, 2),
            "consolidation_settlement_mm": round_value(sc_mm, 2) if calc_consolidation else 0.0,
            "total_settlement_mm": round_value(total_settlement, 2),
            "allowable_mm": allowable,
        },
        "steps": steps,
        "warnings": ["Total settlement exceeds allowable limits"] if total_settlement > allowable else [],
        "errors": [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
