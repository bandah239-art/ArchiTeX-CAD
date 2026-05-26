"""Geotechnical bearing capacity calculation using Terzaghi & Meyerhof."""

from datetime import datetime, timezone
from typing import Any
import math

from calculations.utils.formatters import round_value
from calculations.geo.african_soils import get_soil_properties

def calculate_bearing_capacity(inputs: dict[str, Any]) -> dict[str, Any]:
    soil_type = inputs.get("soil_type", "sandy")
    b = float(inputs.get("foundation_width_m", 2.0))
    l = float(inputs.get("foundation_length_m", 2.0))
    df = float(inputs.get("foundation_depth_m", 1.2))
    fos = float(inputs.get("fos", 3.0))

    if inputs.get("use_custom_soil", False):
        c = float(inputs.get("cohesion_kpa", 0))
        phi = float(inputs.get("friction_angle_deg", 30))
        gamma = float(inputs.get("unit_weight_knm3", 18))
    else:
        props = get_soil_properties(soil_type)
        c = props["cohesion_kpa"]
        phi = props["phi"]
        gamma = props["gamma_knm3"]

    phi_rad = math.radians(phi)
    q = gamma * df

    # Bearing Capacity Factors (Meyerhof)
    if phi == 0:
        nq = 1.0
        nc = 5.14
        ngamma = 0.0
    else:
        nq = math.exp(math.pi * math.tan(phi_rad)) * math.tan(math.radians(45 + phi/2))**2
        nc = (nq - 1) / math.tan(phi_rad)
        ngamma = 2 * (nq + 1) * math.tan(phi_rad)

    # Shape Factors (Meyerhof)
    if phi == 0:
        fcs = 1 + 0.2 * (b/l)
        fqs = 1.0
        fgs = 1.0
    else:
        fcs = 1 + (b/l) * (nq/nc)
        fqs = 1 + (b/l) * math.tan(phi_rad)
        fgs = 1 - 0.4 * (b/l)

    # Depth Factors (Hansen/Meyerhof)
    # For df/b <= 1: depth term = df/b (linear).
    # For df/b > 1: depth term = (4/π)*arctan(df/b), which equals df/b=1 at the boundary (continuous).
    # The (4/π) normalisation ensures continuity: at df/b=1, (4/π)*arctan(1) = (4/π)*(π/4) = 1.
    _depth_term = df / b if df / b <= 1 else (4.0 / math.pi) * math.atan(df / b)
    if phi == 0:
        fcd = 1 + 0.4 * _depth_term
        fqd = 1.0
        fgd = 1.0
    else:
        fqd = 1 + 2 * math.tan(phi_rad) * (1 - math.sin(phi_rad))**2 * _depth_term
        fcd = fqd - (1 - fqd) / (nc * math.tan(phi_rad))
        fgd = 1.0

    # Ultimate Bearing Capacity
    qu = (c * nc * fcs * fcd) + (q * nq * fqs * fqd) + (0.5 * gamma * b * ngamma * fgs * fgd)
    
    # Safe Bearing Capacity
    q_safe = qu / fos

    status = "pass"
    if q_safe < 50:
        status = "warning"
        
    return {
        "status": status,
        "summary": {
            "soil_type": soil_type,
            "ultimate_capacity_kpa": round_value(qu, 1),
            "safe_capacity_kpa": round_value(q_safe, 1),
            "nc": round_value(nc, 2),
            "nq": round_value(nq, 2),
            "ngamma": round_value(ngamma, 2),
        },
        "steps": [
            {
                "step_number": 1,
                "title": "Bearing Capacity Factors",
                "formula": "Nq = e^(π·tanφ) × tan²(45 + φ/2)",
                "substitution": f"Nq = e^(π·tan({phi})) × tan²(45 + {phi}/2)",
                "result": f"Nc={round_value(nc, 2)}, Nq={round_value(nq, 2)}, Nγ={round_value(ngamma, 2)}",
                "unit": "",
                "reference": "Meyerhof (1963)",
                "status": "info",
            },
            {
                "step_number": 2,
                "title": "Ultimate Bearing Capacity",
                "formula": "qu = c·Nc·Fcs·Fcd + q·Nq·Fqs·Fqd + 0.5·γ·B·Nγ·Fγs·Fγd",
                "substitution": f"qu = ({c}×{round_value(nc,2)}×{round_value(fcs,2)}×{round_value(fcd,2)}) + ({round_value(q,1)}×{round_value(nq,2)}×{round_value(fqs,2)}×{round_value(fqd,2)}) + (0.5×{gamma}×{b}×{round_value(ngamma,2)}×{round_value(fgs,2)}×{round_value(fgd,2)})",
                "result": str(round_value(qu, 1)),
                "unit": "kPa",
                "reference": "General Bearing Capacity Equation",
                "status": "info",
            },
            {
                "step_number": 3,
                "title": "Safe Bearing Capacity",
                "formula": "q_safe = qu / FOS",
                "substitution": f"q_safe = {round_value(qu, 1)} / {fos}",
                "result": str(round_value(q_safe, 1)),
                "unit": "kPa",
                "reference": "Design capacity",
                "status": status,
            },
        ],
        "warnings": ["Low bearing capacity. Deep foundation or soil improvement required."] if q_safe < 50 else [],
        "errors": [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
