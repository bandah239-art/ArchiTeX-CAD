"""Verification tests for BoQ engine and Geo Intelligence."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from calculations.structural.foundation import calculate_foundation
from calculations.structural.column import calculate_column
from calculations.structural.slab import calculate_slab
from boq.quantity_extractor import extract_quantities
from boq.boq_compiler import compile_boq
from geo.geo_intelligence import run_site_analysis


def run_boq_test():
    print("=== BoQ TEST (ZM Zambia) ===")
    elements = []

    fdn_result = calculate_foundation({
        "foundation_type": "pad",
        "column_load": 800,
        "moment_x": 30,
        "moment_y": 0,
        "soil_bearing": 150,
        "soil_unit_weight": 18,
        "foundation_depth": 1.2,
        "foundation_depth_concrete": 400,
        "fck": 25,
        "fyk": 500,
        "column_width": 300,
        "column_depth": 300,
    })
    elements.append(extract_quantities({
        "calculation_type": "foundation",
        "calculation_result": fdn_result,
        "element_dimensions": {"width": 2.7, "length": 2.7, "depth": 0.4},
        "element_count": 6,
        "ref": "F1",
        "description": "Pad Foundation F1",
        "calculation_inputs": {"fck": 25},
    }))

    col_result = calculate_column({
        "height": 3.5,
        "width": 300,
        "depth": 300,
        "axial_load": 850,
        "moment_major": 45,
        "moment_minor": 20,
        "fck": 30,
        "fyk": 500,
        "le_factor": 0.85,
    })
    elements.append(extract_quantities({
        "calculation_type": "column",
        "calculation_result": col_result,
        "element_dimensions": {"width": 300, "depth": 300, "length": 3.5},
        "element_count": 12,
        "ref": "C1",
        "description": "Column C1 300x300",
        "calculation_inputs": {"fck": 30},
    }))

    slab_result = calculate_slab({
        "slab_type": "two_way",
        "span_lx": 8,
        "span_ly": 10,
        "dead_load": 5,
        "live_load": 3,
        "depth": 175,
        "fck": 30,
        "fyk": 500,
        "support_condition": "simply_supported",
    })
    elements.append(extract_quantities({
        "calculation_type": "slab",
        "calculation_result": slab_result,
        "element_dimensions": {"length": 8, "width": 10, "depth": 175},
        "element_count": 1,
        "ref": "S1",
        "description": "First Floor Slab 8x10m",
        "calculation_inputs": {"fck": 30},
    }))

    boq = compile_boq({
        "project_name": "ARCHITEX-CAD Demo",
        "client": "Test Client",
        "country_code": "ZM",
        "contractor_overhead": 15,
        "contractor_profit": 10,
        "contingency": 10,
        "elements": elements,
    })

    s = boq["summary"]
    total = s["total_project_estimate_usd"]
    local = s["total_local_currency"]
    lo, hi = s["total_project_range_usd"]

    print(f"Construction cost: USD {s['construction_cost_usd']:,.0f}")
    print(f"Total estimate:    USD {total:,.0f} (range {lo:,.0f} - {hi:,.0f})")
    print(f"Local (ZMW):       ZMW {local:,.0f}")
    ok = 45000 <= total <= 75000 or 45000 <= hi <= 90000
    print(f"Status:            {'PASS' if ok else 'CHECK'} (expected USD 45,000-75,000 ballpark)")
    return boq


def run_geo_test():
    print("\n=== GEO TEST (Lusaka -15.4167, 28.2833) ===")
    analysis = run_site_analysis({
        "latitude": -15.4167,
        "longitude": 28.2833,
        "country_code": "ZM",
        "project_name": "Lusaka Site",
    })

    exec_sum = analysis["executive_summary"]
    terrain = analysis["terrain"]
    climate = analysis["climate"]
    seismic = analysis["seismic"]
    soil = analysis["soil"]

    print(f"Elevation:         {terrain['elevation_m']} m (exp ~1277m)")
    print(f"Annual Rainfall:   {climate['annual_rainfall_mm']} mm (exp 780-900mm)")
    print(f"Climate Zone:      {climate['climate_zone']} (exp Sub-humid)")
    print(f"Seismic SDC:       {seismic['seismic_design_category']} ({seismic['sdc_description']})")
    print(f"Soil:              {soil['uscs_classification']}")
    print(f"Buildability:      {exec_sum['buildability_score']}/10 (exp 7-9)")
    print(f"Solar GHI:         {climate['ghi_kwh_m2_day']} kWh/m2/day (exp 5.5-6.2)")
    print(f"Status:            COMPLETE")
    return analysis


if __name__ == "__main__":
    run_boq_test()
    run_geo_test()
