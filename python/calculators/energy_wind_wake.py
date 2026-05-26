from pydantic import BaseModel
import math

class WindWakeRequest(BaseModel):
    turbine_rotor_diameter_m: float = 80.0
    turbine_rating_kw: float = 2000.0
    wind_speed_mps: float = 12.0
    rows: int = 4
    spacing_factor_d: float = 5.0 # Turbine spacing as a multiple of rotor diameter

def calculate_wind_wake(req: WindWakeRequest) -> dict:
    """
    Calculates the Jensen wake effect model to determine power loss due to turbine spacing.
    """
    # Ideal Power if there was no wake
    total_ideal_power_kw = req.rows * req.turbine_rating_kw
    
    # Jensen Model Wake Decay Constant (k)
    # k ~ 0.04 for offshore, 0.075 for onshore
    k = 0.075 
    
    # Thrust coefficient (Ct) - typically 0.8 at design speed
    ct = 0.8
    
    x = req.spacing_factor_d * req.turbine_rotor_diameter_m # distance downstream
    r = req.turbine_rotor_diameter_m / 2.0
    
    # Wake velocity deficit calculation for subsequent rows
    # V_wake / V_freestream = 1 - ( (1 - sqrt(1 - Ct)) / (1 + k*x/r)^2 )
    
    powers = []
    current_power = req.turbine_rating_kw
    powers.append(current_power) # First row gets 100% wind
    
    total_actual_power_kw = current_power
    
    # Simple cumulative wake effect
    for i in range(1, req.rows):
        distance = i * x
        velocity_deficit = (1.0 - math.sqrt(1.0 - ct)) / ((1.0 + (k * distance) / r)**2)
        v_wake = req.wind_speed_mps * (1.0 - velocity_deficit)
        
        # Power is proportional to the cube of wind speed
        power_ratio = (v_wake / req.wind_speed_mps)**3
        row_power = req.turbine_rating_kw * power_ratio
        
        powers.append(round(row_power, 1))
        total_actual_power_kw += row_power
        
    efficiency_percent = (total_actual_power_kw / total_ideal_power_kw) * 100.0
    
    return {
        "status": "success",
        "total_ideal_power_kw": round(total_ideal_power_kw, 1),
        "total_actual_power_kw": round(total_actual_power_kw, 1),
        "farm_efficiency_percent": round(efficiency_percent, 2),
        "row_powers_kw": powers,
        "recommendation": f"At {req.spacing_factor_d}D spacing, the farm efficiency is {round(efficiency_percent, 1)}%. Increase spacing to reduce aerodynamic wake losses."
    }
