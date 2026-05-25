"""Geotechnical site classification and SPT N60 conversions."""

from datetime import datetime, timezone
from typing import Any
import math

from calculations.utils.formatters import round_value

def calculate_site_classification(inputs: dict[str, Any]) -> dict[str, Any]:
    # Inputs
    spt_n = float(inputs.get("spt_n", 15))
    energy_ratio = float(inputs.get("energy_ratio", 60)) # %
    borehole_diam = float(inputs.get("borehole_diam_mm", 100))
    sampler_type = inputs.get("sampler_type", "standard") # standard, without_liner
    rod_length = float(inputs.get("rod_length_m", 5.0))
    
    # Overburden
    effective_stress_kpa = float(inputs.get("effective_stress_kpa", 50.0))
    
    # SPT Corrections (N60 and (N1)60)
    # Energy correction Ce
    ce = energy_ratio / 60.0
    
    # Borehole diam correction Cb
    cb = 1.0
    if borehole_diam > 115 and borehole_diam <= 150:
        cb = 1.05
    elif borehole_diam > 150:
        cb = 1.15
        
    # Sampler correction Cs
    cs = 1.2 if sampler_type == "without_liner" else 1.0
    
    # Rod length correction Cr
    cr = 1.0
    if rod_length < 4:
        cr = 0.75
    elif rod_length < 6:
        cr = 0.85
    elif rod_length < 10:
        cr = 0.95
        
    # N60
    n60 = spt_n * ce * cb * cs * cr
    
    # Overburden correction Cn
    # Cn = sqrt(100 / sigma_v') <= 1.7
    cn = min(math.sqrt(100.0 / max(effective_stress_kpa, 1.0)), 1.7)
    
    # (N1)60
    n1_60 = n60 * cn
    
    # Seismic Site Classification (ASCE 7 / IBC based on N-bar)
    # Simplified approximation using N1_60 for top 30m
    site_class = "E"
    class_desc = "Soft clay profile"
    if n1_60 > 50:
        site_class = "C"
        class_desc = "Very dense soil and soft rock"
    elif n1_60 > 15:
        site_class = "D"
        class_desc = "Stiff soil profile"
        
    # Liquefaction Potential (Simplified Check)
    pga = float(inputs.get("pga_g", 0.15))
    magnitude = float(inputs.get("magnitude", 7.5))
    
    csr = 0.65 * pga * (effective_stress_kpa / max(effective_stress_kpa, 1.0)) * 1.0 # simplified rd = 1.0
    
    # CRR based on N1_60 (simplified NCEER 1997 curve for clean sand)
    crr = 0.0
    if n1_60 < 30:
        crr = math.exp((n1_60 / 14.1) + (n1_60 / 126)**2 - (n1_60 / 23.6)**3 + (n1_60 / 25.4)**4 - 2.8)
    else:
        crr = 2.0 # Non-liquefiable
        
    fs_liq = crr / max(csr, 0.0001)

    steps = [
        {
            "step_number": 1,
            "title": "SPT N60 Correction",
            "formula": "N60 = N × Ce × Cb × Cs × Cr",
            "substitution": f"N60 = {spt_n} × {ce} × {cb} × {cs} × {cr}",
            "result": str(round_value(n60, 1)),
            "unit": "blows/300mm",
            "reference": "Skempton (1986)",
            "status": "info",
        },
        {
            "step_number": 2,
            "title": "Overburden Correction (N1)60",
            "formula": "(N1)60 = N60 × Cn, where Cn = min(sqrt(100/σ'), 1.7)",
            "substitution": f"(N1)60 = {round_value(n60, 1)} × {round_value(cn, 2)}",
            "result": str(round_value(n1_60, 1)),
            "unit": "blows/300mm",
            "reference": "Liao and Whitman (1986)",
            "status": "info",
        },
        {
            "step_number": 3,
            "title": "Liquefaction FS",
            "formula": "FS = CRR / CSR",
            "substitution": f"FS = {round_value(crr, 3)} / {round_value(csr, 3)}",
            "result": str(round_value(fs_liq, 2)),
            "unit": "",
            "reference": "NCEER (1997)",
            "status": "pass" if fs_liq > 1.2 else "fail",
        }
    ]

    status = "pass"
    if fs_liq < 1.0:
        status = "fail"
    elif fs_liq < 1.2:
        status = "warning"

    return {
        "status": status,
        "summary": {
            "n60": round_value(n60, 1),
            "n1_60": round_value(n1_60, 1),
            "site_class": site_class,
            "class_description": class_desc,
            "liquefaction_fs": round_value(fs_liq, 2),
            "liquefiable": fs_liq < 1.0
        },
        "steps": steps,
        "warnings": ["Liquefaction possible during design earthquake."] if fs_liq < 1.2 else [],
        "errors": [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
