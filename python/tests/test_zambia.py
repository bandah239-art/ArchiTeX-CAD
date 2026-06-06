"""Physics verification tests for Zambian localized engineering calculations."""

import os
import sys
import math
import pytest

# Ensure parent directory is in search path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from calculations.structural.bs8110_beam import run_bs8110_beam
from calculations.structural.bs8110_slab import run_bs8110_slab
from calculations.structural.bs8110_column import run_bs8110_column
from calculations.structural.masonry_bs5628 import run_masonry_wall
from calculations.geotechnical.black_cotton_soil import run_black_cotton_assessment
from calculations.site.zambia_site_data import get_zambia_site_data
from calculations.geotechnical.borehole import run_borehole_design
from calculations.roads.gravel_road import run_gravel_road_design


class TestBS8110Beam:
    """Verifies BS 8110 concrete beam design logic."""

    def test_singly_reinforced_beam(self):
        # M = 120 kNm, Singly reinforced limit check
        res = run_bs8110_beam(
            b_mm=250.0,
            h_mm=500.0,
            cover_mm=30.0,
            bar_dia_mm=16.0,
            n_bars_tension=3,
            n_bars_compression=2,
            link_dia_mm=8.0,
            link_spacing_mm=200.0,
            fcu_mpa=25.0,
            fy_mpa=460.0,
            M_knm=120.0,
            V_kn=80.0,
            span_m=6.0,
            support_condition="simply_supported",
        )
        assert res["status"] in ("pass", "fail")
        summary = res["summary"]
        
        # d = 500 - 30 - 8 - 16/2 = 454 mm
        # K = 120e6 / (25 * 250 * 454^2) = 0.09315 <= 0.156
        assert math.isclose(summary["k_factor"], 0.09315, abs_tol=0.005)
        # z should be approx 400 mm
        assert 390.0 <= summary["lever_arm_mm"] <= 415.0
        # Tension steel required ≈ 748 mm²
        assert 700.0 <= summary["steel_required_mm2"] <= 800.0
        # Steel provided: 3 * pi * 8^2 = 603 mm²
        # Steel provided is less than required, so design status is FAIL ✗
        assert res["status"] == "fail"

    def test_doubly_reinforced_beam(self):
        # M = 220 kNm (Requires compression reinforcement because K > 0.156)
        res = run_bs8110_beam(
            b_mm=250.0,
            h_mm=500.0,
            cover_mm=30.0,
            bar_dia_mm=16.0,
            n_bars_tension=5,
            n_bars_compression=3,
            link_dia_mm=8.0,
            link_spacing_mm=150.0,
            fcu_mpa=25.0,
            fy_mpa=460.0,
            M_knm=220.0,
            V_kn=100.0,
            span_m=6.0,
            support_condition="simply_supported",
        )
        assert "Doubly reinforced" in res["steps"][1]["result"]
        assert len(res["warnings"]) > 0
        assert "Compression steel required" in res["warnings"][0]


class TestBS8110Slab:
    """Verifies BS 8110 one-way and two-way slab calculations."""

    def test_two_way_simply_supported(self):
        # lx = 3m, ly = 4m (ratio = 1.33)
        res = run_bs8110_slab(
            lx_m=3.0,
            ly_m=4.0,
            support_condition="simply_supported",
            h_mm=150.0,
            cover_mm=20.0,
            bar_dia_mm=10.0,
            fcu_mpa=25.0,
            fy_mpa=460.0,
            n_knm2=12.0,
            slab_type="two_way_simply_supported",
        )
        assert res["status"] == "pass"
        summary = res["summary"]
        
        # ly/lx = 1.33
        # Interpolated beta_sx from Table 3.13 for 1.33 ≈ 0.095
        # Msx = 0.095 * 12 * 3^2 = 10.26 kNm/m
        assert 9.5 <= summary["moment_short_span_knm"] <= 11.0
        # beta_sy = 0.062 (constant) -> Msy = 0.062 * 12 * 3^2 = 6.7 kNm/m
        assert math.isclose(summary["moment_long_span_knm"], 6.696, abs_tol=0.2)

    def test_one_way_slab(self):
        res = run_bs8110_slab(
            lx_m=3.0,
            ly_m=7.0,
            support_condition="simply_supported",
            h_mm=150.0,
            cover_mm=20.0,
            bar_dia_mm=10.0,
            fcu_mpa=25.0,
            fy_mpa=460.0,
            n_knm2=10.0,
            slab_type="one_way",
        )
        assert res["status"] == "pass"
        assert res["summary"]["moment_long_span_knm"] == 0.0
        # Msx = n * L^2 / 8 = 10 * 9 / 8 = 11.25 kNm/m
        assert math.isclose(res["summary"]["moment_short_span_knm"], 11.25, rel_tol=0.01)


