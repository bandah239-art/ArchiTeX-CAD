from pydantic import BaseModel

class MicrogridRequest(BaseModel):
    cable_length_m: float
    load_current_amps: float
    system_voltage: float = 230
    cable_material: str = "aluminum" # or "copper"
    max_voltage_drop_percent: float = 5.0

def calculate_voltage_drop(req: MicrogridRequest) -> dict:
    """
    Calculates voltage drop for a radial feeder and selects the optimal cable cross-section.
    Vd = (2 * L * I * rho) / A
    Where:
      L = length (m)
      I = current (A)
      rho = resistivity (Ohm.mm2/m) -> Cu: 0.0175, Al: 0.0282
      A = cross sectional area (mm2)
    """
    rho = 0.0282 if req.cable_material == "aluminum" else 0.0175
    
    max_vd_volts = req.system_voltage * (req.max_voltage_drop_percent / 100.0)
    
    # Calculate required minimum area
    # A = (2 * L * I * rho) / Vd
    min_area_mm2 = (2 * req.cable_length_m * req.load_current_amps * rho) / max_vd_volts
    
    # Standard cable sizes (mm2)
    standard_sizes = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300]
    
    selected_area = None
    for size in standard_sizes:
        if size >= min_area_mm2:
            selected_area = size
            break
            
    if not selected_area:
        selected_area = min_area_mm2 # Unrealistic, but fallback
        
    # Actual voltage drop with selected cable
    actual_vd_volts = (2 * req.cable_length_m * req.load_current_amps * rho) / selected_area
    actual_vd_percent = (actual_vd_volts / req.system_voltage) * 100
    
    return {
        "status": "success",
        "minimum_area_mm2": round(min_area_mm2, 2),
        "selected_cable_mm2": selected_area,
        "actual_voltage_drop_v": round(actual_vd_volts, 2),
        "actual_voltage_drop_percent": round(actual_vd_percent, 2),
        "recommendation": f"Use {selected_area}mm² {req.cable_material.title()} cable to maintain voltage drop at {round(actual_vd_percent, 2)}%."
    }
