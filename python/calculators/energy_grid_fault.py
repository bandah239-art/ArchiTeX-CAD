from pydantic import BaseModel
import math

class GridFaultRequest(BaseModel):
    generator_kva: float = 1000.0
    generator_voltage_v: float = 400.0
    generator_subtransient_reactance_pu: float = 0.15 # X"d
    cable_length_m: float = 50.0
    cable_reactance_ohm_km: float = 0.08
    cable_resistance_ohm_km: float = 0.16

def calculate_grid_fault(req: GridFaultRequest) -> dict:
    """
    Calculates the 3-phase short circuit fault current for breaker sizing.
    """
    # Base Values
    base_kva = req.generator_kva
    base_v = req.generator_voltage_v
    
    # Base Current: I_base = S / (sqrt(3) * V)
    i_base_amps = (base_kva * 1000.0) / (math.sqrt(3) * base_v)
    
    # Base Impedance: Z_base = V^2 / S
    z_base_ohms = (base_v**2) / (base_kva * 1000.0)
    
    # Generator Impedance in Ohms (assume R is negligible compared to X)
    x_gen_ohms = req.generator_subtransient_reactance_pu * z_base_ohms
    
    # Cable Impedance
    r_cable_ohms = req.cable_resistance_ohm_km * (req.cable_length_m / 1000.0)
    x_cable_ohms = req.cable_reactance_ohm_km * (req.cable_length_m / 1000.0)
    
    # Total Fault Impedance
    total_r = r_cable_ohms
    total_x = x_gen_ohms + x_cable_ohms
    z_fault_ohms = math.sqrt(total_r**2 + total_x**2)
    
    # 3-Phase Short Circuit Current
    # I_sc = V_phase / Z_fault
    v_phase = base_v / math.sqrt(3)
    i_sc_amps = v_phase / z_fault_ohms
    i_sc_ka = i_sc_amps / 1000.0
    
    # Select Breaker Size (Standard IEC sizes: 10kA, 16kA, 25kA, 36kA, 50kA, 65kA)
    standard_breakers = [10.0, 16.0, 25.0, 36.0, 50.0, 65.0, 100.0]
    breaker_ka = None
    for size in standard_breakers:
        if size >= i_sc_ka:
            breaker_ka = size
            break
            
    if not breaker_ka:
        breaker_ka = standard_breakers[-1]
    
    return {
        "status": "success",
        "full_load_current_amps": round(i_base_amps, 1),
        "fault_current_ka": round(i_sc_ka, 2),
        "recommended_breaker_ka": breaker_ka,
        "recommendation": f"The prospective short-circuit current is {round(i_sc_ka, 2)}kA. A circuit breaker with a breaking capacity of at least {breaker_ka}kA is required."
    }
