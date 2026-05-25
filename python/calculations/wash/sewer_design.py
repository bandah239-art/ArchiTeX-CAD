"""WASH sewer design using Manning's Equation."""

from datetime import datetime, timezone
from typing import Any
import math

from calculations.utils.formatters import round_value

# Default Manning's n values
MANNINGS_N = {
    "pvc": 0.010,
    "hdpe": 0.009,
    "concrete": 0.013,
    "clay": 0.013,
}

def calculate_sewer_design(inputs: dict[str, Any]) -> dict[str, Any]:
    population = int(inputs.get("population", 500))
    lpcd = float(inputs.get("lpcd", 80))
    infiltration_pct = float(inputs.get("infiltration_pct", 20))
    material = inputs.get("material", "pvc").lower()
    n_val = MANNINGS_N.get(material, 0.010)

    # DWF = population * per_capita * 0.80 + infiltration
    # We add infiltration directly to the total
    dwf_lpd = population * lpcd * 0.80 * (1 + infiltration_pct / 100)
    dwf_m3s = dwf_lpd / (24 * 3600 * 1000)
    dwf_lps = dwf_lpd / (24 * 3600)
    
    # Peak flow for design (assume peak factor 2.5 for small populations)
    peak_factor = float(inputs.get("peak_factor", 2.5))
    q_design_m3s = dwf_m3s * peak_factor
    q_design_lps = dwf_lps * peak_factor

    # Try standard diameters starting from 150mm
    diameters_mm = [150, 200, 225, 250, 300, 400, 500, 600]
    selected_diam_m = 0.15
    q_full_m3s = 0.0
    v_full_ms = 0.0
    gradient = 0.0

    for d_mm in diameters_mm:
        d_m = d_mm / 1000.0
        # Min gradient S_min = 1/D (D in mm) -> 1/150 = 0.0067
        gradient = 1 / float(d_mm)
        
        area = math.pi * (d_m / 2)**2
        perimeter = math.pi * d_m
        r_hyd = area / perimeter
        
        # Manning's for full flow
        v_full = (1 / n_val) * (r_hyd ** (2/3)) * (gradient ** 0.5)
        q_full = area * v_full
        
        if q_full >= q_design_m3s:
            selected_diam_m = d_m
            q_full_m3s = q_full
            v_full_ms = v_full
            break

    status = "pass"
    warnings = []
    
    # Check velocity
    if v_full_ms < 0.75:
        warnings.append(f"Full flow velocity {v_full_ms:.2f} m/s is below self-cleaning minimum 0.75 m/s")
        status = "warning"
    elif v_full_ms > 3.0:
        warnings.append(f"Full flow velocity {v_full_ms:.2f} m/s exceeds erosion maximum 3.0 m/s")
        status = "warning"

    return {
        "status": status,
        "summary": {
            "population": population,
            "dwf_lps": round_value(dwf_lps, 2),
            "design_flow_lps": round_value(q_design_lps, 2),
            "selected_diameter_mm": int(selected_diam_m * 1000),
            "min_gradient": round_value(gradient, 4),
            "capacity_full_lps": round_value(q_full_m3s * 1000, 2),
            "velocity_full_ms": round_value(v_full_ms, 2),
            "manhole_max_spacing_m": 120,
        },
        "steps": [
            {
                "step_number": 1,
                "title": "Dry Weather Flow",
                "formula": "DWF = Pop × LPCD × 0.80 × (1 + Infiltration%)",
                "substitution": f"DWF = {population} × {lpcd} × 0.80 × {1 + infiltration_pct/100}",
                "result": str(round_value(dwf_lps, 2)),
                "unit": "L/s",
                "reference": "WASH flow estimation",
                "status": "info",
            },
            {
                "step_number": 2,
                "title": "Pipe Sizing (Manning's)",
                "formula": "Q_full = (1/n) × A × R^(2/3) × S^(1/2)",
                "substitution": f"Q = (1/{n_val}) × {round_value(math.pi * (selected_diam_m/2)**2, 3)} × R^(2/3) × {gradient:.4f}^(1/2)",
                "result": str(round_value(q_full_m3s * 1000, 2)),
                "unit": "L/s",
                "reference": "Manning's Equation",
                "status": "pass" if q_full_m3s >= q_design_m3s else "warning",
            },
        ],
        "warnings": warnings,
        "errors": [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
