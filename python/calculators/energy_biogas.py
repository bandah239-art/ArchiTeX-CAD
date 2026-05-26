from pydantic import BaseModel
import math

class BiogasRequest(BaseModel):
    cattle_count: int = 0
    poultry_count: int = 0
    human_count: int = 0
    temperature_c: float = 25.0

def calculate_biogas(req: BiogasRequest) -> dict:
    """
    Calculates the required digester volume and expected daily methane (biogas) yield based on feedstock.
    """
    # Typical daily waste production (kg/day/head)
    waste_cattle = 10.0 # kg
    waste_poultry = 0.1 # kg
    waste_human = 0.5   # kg
    
    total_waste_kg = (req.cattle_count * waste_cattle) + \
                     (req.poultry_count * waste_poultry) + \
                     (req.human_count * waste_human)
                     
    # Biogas yield (m3/kg of fresh waste)
    yield_cattle = 0.04
    yield_poultry = 0.06
    yield_human = 0.03
    
    total_biogas_m3 = (req.cattle_count * waste_cattle * yield_cattle) + \
                      (req.poultry_count * waste_poultry * yield_poultry) + \
                      (req.human_count * waste_human * yield_human)
                      
    # Energy equivalent (1 m3 biogas ~= 6 kWh)
    energy_kwh = total_biogas_m3 * 6.0
    
    # Digester Volume Calculation
    # Assume 1:1 mixture of waste to water
    total_mixture_kg = total_waste_kg * 2
    mixture_volume_m3 = total_mixture_kg / 1000.0 # roughly 1000 kg/m3 density
    
    # Hydraulic Retention Time (HRT) heavily depends on temperature.
    # At 25C, ~40 days
    hrt_days = 40.0
    if req.temperature_c > 30:
        hrt_days = 30.0
    elif req.temperature_c < 20:
        hrt_days = 60.0
        
    digester_active_volume_m3 = mixture_volume_m3 * hrt_days
    
    # Add 20% for gas storage dome
    total_digester_volume_m3 = digester_active_volume_m3 * 1.2
    
    return {
        "status": "success",
        "total_waste_kg_day": round(total_waste_kg, 1),
        "biogas_yield_m3_day": round(total_biogas_m3, 2),
        "energy_kwh_day": round(energy_kwh, 1),
        "digester_volume_m3": round(total_digester_volume_m3, 1),
        "recommendation": f"Construct a {round(total_digester_volume_m3, 1)}m³ fixed-dome digester. It will process {round(total_waste_kg, 1)}kg of waste daily and produce {round(total_biogas_m3, 2)}m³ of biogas (equivalent to {round(energy_kwh, 1)} kWh)."
    }