class TestBS8110Column:
    """Verifies BS 8110 column capacity and slenderness checks."""

    def test_short_braced_column(self):
        # 300x300, braced, height=3m (lex/h = 10 < 15 -> SHORT)
        res = run_bs8110_column(
            b_mm=300.0,
            h_mm=300.0,
            cover_mm=30.0,
            bar_dia_mm=16.0,
            n_bars=4,
            fcu_mpa=25.0,
            fy_mpa=460.0,
            N_kn=800.0,
            Mx_knm=15.0,
            My_knm=10.0,
            le_x_m=3.0,
            le_y_m=3.0,
            support_condition="braced",
        )
        assert res["status"] == "pass"
        assert res["summary"]["column_type"] == "SHORT"
        assert res["summary"]["additional_moment_x_knm"] == 0.0
        # N_capacity = 0.4*fcu*Ac + 0.8*Asc*fy
        # Asc = 4 * pi * 8^2 = 804.2 mm2
        # Ac = 90000 - 804.2 = 89195.8 mm2
        # N_capacity = (0.4 * 25 * 89195.8 + 0.8 * 804.2 * 460) / 1000 = 1187.9 kN
        assert math.isclose(res["summary"]["axial_capacity_kn"], 1187.9, rel_tol=0.01)
        assert res["summary"]["axial_utilisation"] < 1.0

    def test_slender_column_additional_moments(self):
        # lex = 5.0m (le/h = 5000/300 = 16.67 >= 15 -> SLENDER)
        res = run_bs8110_column(
            b_mm=300.0,
            h_mm=300.0,
            cover_mm=30.0,
            bar_dia_mm=16.0,
            n_bars=4,
            fcu_mpa=25.0,
            fy_mpa=460.0,
            N_kn=600.0,
            Mx_knm=15.0,
            My_knm=10.0,
            le_x_m=5.0,
            le_y_m=5.0,
            support_condition="braced",
        )
        assert res["summary"]["column_type"] == "SLENDER"
        # Madd = N * (1/2000) * (le/h)^2 * h = 600 * (1/2000) * (16.67)^2 * 0.3 = 25.0 kNm
        assert math.isclose(res["summary"]["additional_moment_x_knm"], 25.0, rel_tol=0.02)


class TestMasonryBS5628:
    """Verifies BS 5628 masonry wall compressive resistance."""

    def test_wall_capacity(self):
        # 230mm brick wall, Class 3 brick, Mortar ii (fk = 4.0 MPa)
        res = run_masonry_wall(
            t_mm=230.0,
            h_m=3.0,
            L_m=4.0,
            load_type="udl",
            N_kn_m=120.0,
            M_knm_m=3.0,
            brick_class="3",
            mortar_designation="ii",
            wall_condition="normal",
            restraint_top="restrained",
            restraint_bottom="restrained",
        )
        assert res["status"] in ("pass", "fail")
        summary = res["summary"]
        assert summary["fk_mpa"] == 4.0
        # SR = 3000 * 0.75 / 230 = 9.78
        assert math.isclose(summary["slenderness_ratio"], 9.78, rel_tol=0.01)
        # Check costing ZMW
        assert summary["unit_rate_zmw"] == 1100.0
        assert summary["total_cost_zmw"] == 12 * 1100.0


class TestBlackCottonSoil:
    """Verifies expansive clay classification and Winkler raft properties."""

    def test_expansive_clay_assessment(self):
        res = run_black_cotton_assessment(
            LL_pct=55.0,
            PL_pct=20.0,
            PI_pct=35.0,
            swell_pressure_kpa=0.0,
            depth_to_rock_m=3.5,
            GWT_m=2.0,
            dry_unit_weight_knm3=15.0,
            proposed_foundation="raft",
            B_m=1.5,
            Df_m=1.0,
            soil_profile={
                "clay_content_pct": 50.0,
                "natural_moisture_pct": 18.0,
                "undrained_cohesion_kpa": 45.0,
                "column_load_kn": 180.0
            }
        )
        assert res["status"] == "pass"
        summary = res["summary"]
        assert "CH expansive clay" in summary["classification"]
        # ks = 40 * (2 * 45) = 3600 kPa/m
        assert summary["subgrade_modulus_ks_knm3"] == 3600.0
        # High PI (35 > 32) -> VERY HIGH risk
        assert summary["risk_level"] == "very_high"
        # Lime treatment target target > 2.0%
        assert summary["lime_treatment_pct"] > 3.0


