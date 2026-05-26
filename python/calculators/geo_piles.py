from pydantic import BaseModel
import math

class PilesRequest(BaseModel):
    pile_diameter_m: float = 0.6
    pile_length_m: float = 20.0
    soil_cohesion_kpa: float = 50.0
    adhesion_factor_alpha: float = 0.5
    end_bearing_capacity_factor_nc: float = 9.0
    factor_of_safety: float = 2.5

def calculate_piles(req: PilesRequest) -> dict:
    """
    Calculates the ultimate and allowable bearing capacity of a bored pile in cohesive soil (clay).
    Capacity = Shaft Resistance (Skin Friction) + End Bearing Resistance
    """
    # Shaft Area (m2) = pi * D * L
    shaft_area_m2 = math.pi * req.pile_diameter_m * req.pile_length_m
    
    # Base Area (m2) = pi * D^2 / 4
    base_area_m2 = (math.pi * req.pile_diameter_m**2) / 4.0
    
    # Ultimate Shaft Resistance (Qs) = alpha * cu * As
    ultimate_shaft_res_kn = req.adhesion_factor_alpha * req.soil_cohesion_kpa * shaft_area_m2
    
    # Ultimate End Bearing Resistance (Qb) = Nc * cu * Ab
    ultimate_end_bearing_kn = req.end_bearing_capacity_factor_nc * req.soil_cohesion_kpa * base_area_m2
    
    # Total Ultimate Capacity (Qu)
    ultimate_capacity_kn = ultimate_shaft_res_kn + ultimate_end_bearing_kn
    
    # Allowable Capacity (Qall)
    allowable_capacity_kn = ultimate_capacity_kn / req.factor_of_safety
    
    return {
        "status": "success",
        "shaft_resistance_kn": round(ultimate_shaft_res_kn, 1),
        "end_bearing_kn": round(ultimate_end_bearing_kn, 1),
        "ultimate_capacity_kn": round(ultimate_capacity_kn, 1),
        "allowable_capacity_kn": round(allowable_capacity_kn, 1),
        "recommendation": f"A {req.pile_diameter_m}m diameter pile at {req.pile_length_m}m depth provides a safe allowable working load of {round(allowable_capacity_kn, 1)} kN (FoS = {req.factor_of_safety})."
    }
