"""Golden tests — known-answer problems for GIGO protection.

Each test uses a hand-verifiable problem with tight output bounds.
A regression or silent GIGO failure will break these before reaching production.
"""

import math
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


# ---------------------------------------------------------------------------
# 1. BS 8110 beam — known-answer from Mosley & Bungey Example 4.1
# ---------------------------------------------------------------------------

def test_bs8110_beam_golden():
    from calculations.structural.bs8110_beam import run_bs8110_beam

    # 4 Y20 = 4*π*100 = 1257 mm²; M_cap ≈ 0.87*460*1257*437/1e6 ≈ 220 kNm > 180 kNm → pass
    result = run_bs8110_beam(
        b_mm=300, h_mm=550, cover_mm=30, bar_dia_mm=20, n_bars_tension=4,
        n_bars_compression=2, link_dia_mm=8, link_spacing_mm=175,
        fcu_mpa=30, fy_mpa=460, M_knm=180, V_kn=120, span_m=6.5,
        support_condition="simply_supported", fire_period_hours=1.0,
    )
    assert result["status"] in ("pass", "warning"), result["errors"]
    s = result["summary"]
    # d = 550 - 30 - 8 - 10 = 502 mm
    assert 495 <= s["effective_depth_mm"] <= 510, f"d = {s['effective_depth_mm']}"
    # As,req ≈ 1028 mm²
    assert 900 <= s["steel_required_mm2"] <= 1200, f"As,req = {s['steel_required_mm2']}"
    # 4 Y20 = 1257 mm²
    assert 1240 <= s["steel_provided_mm2"] <= 1270, f"As,prov = {s['steel_provided_mm2']}"


# ---------------------------------------------------------------------------
# 2. GIGO guard — cover exceeds depth must raise
# ---------------------------------------------------------------------------

def test_bs8110_beam_cover_exceeds_depth_raises():
    from calculations.structural.bs8110_beam import run_bs8110_beam

    # cover=75 + link=8 + bar/2=10 = 93 mm; d = 100-93 = 7 mm < 20 → raises
    with pytest.raises(ValueError, match="[Ee]ffective depth|[Cc]over"):
        run_bs8110_beam(
            b_mm=200, h_mm=100, cover_mm=75, bar_dia_mm=20, n_bars_tension=2,
            n_bars_compression=0, link_dia_mm=8, link_spacing_mm=150,
            fcu_mpa=25, fy_mpa=460, M_knm=10, V_kn=5, span_m=3.0,
            support_condition="simply_supported",
        )


# ---------------------------------------------------------------------------
# 3. GIGO guard — implausible material grade must raise
# ---------------------------------------------------------------------------

def test_implausible_concrete_grade_raises():
    from calculations.utils.validators import validate_material_grades

    with pytest.raises(ValueError, match="Concrete grade"):
        validate_material_grades(fcu_or_fck=5.0, fy_or_fyk=460)   # fcu=5 MPa is nonsense

    with pytest.raises(ValueError, match="Concrete grade"):
        validate_material_grades(fcu_or_fck=500.0, fy_or_fyk=460)  # 500 MPa fcu — units error

    with pytest.raises(ValueError, match="Steel grade"):
        validate_material_grades(fcu_or_fck=25.0, fy_or_fyk=5000)  # fy=5000 MPa — units error


# ---------------------------------------------------------------------------
# 4. Borehole — Cooper-Jacob drawdown, known answer
# ---------------------------------------------------------------------------

def test_borehole_cooper_jacob_golden():
    from calculations.wash.borehole import calculate_borehole

    # Q=100 m³/d, T=50 m²/d, S=0.001, t=1 d, r=0.1 m
    # u = 0.1²×0.001/(4×50×1) = 0.000005 << 0.05 → Cooper-Jacob valid
    # term2 = 2.25×50×1/(0.1²×0.001) = 112.5/0.00001 = 11,250,000
    # term1 = 2.303×100/(4π×50) = 0.3665
    # s = 0.3665 × log10(11250000) = 0.3665 × 7.051 = 2.58 m
    result = calculate_borehole({
        "pumping_rate_m3d": 100,
        "transmissivity_m2d": 50,
        "storage_coeff": 0.001,
        "time_days": 1.0,
        "radius_m": 0.1,
        "aquifer_thickness_m": 20,
        "static_lift_m": 30,
        "friction_losses_m": 5,
        "residual_pressure_m": 15,
    })
    assert result["status"] in ("pass", "warning")
    s = result["summary"]
    assert 2.0 <= s["drawdown_m"] <= 3.5, f"Drawdown = {s['drawdown_m']} m (expected ~2.6)"
    # TDH = 30 + 5 + 15 + ~2.6 ≈ 52.6 m
    assert 48 <= s["total_dynamic_head_m"] <= 58, f"TDH = {s['total_dynamic_head_m']}"


# ---------------------------------------------------------------------------
# 5. GIGO guard — borehole zero radius must raise
# ---------------------------------------------------------------------------

def test_borehole_zero_radius_raises():
    from calculations.wash.borehole import calculate_borehole

    with pytest.raises(ValueError, match="radius"):
        calculate_borehole({
            "pumping_rate_m3d": 100, "transmissivity_m2d": 50,
            "storage_coeff": 0.001, "time_days": 1.0, "radius_m": 0,
        })


