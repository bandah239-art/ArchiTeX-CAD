from pydantic import BaseModel
import math

class WaterTowerRequest(BaseModel):
    population: int
    liters_per_capita_day: float = 50.0
    borehole_depth_m: float = 80.0
    tower_height_m: float = 12.0
    pump_efficiency: float = 0.6

def calculate_water_tower(req: WaterTowerRequest) -> dict:
    """
    Calculates the water demand, sizes the overhead tank, and computes Total Dynamic Head (TDH) and Pump HP.
    """
    # 1. Daily Demand
    daily_demand_liters = req.population * req.liters_per_capita_day
    daily_demand_m3 = daily_demand_liters / 1000.0
    
    # Tank size usually sized for 50-100% of daily demand
    recommended_tank_m3 = daily_demand_m3 * 0.75 # 75% of daily demand
    
    # Round tank size to nearest standard size
    standard_tanks = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150]
    tank_m3 = None
    for size in standard_tanks:
        if size >= recommended_tank_m3:
            tank_m3 = size
            break
            
    if not tank_m3:
        tank_m3 = standard_tanks[-1]
        
    # 2. Total Dynamic Head (TDH)
    # TDH = Static Lift + Friction Loss + Operating Pressure
    # Static Lift = Borehole depth to water level + Tower height
    static_lift = req.borehole_depth_m + req.tower_height_m
    friction_loss_estimate = static_lift * 0.1 # 10% friction loss
    operating_pressure_head = 5.0 # meters
    
    tdh = static_lift + friction_loss_estimate + operating_pressure_head
    
    # 3. Pump Power
    # Flow rate (m3/s). Assume pump runs for 8 hours a day to fill tank.
    pump_hours = 8.0
    flow_rate_m3_h = tank_m3 / pump_hours
    flow_rate_m3_s = flow_rate_m3_h / 3600.0
    
    # P (kW) = (rho * g * Q * H) / efficiency
    # rho = 1000 kg/m3, g = 9.81 m/s2
    rho = 1000.0
    g = 9.81
    power_kw = (rho * g * flow_rate_m3_s * tdh) / (req.pump_efficiency * 1000.0)
    power_hp = power_kw * 1.34102
    
    return {
        "status": "success",
        "daily_demand_m3": round(daily_demand_m3, 1),
        "recommended_tank_m3": tank_m3,
        "tdh_m": round(tdh, 1),
        "flow_rate_m3_h": round(flow_rate_m3_h, 1),
        "pump_power_kw": round(power_kw, 2),
        "pump_power_hp": round(power_hp, 2),
        "recommendation": f"Install a {tank_m3}m³ elevated tank on a {req.tower_height_m}m stanchion. Requires a {round(power_hp, 1)} HP submersible pump delivering {round(flow_rate_m3_h, 1)}m³/h at {round(tdh, 1)}m TDH."
    }
