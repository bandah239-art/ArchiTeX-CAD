from pydantic import BaseModel

class BessRequest(BaseModel):
    load_profile: str
    daily_load_kwh: float
    peak_load_kw: float
    autonomy_days: float
    peak_sun_hours: float
    battery_type: str = "lithium_ion" # or tubular_gel

def calculate_bess(req: BessRequest) -> dict:
    """
    Calculates Solar PV Array size, Battery Bank, and Inverter for an off-grid system.
    """
    # 1. Inverter Sizing
    # Assume 25% safety factor for surge loads (motors, compressors)
    inverter_kva = req.peak_load_kw * 1.25
    
    # 2. Battery Bank Sizing
    # Depth of Discharge (DoD)
    dod = 0.8 if req.battery_type == "lithium_ion" else 0.5
    system_voltage = 48 # standard 48V system
    
    total_battery_kwh = (req.daily_load_kwh * req.autonomy_days) / dod
    battery_amp_hours = (total_battery_kwh * 1000) / system_voltage
    
    # 3. Solar Array Sizing
    # System losses (dust, temperature, inverter efficiency) ~ 20%
    system_efficiency = 0.8
    array_kwp = req.daily_load_kwh / (req.peak_sun_hours * system_efficiency)
    
    # Assuming standard 400W panels
    panel_wattage = 400
    panel_count = int((array_kwp * 1000) / panel_wattage) + 1
    
    return {
        "status": "success",
        "inverter_kva": round(inverter_kva, 1),
        "battery_bank_kwh": round(total_battery_kwh, 1),
        "battery_ah_48v": round(battery_amp_hours, 0),
        "array_kwp": round(array_kwp, 1),
        "panel_count_400w": panel_count,
        "recommendation": f"Install a {round(inverter_kva, 1)}kVA Inverter with {panel_count} x 400W Solar Panels and a {round(total_battery_kwh, 1)}kWh {req.battery_type.replace('_', ' ').title()} battery bank."
    }
