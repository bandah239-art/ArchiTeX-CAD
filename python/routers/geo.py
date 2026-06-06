"""Geo-intelligence, geotechnical, and site analysis routes."""

from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from calculations.geo.bearing_capacity import calculate_bearing_capacity
from calculations.geo.settlement import calculate_settlement
from calculations.geo.slope_stability import calculate_slope_stability
from calculations.geo.site_classification import calculate_site_classification
from calculations.site.zambia_site_data import get_zambia_site_data
from calculations.geotechnical.black_cotton_soil import run_black_cotton_assessment
from calculations.core.engineer_control import wrap_calculation_result
from calculations.project import project_store
from geo.geo_intelligence import run_site_analysis
from geo.geocoder import geocode_search, reverse_geocode
from geo.site_budget import compute_site_budget
from geo.terrain_analyser import analyse_terrain
from geo.soil_intelligence import analyse_soil
from geo.climate_intelligence import analyse_climate
from geo.seismic_intelligence import analyse_seismic
from geo.site_report import generate_site_report, generate_site_report_pdf_bytes
from geo.geo_cache import cache_status, clear_cache
from geo.gis_engine import analyze_terrain as analyze_terrain_gis, TerrainAnalyticsRequest
from simulations.flood.d8_flood import simulate_flood_inundation
from calculators.geo_piles import calculate_piles, PilesRequest
from calculators.geo_slope import calculate_slope, SlopeRequest
from calculators.geo_consolidation import calculate_consolidation, ConsolidationRequest
from calculators.geo_ground_improvement import calculate_ground_improvement, GroundImprovementRequest
from calculators.geo_tunneling import calculate_tunneling, TunnelingRequest
from calculators.geo_simulations import (
    simulate_consolidation_settlement, ConsolidationSimRequest,
    simulate_slope_slip_circle, SlopeSlipRequest,
    simulate_pile_load_transfer, PileLoadTransferRequest,
)
from calculators.geo_more_simulations import (
    simulate_rmr_support, RMRSimRequest,
    simulate_ground_improvement_layout, GroundImprovSimRequest,
)

router = APIRouter(tags=["geo"])


# ── Pydantic models ───────────────────────────────────────────────────────────

class GeoBearingCapacityInput(BaseModel):
    soil_type: str = "sandy"
    foundation_width_m: float = 2.0
    foundation_length_m: float = 2.0
    foundation_depth_m: float = 1.2
    fos: float = 3.0
    use_custom_soil: bool = False
    cohesion_kpa: float = 0
    friction_angle_deg: float = 30
    unit_weight_knm3: float = 18


class GeoSettlementInput(BaseModel):
    applied_pressure_kpa: float = 150.0
    foundation_width_m: float = 2.0
    poissons_ratio: float = 0.3
    elastic_modulus_kpa: float = 20000.0
    shape_factor_is: float = 1.0
    calc_consolidation: bool = True
    compression_index_cc: float = 0.3
    clay_layer_thickness_m: float = 5.0
    initial_void_ratio_e0: float = 0.8
    initial_effective_stress_kpa: float = 50.0
    stress_increase_kpa: float = 75.0
    allowable_settlement_mm: float = 25.0


class GeoSlopeStabilityInput(BaseModel):
    slices: list[dict[str, Any]] = Field(default_factory=list)


class GeoSiteClassificationInput(BaseModel):
    spt_n: float = 15
    energy_ratio: float = 60
    borehole_diam_mm: float = 100
    sampler_type: str = "standard"
    rod_length_m: float = 5.0
    effective_stress_kpa: float = 50.0
    pga_g: float = 0.15
    magnitude: float = 7.5


class GeoSiteInput(BaseModel):
    latitude: float
    longitude: float
    country_code: str = "ZM"
    project_name: str = "Site Analysis"
    analysis_radius_km: float = Field(5.0, gt=0)
    platform_area_m2: float = Field(400, gt=0)
    use_cache: bool = True
    offline_only: bool = False


class GeoGeocodeInput(BaseModel):
    query: str = Field(..., min_length=2)


class GeoReverseInput(BaseModel):
    latitude: float
    longitude: float


class GeoSiteBudgetInput(BaseModel):
    latitude: float
    longitude: float
    country_code: str = "ZM"
    project_name: str = "Site Budget"
    project_type: str = "residential"
    gfa_m2: float = Field(142, gt=0)
    platform_area_m2: float = Field(400, gt=0)
    use_cache: bool = True
    offline_only: bool = False


