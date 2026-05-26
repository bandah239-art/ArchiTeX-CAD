from pydantic import BaseModel
import math

class WTPRequest(BaseModel):
    flow_rate_m3_d: float = 5000.0
    turbidity_ntu: float = 50.0

def calculate_wtp(req: WTPRequest) -> dict:
    """
    Calculates basic sizing for Water Treatment Plant (WTP) units:
    Clarifier (Sedimentation) and Rapid Sand Filter.
    """
    # 1. Clarifier / Sedimentation Tank
    # Surface Overflow Rate (SOR) typically 20 - 30 m3/m2/day
    sor = 25.0
    clarifier_area_m2 = req.flow_rate_m3_d / sor
    
    # Assume circular clarifier
    clarifier_diameter_m = math.sqrt((4 * clarifier_area_m2) / math.pi)
    
    # Detention time typically 2-4 hours
    detention_time_h = 3.0
    clarifier_volume_m3 = (req.flow_rate_m3_d / 24.0) * detention_time_h
    clarifier_depth_m = clarifier_volume_m3 / clarifier_area_m2
    
    # 2. Rapid Sand Filter
    # Filtration Rate typically 120 - 150 m3/m2/day
    filtration_rate = 120.0
    total_filter_area_m2 = req.flow_rate_m3_d / filtration_rate
    
    # Divide into multiple filter beds (min 2 for backwashing)
    filter_beds = max(2, int(total_filter_area_m2 / 20) + 1)
    area_per_bed_m2 = total_filter_area_m2 / filter_beds
    
    return {
        "status": "success",
        "clarifier_diameter_m": round(clarifier_diameter_m, 1),
        "clarifier_depth_m": round(clarifier_depth_m, 1),
        "total_filter_area_m2": round(total_filter_area_m2, 1),
        "filter_beds_count": filter_beds,
        "area_per_bed_m2": round(area_per_bed_m2, 1),
        "recommendation": f"Requires a {round(clarifier_diameter_m, 1)}m diameter Clarifier ({round(clarifier_depth_m, 1)}m deep) and {filter_beds} Rapid Sand Filter beds ({round(area_per_bed_m2, 1)}m² each)."
    }
