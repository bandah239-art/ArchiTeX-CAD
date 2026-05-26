from pydantic import BaseModel
import math

class PipeNetworkRequest(BaseModel):
    flow_rate_lps: float # Liters per second
    pipe_length_m: float
    pipe_material: str = "HDPE" # or PVC, Steel
    max_velocity_mps: float = 1.5
    min_pressure_m: float = 10.0

def calculate_pipe_network(req: PipeNetworkRequest) -> dict:
    """
    Calculates pipe sizing using Hazen-Williams equation to maintain optimal velocity and friction loss.
    """
    # 1. Determine optimal pipe diameter to maintain max_velocity
    # Q = A * V -> A = Q / V
    # Area A = pi * D^2 / 4 -> D = sqrt(4 * Q / (pi * V))
    q_m3_s = req.flow_rate_lps / 1000.0
    
    optimal_diameter_m = math.sqrt((4.0 * q_m3_s) / (math.pi * req.max_velocity_mps))
    optimal_diameter_mm = optimal_diameter_m * 1000.0
    
    # Select from standard commercial pipe sizes (DN in mm)
    standard_dn = [20, 25, 32, 40, 50, 63, 75, 90, 110, 160, 200, 250, 315]
    
    selected_dn = None
    for dn in standard_dn:
        if dn >= optimal_diameter_mm:
            selected_dn = dn
            break
            
    if not selected_dn:
        selected_dn = standard_dn[-1]
        
    # 2. Calculate actual velocity with selected pipe
    actual_area_m2 = math.pi * (selected_dn / 1000.0)**2 / 4.0
    actual_velocity_mps = q_m3_s / actual_area_m2
    
    # 3. Hazen-Williams Friction Loss (hf)
    # hf = (10.67 * L * Q^1.852) / (C^1.852 * D^4.87)
    # C-values: HDPE=140, PVC=150, Steel=120
    c_factor = 140
    if req.pipe_material.upper() == "PVC":
        c_factor = 150
    elif req.pipe_material.upper() == "STEEL":
        c_factor = 120
        
    d_meters = selected_dn / 1000.0
    
    hf_m = (10.67 * req.pipe_length_m * (q_m3_s**1.852)) / ((c_factor**1.852) * (d_meters**4.87))
    
    return {
        "status": "success",
        "optimal_diameter_mm": round(optimal_diameter_mm, 1),
        "selected_dn_mm": selected_dn,
        "actual_velocity_mps": round(actual_velocity_mps, 2),
        "friction_loss_m": round(hf_m, 2),
        "recommendation": f"Use DN{selected_dn} {req.pipe_material.upper()} pipe. The water velocity will be {round(actual_velocity_mps, 2)}m/s with a friction head loss of {round(hf_m, 2)}m over the {req.pipe_length_m}m run."
    }