class GeoTerrainInput(BaseModel):
    latitude: float
    longitude: float
    platform_area_m2: float = Field(400, gt=0)


class GeoSoilInput(BaseModel):
    latitude: float
    longitude: float
    country_code: str = "ZM"
    elevation_m: float = 0


class GeoClimateInput(BaseModel):
    latitude: float
    longitude: float


class GeoSeismicInput(BaseModel):
    latitude: float
    longitude: float
    country_code: str = "ZM"


class GeoReportInput(BaseModel):
    latitude: float
    longitude: float
    country_code: str = "ZM"
    project_name: str = "Site Report"


class ZambiaSiteInputs(BaseModel):
    latitude: float
    longitude: float


class FloodInputs(BaseModel):
    grid_size: int = Field(64, ge=16, le=256)
    cell_size_m: float = Field(30, gt=0)
    rainfall_mm: float = Field(80, gt=0)
    catchment_area_km2: float = Field(2.5, gt=0)
    return_period_years: int = Field(100, ge=2)


class BlackCottonInputs(BaseModel):
    LL_pct: float = Field(55, ge=0)
    PL_pct: float = Field(22, ge=0)
    PI_pct: float = Field(33, ge=0)
    swell_pressure_kpa: float = Field(0, ge=0)
    depth_to_rock_m: float = Field(3.5, ge=0)
    GWT_m: float = Field(2.5, ge=0)
    dry_unit_weight_knm3: float = Field(15.5, ge=0)
    proposed_foundation: str = "raft"
    B_m: float = 1.5
    Df_m: float = 1.0
    soil_profile: dict[str, Any] = Field(default_factory=dict)
    project_id: str = "default"


# ── Basic geotechnical calcs ──────────────────────────────────────────────────

