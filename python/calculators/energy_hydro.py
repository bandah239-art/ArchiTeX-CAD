from pydantic import BaseModel

class HydroRequest(BaseModel):
    flow_rate_m3_s: float
    net_head_m: float
    system_efficiency: float = 0.85

def calculate_hydro(req: HydroRequest) -> dict:
    """
    Calculates Micro-Hydro power potential and turbine selection.
    P = rho * g * Q * H * eta
    """
    rho = 1000 # kg/m3
    g = 9.81 # m/s2
    
    # Power in Watts = kg/m3 * m/s2 * m3/s * m
    power_w = rho * g * req.flow_rate_m3_s * req.net_head_m * req.system_efficiency
    power_kw = power_w / 1000.0
    power_mw = power_kw / 1000.0
    
    # Turbine selection heuristic
    # High head, low flow -> Pelton
    # Medium head, medium flow -> Francis / Crossflow
    # Low head, high flow -> Kaplan
    
    if req.net_head_m > 50:
        turbine = "Pelton Wheel"
    elif 10 <= req.net_head_m <= 50:
        turbine = "Crossflow / Francis"
    else:
        turbine = "Kaplan / Propeller"
        
    return {
        "status": "success",
        "power_kw": round(power_kw, 2),
        "power_mw": round(power_mw, 3),
        "recommended_turbine": turbine,
        "recommendation": f"A flow of {req.flow_rate_m3_s}m³/s at {req.net_head_m}m head can generate {round(power_kw, 2)}kW using a {turbine} turbine."
    }
