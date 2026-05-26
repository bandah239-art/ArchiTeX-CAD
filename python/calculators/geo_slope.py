from pydantic import BaseModel
import math

class SlopeRequest(BaseModel):
    slope_angle_degrees: float = 30.0
    soil_cohesion_kpa: float = 20.0
    friction_angle_degrees: float = 25.0
    soil_unit_weight_kn_m3: float = 18.0
    slope_height_m: float = 10.0

def calculate_slope(req: SlopeRequest) -> dict:
    """
    Simplified infinite slope stability analysis (Taylor's stability number approximation)
    or planar slip analysis to calculate Factor of Safety against landslides.
    """
    # Convert angles to radians
    beta_rad = math.radians(req.slope_angle_degrees)
    phi_rad = math.radians(req.friction_angle_degrees)
    
    # Infinite Slope Factor of Safety (dry soil)
    # FS = (c / (gamma * H * cos^2(beta) * tan(beta))) + (tan(phi) / tan(beta))
    
    c = req.soil_cohesion_kpa
    gamma = req.soil_unit_weight_kn_m3
    H = req.slope_height_m
    
    term1 = c / (gamma * H * (math.cos(beta_rad)**2) * math.tan(beta_rad))
    term2 = math.tan(phi_rad) / math.tan(beta_rad)
    
    fos = term1 + term2
    
    status = "safe" if fos >= 1.5 else ("warning" if fos >= 1.0 else "unsafe")
    
    return {
        "status": status,
        "factor_of_safety": round(fos, 2),
        "cohesive_contribution": round(term1, 2),
        "frictional_contribution": round(term2, 2),
        "recommendation": f"The Factor of Safety is {round(fos, 2)}. {'This slope is considered stable.' if fos >= 1.5 else 'WARNING: Slope is potentially unstable. Retaining structures required.'}"
    }
