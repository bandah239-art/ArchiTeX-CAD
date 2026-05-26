from pydantic import BaseModel

class StormwaterRequest(BaseModel):
    catchment_area_ha: float = 10.0
    runoff_coefficient: float = 0.85 # High for urban/paved areas
    rainfall_intensity_mm_hr: float = 75.0
    duration_hours: float = 2.0

def calculate_stormwater(req: StormwaterRequest) -> dict:
    """
    Calculates Peak Runoff using the Rational Method and sizes an Attenuation Pond.
    """
    # 1. Peak Runoff (Rational Method: Q = C * i * A / 360)
    # Q in m3/s, i in mm/hr, A in hectares
    peak_runoff_m3_s = (req.runoff_coefficient * req.rainfall_intensity_mm_hr * req.catchment_area_ha) / 360.0
    
    # 2. Total Runoff Volume
    # V = Q_peak * Duration
    total_volume_m3 = peak_runoff_m3_s * (req.duration_hours * 3600.0)
    
    # 3. Attenuation Pond Sizing
    # Assume we need to store 60% of the total volume to attenuate the peak
    pond_volume_m3 = total_volume_m3 * 0.60
    
    # Assume 2m depth for the pond
    pond_depth_m = 2.0
    pond_area_m2 = pond_volume_m3 / pond_depth_m
    
    return {
        "status": "success",
        "peak_runoff_m3_s": round(peak_runoff_m3_s, 2),
        "total_runoff_volume_m3": round(total_volume_m3, 1),
        "pond_volume_m3": round(pond_volume_m3, 1),
        "pond_area_m2": round(pond_area_m2, 1),
        "recommendation": f"Peak runoff is {round(peak_runoff_m3_s, 2)}m³/s. Construct an attenuation pond of {round(pond_volume_m3, 1)}m³ ({round(pond_area_m2, 1)}m² at 2m depth) to prevent downstream flooding."
    }