@router.post("/geo/bearing-capacity")
def geo_bearing_capacity_endpoint(inputs: GeoBearingCapacityInput):
    try:
        return wrap_calculation_result(calculate_bearing_capacity(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/geo/settlement")
def geo_settlement_endpoint(inputs: GeoSettlementInput):
    try:
        return wrap_calculation_result(calculate_settlement(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/geo/slope-stability")
def geo_slope_stability_endpoint(inputs: GeoSlopeStabilityInput):
    try:
        return wrap_calculation_result(calculate_slope_stability(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/geo/site-classification")
def geo_site_classification_endpoint(inputs: GeoSiteClassificationInput):
    try:
        return wrap_calculation_result(calculate_site_classification(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Geo-intelligence (site analysis) ─────────────────────────────────────────

@router.post("/geo/site-analysis")
def geo_site_analysis(inputs: GeoSiteInput):
    try:
        return run_site_analysis(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/geo/geocode")
def geo_geocode(inputs: GeoGeocodeInput):
    try:
        return {"results": geocode_search(inputs.query)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/geo/reverse-geocode")
def geo_reverse_geocode(inputs: GeoReverseInput):
    try:
        return reverse_geocode(inputs.latitude, inputs.longitude)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/geo/site-budget")
def geo_site_budget(inputs: GeoSiteBudgetInput):
    try:
        return compute_site_budget(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/geo/terrain")
def geo_terrain(inputs: GeoTerrainInput):
    try:
        return analyse_terrain(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/geo/soil")
def geo_soil(inputs: GeoSoilInput):
    try:
        return analyse_soil(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/geo/climate")
def geo_climate(inputs: GeoClimateInput):
    try:
        return analyse_climate(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/geo/seismic")
def geo_seismic(inputs: GeoSeismicInput):
    try:
        return analyse_seismic(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/geo/site-report")
def geo_site_report(inputs: GeoReportInput):
    try:
        return generate_site_report(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/geo/site-report/download")
def geo_site_report_download(inputs: GeoReportInput):
    """Return site intelligence report as downloadable PDF (or HTML fallback)."""
    try:
        data, media_type = generate_site_report_pdf_bytes(inputs.model_dump())
        ext = "pdf" if media_type == "application/pdf" else "html"
        return Response(
            content=data,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename=site_intelligence_report.{ext}"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/geo/cache/status")
def geo_cache_status():
    return cache_status()


@router.post("/geo/cache/clear")
def geo_cache_clear():
    return {"cleared": clear_cache()}


@router.post("/geo/terrain-analytics")
def geo_terrain_analytics_endpoint(req: TerrainAnalyticsRequest):
    try:
        return analyze_terrain_gis(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Advanced geotechnical calculators ────────────────────────────────────────

@router.post("/geo/piles")
def geo_piles_endpoint(req: PilesRequest):
    try:
        return calculate_piles(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/geo/slope")
def geo_slope_endpoint(req: SlopeRequest):
    try:
        return calculate_slope(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/geo/consolidation")
def geo_consolidation_endpoint(req: ConsolidationRequest):
    try:
        return calculate_consolidation(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/geo/ground-improvement")
def geo_ground_improvement_endpoint(req: GroundImprovementRequest):
    try:
        return calculate_ground_improvement(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/geo/tunneling")
def geo_tunneling_endpoint(req: TunnelingRequest):
    try:
        return calculate_tunneling(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Geo simulations ───────────────────────────────────────────────────────────

@router.post("/geo/simulation/consolidation")
def geo_consolidation_sim_endpoint(req: ConsolidationSimRequest):
    try:
        return simulate_consolidation_settlement(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/geo/simulation/slope-slip-circle")
def geo_slope_sim_endpoint(req: SlopeSlipRequest):
    try:
        return simulate_slope_slip_circle(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/geo/simulation/pile-load-transfer")
def geo_pile_sim_endpoint(req: PileLoadTransferRequest):
    try:
        return simulate_pile_load_transfer(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/geo/simulation/rmr-support")
def geo_rmr_sim_endpoint(req: RMRSimRequest):
    try:
        return simulate_rmr_support(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/geo/simulation/ground-improvement-layout")
def geo_ground_sim_endpoint(req: GroundImprovSimRequest):
    try:
        return simulate_ground_improvement_layout(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Flood simulation & Zambia site data ──────────────────────────────────────

@router.post("/simulate/flood")
def simulate_flood_endpoint(inputs: FloodInputs):
    try:
        return simulate_flood_inundation(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/site/zambia-data")
def site_zambia_data_endpoint(inputs: ZambiaSiteInputs):
    try:
        return get_zambia_site_data(inputs.latitude, inputs.longitude)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Black Cotton Soil ─────────────────────────────────────────────────────────

@router.post("/geotechnical/black-cotton")
def geotechnical_black_cotton_endpoint(inputs: BlackCottonInputs):
    try:
        res = run_black_cotton_assessment(
            LL_pct=inputs.LL_pct,
            PL_pct=inputs.PL_pct,
            PI_pct=inputs.PI_pct,
            swell_pressure_kpa=inputs.swell_pressure_kpa,
            depth_to_rock_m=inputs.depth_to_rock_m,
            GWT_m=inputs.GWT_m,
            dry_unit_weight_knm3=inputs.dry_unit_weight_knm3,
            proposed_foundation=inputs.proposed_foundation,
            B_m=inputs.B_m,
            Df_m=inputs.Df_m,
            soil_profile=inputs.soil_profile,
        )
        project_store.save_calculation(inputs.project_id, "black_cotton", inputs.model_dump(), res)
        return wrap_calculation_result(res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Phase 2 Enhanced Geotechnical Calculators ─────────────────────────────────

@router.post("/geo/bearing-capacity/enhanced")
def geo_bearing_capacity_enhanced_endpoint(inputs: dict):
    """Bearing capacity: Terzaghi + Meyerhof (inclination) + Hansen (complete),
    eccentric effective area, water table correction, layered soil check."""
    try:
        from calculations.geo.bearing_capacity_enhanced import calculate_bearing_capacity_enhanced
        from calculations.core.engineer_control import wrap_calculation_result as wrap
        return wrap(calculate_bearing_capacity_enhanced(inputs))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/geo/settlement/enhanced")
def geo_settlement_enhanced_endpoint(inputs: dict):
    """Settlement: elastic immediate (Janbu) + Terzaghi 1D consolidation,
    time-settlement T50/T90/T99 curve, secondary Cα, differential check."""
    try:
        from calculations.geo.settlement_enhanced import calculate_settlement_enhanced
        from calculations.core.engineer_control import wrap_calculation_result as wrap
        return wrap(calculate_settlement_enhanced(inputs))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/geo/black-cotton/enhanced")
def geo_black_cotton_enhanced_endpoint(inputs: dict):
    """Black Cotton Soil: swell pressure (Komornik & David), GPS zone detection,
    lime stabilisation 3/5/7% UCS comparison, ZMW treatment cost."""
    try:
        from calculations.geotechnical.black_cotton_enhanced import calculate_black_cotton_assessment_enhanced
        from calculations.core.engineer_control import wrap_calculation_result as wrap
        return wrap(calculate_black_cotton_assessment_enhanced(inputs))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
