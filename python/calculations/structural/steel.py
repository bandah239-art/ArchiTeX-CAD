"""Steel member calculations per Eurocode 3."""

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


def calculate_steel_beam(inputs: dict[str, Any]) -> dict[str, Any]:
    """Calculate steel beam capacity (bending, shear)."""
    # Inputs
    L = float(inputs.get("length", 5.0))
    fy = float(inputs.get("fy", 275))  # Yield strength MPa
    # Load
    w = float(inputs.get("w", 20))  # design load kN/m
    
    # Section properties (mocking a generic UB section like 406x140x39 for now if custom not provided)
    Wpl = float(inputs.get("Wpl", 721)) * 1000  # cm3 to mm3
    Aw = float(inputs.get("Aw", 22.8)) * 100  # cm2 to mm2
    gamma_M0 = 1.0
    
    steps = []
    
    # Bending Moment
    M_Ed = (w * L**2) / 8
    steps.append(_step(1, "Design Moment", "M_Ed = w*L^2/8", f"{w}*{L}^2/8", round_value(M_Ed, 1), "kNm", "EC3 6.2.5"))
    
    # Moment Capacity
    M_c_Rd = (Wpl * fy / gamma_M0) / 10**6
    steps.append(_step(2, "Moment Capacity", "M_c_Rd = Wpl*fy/gamma_M0", f"{Wpl}*{fy}/1.0", round_value(M_c_Rd, 1), "kNm", "EC3 6.2.5"))
    
    ratio_m = M_Ed / M_c_Rd if M_c_Rd > 0 else 999
    status_m = "pass" if ratio_m <= 1.0 else "fail"
    steps.append(_step(3, "Bending Utilization", "M_Ed / M_c_Rd", f"{round_value(M_Ed,1)} / {round_value(M_c_Rd,1)}", round_value(ratio_m, 3), "", "", status_m))
    
    # Shear Force
    V_Ed = (w * L) / 2
    steps.append(_step(4, "Design Shear", "V_Ed = w*L/2", f"{w}*{L}/2", round_value(V_Ed, 1), "kN", "EC3 6.2.6"))
    
    # Shear Capacity
    V_c_Rd = (Aw * (fy / math.sqrt(3)) / gamma_M0) / 1000
    steps.append(_step(5, "Shear Capacity", "V_c_Rd = Aw*(fy/√3)/gamma_M0", f"{Aw}*({fy}/1.732)/1.0", round_value(V_c_Rd, 1), "kN", "EC3 6.2.6"))
    
    ratio_v = V_Ed / V_c_Rd if V_c_Rd > 0 else 999
    status_v = "pass" if ratio_v <= 1.0 else "fail"
    steps.append(_step(6, "Shear Utilization", "V_Ed / V_c_Rd", f"{round_value(V_Ed,1)} / {round_value(V_c_Rd,1)}", round_value(ratio_v, 3), "", "", status_v))

    global_status = "pass" if status_m == "pass" and status_v == "pass" else "fail"

    return {
        "status": global_status,
        "summary": {
            "max_moment": round_value(M_Ed, 1),
            "moment_capacity": round_value(M_c_Rd, 1),
            "max_shear": round_value(V_Ed, 1),
            "shear_capacity": round_value(V_c_Rd, 1),
        },
        "steps": steps,
        "warnings": [],
        "errors": [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
