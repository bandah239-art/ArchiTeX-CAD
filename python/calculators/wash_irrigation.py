from pydantic import BaseModel

class IrrigationRequest(BaseModel):
    crop_area_ha: float = 50.0
    crop_coefficient_kc: float = 1.1 # e.g. mature maize
    reference_evapotranspiration_mm_day: float = 6.0 # ET0
    irrigation_efficiency: float = 0.85 # Drip ~ 0.9, Sprinkler ~ 0.75

def calculate_irrigation(req: IrrigationRequest) -> dict:
    """
    Calculates agricultural crop water requirements and irrigation sizing.
    """
    # 1. Crop Evapotranspiration (ETc)
    # ETc = ET0 * Kc (mm/day)
    etc_mm_day = req.reference_evapotranspiration_mm_day * req.crop_coefficient_kc
    
    # 2. Gross Irrigation Requirement (GIR)
    # GIR = ETc / Efficiency (mm/day)
    gir_mm_day = etc_mm_day / req.irrigation_efficiency
    
    # 3. Total Daily Water Volume
    # 1 mm over 1 Hectare = 10 m3
    daily_volume_m3 = gir_mm_day * req.crop_area_ha * 10.0
    
    # 4. Pump Sizing (Assume 12 hours pumping per day)
    flow_rate_m3_h = daily_volume_m3 / 12.0
    flow_rate_lps = (flow_rate_m3_h * 1000.0) / 3600.0
    
    return {
        "status": "success",
        "crop_evapotranspiration_mm_day": round(etc_mm_day, 2),
        "gross_irrigation_req_mm_day": round(gir_mm_day, 2),
        "daily_volume_m3": round(daily_volume_m3, 1),
        "pump_flow_rate_lps": round(flow_rate_lps, 1),
        "recommendation": f"The crops require {round(daily_volume_m3, 1)}m³ of water daily. You need a pump delivering {round(flow_rate_lps, 1)} Liters/second (assuming 12h operation) to meet this demand."
    }
