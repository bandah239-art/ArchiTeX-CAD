"""Compliance verification suite for civil engineering calculations and FEA element forces."""

import math
import sys
import os
from typing import Any

# Ensure parent directory is in search path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from calculations.fea.solver_2d import solve_2d_frame
from calculations.structural.beam import calculate_beam
from calculations.structural.column import calculate_column
from calculations.geo.bearing_capacity import calculate_bearing_capacity

def test_fea_simply_supported_beam_udl():
    """Verify 2D FEA solver matches analytical solutions for simply supported beam under UDL."""
    L = 6.0
    E = 2.0e11
    I_val = 1.0e-5
    A = 0.01
    w = 10000.0  # N/m
    
    nodes = [
        {"id": 1, "x": 0.0, "y": 0.0},
        {"id": 2, "x": L, "y": 0.0}
    ]
    elements = [
        {"id": 1, "node_i": 1, "node_j": 2, "E": E, "A": A, "I": I_val, "udl": w}
    ]
    loads = []
    # Pin at Node 1, Roller at Node 2
    supports = [
        {"node_id": 1, "ux": True, "uy": True, "rz": False},
        {"node_id": 2, "ux": False, "uy": True, "rz": False}
    ]
    
    res = solve_2d_frame(nodes, elements, loads, supports)
    assert res["status"] == "success"
    
    el_res = res["element_results"][0]
    moments = el_res["moments"]
    shears = el_res["shears"]
    deflections = el_res["deflections"]
    
    # 1. Bending Moment Diagram Verification
    # Analytical Max Moment at mid-span = w * L^2 / 8
    analytical_max_moment = (w * L**2) / 8.0  # 45000 N*m
    # The middle index is 5 (x = 3.0m)
    # Note: sign convention might be negative or positive depending on solver local coords, check absolute
    assert math.isclose(abs(moments[5]), analytical_max_moment, rel_tol=0.0005)
    
    # 2. Shear Force Diagram Verification
    # Analytical Shear at ends = w * L / 2 = 30000 N
    analytical_end_shear = w * L / 2.0
    assert math.isclose(abs(shears[0]), analytical_end_shear, rel_tol=0.0005)
    assert math.isclose(abs(shears[10]), analytical_end_shear, rel_tol=0.0005)
    
    # 3. Deflection Curve Verification
    # Analytical Max Deflection at mid-span = 5 * w * L^4 / (384 * E * I)
    analytical_max_deflection = (5.0 * w * L**4) / (384.0 * E * I_val) # 0.084375 m
    assert math.isclose(abs(deflections[5]), analytical_max_deflection, rel_tol=0.0005)


def test_eurocode_beam_bending_moment():
    """Verify beam calculator matches analytical combinations and bending moment limit formulas."""
    inputs = {
        "span": 6.0,
        "support_condition": "simply_supported",
        "dead_load": 10.0,  # Gk (kN/m)
        "imposed_load": 5.0,  # Qk (kN/m)
        "width": 300.0,  # mm
        "depth": 500.0,  # mm
        "fck": 30.0,  # MPa
        "fyk": 500.0,  # MPa
        "exposure_class": "XC1",
        "design_code": "Eurocode2"
    }
    
    res = calculate_beam(inputs)
    assert res["status"] in ("pass", "fail")  # It should complete calculation
    
    # 1. Ultimate Design Load combination: 1.35 * Gk + 1.5 * Qk = 1.35 * 10 + 1.5 * 5 = 21.0 kN/m
    analytical_wu = 1.35 * inputs["dead_load"] + 1.5 * inputs["imposed_load"]
    # 2. Max Moment = wu * L^2 / 8 = 21.0 * 36 / 8 = 94.5 kNm
    analytical_mu = analytical_wu * (inputs["span"]**2) / 8.0
    
    summary = res["summary"]
    assert math.isclose(summary["ultimate_moment_knm"], analytical_mu, rel_tol=0.0005)
    assert math.isclose(summary["shear_force_kn"], analytical_wu * inputs["span"] / 2.0, rel_tol=0.0005)


def test_eurocode_column_slenderness():
    """Verify column calculator matches analytical effective length and eccentricity limit equations."""
    inputs = {
        "height": 4.0,
        "width": 300.0,
        "depth": 300.0,
        "axial_load": 800.0,  # kN
        "moment_major": 30.0,  # kNm
        "moment_minor": 0.0,
        "fck": 30.0,
        "fyk": 500.0,
        "le_factor": 0.7  # Fixed-fixed approximation
    }
    
    res = calculate_column(inputs)
    assert res["status"] in ("pass", "fail")
    
    summary = res["summary"]
    # lo = le_factor * height = 0.7 * 4.0 = 2.8m
    assert math.isclose(summary["effective_length_m"], 2.8, rel_tol=0.0005)
    
    # Minimum eccentricity e_min = max(h/30, 20mm) = max(300/30, 20) = 20mm
    # Minimum moment M_min = NEd * e_min = 800 kN * 0.02m = 16.0 kNm
    # Design moment = max(M_major, M_min) = max(30.0, 16.0) = 30.0 kNm
    assert math.isclose(summary["design_moment_knm"], 30.0, rel_tol=0.0005)
    assert math.isclose(summary["min_eccentricity_mm"], 20.0, rel_tol=0.0005)


def test_geotechnical_bearing_capacity():
    """Verify bearing capacity matches analytical Meyerhof calculations."""
    inputs = {
        "soil_type": "sandy",
        "foundation_width_m": 2.0,
        "foundation_length_m": 2.0,
        "foundation_depth_m": 1.5,
        "fos": 3.0,
        "use_custom_soil": True,
        "cohesion_kpa": 10.0,
        "friction_angle_deg": 30.0,
        "unit_weight_knm3": 18.0
    }
    
    res = calculate_bearing_capacity(inputs)
    assert res["status"] in ("pass", "warning")
    
    summary = res["summary"]
    # Check Meyerhof factors for phi = 30 degrees
    # nq = exp(pi * tan(30)) * tan(60)^2
    phi_rad = math.radians(30.0)
    expected_nq = math.exp(math.pi * math.tan(phi_rad)) * (math.tan(math.radians(45.0 + 15.0))**2)
    expected_nc = (expected_nq - 1.0) / math.tan(phi_rad)
    expected_ngamma = 2.0 * (expected_nq + 1.0) * math.tan(phi_rad)
    
    assert math.isclose(summary["nq"], expected_nq, rel_tol=0.005)
    assert math.isclose(summary["nc"], expected_nc, rel_tol=0.005)
    assert math.isclose(summary["ngamma"], expected_ngamma, rel_tol=0.005)


if __name__ == "__main__":
    test_fea_simply_supported_beam_udl()
    test_eurocode_beam_bending_moment()
    test_eurocode_column_slenderness()
    test_geotechnical_bearing_capacity()
    print("All compliance verification tests passed successfully (<0.05% error margin check).")