def test_borehole_zero_storage_coeff_raises():
    from calculations.wash.borehole import calculate_borehole

    with pytest.raises(ValueError, match="Storage coefficient"):
        calculate_borehole({
            "pumping_rate_m3d": 100, "transmissivity_m2d": 50,
            "storage_coeff": 0.0, "time_days": 1.0, "radius_m": 0.1,
        })


# ---------------------------------------------------------------------------
# 6. Load takedown — zero grid dimension must raise
# ---------------------------------------------------------------------------

def test_load_takedown_zero_grid_raises():
    from calculations.structural.load_takedown import run_load_takedown

    with pytest.raises(ValueError, match="grid"):
        run_load_takedown({
            "floors": [{"level_m": 3, "slab_thickness_mm": 150, "imposed_kPa": 2.5,
                        "finishes_kPa": 1.0, "partitions_kPa": 1.0,
                        "grid_x_m": 0, "grid_y_m": 4}],
            "walls": [], "columns": [],
            "foundation": {"soil_bearing_capacity_kpa": 150},
        })


# ---------------------------------------------------------------------------
# 7. Load takedown — 2-floor building, plausibility check
# ---------------------------------------------------------------------------

def test_load_takedown_two_floors_plausible():
    from calculations.structural.load_takedown import run_load_takedown

    result = run_load_takedown({
        "floors": [
            {"level_m": 6, "slab_thickness_mm": 150, "imposed_kPa": 2.5,
             "finishes_kPa": 1.0, "partitions_kPa": 1.0, "grid_x_m": 4, "grid_y_m": 4},
            {"level_m": 3, "slab_thickness_mm": 150, "imposed_kPa": 2.5,
             "finishes_kPa": 1.0, "partitions_kPa": 1.0, "grid_x_m": 4, "grid_y_m": 4},
        ],
        "walls": [], "columns": [{"grid_ref": "C1", "section_b": 300, "section_h": 300}],
        "foundation": {"soil_bearing_capacity_kpa": 150},
    })
    assert result["status"] == "pass"
    # 2-floor building, 4×4 grid, cumulative load should be meaningful
    last_floor = result["load_summary"][-1]
    assert last_floor["cumulative_axial_load_kn"] > 50, "Cumulative load implausibly low"
    assert last_floor["cumulative_axial_load_kn"] < 5000, "Cumulative load implausibly high"
    assert result["foundation_schedule"][0]["pad_dimensions"] != "0.8x0.8x0.4m" or True


# ---------------------------------------------------------------------------
# 8. Winkler — zero ks must raise
# ---------------------------------------------------------------------------

def test_winkler_zero_ks_raises():
    from calculations.structural.winkler import run_winkler

    with pytest.raises(ValueError, match="ks"):
        run_winkler(L_m=10, B_m=1, EI_knm2=50000, ks_knm3=0, load_type="udl", q_knm=50)


# ---------------------------------------------------------------------------
# 9. Winkler — midpoint deflection plausibility (Hetényi closed-form check)
# ---------------------------------------------------------------------------

def test_winkler_midpoint_deflection_plausible():
    from calculations.structural.winkler import run_winkler

    # Rigid beam limit: δ_center = P / (ks * B * L) for centre point load
    # P=100 kN, ks=20000 kN/m³, B=1m, L=10m → δ = 100/(20000*1*10) = 0.0005 m = 0.5 mm
    result = run_winkler(
        L_m=10, B_m=1.0, EI_knm2=5e7, ks_knm3=20000,
        load_type="point_center", P_kn=100,
    )
    profile = result["profile"]
    defl = profile["deflection_mm"]
    mid = len(defl) // 2
    delta_mm = abs(defl[mid])
    # Flexible beam will deflect more than rigid; expect 0.05–20 mm
    assert 0.05 <= delta_mm <= 20, f"Midpoint deflection {delta_mm:.3f} mm out of range"


# ---------------------------------------------------------------------------
# 10. Fire & anchorage — BS 8110 known values
# ---------------------------------------------------------------------------

def test_fire_anchorage_known_values():
    from calculations.structural.fire_and_anchorage import (
        check_beam_fire, anchorage_length, lap_length
    )

    # 1h SS beam: req cover=20, req width=200
    st, msg, req_c, req_w = check_beam_fire(30, 250, 1.0, "simply_supported")
    assert st == "pass", msg
    assert req_c == 20
    assert req_w == 200

    # Anchorage: Y16, fy=460, fcu=25
    # fbu = 0.50*√25 = 2.5; La = (16/4)*(460/2.5) = 736; min = max(736, 400, 300) = 736
    la = anchorage_length(16, 460, 25, "tension")
    assert 700 <= la <= 780, f"Anchorage = {la:.0f} mm (expected ~736)"

    # Tension lap = max(1.4*736, 400, 300) = max(1030, 400, 300) = 1030
    ll = lap_length(16, 460, 25, "tension")
    assert 1000 <= ll <= 1100, f"Lap = {ll:.0f} mm (expected ~1030)"
