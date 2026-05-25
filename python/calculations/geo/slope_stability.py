"""Geotechnical slope stability calculation (Bishop's Simplified Method)."""

from datetime import datetime, timezone
from typing import Any
import math

from calculations.utils.formatters import round_value

def calculate_slope_stability(inputs: dict[str, Any]) -> dict[str, Any]:
    # We expect a list of slices. Each slice has:
    # b: width (m)
    # w: weight (kN/m)
    # alpha: base angle (deg)
    # c: cohesion (kPa)
    # phi: friction angle (deg)
    # u: pore pressure (kPa)
    
    slices = inputs.get("slices", [])
    
    # If no slices provided, generate a dummy 3-slice slip surface for demonstration
    if not slices:
        slices = [
            {"b": 2.0, "w": 50.0, "alpha": 45.0, "c": 10.0, "phi": 30.0, "u": 5.0},
            {"b": 2.0, "w": 100.0, "alpha": 15.0, "c": 10.0, "phi": 30.0, "u": 15.0},
            {"b": 2.0, "w": 40.0, "alpha": -10.0, "c": 10.0, "phi": 30.0, "u": 0.0},
        ]

    # Bishop's method requires iteration since FOS is on both sides of the equation
    # FOS = Σ [ (c'·b + (W - u·b)·tanφ') / mα ] / Σ(W·sinα)
    # mα = cosα + (sinα·tanφ')/FOS
    
    fos_assumed = 1.0
    tolerance = 0.001
    max_iter = 50
    iter_count = 0
    
    driving_moment_sum = 0.0
    for s in slices:
        alpha_rad = math.radians(s["alpha"])
        driving_moment_sum += s["w"] * math.sin(alpha_rad)

    if driving_moment_sum <= 0:
        return {
            "status": "error",
            "summary": {},
            "steps": [],
            "warnings": [],
            "errors": ["Sum of driving forces (W*sin(alpha)) must be positive."],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    fos_calculated = 1.0
    for i in range(max_iter):
        resisting_sum = 0.0
        for s in slices:
            b = s["b"]
            w = s["w"]
            alpha = s["alpha"]
            c = s["c"]
            phi = s["phi"]
            u = s.get("u", 0.0)
            
            alpha_rad = math.radians(alpha)
            phi_rad = math.radians(phi)
            
            # m_alpha
            m_alpha = math.cos(alpha_rad) + (math.sin(alpha_rad) * math.tan(phi_rad)) / fos_assumed
            
            # Numerator term for this slice
            numerator = c * b + (w - u * b) * math.tan(phi_rad)
            
            resisting_sum += numerator / m_alpha
            
        fos_calculated = resisting_sum / driving_moment_sum
        
        if abs(fos_calculated - fos_assumed) < tolerance:
            break
            
        fos_assumed = fos_calculated
        iter_count += 1

    status = "pass"
    if fos_calculated < 1.0:
        status = "fail"
    elif fos_calculated < 1.5:
        status = "warning"

    return {
        "status": status,
        "summary": {
            "factor_of_safety": round_value(fos_calculated, 2),
            "iterations": iter_count,
            "slices_analyzed": len(slices),
        },
        "steps": [
            {
                "step_number": 1,
                "title": "Iterative Bishop's Analysis",
                "formula": "FOS = Σ [ (c'·b + (W - u·b)·tanφ') / mα ] / Σ(W·sinα)",
                "substitution": f"Converged after {iter_count} iterations",
                "result": f"FOS = {round_value(fos_calculated, 3)}",
                "unit": "",
                "reference": "Bishop's Simplified Method (1955)",
                "status": status,
            }
        ],
        "warnings": ["FOS < 1.5. Slope is marginally stable."] if 1.0 <= fos_calculated < 1.5 else [],
        "errors": ["FOS < 1.0. Slope is UNSTABLE and expected to fail."] if fos_calculated < 1.0 else [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