class TestZambiaSite:
    """Verifies Zambia site intelligence coordinate routing and IDF curves."""

    def test_lusaka_lookup(self):
        res = get_zambia_site_data(lat=-15.42, lon=28.28)
        assert res["status"] == "ok"
        assert res["region"]["province"] == "Lusaka"
        assert res["region"]["province_slug"] == "lusaka"
        assert res["wind"]["zone_speed_ms"] == 30.0
        assert res["seismic"]["pga_g"] == 0.04
        assert res["soil_prior"]["expansion_risk"] in ("HIGH", "MODERATE", "LOW")

    def test_livingstone_lookup(self):
        res = get_zambia_site_data(lat=-17.85, lon=25.85)
        assert res["region"]["province"] == "Southern"
        assert res["wind"]["zone_speed_ms"] == 33.0
        assert res["seismic"]["pga_g"] == 0.04
        assert res["soil_prior"]["expansion_risk"] == "LOW"

    def test_ten_provinces_detected(self):
        from geo.zambia_provinces import PROVINCE_CENTROIDS, detect_province
        assert len(PROVINCE_CENTROIDS) == 10
        for slug in PROVINCE_CENTROIDS:
            lat, lon, _ = PROVINCE_CENTROIDS[slug]
            prov = detect_province(lat, lon)
            assert prov["slug"] == slug


class TestBoreholeDrawdown:
    """Verifies borehole lithology log depth and aquifer drawdown curves."""

    def test_borehole_design_and_pump(self):
        layers = [
            {"thickness_m": 5.0, "lithology": "Clay", "color": "Red"},
            {"thickness_m": 12.0, "lithology": "Sandstone", "color": "Grey"},
            {"thickness_m": 25.0, "lithology": "Granite", "color": "White"},
        ]
        res = run_borehole_design(
            layers=layers,
            q_design_lps=1.5,
            transmissivity_m2d=45.0,
            storage_coeff=0.0008,
            r_well_mm=100.0,
            pumping_duration_hr=12.0,
            static_water_level_m=18.0,
            friction_loss_m=1.2,
            minor_losses_m=0.3,
        )
        assert res["status"] == "pass"
        summary = res["summary"]
        # Total depth = 5 + 12 + 25 = 42 m
        assert summary["total_dynamic_head_m"] > 18.0 + 1.5
        assert "Lorentz" in summary["recommended_pump_size"] or "Grundfos" in summary["recommended_pump_size"]


class TestGravelRoad:
    """Verifies SATCC unsealed gravel road pavement thickness and Manning culverts."""

    def test_gravel_road_design(self):
        res = run_gravel_road_design(
            AADT=120.0,
            CBR_subgrade_pct=6.0,
            CBR_gravel_pct=40.0,
            design_period_years=10,
            traffic_growth_rate_pct=4.0,
            rainfall_zone="dry",
            terrain_type="flat",
        )
        assert res["status"] == "pass"
        summary = res["summary"]
        # E80s check
        assert summary["cumulative_e80s"] > 50000.0
        # Thickness: T = 3 * (30 - 6) = 72mm -> capped at 100mm and rounded to 25mm -> 100mm
        assert summary["wearing_course_thickness_mm"] == 100.0
        # Subgrade CBR >= 3 and < 7 -> Subbase = 150mm
        assert summary["subbase_thickness_mm"] == 150.0
        # Culvert recommended diameter should be positive
        assert summary["recommended_culvert_diameter_mm"] in (450, 600, 750, 900)


class TestLoadTakedown:
    """Verifies building load takedown and column/foundation schedule calculations."""

    def test_run_load_takedown(self):
        from calculations.structural.load_takedown import run_load_takedown
        building = {
            "floors": [
                {"level_m": 3.0, "slab_thickness_mm": 150.0, "imposed_kPa": 1.5, "finishes_kPa": 1.0, "partitions_kPa": 1.0, "grid_x_m": 4.0, "grid_y_m": 4.0}
            ],
            "walls": [],
            "columns": [
                {"grid_ref": "C1", "section_b": 300.0, "section_h": 300.0}
            ],
            "foundation": {"soil_bearing_capacity_kpa": 150.0}
        }
        res = run_load_takedown(building)
        assert res["status"] == "pass"
        assert res["total_concrete_m3"] > 0
        assert res["total_rebar_tonnes"] > 0
        assert len(res["column_schedule"]) == 1
        assert len(res["foundation_schedule"]) == 1
