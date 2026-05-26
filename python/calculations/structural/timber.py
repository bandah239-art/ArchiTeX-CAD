"""Timber member calculations per Eurocode 5."""

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


def calculate_timber_beam(inputs: dict[str, Any]) -> dict[str, Any]:
    """Calculate timber joist/beam capacity (bending, shear, deflection)."""
    # Inputs
    L = float(inputs.get("length", 4.0)) # m
    b = float(inputs.get("b", 50)) # mm
    h = float(inputs.get("h", 200)) # mm
    
    # Material properties (e.g., C24 Timber)
    fm_k = float(inputs.get("fm_k", 24)) # MPa
    fv_k = float(inputs.get("fv_k", 4.0)) # MPa
    E0_mean = float(inputs.get("E0_mean", 11000)) # MPa
    
    # Modification factors
    k_mod = float(inputs.get("k_mod", 0.8)) # Service class 2, Medium term
    gamma_M = 1.3 # Solid timber
    
    # Load
    w = float(inputs.get("w", 5)) # design load kN/m
    w_sls = float(inputs.get("w_sls", 3.5)) # SLS load kN/m
    
    steps = []
    
    # Bending Moment
    M_Ed = (w * L**2) / 8
    steps.append(_step(1, "Design Moment", "M_Ed = w*L^2/8", f"{w}*{L}^2/8", round_value(M_Ed, 2), "kNm", "EC5"))
    
    # Bending Stress
    W_y = (b * h**2) / 6
    sigma_m_d = (M_Ed * 10**6) / W_y
    steps.append(_step(2, "Bending Stress", "σ_m_d = M_Ed / W_y", f"{M_Ed*1000} / {W_y}", round_value(sigma_m_d, 2), "MPa", "EC5 6.1.6"))
    
    # Bending Capacity
    fm_d = fm_k * k_mod / gamma_M
    steps.append(_step(3, "Bending Strength", "f_m_d = f_m_k * k_mod / gamma_M", f"{fm_k} * {k_mod} / {gamma_M}", round_value(fm_d, 2), "MPa", "EC5 2.4.1"))
    
    ratio_m = sigma_m_d / fm_d if fm_d > 0 else 999
    status_m = "pass" if ratio_m <= 1.0 else "fail"
    steps.append(_step(4, "Bending Utilization", "σ_m_d / f_m_d", f"{round_value(sigma_m_d,2)} / {round_value(fm_d,2)}", round_value(ratio_m, 3), "", "", status_m))
    
    # Shear
    V_Ed = (w * L) / 2
    steps.append(_step(5, "Design Shear", "V_Ed = w*L/2", f"{w}*{L}/2", round_value(V_Ed, 2), "kN", "EC5"))
    
    tau_d = 1.5 * (V_Ed * 1000) / (b * h) # Note: k_cr might be needed, assumed 1.0 here for simple joist
    steps.append(_step(6, "Shear Stress", "τ_d = 1.5 * V_Ed / (b*h)", f"1.5 * {V_Ed*1000} / ({b}*{h})", round_value(tau_d, 2), "MPa", "EC5 6.1.7"))
    
    fv_d = fv_k * k_mod / gamma_M
    steps.append(_step(7, "Shear Strength", "f_v_d = f_v_k * k_mod / gamma_M", f"{fv_k} * {k_mod} / {gamma_M}", round_value(fv_d, 2), "MPa", "EC5 2.4.1"))
    
    ratio_v = tau_d / fv_d if fv_d > 0 else 999
    status_v = "pass" if ratio_v <= 1.0 else "fail"
    steps.append(_step(8, "Shear Utilization", "τ_d / f_v_d", f"{round_value(tau_d,2)} / {round_value(fv_d,2)}", round_value(ratio_v, 3), "", "", status_v))

    # Deflection (Instantaneous)
    I_y = (b * h**3) / 12
    w_inst = (5 * w_sls * (L*1000)**4) / (384 * E0_mean * I_y)
    limit_inst = (L * 1000) / 300
    status_def = "pass" if w_inst <= limit_inst else "fail"
    steps.append(_step(9, "Inst. Deflection", "w_inst = 5*w_sls*L^4 / (384*E*I)", f"5*{w_sls}*{L*1000}^4 / (384*{E0_mean}*{I_y})", round_value(w_inst, 1), "mm", "EC5 7.2", status_def))

    global_status = "pass" if status_m == "pass" and status_v == "pass" and status_def == "pass" else "fail"

    return {
        "status": global_status,
        "summary": {
            "bending_ratio": round_value(ratio_m, 3),
            "shear_ratio": round_value(ratio_v, 3),
            "deflection_mm": round_value(w_inst, 1),
            "deflection_limit": round_value(limit_inst, 1),
        },
        "steps": steps,
        "warnings": [],
        "errors": [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
