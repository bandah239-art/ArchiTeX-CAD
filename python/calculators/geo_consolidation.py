from pydantic import BaseModel
import math

class ConsolidationRequest(BaseModel):
    clay_thickness_m: float = 5.0
    initial_void_ratio: float = 0.8
    compression_index_cc: float = 0.25
    initial_effective_stress_kpa: float = 100.0
    added_stress_kpa: float = 50.0

def calculate_consolidation(req: ConsolidationRequest) -> dict:
    """
    Calculates primary consolidation settlement (sinking) of a clay layer under added foundation load.
    Sc = (Cc * H / (1 + e0)) * log10((sigma0' + delta_sigma') / sigma0')
    """
    H = req.clay_thickness_m
    e0 = req.initial_void_ratio
    Cc = req.compression_index_cc
    sigma0 = req.initial_effective_stress_kpa
    delta_sigma = req.added_stress_kpa
    
    # Calculate Settlement (Sc) in meters
    sc_m = (Cc * H / (1.0 + e0)) * math.log10((sigma0 + delta_sigma) / sigma0)
    sc_mm = sc_m * 1000.0
    
    return {
        "status": "success",
        "settlement_m": round(sc_m, 4),
        "settlement_mm": round(sc_mm, 1),
        "recommendation": f"The clay layer is expected to settle (sink) by {round(sc_mm, 1)} mm under the additional structural load."
    }
