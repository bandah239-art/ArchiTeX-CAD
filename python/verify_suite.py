"""Run verification tests for the structural suite calculators."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from calculations.structural.foundation import calculate_foundation
from calculations.loads.load_combinations import calculate_loads
from calculations.civil.pavement import calculate_pavement
from calculations.civil.drainage import calculate_drainage


def run_foundation():
    inputs = {
        "foundation_type": "pad",
        "column_load": 800,
        "moment_x": 30,
        "moment_y": 0,
        "soil_bearing": 150,
        "soil_unit_weight": 18,
        "foundation_depth": 1.2,
        "fck": 25,
        "fyk": 500,
        "column_width": 300,
        "column_depth": 300,
        "foundation_depth_concrete": 400,
    }
    r = calculate_foundation(inputs)
    s = r["summary"]
    print("=== FOUNDATION ===")
    print(f"Status: {r['status']}")
    print(f"q_net: {s['net_allowable_knm2']} kN/m² (exp ~128.4)")
    print(f"Size: {s['width_m']} x {s['length_m']} m (exp ~2.7 x 2.7)")
    print(f"q_max: {s['q_max_knm2']} kN/m² (exp ~125.1)")
    print(f"Design: {s['structural_design']}".encode('ascii', 'replace').decode())
    return r


def run_loads():
    inputs = {
        "dead_load_g": 20.0,
        "imposed_load_q": 15.0,
        "wind_load_w": 5.0,
        "design_code": "eurocode",
        "load_type": "udl",
    }
    r = calculate_loads(inputs)
    s = r["summary"]
    print("\n=== LOADS ===")
    print(f"Status: {r['status']}")
    print(f"Combo 1: {s['combo_1_gravity']} kN/m (exp ~47.0)")
    print(f"Combo 2: {s['combo_2_wind_unfav']} kN/m (exp ~41.5)")
    print(f"Combo 3: {s['combo_3_wind_fav']} kN/m (exp ~27.5)")
    print(f"Governing: {s['governing_combination']} -> {s['governing_uls_kn']} kN/m")
    return r


def run_pavement():
    inputs = {
        "road_class": "secondary",
        "traffic_count": 500,
        "heavy_vehicle_pct": 12,
        "design_life": 20,
        "cbr_subgrade": 6,
        "climate_zone": "semi_arid",
        "country": "Zambia",
    }
    r = calculate_pavement(inputs)
    s = r["summary"]
    print("\n=== PAVEMENT ===")
    print(f"Status: {r['status']}")
    print(f"ESALs: {s['design_esals_million']} million (exp ~1.8)")
    print(f"SN: {s['structural_number']} (exp ~4.1)")
    print(f"Layers: {s['wearing_course_mm']}/{s['base_course_mm']}/{s['subbase_mm']} mm (exp 50/225/225)")
    print(f"Design: {s['pavement_design']}".encode('ascii', 'replace').decode())
    return r


def run_drainage():
    inputs = {
        "catchment_area": 2.5,
        "rainfall_intensity": 65,
        "runoff_coefficient": 0.60,
        "pipe_gradient": 1.5,
        "pipe_material": "concrete",
        "country": "Zambia",
    }
    r = calculate_drainage(inputs)
    s = r["summary"]
    print("\n=== DRAINAGE ===")
    print(f"Status: {r['status']}")
    print(f"Q: {s['peak_flow_m3s']} m³/s (exp ~0.027)")
    print(f"Pipe: {s['pipe_diameter_mm']} mm (exp 375)")
    print(f"Velocity: {s['velocity_ms']} m/s (exp ~0.71)")
    print(f"Design: {s['drainage_design']}".encode('ascii', 'replace').decode())
    return r


if __name__ == "__main__":
    run_foundation()
    run_loads()
    run_pavement()
    run_drainage()
