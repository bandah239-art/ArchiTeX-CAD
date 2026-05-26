from pydantic import BaseModel
import math

class TransmissionRequest(BaseModel):
    span_length_m: float
    conductor_weight_kg_m: float = 1.5 # Weight of conductor per meter
    max_tension_kg: float = 2000.0 # Maximum allowable tension
    temperature_c: float = 40.0
    ground_clearance_m: float = 8.0

def calculate_sag_tension(req: TransmissionRequest) -> dict:
    """
    Calculates the catenary sag of a transmission line.
    Approximate parabolic equation: Sag (S) = (w * L^2) / (8 * T)
    Where:
      w = weight per unit length (kg/m)
      L = span length (m)
      T = tension (kg)
    """
    w = req.conductor_weight_kg_m
    L = req.span_length_m
    T = req.max_tension_kg
    
    # Calculate Sag
    sag_m = (w * L**2) / (8 * T)
    
    # Calculate required pole height to maintain ground clearance
    # Pole Height = Ground Clearance + Sag + Insulator String Length (assume 1m)
    insulator_length = 1.0
    min_pole_height = req.ground_clearance_m + sag_m + insulator_length
    
    # Calculate actual conductor length (approximate)
    # Length = L + (8 * Sag^2) / (3 * L)
    actual_length_m = L + (8 * sag_m**2) / (3 * L)
    
    return {
        "status": "success",
        "sag_m": round(sag_m, 2),
        "min_pole_height_m": round(min_pole_height, 2),
        "actual_conductor_length_m": round(actual_length_m, 2),
        "recommendation": f"For a span of {L}m, the conductor sag is {round(sag_m, 2)}m. Use transmission poles of at least {round(min_pole_height, 2)}m height to maintain {req.ground_clearance_m}m ground clearance."
    }
