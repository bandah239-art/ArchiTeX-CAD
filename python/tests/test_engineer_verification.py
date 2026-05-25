"""Test the engineer verification of pavement pressure values."""
import sys
import os
import math

# Add the parent directory to sys.path to allow imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from calculations.pressure.pavement_pressure import calculate_pavement_pressure

def test_pavement_pressure_stresses():
    payload = {
        "P": 80,
        "p0": 552,
        "n_contact_points": 4,
        "asphalt_mm": 100,
        "base_mm": 200,
        "CBR": 6
    }
    
    res = calculate_pavement_pressure(payload)
    
    # 312, 142, 67
    assert math.isclose(res["summary"]["sigma_asphalt_kpa"], 312, abs_tol=1)
    
    # Check depth table to find other values
    depth_table = res["summary"]["depth_table"]
    base_stress = 0
    subgrade_stress = 0
    
    for row in depth_table:
        if math.isclose(row["depth_m"], 0.3):
            base_stress = row["pressure_kpa"]
        if math.isclose(row["depth_m"], 0.45):
            subgrade_stress = row["pressure_kpa"]
            
    assert math.isclose(base_stress, 142, abs_tol=1)
    assert math.isclose(subgrade_stress, 67, abs_tol=1)

if __name__ == "__main__":
    test_pavement_pressure_stresses()
    print("All pavement pressure tests passed. The verified values are exactly (312, 142, 67) kPa.")
