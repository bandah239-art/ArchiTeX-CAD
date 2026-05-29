from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from typing import Any
from datetime import datetime, timezone

from calculations.structural.beam import calculate_beam
from calculations.structural.slab import calculate_slab
from calculations.structural.column import calculate_column
from calculations.structural.foundation import calculate_foundation
from calculations.structural.bs8110_beam import run_bs8110_beam
from calculations.structural.bs8110_slab import run_bs8110_slab
from calculations.structural.bs8110_column import run_bs8110_column
from calculations.structural.masonry_bs5628 import run_masonry_wall
from calculations.geotechnical.black_cotton_soil import run_black_cotton_assessment
from calculations.roads.gravel_road import run_gravel_road_design
from calculations.site.zambia_site_data import get_zambia_site_data
from calculations.geotechnical.borehole import run_borehole_design
from calculations.project import project_store
from calculations.reporting.eiz_memo import default_memo_date, generate_eiz_memo, normalize_calculation_sections
from calculations.structural.bearings import calculate_bearing
from calculations.structural.steel import calculate_steel_beam
from calculations.structural.timber import calculate_timber_beam
from calculations.fea.solver_2d import run_fea_calculation
from data.african_conditions import apply_local_adjustments
from calculations.loads.load_combinations import calculate_loads, generate_load_combinations
from calculations.core.engineer_control import wrap_calculation_result
from calculations.core.calculation_db import save_review, save_reviews_batch, load_reviews
from reports.pdf_renderer import render_calculation_pdf
from calculations.pressure.foundation_bearing import calculate_foundation_bearing
from calculations.pressure.lateral_earth import calculate_lateral_earth
from calculations.pressure.wind_distribution import calculate_wind_distribution
from calculations.pressure.boussinesq import calculate_boussinesq
from calculations.pressure.bridge_hydrostatic import calculate_bridge_hydrostatic
from calculations.pressure.bridge_hydrodynamic import calculate_bridge_hydrodynamic
from calculations.pressure.bridge_foundation import calculate_bridge_foundation
from calculations.pressure.pavement_pressure import calculate_pavement_pressure
from calculations.pressure.pipe_pressure import calculate_pipe_pressure
from calculations.pressure.tank_pressure import calculate_tank_pressure
from calculations.pressure.consolidation import calculate_consolidation
from calculations.loads.wind_loads import calculate_wind_loads
from calculations.roads.flexible_pavement import calculate_pavement
from calculations.roads.hydrology import calculate_drainage
from calculations.roads.geometric_design import calculate_geometric_design
from calculations.roads.traffic_load import calculate_traffic_load
from calculations.materials.selector import recommend_material
from data.african_conditions import apply_local_adjustments

from vision.image_processor import process_image
from vision.structure_analyser import analyse_structure
from vision.multi_image_analyser import analyse_multi_image
from vision.cad_generator import CADGenerator
from vision.report_generator import generate_markdown_report

from boq.quantity_extractor import extract_quantities
from boq.boq_compiler import compile_boq
from boq.excel_generator import generate_boq_excel_bytes
from boq.pdf_generator import generate_boq_pdf_bytes
from geo.geo_intelligence import run_site_analysis
from geo.geocoder import geocode_search, reverse_geocode
from geo.site_budget import compute_site_budget
from geo.terrain_analyser import analyse_terrain
from geo.soil_intelligence import analyse_soil
from geo.climate_intelligence import analyse_climate
from geo.seismic_intelligence import analyse_seismic
from geo.site_report import generate_site_report
from bim.ifc_to_boq import extract_from_bim
from bim.ifc_geometry import parse_ifc_file, parse_ifc_bytes, HAS_IFCOPENSHELL
from bim.cad_parser import parse_cad_file, parse_cad_bytes, _cad_status as cad_parser_status
from bim.ifc_export import export_ifc_from_elements
from bim.geometry_kernel import boolean_operation, mesh_intersection_volume, region_boolean
from bim.geometry_extensions import (
    extensions_status,
    polygon_area,
    polygon_contains,
    polyline_length,
    transform_point,
    flatten_xy,
)
from bim.autocad_bridge import autocad_bridge_status, export_dwg_geometry
from bim.plan_detection import extract_plan_takeoff
from geo.geo_cache import cache_status, clear_cache
from ai.design_generator import generate_design
from ai.gemini_client import call_gemini, call_gemini_chat, CHAT_SYSTEM
from ai.proposal_generator import generate_proposal
from ai.text_to_bim import generate_bim_from_text
from ai.voice_agent import process_voice_command
from real_estate.plot_valuation import value_plot
from real_estate.feasibility import run_feasibility
from real_estate.land_use_optimiser import optimise_land_use
from real_estate.mortgage import calculate_mortgage
from government.dashboard_engine import portfolio_summary
from government.portfolio_database import (
    add_snapshot,
    add_variation,
    create_project,
    init_db,
    list_projects,
    seed_demo_projects,
    update_project,
)
from government.project_tracker import (
    cashflow_projection,
    generate_s_curve,
    get_project_detail,
)
from government.payment_certificates import generate_certificate
from government.reporting_engine import generate_report
from documents.tender_generator import generate_tender
from documents.calculation_report import generate_calculation_report
from documents.eia_screening import screen_eia
from sync.mobile_sync import list_sync_items, receive_sync_item
from mobile.quick_calculators import concrete_mix, quick_beam_check, rebar_weight
from calculations.wash.water_demand import calculate_water_demand

from calculators.energy_bess import calculate_bess, BessRequest
from calculators.energy_microgrid import calculate_voltage_drop, MicrogridRequest
from calculators.energy_transmission import calculate_sag_tension, TransmissionRequest
from calculators.energy_hydro import calculate_hydro, HydroRequest
from calculators.energy_biogas import calculate_biogas, BiogasRequest
from calculators.energy_wind_wake import calculate_wind_wake, WindWakeRequest
from calculators.energy_grid_fault import calculate_grid_fault, GridFaultRequest

from calculators.wash_water_tower import calculate_water_tower, WaterTowerRequest
from calculators.wash_epanet import calculate_pipe_network, PipeNetworkRequest
from calculators.wash_dewats import calculate_dewats, DewatsRequest
from calculators.wash_wtp import calculate_wtp, WTPRequest
from calculators.wash_stormwater import calculate_stormwater, StormwaterRequest
from calculators.wash_landfill import calculate_landfill, LandfillRequest
from calculators.wash_irrigation import calculate_irrigation, IrrigationRequest

# New Engines
from geo.gis_engine import analyze_terrain, TerrainAnalyticsRequest
from calculators.energy_power_flow import run_power_flow, PowerFlowRequest
from calculators.market_pricing import get_live_pricing, PricingRequest

from calculators.geo_piles import calculate_piles, PilesRequest
from calculators.geo_slope import calculate_slope, SlopeRequest
from calculators.geo_consolidation import calculate_consolidation, ConsolidationRequest
from calculators.geo_ground_improvement import calculate_ground_improvement, GroundImprovementRequest
from calculators.geo_tunneling import calculate_tunneling, TunnelingRequest
from calculators.energy_simulations import (
    simulate_solar_battery_day, SolarBatteryDayRequest,
    simulate_wind_wake_map, WindWakeMapRequest,
    simulate_hydro_curve, HydroCurveRequest,
)
from calculators.geo_simulations import (
    simulate_consolidation_settlement, ConsolidationSimRequest,
    simulate_slope_slip_circle, SlopeSlipRequest,
    simulate_pile_load_transfer, PileLoadTransferRequest,
)
from calculators.wash_simulations import (
    simulate_water_tower_day, WaterTowerDayRequest,
    simulate_pipe_pressure_profile, PipePressureRequest,
)
from calculators.structural_simulations import (
    simulate_beam_bmd_sfd, BeamSimRequest,
    simulate_foundation_pressure, FoundationPressureRequest,
)
from calculators.energy_extended_simulations import (
    simulate_voltage_drop_profile, VoltageDropRequest,
    simulate_biogas_yield_curve, BiogasYieldRequest,
    simulate_conductor_catenary, CatenaryRequest,
    simulate_fault_current_decay, FaultDecayRequest,
)
from calculators.structural_more_simulations import (
    simulate_slab_moments, SlabSimRequest,
    simulate_pm_interaction, PMSimRequest,
    simulate_wind_facade, WindFacadeRequest,
)
from calculators.road_simulations import (
    simulate_pavement_stress, PavementStressRequest,
    simulate_esal_growth, ESALGrowthRequest,
    simulate_stormwater_hydrograph, HydrographRequest,
)
from calculators.geo_more_simulations import (
    simulate_rmr_support, RMRSimRequest,
    simulate_ground_improvement_layout, GroundImprovSimRequest,
)
from calculators.environment_simulations import (
    simulate_landfill_gas, LandfillGasRequest,
    simulate_soil_moisture, SoilMoistureRequest,
    simulate_tank_hoop_stress, TankHoopRequest,
)
from calculations.fea.modal_analysis import run_modal_analysis
from calculations.seismic.response_spectrum import run_seismic_spectrum, modal_seismic_response
from calculations.structural.crack_width import run_crack_width
from calculations.structural.winkler import run_winkler
from calculations.structural.fire_and_anchorage import (
    check_beam_fire, check_slab_fire, check_column_fire,
    anchorage_length, lap_length,
)
from calculations.wash.water_hammer import run_water_hammer
from calculations.circuit.spice_solver import solve_dc, solve_ac_sweep, solve_transient
from calculations.wind.panel_method import run_panel_cfd, building_shapes
from calculations.power.short_circuit import run_short_circuit
from calculations.power.protection import grading_chart
from calculations.power.harmonics import harmonic_spectrum
from calculations.wash.borehole import calculate_borehole
from calculations.wash.sewer_design import calculate_sewer_design
from calculations.wash.pipe_network import analyze_pipe_network
from calculations.wash.treatment_plant import calculate_treatment_plant
from calculations.geo.bearing_capacity import calculate_bearing_capacity
from calculations.geo.settlement import calculate_settlement
from calculations.geo.slope_stability import calculate_slope_stability
from calculations.geo.site_classification import calculate_site_classification
from calculations.energy.solar_pv import calculate_solar_pv
from calculations.energy.battery_storage import calculate_battery
from collaboration.room_manager import handle_message, join_room, leave_room, room_status
from collaboration.ws_manager import register, unregister, broadcast
from calculations.sustainability.carbon import calculate_construction_carbon, calculate_carbon_credits
from simulations.flood.d8_flood import simulate_flood_inundation
from intelligence.digital_twin import get_asset, ingest_reading, list_assets, register_asset, seed_demo_assets
from intelligence.predictive_maintenance import analyse_asset, analyse_portfolio
from scheduling.construction_4d import build_schedule_from_bim
from cache.calc_cache import cache_status as calc_cache_status, clear_cache as clear_calc_cache, get_cached, set_cached
from cache.project_cache import load_project_meta, save_project_meta
from documents.esg_report import generate_esg_report
from emerging.platform import (
    ar_mobile_scene,
    blockchain_anchor,
    cv_safety_scan,
    disaster_response_plan,
    drone_photogrammetry,
    marketplace_listings,
    satellite_analysis,
    voice_command,
)
from simulations.thermal.thermal_building import simulate_thermal
from simulations.seismic.seismic_response import simulate_seismic_response
from calculations.generative.optimizer import optimize_structural_layout, optimize_solar_orientation
from sync.desktop_sync import process_sync_batch

app = FastAPI(
    title="ARCHITEX-CAD Calculation Engine",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS — desktop Electron renderer + local dev only
_ALLOWED_ORIGINS = [
    "http://localhost:5173",   # Vite dev
    "http://localhost:4173",   # Vite preview
    "http://127.0.0.1:5173",
    "http://127.0.0.1:4173",
    "app://.",                 # Electron production renderer
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
)

# Security headers for all responses
@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store"
    return response

from cad.occ_routes import router as occ_router
from routers.government import router as government_router
from routers.real_estate import router as real_estate_router
from routers.intelligence import router as intelligence_router
from routers.documents import router as documents_router
from routers.emerging import router as emerging_router

app.include_router(occ_router)
app.include_router(government_router)
app.include_router(real_estate_router)
app.include_router(intelligence_router)
app.include_router(documents_router)
app.include_router(emerging_router)


class FeaInputs(BaseModel):
    model_config = {"extra": "allow"}
    height: float = Field(4.0, gt=0, description="Column height in metres")
    span: float = Field(6.0, gt=0, description="Beam span in metres")
    lateral_load: float = Field(20000.0, description="Lateral point load at top-left joint in N")
    vertical_load: float = Field(-50000.0, description="Vertical point load at top-right joint in N")
    support_type: str = Field("fixed", description="Support conditions: fixed or pinned")
    E: float = Field(2.0e11, gt=0, description="Elastic modulus in Pa")
    A: float = Field(0.01, gt=0, description="Cross-sectional area in m²")
    I: float = Field(1.0e-5, gt=0, description="Second moment of area in m⁴")


class BeamInputs(BaseModel):
    model_config = {"extra": "allow"}
    span: float = Field(..., gt=0, description="Span in metres")
    dead_load: float = Field(..., ge=0, description="Dead load kN/m")
    live_load: float = Field(..., ge=0, description="Live/imposed load kN/m")
    width: float = Field(..., gt=0, description="Beam width mm")
    depth: float = Field(..., gt=0, description="Beam depth mm")
    fck: float = Field(30, gt=0, description="Concrete grade MPa")
    fyk: float = Field(500, gt=0, description="Steel grade MPa")
    support_condition: str = "simply_supported"
    exposure_class: str = "XC1"
    design_code: str = "Eurocode2"
    country: str = "Zambia"


class SlabInputs(BaseModel):
    model_config = {"extra": "allow"}
    slab_type: str = "two_way"
    span_lx: float = Field(..., gt=0, description="Short span in metres")
    span_ly: float = Field(..., gt=0, description="Long span in metres")
    dead_load: float = Field(..., ge=0, description="Dead load kN/m²")
    live_load: float = Field(..., ge=0, description="Live load kN/m²")
    depth: float = Field(..., gt=0, description="Slab depth mm")
    # fck/fyk have defaults; frontend may send fcu_mpa/fy_mpa instead (handled in endpoint)
    fck: float = Field(25.0, gt=0, description="Concrete characteristic strength MPa")
    fyk: float = Field(460.0, gt=0, description="Steel characteristic strength MPa")
    support_condition: str = "simply_supported"
    country: str = "Zambia"


class ColumnInputs(BaseModel):
    model_config = {"extra": "allow"}
    height: float = Field(..., gt=0, description="Column height in metres")
    width: float = Field(..., gt=0, description="Column width in mm")
    depth: float = Field(..., gt=0, description="Column depth in mm")
    axial_load: float = Field(..., gt=0, description="Axial load kN")
    moment_major: float = Field(0, ge=0, description="Major axis moment kNm")
    moment_minor: float = Field(0, ge=0, description="Minor axis moment kNm")
    # fck/fyk have defaults; frontend may send fcu_mpa/fy_mpa instead (handled in endpoint)
    fck: float = Field(25.0, gt=0, description="Concrete characteristic strength MPa")
    fyk: float = Field(460.0, gt=0, description="Steel characteristic strength MPa")
    le_factor: float = Field(1.0, gt=0, description="Effective length factor")
    country: str = "Zambia"


class MasonryInputs(BaseModel):
    width: float = Field(..., gt=0, description="Wall thickness mm")
    height: float = Field(..., gt=0, description="Wall height m")
    length: float = Field(..., gt=0, description="Wall length m")
    load_type: str = "udl"
    axial_load: float = Field(..., ge=0, description="Design load kN/m")
    moment: float = Field(0.0, ge=0, description="Design moment kNm/m")
    brick_class: str = "3"
    mortar_designation: str = "ii"
    wall_condition: str = "normal"
    restraint_top: str = "restrained"
    restraint_bottom: str = "restrained"
    openings: bool = False
    project_id: str = "default"


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


class GravelRoadInputs(BaseModel):
    AADT: float = Field(200, ge=0)
    CBR_subgrade_pct: float = Field(5, ge=0)
    CBR_gravel_pct: float = Field(30, ge=0)
    design_period_years: int = Field(10, ge=1)
    traffic_growth_rate_pct: float = Field(3.5, ge=0)
    rainfall_zone: str = "dry"
    terrain_type: str = "flat"
    road_width_m: float = 6.0
    road_length_km: float = 1.0
    project_id: str = "default"


class ZambiaSiteInputs(BaseModel):
    latitude: float
    longitude: float


class ProjectSaveInputs(BaseModel):
    id: str
    name: str
    location: str = ""
    engineer: str = ""
    eiz_number: str = ""
    client: str = ""
    created_date: str = ""


class CalcSaveInputs(BaseModel):
    project_id: str
    module: str
    inputs: dict[str, Any]
    outputs: dict[str, Any]



class FoundationInputs(BaseModel):
    foundation_type: str = Field("pad", pattern="^(pad|strip|raft)$")
    column_load: float = Field(..., gt=0, description="Column load kN")
    moment_x: float = Field(0, ge=0, description="Moment about X kNm")
    moment_y: float = Field(0, ge=0, description="Moment about Y kNm")
    soil_bearing: float = Field(..., gt=0, description="Allowable soil bearing kN/m²")
    soil_unit_weight: float = Field(18, gt=0, description="Soil unit weight kN/m³")
    foundation_depth: float = Field(..., gt=0, description="Foundation embedment depth m")
    foundation_width: float = Field(1.0, gt=0, description="Foundation width m (strip)")
    foundation_length: float = Field(1.0, gt=0, description="Foundation length m")
    foundation_depth_concrete: float = Field(400, gt=0, description="Concrete thickness mm")
    fck: float = Field(25, gt=0, description="Concrete grade MPa")
    fyk: float = Field(500, gt=0, description="Steel grade MPa")
    column_width: float = Field(300, gt=0, description="Column width mm")
    column_depth: float = Field(300, gt=0, description="Column depth mm")
    exposure_class: str = "XC1"
    country: str = "Zambia"


class SteelInputs(BaseModel):
    length: float = Field(..., gt=0, description="Member length in metres")
    fy: float = Field(275, gt=0, description="Yield strength in MPa")
    w: float = Field(20, ge=0, description="Design line load in kN/m")
    Wpl: float = Field(721, gt=0, description="Plastic section modulus in cm^3")
    Aw: float = Field(22.8, gt=0, description="Web area in cm^2")


class TimberInputs(BaseModel):
    length: float = Field(..., gt=0, description="Span/length in metres")
    b: float = Field(..., gt=0, description="Section width in mm")
    h: float = Field(..., gt=0, description="Section depth in mm")
    fm_k: float = Field(24, gt=0, description="Characteristic bending strength in MPa")
    fv_k: float = Field(4.0, gt=0, description="Characteristic shear strength in MPa")
    E0_mean: float = Field(11000, gt=0, description="Mean modulus of elasticity in MPa")
    k_mod: float = Field(0.8, gt=0, description="Modification factor")
    w: float = Field(5, ge=0, description="Design line load in kN/m")
    w_sls: float = Field(3.5, ge=0, description="Serviceability line load in kN/m")


class LoadInputs(BaseModel):
    model_config = {"extra": "allow"}
    dead_load_g: float = Field(..., ge=0, description="Dead load Gk")
    imposed_load_q: float = Field(..., ge=0, description="Imposed load Qk")
    wind_load_w: float = Field(0, ge=0, description="Wind load Wk")
    snow_load_s: float = Field(0, ge=0, description="Snow load Sk")
    load_type: str = Field("udl")
    design_code: str = Field("eurocode")
    structure_class: str = Field("ordinary")


class LoadCombinationsInput(BaseModel):
    gk: float = Field(..., ge=0, description="Permanent load Gk")
    qk: float = Field(..., ge=0, description="Variable load Qk")
    wk: float = Field(0, ge=0, description="Wind load Wk")
    ek: float = Field(0, ge=0, description="Seismic load Ek")
    code: str = Field("EC0", description="EC0 | ACI318 | BS8110")
    unit: str = Field("kN/m", description="Result unit")


class PavementInputs(BaseModel):
    road_class: str = Field("secondary", pattern="^(trunk|primary|secondary|feeder)$")
    traffic_count: float = Field(..., gt=0, description="AADT vehicles/day")
    heavy_vehicle_pct: float = Field(12.0, ge=0, le=100)
    design_life: int = Field(20, gt=0)
    cbr_subgrade: float = Field(6.0, gt=0)
    subbase_material: str = Field("natural_gravel")
    base_material: str = Field("crushed_stone")
    climate_zone: str = Field("semi_arid")
    country: str = Field("Zambia")


class DrainageInputs(BaseModel):
    catchment_area: float = Field(..., gt=0, description="Catchment area ha")
    rainfall_intensity: float = Field(0, ge=0, description="Rainfall intensity mm/hr")
    runoff_coefficient: float = Field(0.6, gt=0, le=1.0)
    pipe_gradient: float = Field(1.5, gt=0, description="Gradient in %")
    pipe_material: str = Field("concrete")
    pipe_length: float = Field(100.0, gt=0)
    country: str = Field("Zambia")
    region: str = Field("")


class GeometricDesignInputs(BaseModel):
    design_speed_kmh: float = 80
    radius_m: float = 300
    max_superelevation_pct: float = 8.0
    side_friction_factor: float = 0.14


class TrafficLoadInputs(BaseModel):
    aadt: float = 1000
    growth_rate_pct: float = 4.0
    design_life_yrs: float = 20
    truck_pct: float = 10.0
    bus_pct: float = 5.0
    vdf_truck: float = 3.0
    vdf_bus: float = 1.2
    directional_split: float = 0.5
    lane_factor: float = 1.0


class ExtractQuantitiesInput(BaseModel):
    calculation_type: str = Field(..., pattern="^(beam|slab|column|foundation|road)$")
    calculation_result: dict[str, Any]
    element_dimensions: dict[str, float] = Field(default_factory=dict)
    element_count: int = Field(1, ge=1)
    project_id: str = ""
    ref: str = "1"
    description: str = ""
    calculation_inputs: dict[str, Any] = Field(default_factory=dict)


class BoQCompileInput(BaseModel):
    project_id: str = ""
    project_name: str = "Untitled Project"
    client: str = ""
    country_code: str = "ZM"
    currency_display: str = "USD"
    contractor_overhead: float = Field(15, ge=0)
    contractor_profit: float = Field(10, ge=0)
    contingency: float = Field(10, ge=0)
    elements: list[dict[str, Any]]


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


class BimExtractInput(BaseModel):
    elements: list[dict[str, Any]]
    project_id: str = ""
    source: str = "ifc"


class BimParsePathInput(BaseModel):
    path: str


class GeometryBooleanInput(BaseModel):
    operation: str = "intersection"
    mesh_a: dict[str, Any] = Field(default_factory=dict)
    mesh_b: dict[str, Any] = Field(default_factory=dict)


class RegionBooleanInput(BaseModel):
    operation: str = "intersection"
    polygons_a: list[list[list[float]]] = Field(default_factory=list)
    polygons_b: list[list[list[float]]] = Field(default_factory=list)


class PolygonVerticesInput(BaseModel):
    vertices: list[list[float]] = Field(default_factory=list)
    point: list[float] | None = None


class PolylineLengthInput(BaseModel):
    segments: list[dict[str, Any]] = Field(default_factory=list)


class TransformPointInput(BaseModel):
    matrix: list[float] = Field(default_factory=list)
    point: list[float] = Field(default_factory=list)


class DwgExportInput(BaseModel):
    path: str = ""
    elements: list[dict[str, Any]] = Field(default_factory=list)


class ScheduleBuildInput(BaseModel):
    project_name: str = "Project"
    duration_weeks: int = 52
    elements: list[dict[str, Any]] = Field(default_factory=list)


class BearingInputs(BaseModel):
    bearing_type: str = Field("elastomeric", pattern="^(pad|elastomeric|pot|roller)$")
    vertical_load: float = Field(800, gt=0)
    horizontal_load: float = Field(40, ge=0)
    rotation: float = Field(0.01, ge=0)
    span: float = Field(15, gt=0)
    material: str = Field("concrete", pattern="^(concrete|steel|masonry)$")
    fck: float = Field(30, gt=0)
    bearing_width: float = Field(300, gt=0)
    column_width: float = Field(200, gt=0)
    pad_thickness: float = Field(20, gt=0)
    sigma_allow: float = Field(10.0, gt=0)
    horizontal_movement_mm: float = Field(40.0, ge=0)
    layer_thickness_mm: float = Field(10.0, ge=0)
    weight_steel: float = 1.0
    weight_cost: float = 1.5
    weight_deflection: float = 0.1
    max_iterations: int = Field(200, ge=10, le=1000)


class MaterialSelectorInputs(BaseModel):
    structure_type: str = Field("beam", pattern="^(beam|column|slab|wall|foundation|bridge|roof|truss)$")
    span: float = Field(5.0, gt=0)
    load: float = Field(10.0, gt=0)
    exposure: str = Field("internal", pattern="^(internal|external|aggressive|marine)$")
    budget: str = Field("medium", pattern="^(low|medium|high)$")
    availability: str = Field("Zambia")

class VisionImageInput(BaseModel):
    image_base64: str
    image_source: str = "mobile"
    gps_latitude: float | None = None
    gps_longitude: float | None = None
    structure_hint: str | None = None
    country_code: str = "ZM"
    project_id: str | None = None

class VisionMultiImageInput(BaseModel):
    images: list[str]
    metadata: dict = {}
    geo_context: dict = {}

class OptimizerInput(BaseModel):
    floor_area_m2: float = Field(400, gt=0)
    span_min_m: float = Field(4, gt=0)
    span_max_m: float = Field(12, gt=0)
    n_spans_min: int = Field(2, ge=1)
    n_spans_max: int = Field(8, ge=1)
    weight_steel: float = 1.0
    weight_cost: float = 1.5
    weight_deflection: float = 0.1
    max_iterations: int = Field(200, ge=10, le=1000)


class SolarOptimizerInput(BaseModel):
    latitude: float = -15.4
    longitude: float = 28.3
    roof_area_m2: float = Field(80, gt=0)
    n_trials: int = Field(100, ge=10, le=500)


class SeismicAnalysisInput(BaseModel):
    analysis_type: str = Field("modal", pattern="^(modal|time_history|pushover)$")
    pga_g: float = Field(0.15, gt=0)
    n_storeys: int = Field(4, ge=1, le=30)
    storey_height_m: float = Field(3.0, gt=0)
    bay_width_m: float = Field(6.0, gt=0)
    n_bays: int = Field(3, ge=1)
    site_class: str = "B"
    mass_t: float = Field(500, gt=0)


class SyncBatchInput(BaseModel):
    operations: list[dict[str, Any]] = Field(default_factory=list)


class EsgReportInput(BaseModel):
    project_name: str = "Project"
    elements: list[dict[str, Any]] = Field(default_factory=list)
    material_totals: dict[str, float] = Field(default_factory=dict)


class EmergingInput(BaseModel):
    payload: dict[str, Any] = Field(default_factory=dict)


class ProjectMetaInput(BaseModel):
    name: str = ""
    ifc_path: str = ""
    country_code: str = "ZM"
    last_opened: str = ""


class AiDesignInput(BaseModel):
    natural_language_prompt: str
    country_code: str = "ZM"
    site_latitude: float = 0
    site_longitude: float = 0
    geo_data: dict[str, Any] = Field(default_factory=dict)
    budget_usd: float = 45000
    project_type: str = "residential"
    design_code: str = "eurocode"
    user_preferences: dict[str, Any] = Field(default_factory=dict)


class AiVariantInput(BaseModel):
    natural_language_prompt: str = ""
    country_code: str = "ZM"
    budget_usd: float = 45000
    base_brief: dict[str, Any] = Field(default_factory=dict)
    geo_data: dict[str, Any] = Field(default_factory=dict)
    project_type: str = "residential"


class AiPushInput(BaseModel):
    design_brief: dict[str, Any]
    geo_data: dict[str, Any] = Field(default_factory=dict)
    country_code: str = "ZM"
    design_code: str = "eurocode"


class AiProposalInput(BaseModel):
    project_name: str = "Project"
    client_name: str = "Client"
    design_brief: dict[str, Any] = Field(default_factory=dict)
    geo_data: dict[str, Any] = Field(default_factory=dict)
    boq_summary: dict[str, Any] = Field(default_factory=dict)
    design_code: str = "eurocode"


class PlotValuationInput(BaseModel):
    latitude: float = 0
    longitude: float = 0
    country_code: str = "ZM"
    city: str = "Lusaka"
    neighbourhood: str = "Woodlands"
    plot_area_m2: float
    asking_price_usd: float
    road_frontage_m: float = 15
    services_available: dict[str, bool] = Field(default_factory=dict)
    title_deed_type: str = "freehold"
    geo_data: dict[str, Any] = Field(default_factory=dict)


class FeasibilityInput(BaseModel):
    plot_data: dict[str, Any] = Field(default_factory=dict)
    land_cost_usd: float = 0
    development_type: str = "residential_single"
    units_planned: int = 1
    gross_floor_area_m2: float = 250
    construction_standard: str = "standard"
    finance_type: str = "cash"
    loan_percentage: float = 0
    interest_rate_annual: float = 0
    loan_term_months: int = 0
    target_sale_price_per_m2: float = 750
    target_rental_per_month: float = 0
    country_code: str = "ZM"
    city: str = "Lusaka"


class LandUseInput(BaseModel):
    plot_data: dict[str, Any]
    country_code: str = "ZM"
    city: str = "Lusaka"
    geo_data: dict[str, Any] = Field(default_factory=dict)


class MortgageInput(BaseModel):
    country_code: str = "ZM"
    property_value_usd: float
    deposit_pct: float = 20
    term_years: int = 15
    interest_rate_annual: float = 0
    monthly_income_usd: float = 0


class GovProjectInput(BaseModel):
    project_name: str
    project_code: str = ""
    project_type: str = "building"
    country_code: str = "ZM"
    province: str = ""
    district: str = ""
    contract_value_usd: float = 0
    funding_source: str = "GRZ"
    contractor_name: str = ""
    consultant_name: str = ""
    commencement_date: str = ""
    original_completion: str = ""
    status: str = "active"
    completion_pct: float = 0


class GovSnapshotInput(BaseModel):
    snapshot_date: str = ""
    completion_pct: float = 0
    expenditure_usd: float = 0
    report_narrative: str = ""


class GovVariationInput(BaseModel):
    variation_no: str = ""
    description: str = ""
    value_usd: float = 0
    direction: str = "addition"
    status: str = "pending"
    reason: str = ""


class GovCertificateInput(BaseModel):
    contract_value_usd: float = 0
    previous_cumulative_gross_usd: float = 0
    previous_net_certified_usd: float = 0
    works_value_usd: float = 0
    materials_on_site_usd: float = 0
    retention_pct: float = 10
    period_from: str = ""
    period_to: str = ""
    exchange_rate: float = 26.5
    currency: str = "ZMW"


class GovReportInput(BaseModel):
    reporting_period: str = ""
    employer: str = "Ministry of Infrastructure, Housing and Urban Development"
    country: str = "Zambia"


class TenderInput(BaseModel):
    project_name: str
    employer: str = "Ministry of Infrastructure"
    country_code: str = "ZM"
    project_description: str = ""
    contract_type: str = "lump_sum"
    estimated_value_usd: float = 0
    contract_duration_months: int = 18
    tender_closing_date: str = ""
    boq_data: dict[str, Any] = Field(default_factory=dict)
    province: str = "Lusaka"


class CalcReportInput(BaseModel):
    project_name: str = "Project"
    client_name: str = "Client"
    engineer_name: str = "Engineer"
    engineer_reg: str = ""
    site_data: dict[str, Any] = Field(default_factory=dict)
    calculations: dict[str, Any] = Field(default_factory=dict)
    design_code: str = "Eurocode 2"


class EiaScreeningInput(BaseModel):
    project_name: str = "Project"
    project_type: str = "building"
    country_code: str = "ZM"
    latitude: float = 0
    longitude: float = 0
    estimated_value_usd: float = 0
    gross_floor_area_m2: float = 0
    project_scale: dict[str, Any] = Field(default_factory=dict)
    proximity_to: dict[str, Any] = Field(default_factory=dict)
    geo_data: dict[str, Any] = Field(default_factory=dict)


class MobileQuickCalcInput(BaseModel):
    calc_type: str = "concrete"
    grade: str = "C25"
    volume_m3: float = 1
    bar_size: str = "H16"
    length_m: float = 1
    quantity: int = 1
    span_m: float = 0
    depth_mm: float = 0


class SyncReceiveInput(BaseModel):
    id: str = ""
    type: str = "site_report"
    project_id: str = ""
    priority: int = 5
    data: dict[str, Any] = Field(default_factory=dict)


class WashDemandInput(BaseModel):
    population: int = 500
    lpcd: float = 50
    context: str = "urban_low"
    peak_factor: float = 2.5
    storage_days: float = 1.0
    leakage_pct: float = 15
    country: str = "Zambia"


class BoreholeInput(BaseModel):
    pumping_rate_m3d: float = 100
    transmissivity_m2d: float = 50
    storage_coeff: float = 0.001
    time_days: float = 1.0
    radius_m: float = 0.1
    aquifer_thickness_m: float = 20
    static_lift_m: float = 30
    friction_losses_m: float = 5
    residual_pressure_m: float = 15
    country: str = "Zambia"
    daily_demand_m3: float | None = None
    aquifer_yield_lps: float | None = None


class SewerDesignInput(BaseModel):
    population: int = 500
    lpcd: float = 80
    infiltration_pct: float = 20
    peak_factor: float = 2.5
    material: str = "pvc"

class PipeNetworkInput(BaseModel):
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    pipes: list[dict[str, Any]] = Field(default_factory=list)
    loops: list[list] = Field(default_factory=list)
    source_head_m: float = 50.0
    settlement_type: str = "urban"

class TreatmentPlantInput(BaseModel):
    flow_rate_m3h: float = 100
    floc_detention_min: float = 30
    velocity_gradient_g: float = 40
    surface_overflow_rate_mh: float = 1.5
    sed_detention_hr: float = 3
    filter_type: str = "rapid"
    filtration_rate_mh: float = 10
    chlorine_contact_min: float = 30
    chlorine_residual_mgl: float = 0.5

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

class SolarPvInput(BaseModel):
    daily_load_kwh: float = 15
    country: str = "Zambia"
    ghi_kwh_m2_day: float = 0
    panel_watt: float = 550
    system_losses_pct: float = 20
    latitude: float = -15.4


class BatteryInput(BaseModel):
    daily_load_kwh: float = 15
    autonomy_days: float = 2
    depth_of_discharge_pct: float = 80
    system_voltage: float = 48
    battery_type: str = "lithium"
    country: str = "Zambia"


class TwinAssetInput(BaseModel):
    asset_name: str
    asset_type: str = "structure"
    project_id: str = ""
    location: str = ""


class SensorReadingInput(BaseModel):
    asset_id: str
    sensor_type: str = "generic"
    value: float
    unit: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)


class CollabJoinInput(BaseModel):
    user_id: str
    user_name: str = "Engineer"


class WindInputs(BaseModel):
    basic_wind_speed: float = Field(45, gt=0, description="Basic wind speed m/s")
    building_height: float = Field(12, gt=0, description="Mean roof height m")
    building_width: float = Field(20, gt=0, description="Building width m")
    building_length: float = Field(30, gt=0, description="Building length m")
    exposure_category: str = Field("B", pattern="^(A|B|C|D|0|I|II|III|IV)$")


class CarbonInputs(BaseModel):
    materials: dict[str, float] = Field(default_factory=dict)
    transport: dict[str, list[float]] = Field(default_factory=dict)
    energy: dict[str, float] = Field(default_factory=dict)


class CarbonCreditInputs(BaseModel):
    baseline_emissions_tCO2e: float = Field(100, ge=0)
    project_emissions_tCO2e: float = Field(60, ge=0)
    sequestration_tCO2e: float = Field(0, ge=0)
    project_life_years: int = Field(20, ge=1)
    price_per_vcu_usd: float = Field(15, ge=0)
    methodology: str = "VCS VM0045"


class FloodInputs(BaseModel):
    grid_size: int = Field(64, ge=16, le=256)
    cell_size_m: float = Field(30, gt=0)
    rainfall_mm: float = Field(80, gt=0)
    catchment_area_km2: float = Field(2.5, gt=0)
    return_period_years: int = Field(100, ge=2)


class IfcExportInput(BaseModel):
    name: str = "ARCHITEX-CAD Export"
    site_name: str = "Site"
    elements: list[dict[str, Any]] = Field(default_factory=list)


@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/wash/water-demand")
def wash_water_demand_endpoint(inputs: WashDemandInput):
    try:
        return wrap_calculation_result(calculate_water_demand(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/wash/pipe-network")
def wash_pipe_network_endpoint(inputs: PipeNetworkInput):
    try:
        return wrap_calculation_result(analyze_pipe_network(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/wash/sewer-design")
def wash_sewer_design_endpoint(inputs: SewerDesignInput):
    try:
        return wrap_calculation_result(calculate_sewer_design(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/wash/borehole")
def wash_borehole_endpoint(inputs: BoreholeInput):
    try:
        return wrap_calculation_result(calculate_borehole(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/wash/treatment-plant")
def wash_treatment_plant_endpoint(inputs: TreatmentPlantInput):
    try:
        return wrap_calculation_result(calculate_treatment_plant(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/geo/bearing-capacity")
def geo_bearing_capacity_endpoint(inputs: GeoBearingCapacityInput):
    try:
        return wrap_calculation_result(calculate_bearing_capacity(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/geo/settlement")
def geo_settlement_endpoint(inputs: GeoSettlementInput):
    try:
        return wrap_calculation_result(calculate_settlement(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/geo/slope-stability")
def geo_slope_stability_endpoint(inputs: GeoSlopeStabilityInput):
    try:
        return wrap_calculation_result(calculate_slope_stability(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/geo/site-classification")
def geo_site_classification_endpoint(inputs: GeoSiteClassificationInput):
    try:
        return wrap_calculation_result(calculate_site_classification(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/calculate/fea")
def calculate_fea_endpoint(inputs: FeaInputs):
    try:
        return wrap_calculation_result(run_fea_calculation(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# BS 8110 Table 3.5 — design moment coefficients for beams
MOMENT_COEFF: dict[str, float] = {
    "simply_supported":    1 / 8,    # M = wL²/8
    "continuous":          0.086,    # end span of 3+ span continuous beam
    "cantilever":          0.5,      # M = wL²/2
    "one_end_continuous":  0.086,    # conservative end span
    "both_ends_continuous": 0.063,   # interior span
    "propped_cantilever":  0.125,    # worst case
}

@app.post("/calculate/beam")
def calculate_beam_endpoint(inputs: BeamInputs):
    try:
        data = inputs.model_dump()
        dcode = data.get("design_code", "Eurocode2")
        proj_id = data.get("project_id", "default")
        
        if dcode in ("BS8110", "BS_8110"):
            span = data["span"]
            gk = data["dead_load"]
            qk = data["live_load"]
            wu = 1.4 * gk + 1.6 * qk
            
            coeff = MOMENT_COEFF.get(data["support_condition"], 1/8)
            mu_calc = wu * span**2 * coeff
            v_calc = wu * span / 2
            
            m_knm = data.get("M_knm", 0.0)
            if m_knm <= 0:
                m_knm = mu_calc
            v_kn = data.get("V_kn", 0.0)
            if v_kn <= 0:
                v_kn = v_calc
                
            res = run_bs8110_beam(
                b_mm=data["width"],
                h_mm=data["depth"],
                cover_mm=data.get("cover_mm", 30.0),
                bar_dia_mm=data.get("bar_dia_mm", 16.0),
                n_bars_tension=data.get("n_bars_tension", 2),
                n_bars_compression=data.get("n_bars_compression", 2),
                link_dia_mm=data.get("link_dia_mm", 8.0),
                link_spacing_mm=data.get("link_spacing_mm", 200.0),
                fcu_mpa=data.get("fcu_mpa", data.get("fck", 25.0)),
                fy_mpa=data.get("fy_mpa", data.get("fyk", 460.0)),
                M_knm=m_knm,
                V_kn=v_kn,
                span_m=span,
                support_condition=data["support_condition"],
                fire_period_hours=data.get("fire_period_hours", 1.0),
            )
            res["module"] = "beam"
            project_store.save_calculation(proj_id, "beam", data, res)
            return wrap_calculation_result(res)

        data_adjusted = apply_local_adjustments(inputs.country, data)
        res = calculate_beam(data_adjusted)
        project_store.save_calculation(proj_id, "beam", data, res)
        return wrap_calculation_result(res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/slab")
def calculate_slab_endpoint(inputs: SlabInputs):
    try:
        data = inputs.model_dump()
        dcode = data.get("design_code", "Eurocode2")
        proj_id = data.get("project_id", "default")

        if dcode in ("BS8110", "BS_8110"):
            n = 1.4 * data["dead_load"] + 1.6 * data["live_load"]
            res = run_bs8110_slab(
                lx_m=data["span_lx"],
                ly_m=data.get("span_ly", data["span_lx"]),
                support_condition=data.get("support_condition", "simply_supported"),
                h_mm=data["depth"],
                cover_mm=data.get("cover_mm", 25.0),
                bar_dia_mm=data.get("bar_dia_mm", 10.0),
                fcu_mpa=data.get("fcu_mpa", data.get("fck", 25.0)),
                fy_mpa=data.get("fy_mpa", data.get("fyk", 460.0)),
                n_knm2=n,
                slab_type=data["slab_type"],
                fire_period_hours=data.get("fire_period_hours", 1.0),
            )
            res["module"] = "slab"
            project_store.save_calculation(proj_id, "slab", data, res)
            return wrap_calculation_result(res)

        data_adjusted = apply_local_adjustments(inputs.country, data)
        res = calculate_slab(data_adjusted)
        project_store.save_calculation(proj_id, "slab", data, res)
        return wrap_calculation_result(res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/column")
def calculate_column_endpoint(inputs: ColumnInputs):
    try:
        data = inputs.model_dump()
        dcode = data.get("design_code", "Eurocode2")
        proj_id = data.get("project_id", "default")
        
        if dcode in ("BS8110", "BS_8110"):
            res = run_bs8110_column(
                b_mm=data["width"],
                h_mm=data["depth"],
                cover_mm=data.get("cover_mm", 30.0),
                bar_dia_mm=data.get("bar_dia_mm", 20.0),
                n_bars=data.get("n_bars", 4),
                fcu_mpa=data.get("fcu_mpa", data.get("fck", 25.0)),
                fy_mpa=data.get("fy_mpa", data.get("fyk", 460.0)),
                N_kn=data["axial_load"],
                Mx_knm=data.get("moment_major", 0.0),
                My_knm=data.get("moment_minor", 0.0),
                le_x_m=data.get("le_factor", 1.0) * data["height"],
                le_y_m=data.get("le_factor", 1.0) * data["height"],
                support_condition="braced",
                link_dia_mm=data.get("link_dia_mm"),
                link_spacing_mm=data.get("link_spacing_mm"),
                fire_period_hours=data.get("fire_period_hours", 1.0),
            )
            res["module"] = "column"
            project_store.save_calculation(proj_id, "column", data, res)
            return wrap_calculation_result(res)
            
        data_adjusted = apply_local_adjustments(inputs.country, data)
        res = calculate_column(data_adjusted)
        project_store.save_calculation(proj_id, "column", data, res)
        return wrap_calculation_result(res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/load-takedown")
def calculate_load_takedown_endpoint(payload: dict[str, Any]):
    try:
        from calculations.structural.load_takedown import run_load_takedown
        res = run_load_takedown(payload)
        return wrap_calculation_result(res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/foundation")
def calculate_foundation_endpoint(inputs: FoundationInputs):
    try:
        data = apply_local_adjustments(inputs.country, inputs.model_dump())
        result = wrap_calculation_result(calculate_foundation(data))
        try:
            bearing = calculate_foundation_bearing(
                {
                    "N": inputs.column_load,
                    "Mx": inputs.moment_x,
                    "My": inputs.moment_y,
                    "B": inputs.foundation_width,
                    "L": inputs.foundation_length,
                    "bearing_method": "structural_linear",
                }
            )
            result["pressure_bearing"] = bearing
        except Exception:
            pass
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/calculate/bearing")
def calculate_bearing_endpoint(inputs: BearingInputs):
    try:
        return wrap_calculation_result(calculate_bearing(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/steel")
def calculate_steel_endpoint(inputs: SteelInputs):
    try:
        return wrap_calculation_result(calculate_steel_beam(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/timber")
def calculate_timber_endpoint(inputs: TimberInputs):
    try:
        return wrap_calculation_result(calculate_timber_beam(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/materials/recommend")
def materials_recommend_endpoint(inputs: MaterialSelectorInputs):
    try:
        return recommend_material(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/vision/process-image")
def vision_process_image(inputs: VisionImageInput):
    try:
        return process_image(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/vision/analyse")
async def vision_analyse(inputs: dict):
    try:
        return await analyse_structure(inputs.get("image_base64", ""), inputs.get("metadata", {}), inputs.get("geo_context", {}))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/vision/analyse-multi")
async def vision_analyse_multi(inputs: VisionMultiImageInput):
    try:
        return await analyse_multi_image(inputs.images, inputs.metadata, inputs.geo_context)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/vision/generate-cad")
def vision_generate_cad(inputs: dict):
    try:
        generator = CADGenerator()
        svg = generator.generate(inputs)
        return {"svg": svg}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/vision/generate-report")
def vision_generate_report(inputs: dict):
    try:
        report = generate_markdown_report(inputs)
        return {"report": report}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/calculate/loads")
def calculate_loads_endpoint(inputs: LoadInputs):
    try:
        return wrap_calculation_result(calculate_loads(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/load-combinations")
def calculate_load_combinations_endpoint(inputs: LoadCombinationsInput):
    try:
        # Return raw format — frontend LoadCombinations component reads
        # governing_uls, governing_sls, feed_to_calculators directly
        return generate_load_combinations(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class ReviewInput(BaseModel):
    calc_module: str
    step_key: str
    status: str
    override_value: str = ""
    override_reason: str = ""
    flag_note: str = ""
    engineer_name: str = ""
    registration_no: str = ""
    project_id: str = "default"

class ReviewBatchInput(BaseModel):
    project_id: str = "default"
    reviews: list[dict[str, Any]]

@app.post("/reviews/save")
def reviews_save_endpoint(inputs: ReviewInput):
    return save_review(**inputs.model_dump())

@app.post("/reviews/save-batch")
def reviews_save_batch_endpoint(inputs: ReviewBatchInput):
    return save_reviews_batch(inputs.reviews, inputs.project_id)

@app.get("/reviews/load")
def reviews_load_endpoint(calc_module: str | None = None, project_id: str = "default"):
    return load_reviews(calc_module, project_id)

@app.post("/export/pdf")
def export_pdf_endpoint(payload: dict[str, Any]):
    try:
        pdf_bytes = render_calculation_pdf(payload)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=calculation_report.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF Generation failed: {str(e)}")

class PressurePayload(BaseModel):
    """Flexible payload for pressure modules."""
    model_config = {"extra": "allow"}


def _pressure_endpoint(fn, inputs: PressurePayload):
    try:
        return wrap_calculation_result(fn(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/pressure/foundation-bearing")
def pressure_foundation_bearing(inputs: PressurePayload):
    return _pressure_endpoint(calculate_foundation_bearing, inputs)


@app.post("/pressure/lateral-earth")
def pressure_lateral_earth(inputs: PressurePayload):
    return _pressure_endpoint(calculate_lateral_earth, inputs)


@app.post("/pressure/wind-distribution")
def pressure_wind_distribution(inputs: PressurePayload):
    return _pressure_endpoint(calculate_wind_distribution, inputs)


@app.post("/pressure/boussinesq")
def pressure_boussinesq(inputs: PressurePayload):
    return _pressure_endpoint(calculate_boussinesq, inputs)


@app.post("/pressure/consolidation")
def pressure_consolidation(inputs: PressurePayload):
    return _pressure_endpoint(calculate_consolidation, inputs)


@app.post("/pressure/bridge-hydrostatic")
def pressure_bridge_hydrostatic(inputs: PressurePayload):
    return _pressure_endpoint(calculate_bridge_hydrostatic, inputs)


@app.post("/pressure/bridge-hydrodynamic")
def pressure_bridge_hydrodynamic(inputs: PressurePayload):
    return _pressure_endpoint(calculate_bridge_hydrodynamic, inputs)


@app.post("/pressure/bridge-foundation")
def pressure_bridge_foundation(inputs: PressurePayload):
    return _pressure_endpoint(calculate_bridge_foundation, inputs)


@app.post("/pressure/pavement-pressure")
def pressure_pavement(inputs: PressurePayload):
    return _pressure_endpoint(calculate_pavement_pressure, inputs)


@app.post("/pressure/pipe-pressure")
def pressure_pipe(inputs: PressurePayload):
    return _pressure_endpoint(calculate_pipe_pressure, inputs)


@app.post("/pressure/tank-pressure")
def pressure_tank(inputs: PressurePayload):
    return _pressure_endpoint(calculate_tank_pressure, inputs)


@app.post("/calculate/wind")
def calculate_wind_endpoint(inputs: WindInputs):
    try:
        return wrap_calculation_result(calculate_wind_loads(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/carbon")
def calculate_carbon_endpoint(inputs: CarbonInputs):
    try:
        return wrap_calculation_result(calculate_construction_carbon(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/carbon/credits")
def calculate_carbon_credits_endpoint(inputs: CarbonCreditInputs):
    try:
        return wrap_calculation_result(calculate_carbon_credits(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/simulate/flood")
def simulate_flood_endpoint(inputs: FloodInputs):
    try:
        return simulate_flood_inundation(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/bim/export-ifc")
def bim_export_ifc(inputs: IfcExportInput):
    try:
        return export_ifc_from_elements(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/road/pavement")
def calculate_pavement_endpoint(inputs: PavementInputs):
    try:
        return wrap_calculation_result(calculate_pavement(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/calculate/road/drainage")
def calculate_drainage_endpoint(inputs: DrainageInputs):
    try:
        return wrap_calculation_result(calculate_drainage(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/roads/geometric-design")
def calculate_geometric_design_endpoint(inputs: GeometricDesignInputs):
    try:
        return wrap_calculation_result(calculate_geometric_design(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/roads/traffic-load")
def calculate_traffic_load_endpoint(inputs: TrafficLoadInputs):
    try:
        return wrap_calculation_result(calculate_traffic_load(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/boq/extract-quantities")
def boq_extract_quantities(inputs: ExtractQuantitiesInput):
    try:
        return extract_quantities(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/boq/compile")
def boq_compile(inputs: BoQCompileInput):
    try:
        return compile_boq(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/boq/export-excel")
def boq_export_excel(inputs: BoQCompileInput):
    try:
        boq = compile_boq(inputs.model_dump())
        data = generate_boq_excel_bytes(boq)
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=architex-cad_boq.xlsx"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/boq/export-pdf")
def boq_export_pdf(inputs: BoQCompileInput):
    try:
        boq = compile_boq(inputs.model_dump())
        data, media_type = generate_boq_pdf_bytes(boq)
        ext = "pdf" if media_type == "application/pdf" else "html"
        return Response(
            content=data,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename=architex-cad_boq.{ext}"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/boq/zambia-rates")
def boq_zambia_rates():
    from calculations.boq.zmw_rates import ZAMBIA_UNIT_RATES_ZMW, RATE_METADATA
    return {"status": "ok", "rates": ZAMBIA_UNIT_RATES_ZMW, "metadata": RATE_METADATA}


@app.post("/geo/site-analysis")
def geo_site_analysis(inputs: GeoSiteInput):
    try:
        return run_site_analysis(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/geo/geocode")
def geo_geocode(inputs: GeoGeocodeInput):
    try:
        return {"results": geocode_search(inputs.query)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/geo/reverse-geocode")
def geo_reverse_geocode(inputs: GeoReverseInput):
    try:
        return reverse_geocode(inputs.latitude, inputs.longitude)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/geo/site-budget")
def geo_site_budget(inputs: GeoSiteBudgetInput):
    try:
        return compute_site_budget(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/geo/terrain")
def geo_terrain(inputs: GeoTerrainInput):
    try:
        return analyse_terrain(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/geo/soil")
def geo_soil(inputs: GeoSoilInput):
    try:
        return analyse_soil(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/geo/climate")
def geo_climate(inputs: GeoClimateInput):
    try:
        return analyse_climate(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/geo/seismic")
def geo_seismic(inputs: GeoSeismicInput):
    try:
        return analyse_seismic(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/geo/site-report")
def geo_site_report(inputs: GeoReportInput):
    try:
        return generate_site_report(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/geo/cache/status")
def geo_cache_status():
    return cache_status()


@app.post("/geo/cache/clear")
def geo_cache_clear():
    return {"cleared": clear_cache()}


@app.post("/boq/extract-from-bim")
def boq_extract_from_bim(inputs: BimExtractInput):
    try:
        return extract_from_bim(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/bim/status")
def bim_geometry_status():
    ext = extensions_status()
    return {
        "ifcopenshell": HAS_IFCOPENSHELL,
        "geometry_extensions": ext,
        "engines": {
            "client": "web-ifc",
            "server": "ifcopenshell" if HAS_IFCOPENSHELL else "unavailable",
            "2d_kernel": ext["engines"]["2d_regions"],
            "3d_kernel": ext["engines"]["3d_mesh"],
        },
    }


@app.get("/geometry/extensions/status")
def geometry_extensions_status():
    return extensions_status()


@app.post("/geometry/polygon/area")
def geometry_polygon_area(inputs: PolygonVerticesInput):
    verts = [(v[0], v[1]) for v in inputs.vertices if len(v) >= 2]
    return polygon_area(verts)


@app.post("/geometry/polygon/contains")
def geometry_polygon_contains(inputs: PolygonVerticesInput):
    if not inputs.point or len(inputs.point) < 2:
        raise HTTPException(status_code=400, detail="point [x,y] required")
    verts = [(v[0], v[1]) for v in inputs.vertices if len(v) >= 2]
    return polygon_contains(verts, (inputs.point[0], inputs.point[1]))


@app.post("/geometry/polyline/length")
def geometry_polyline_length(inputs: PolylineLengthInput):
    return {"length": polyline_length(inputs.segments)}


@app.post("/geometry/transform/point")
def geometry_transform_point(inputs: TransformPointInput):
    if len(inputs.matrix) != 16 or len(inputs.point) < 3:
        raise HTTPException(status_code=400, detail="matrix(16) and point[3] required")
    pt = transform_point(inputs.matrix, tuple(inputs.point[:3]))
    return {"point": list(pt), "flattened": list(flatten_xy(pt))}


@app.post("/geometry/region/boolean")
def geometry_region_boolean(inputs: RegionBooleanInput):
    polys_a = [[(p[0], p[1]) for p in poly] for poly in inputs.polygons_a]
    polys_b = [[(p[0], p[1]) for p in poly] for poly in inputs.polygons_b]
    op = inputs.operation if inputs.operation in ("union", "difference", "intersection") else "intersection"
    result = region_boolean(polys_a, polys_b, op)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("error", "Region boolean failed"))
    return result


@app.post("/geometry/autocad/export-dwg")
def geometry_autocad_export(inputs: DwgExportInput):
    return export_dwg_geometry(inputs.path, inputs.elements or None)


@app.get("/geometry/autocad/status")
def geometry_autocad_status():
    return autocad_bridge_status()


@app.post("/bim/parse-ifc-path")
def bim_parse_ifc_path(inputs: BimParsePathInput):
    try:
        result = parse_ifc_file(inputs.path)
        if result.get("status") == "error":
            raise HTTPException(status_code=503, detail=result.get("error", "Parse failed"))
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/bim/parse-ifc-upload")
async def bim_parse_ifc_upload(file: UploadFile = File(...)):
    try:
        data = await file.read()
        result = parse_ifc_bytes(data)
        if result.get("status") == "error":
            raise HTTPException(status_code=503, detail=result.get("error", "Parse failed"))
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/bim/cad/status")
def bim_cad_status():
    return cad_parser_status()


@app.post("/bim/parse-cad-path")
def bim_parse_cad_path(inputs: BimParsePathInput):
    try:
        result = parse_cad_file(inputs.path)
        if result.get("status") == "error":
            return JSONResponse(status_code=400, content={"detail": result.get("error", "CAD parse failed"), "cad": result.get("cad")})
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/bim/parse-cad-upload")
async def bim_parse_cad_upload(file: UploadFile = File(...)):
    try:
        data = await file.read()
        result = parse_cad_bytes(data, file.filename or "upload.dxf")
        if result.get("status") == "error":
            return JSONResponse(status_code=400, content={"detail": result.get("error", "CAD parse failed"), "cad": result.get("cad")})
        return result
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/bim/geometry/boolean")
def bim_geometry_boolean(inputs: GeometryBooleanInput):
    try:
        result = boolean_operation(inputs.model_dump())
        if result.get("status") == "error":
            raise HTTPException(status_code=400, detail=result.get("error", "Boolean failed"))
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/bim/plan-takeoff")
def bim_plan_takeoff(inputs: BimParsePathInput):
    try:
        result = extract_plan_takeoff(inputs.path)
        if result.get("status") == "error":
            raise HTTPException(status_code=503, detail=result.get("error", "Plan takeoff failed"))
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/bim/geometry/intersection-volume")
def bim_geometry_intersection(inputs: GeometryBooleanInput):
    try:
        return mesh_intersection_volume(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class VoiceRequest(BaseModel):
    command: str

@app.post("/ai/voice-command")
def ai_voice_command(req: VoiceRequest):
    result = process_voice_command(req.command)
    return result


class ChatRequest(BaseModel):
    message: str
    context: str = ""


@app.post("/ai/chat")
def ai_chat(req: ChatRequest):
    """Dual-mode chat: structured engineering commands get action payloads,
    conversational messages get a spoken reply."""
    voice_result = process_voice_command(req.message)
    intent = voice_result.get("intent", "chat")
    spoken = voice_result.get("spoken_response", "")

    if intent != "chat":
        return {
            "reply": spoken or "Done.",
            "intent": intent,
            "action": voice_result.get("payload", {}),
        }

    # For chat: the voice agent (Gemini JSON-mode or local NLU) already generated
    # a spoken_response — use it directly. No second Gemini call needed.
    if spoken:
        return {"reply": spoken, "intent": "chat", "action": None}

    # Fallback only if spoken_response is somehow empty
    system = CHAT_SYSTEM
    if req.context:
        system = f"{CHAT_SYSTEM}\n\nProject context: {req.context}"
    reply = call_gemini_chat(system, req.message)
    return {"reply": reply or "Hello! How can I help you?", "intent": "chat", "action": None}


@app.post("/ai/generate-design")
def ai_generate_design(inputs: AiDesignInput):
    try:
        return generate_design(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/ai/generate-variants")
def ai_generate_variants(inputs: AiVariantInput):
    try:
        return generate_variants(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/ai/push-to-calculators")
def ai_push_to_calculators(inputs: AiPushInput):
    try:
        return push_to_calculators(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/ai/generate-proposal")
def ai_generate_proposal(inputs: AiProposalInput):
    try:
        return generate_proposal(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- TIER 2: WASH + Energy + Collaboration ---

@app.post("/calculate/wash/demand")
def wash_demand(inputs: WashDemandInput):
    try:
        return wrap_calculation_result(calculate_water_demand(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/wash/borehole")
def wash_borehole(inputs: BoreholeInput):
    try:
        return wrap_calculation_result(calculate_borehole(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/wash/sewerage")
def wash_sewerage(inputs: SewerDesignInput):
    try:
        return wrap_calculation_result(calculate_sewer_design(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/energy/solar")
def energy_solar(inputs: SolarPvInput):
    try:
        return wrap_calculation_result(calculate_solar_pv(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/energy/battery")
def energy_battery(inputs: BatteryInput):
    try:
        return wrap_calculation_result(calculate_battery(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/geo/terrain-analytics")
def geo_terrain_analytics_endpoint(req: TerrainAnalyticsRequest):
    try:
        return analyze_terrain(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/energy/power-flow")
def energy_power_flow_endpoint(req: PowerFlowRequest):
    try:
        return run_power_flow(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/finance/live-pricing")
def finance_live_pricing_endpoint(req: PricingRequest):
    try:
        return get_live_pricing(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/energy/bess")
def energy_bess_endpoint(req: BessRequest):
    try:
        return calculate_bess(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/energy/microgrid")
def energy_microgrid_endpoint(req: MicrogridRequest):
    try:
        return calculate_voltage_drop(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/energy/transmission")
def energy_transmission_endpoint(req: TransmissionRequest):
    try:
        return calculate_sag_tension(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/energy/hydro")
def energy_hydro_endpoint(req: HydroRequest):
    try:
        return calculate_hydro(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/energy/biogas")
def energy_biogas_endpoint(req: BiogasRequest):
    try:
        return calculate_biogas(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/energy/wind-wake")
def energy_wind_wake_endpoint(req: WindWakeRequest):
    try:
        return calculate_wind_wake(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/energy/grid-fault")
def energy_grid_fault_endpoint(req: GridFaultRequest):
    try:
        return calculate_grid_fault(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/wash/water-tower")
def wash_water_tower_endpoint(req: WaterTowerRequest):
    try:
        return calculate_water_tower(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/wash/epanet")
def wash_epanet_endpoint(req: PipeNetworkRequest):
    try:
        return calculate_pipe_network(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/wash/dewats")
def wash_dewats_endpoint(req: DewatsRequest):
    try:
        return calculate_dewats(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/wash/wtp")
def wash_wtp_endpoint(req: WTPRequest):
    try:
        return calculate_wtp(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/wash/stormwater")
def wash_stormwater_endpoint(req: StormwaterRequest):
    try:
        return calculate_stormwater(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/wash/landfill")
def wash_landfill_endpoint(req: LandfillRequest):
    try:
        return calculate_landfill(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/wash/irrigation")
def wash_irrigation_endpoint(req: IrrigationRequest):
    try:
        return calculate_irrigation(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/geo/piles")
def geo_piles_endpoint(req: PilesRequest):
    try:
        return calculate_piles(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/geo/slope")
def geo_slope_endpoint(req: SlopeRequest):
    try:
        return calculate_slope(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/geo/consolidation")
def geo_consolidation_endpoint(req: ConsolidationRequest):
    try:
        return calculate_consolidation(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/geo/ground-improvement")
def geo_ground_improvement_endpoint(req: GroundImprovementRequest):
    try:
        return calculate_ground_improvement(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/geo/tunneling")
def geo_tunneling_endpoint(req: TunnelingRequest):
    try:
        return calculate_tunneling(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/energy/simulation/solar-battery-day")
def solar_battery_day_endpoint(req: SolarBatteryDayRequest):
    try:
        return simulate_solar_battery_day(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/energy/simulation/wind-wake-map")
def wind_wake_map_endpoint(req: WindWakeMapRequest):
    try:
        return simulate_wind_wake_map(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/energy/simulation/hydro-curve")
def hydro_curve_endpoint(req: HydroCurveRequest):
    try:
        return simulate_hydro_curve(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/geo/simulation/consolidation")
def geo_consolidation_sim_endpoint(req: ConsolidationSimRequest):
    try:
        return simulate_consolidation_settlement(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/geo/simulation/slope-slip-circle")
def geo_slope_sim_endpoint(req: SlopeSlipRequest):
    try:
        return simulate_slope_slip_circle(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/geo/simulation/pile-load-transfer")
def geo_pile_sim_endpoint(req: PileLoadTransferRequest):
    try:
        return simulate_pile_load_transfer(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/wash/simulation/water-tower-day")
def wash_tower_sim_endpoint(req: WaterTowerDayRequest):
    try:
        return simulate_water_tower_day(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/wash/simulation/pipe-pressure")
def wash_pipe_sim_endpoint(req: PipePressureRequest):
    try:
        return simulate_pipe_pressure_profile(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/structural/simulation/beam-bmd-sfd")
def struct_beam_sim_endpoint(req: BeamSimRequest):
    try:
        return simulate_beam_bmd_sfd(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/structural/simulation/foundation-pressure")
def struct_foundation_sim_endpoint(req: FoundationPressureRequest):
    try:
        return simulate_foundation_pressure(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/structural/simulation/slab-moments")
def struct_slab_sim_endpoint(req: SlabSimRequest):
    try:
        return simulate_slab_moments(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/structural/simulation/pm-interaction")
def struct_pm_sim_endpoint(req: PMSimRequest):
    try:
        return simulate_pm_interaction(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/structural/simulation/wind-facade")
def struct_wind_sim_endpoint(req: WindFacadeRequest):
    try:
        return simulate_wind_facade(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/road/simulation/pavement-stress")
def road_pavement_sim_endpoint(req: PavementStressRequest):
    try:
        return simulate_pavement_stress(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/road/simulation/esal-growth")
def road_esal_sim_endpoint(req: ESALGrowthRequest):
    try:
        return simulate_esal_growth(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/road/simulation/stormwater-hydrograph")
def road_hydro_sim_endpoint(req: HydrographRequest):
    try:
        return simulate_stormwater_hydrograph(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/geo/simulation/rmr-support")
def geo_rmr_sim_endpoint(req: RMRSimRequest):
    try:
        return simulate_rmr_support(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/geo/simulation/ground-improvement-layout")
def geo_ground_sim_endpoint(req: GroundImprovSimRequest):
    try:
        return simulate_ground_improvement_layout(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/env/simulation/landfill-gas")
def env_landfill_sim_endpoint(req: LandfillGasRequest):
    try:
        return simulate_landfill_gas(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/env/simulation/soil-moisture")
def env_soil_sim_endpoint(req: SoilMoistureRequest):
    try:
        return simulate_soil_moisture(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/env/simulation/tank-hoop-stress")
def env_tank_sim_endpoint(req: TankHoopRequest):
    try:
        return simulate_tank_hoop_stress(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/energy/simulation/voltage-drop")
def energy_voltage_drop_endpoint(req: VoltageDropRequest):
    try:
        return simulate_voltage_drop_profile(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/energy/simulation/biogas-yield")
def energy_biogas_yield_endpoint(req: BiogasYieldRequest):
    try:
        return simulate_biogas_yield_curve(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/energy/simulation/catenary")
def energy_catenary_endpoint(req: CatenaryRequest):
    try:
        return simulate_conductor_catenary(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/energy/simulation/fault-current-decay")
def energy_fault_decay_endpoint(req: FaultDecayRequest):
    try:
        return simulate_fault_current_decay(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Circuit / SPICE-lite endpoints
# ---------------------------------------------------------------------------

class CircuitDCRequest(BaseModel):
    components: list[dict]

class CircuitACRequest(BaseModel):
    components: list[dict]
    freq_start: float = 1.0
    freq_stop: float = 1e6
    n_pts: int = 100
    input_node: str = "1"
    output_node: str = "2"

class CircuitTransientRequest(BaseModel):
    components: list[dict]
    t_stop: float = 0.01
    dt: float = 1e-5
    output_nodes: list[str] = ["1"]

@app.post("/circuit/dc")
def circuit_dc_endpoint(req: CircuitDCRequest):
    try:
        return solve_dc(req.components)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/circuit/ac-sweep")
def circuit_ac_endpoint(req: CircuitACRequest):
    try:
        return solve_ac_sweep(
            req.components, req.freq_start, req.freq_stop,
            req.n_pts, req.input_node, req.output_node,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/circuit/transient")
def circuit_transient_endpoint(req: CircuitTransientRequest):
    try:
        return solve_transient(req.components, req.t_stop, req.dt, req.output_nodes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Wind CFD (panel method) endpoints
# ---------------------------------------------------------------------------

class WindCFDRequest(BaseModel):
    polygon_x: list[float]
    polygon_y: list[float]
    wind_speed_ms: float = 10.0
    wind_angle_deg: float = 0.0
    grid_nx: int = 30
    grid_ny: int = 25
    grid_margin: float = 2.5

@app.post("/wind/cfd-panel")
def wind_cfd_endpoint(req: WindCFDRequest):
    try:
        return run_panel_cfd(
            req.polygon_x, req.polygon_y, req.wind_speed_ms,
            req.wind_angle_deg, req.grid_nx, req.grid_ny, req.grid_margin,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/wind/building-shapes")
def wind_shapes_endpoint():
    shapes = building_shapes()
    return {name: {"x": pts[0], "y": pts[1]} for name, pts in shapes.items()}


# ---------------------------------------------------------------------------
# Power systems endpoints (short-circuit, protection grading, harmonics)
# ---------------------------------------------------------------------------

class ShortCircuitRequest(BaseModel):
    system_voltage_kv: float = 11.0
    source_impedance_ohm: float = 0.05
    cable_length_km: float = 1.0
    cable_r_ohm_km: float = 0.32
    cable_x_ohm_km: float = 0.08

class RelayGradingRequest(BaseModel):
    relays: list[dict]
    fault_current_a: float = 5000.0
    i_range_factor: float = 10.0

class HarmonicRequest(BaseModel):
    system_voltage_v: float = 11000.0
    load_kva: float = 500.0
    system_impedance_ohm: float = 0.05
    cable_r_ohm: float = 0.32
    cable_x_ohm: float = 0.08
    fund_freq_hz: float = 50.0
    harmonic_profile: str = "class3_iec"
    max_harmonic: int = 25

@app.post("/power/short-circuit")
def power_sc_endpoint(req: ShortCircuitRequest):
    try:
        return run_short_circuit(
            req.system_voltage_kv, req.source_impedance_ohm,
            req.cable_length_km, req.cable_r_ohm_km, req.cable_x_ohm_km,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/power/relay-grading")
def power_relay_endpoint(req: RelayGradingRequest):
    try:
        return grading_chart(req.relays, req.fault_current_a, req.i_range_factor)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/power/harmonics")
def power_harmonics_endpoint(req: HarmonicRequest):
    try:
        return harmonic_spectrum(
            req.system_voltage_v, req.load_kva, req.system_impedance_ohm,
            req.cable_r_ohm, req.cable_x_ohm, req.fund_freq_hz,
            req.harmonic_profile, req.max_harmonic,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# FEA Modal Analysis endpoint
# ---------------------------------------------------------------------------

class ModalAnalysisRequest(BaseModel):
    height: float = 4.0
    span: float = 6.0
    support_type: str = "fixed"
    E: float = 2.0e11
    A: float = 0.01
    I: float = 1.0e-5
    rho: float = 7850.0
    n_modes: int = 6

@app.post("/fea/modal-analysis")
def fea_modal_endpoint(req: ModalAnalysisRequest):
    try:
        from calculations.fea.solver_2d import assemble_frame_stiffness
        K, nodes, elements, boundary_dofs = assemble_frame_stiffness(req.model_dump())
        return run_modal_analysis(nodes, elements, K, boundary_dofs, req.rho, req.n_modes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Seismic response spectrum endpoints
# ---------------------------------------------------------------------------

class SeismicSpectrumRequest(BaseModel):
    ag: float = 0.15               # Peak ground acceleration in g
    ground_type: str = "B"         # A, B, C, D, E
    xi_pct: float = 5.0            # Damping ratio %
    q: float = 1.5                 # Behaviour factor
    importance_class: str = "II"   # I, II, III, IV
    spectrum_type: int = 1         # 1 = high seismicity, 2 = low seismicity
    combination: str = "SRSS"      # SRSS or CQC
    modal_periods: list[float] = []
    modal_eff_masses_x: list[float] = []
    modal_eff_masses_y: list[float] = []
    modal_mass_part_x: list[float] = []

@app.post("/seismic/response-spectrum")
def seismic_spectrum_endpoint(req: SeismicSpectrumRequest):
    try:
        return run_seismic_spectrum(
            req.ag, req.ground_type, req.xi_pct, req.q,
            req.importance_class, req.spectrum_type,
            req.modal_periods or None,
            req.modal_eff_masses_x or None,
            req.modal_eff_masses_y or None,
            req.modal_mass_part_x or None,
            req.combination,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class SeismicModalCombineRequest(BaseModel):
    modes: list[dict]              # From /fea/modal-analysis output
    ag: float = 0.15              # in g
    ground_type: str = "B"
    xi_pct: float = 5.0
    q: float = 1.5
    importance_class: str = "II"
    spectrum_type: int = 1
    combination: str = "SRSS"

@app.post("/seismic/modal-combine")
def seismic_modal_combine_endpoint(req: SeismicModalCombineRequest):
    try:
        ag_ms2 = req.ag * 9.81
        return modal_seismic_response(
            req.modes, ag_ms2, req.ground_type, req.xi_pct,
            req.q, req.importance_class, req.spectrum_type, req.combination,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Water Hammer endpoint
# ---------------------------------------------------------------------------

class WaterHammerRequest(BaseModel):
    D_mm: float = 200.0
    t_mm: float = 6.0
    L_m: float = 500.0
    V0_ms: float = 1.5
    Tc_s: float = 0.0
    H_static_m: float = 50.0
    E_pipe_gpa: float = 200.0
    pipe_material: str = "steel"
    safety_factor: float = 1.3

@app.post("/wash/water-hammer")
def water_hammer_endpoint(req: WaterHammerRequest):
    try:
        return run_water_hammer(
            req.D_mm, req.t_mm, req.L_m, req.V0_ms,
            req.Tc_s, req.H_static_m, req.E_pipe_gpa,
            req.pipe_material, safety_factor=req.safety_factor,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Winkler Foundation endpoint
# ---------------------------------------------------------------------------

class WinklerRequest(BaseModel):
    L_m: float = 10.0
    B_m: float = 1.0
    EI_knm2: float = 50000.0
    ks_knm3: float = 20000.0
    load_type: str = "udl"
    q_knm: float = 50.0
    P_kn: float = 100.0
    point_loads: list[dict] = []
    support: str = "free"
    n_el: int = 40

@app.post("/structural/winkler")
def winkler_endpoint(req: WinklerRequest):
    try:
        return run_winkler(
            req.L_m, req.B_m, req.EI_knm2, req.ks_knm3,
            req.load_type, req.q_knm, req.P_kn,
            req.point_loads or None, req.support, req.n_el,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# EC2 Crack Width endpoint
# ---------------------------------------------------------------------------

class CrackWidthRequest(BaseModel):
    b_mm: float = 300.0
    h_mm: float = 500.0
    d_mm: float | None = None
    cover_mm: float = 35.0
    bar_dia_mm: float = 16.0
    n_bars: int = 3
    fck_mpa: float = 30.0
    fyk_mpa: float = 500.0
    Es_gpa: float = 200.0
    M_knm: float = 80.0
    N_kn: float = 0.0
    wk_limit_mm: float = 0.3
    bond_condition: str = "good"

@app.post("/structural/crack-width")
def crack_width_endpoint(req: CrackWidthRequest):
    try:
        return run_crack_width(
            req.b_mm, req.h_mm, req.d_mm, req.cover_mm,
            req.bar_dia_mm, req.n_bars,
            req.fck_mpa, req.fyk_mpa, req.Es_gpa,
            req.M_knm, req.N_kn, req.wk_limit_mm, req.bond_condition,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Zambia Localized Endpoints
# ---------------------------------------------------------------------------

@app.post("/calculate/masonry")
def calculate_masonry_endpoint(inputs: MasonryInputs):
    try:
        res = run_masonry_wall(
            t_mm=inputs.width,
            h_m=inputs.height,
            L_m=inputs.length,
            load_type=inputs.load_type,
            N_kn_m=inputs.axial_load,
            M_knm_m=inputs.moment,
            brick_class=inputs.brick_class,
            mortar_designation=inputs.mortar_designation,
            wall_condition=inputs.wall_condition,
            restraint_top=inputs.restraint_top,
            restraint_bottom=inputs.restraint_bottom,
            openings=inputs.openings
        )
        project_store.save_calculation(inputs.project_id, "masonry", inputs.model_dump(), res)
        return wrap_calculation_result(res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/geotechnical/black-cotton")
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
            soil_profile=inputs.soil_profile
        )
        project_store.save_calculation(inputs.project_id, "black_cotton", inputs.model_dump(), res)
        return wrap_calculation_result(res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/roads/gravel-design")
def roads_gravel_design_endpoint(inputs: GravelRoadInputs):
    try:
        res = run_gravel_road_design(
            AADT=inputs.AADT,
            CBR_subgrade_pct=inputs.CBR_subgrade_pct,
            CBR_gravel_pct=inputs.CBR_gravel_pct,
            design_period_years=inputs.design_period_years,
            traffic_growth_rate_pct=inputs.traffic_growth_rate_pct,
            rainfall_zone=inputs.rainfall_zone,
            terrain_type=inputs.terrain_type,
            road_width_m=inputs.road_width_m,
            road_length_km=inputs.road_length_km
        )
        project_store.save_calculation(inputs.project_id, "gravel_road", inputs.model_dump(), res)
        return wrap_calculation_result(res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/site/zambia-data")
def site_zambia_data_endpoint(inputs: ZambiaSiteInputs):
    try:
        return get_zambia_site_data(inputs.latitude, inputs.longitude)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/project/save")
def project_save_endpoint(inputs: ProjectSaveInputs):
    try:
        return project_store.save_project(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/project/{project_id}/summary")
def project_summary_endpoint(project_id: str):
    try:
        return project_store.get_project_summary(project_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/project/export-eiz")
def project_export_eiz_endpoint(payload: dict[str, Any]):
    try:
        p_name = payload.get("project_name", "Default Project")
        p_loc = payload.get("project_location", "Lusaka")
        eng_name = payload.get("engineer_name", "EIZ Registered Engineer")
        eiz_no = payload.get("eiz_number", "EIZ-XXXX")
        calc_title = payload.get("calc_title", "Calculation Report Memo")
        calc_ref = payload.get("calc_ref", "INFRA-01")
        rev = payload.get("revision", "1")
        date_str = payload.get("date") or default_memo_date()
        client = payload.get("client_name", "GRZ")
        auth = payload.get("local_authority", "Lusaka City Council")

        sections = normalize_calculation_sections(payload.get("calculation_sections", []))
        
        pdf_bytes = generate_eiz_memo(
            project_name=p_name,
            project_location=p_loc,
            engineer_name=eng_name,
            eiz_number=eiz_no,
            calc_title=calc_title,
            calc_reference=calc_ref,
            revision=rev,
            date=date_str,
            client_name=client,
            local_authority=auth,
            calculation_sections=sections
        )
        
        p_id = payload.get("project_id", "default")
        filename = f"EIZ-Memo-{calc_ref}.pdf"
        project_store.save_document_record(p_id, filename, "memo")
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"EIZ Memo Generation failed: {str(e)}")


# ── Phase 4: Quantity Verifier ────────────────────────────────────────────────

class BoQVerifyRequest(BaseModel):
    project_name: str = "Project"
    contractor_name: str = "Contractor"
    tolerance_pct: float = 15.0
    verified_items: list[dict[str, Any]] = Field(default_factory=list)
    submitted_items: list[dict[str, Any]] = Field(default_factory=list)

import hashlib, time as _time

@app.post("/verification/compare-boq")
def compare_boq(req: BoQVerifyRequest):
    results = []
    ver_map = {str(item.get("code", "")).lower(): item for item in req.verified_items}

    for sub in req.submitted_items:
        code = str(sub.get("code", "")).lower()
        desc = sub.get("description", code)
        unit = sub.get("unit", "item")
        sub_qty = float(sub.get("qty", 0))
        rate = float(sub.get("rate_zmw", 0))

        ver = ver_map.get(code)
        ver_qty = float(ver.get("qty", 0)) if ver else 0.0

        if ver_qty > 0:
            variance_pct = round((sub_qty - ver_qty) / ver_qty * 100, 1)
        else:
            variance_pct = 0.0

        abs_var = abs(variance_pct)
        if abs_var <= req.tolerance_pct:
            risk = "pass"
        elif abs_var <= req.tolerance_pct * 2:
            risk = "warning"
        else:
            risk = "fail"

        results.append({
            "code": sub.get("code", code),
            "description": desc,
            "unit": unit,
            "submitted_qty": sub_qty,
            "verified_qty": ver_qty,
            "submitted_total": round(sub_qty * rate, 2),
            "verified_total": round(ver_qty * rate, 2),
            "variance_pct": variance_pct,
            "risk": risk,
        })

    fails    = sum(1 for r in results if r["risk"] == "fail")
    warnings = sum(1 for r in results if r["risk"] == "warning")
    sub_total = sum(r["submitted_total"] for r in results)
    ver_total = sum(r["verified_total"] for r in results)

    overall = "fail" if fails > 0 else "warning" if warnings > 0 else "pass"

    payload = {
        "project": req.project_name,
        "contractor": req.contractor_name,
        "items": results,
        "timestamp": int(_time.time()),
    }
    audit_hash = hashlib.sha256(
        str(sorted(str(payload).split())).encode()
    ).hexdigest()

    return {
        "status": overall,
        "items": results,
        "summary": {
            "total_items": len(results),
            "pass": len(results) - fails - warnings,
            "warning": warnings,
            "fail": fails,
            "submitted_total_zmw": round(sub_total, 2),
            "verified_total_zmw": round(ver_total, 2),
            "overpriced_by_zmw": round(sub_total - ver_total, 2),
        },
        "audit_hash": audit_hash,
        "tolerance_pct": req.tolerance_pct,
    }


# ---------------------------------------------------------------------------
# Fire Resistance & Anchorage (BS 8110)
# ---------------------------------------------------------------------------

class FireAnchorageRequest(BaseModel):
    check_type: str = Field("beam", pattern="^(beam|slab|column)$")
    cover_mm: float = Field(30.0, ge=0)
    b_mm: float = Field(250.0, gt=0)
    h_mm: float = Field(450.0, gt=0)
    fire_period_hours: float = Field(1.0, gt=0)
    support_condition: str = Field("simply_supported")
    bar_dia_mm: float = Field(16.0, gt=0)
    fy_mpa: float = Field(460.0, gt=0)
    fcu_mpa: float = Field(25.0, gt=0)
    zone: str = Field("tension", pattern="^(tension|compression)$")

@app.post("/structural/fire-anchorage")
def structural_fire_anchorage(req: FireAnchorageRequest):
    try:
        if req.check_type == "beam":
            status, msg, req_cover, req_dim = check_beam_fire(
                req.cover_mm, req.b_mm, req.fire_period_hours, req.support_condition
            )
        elif req.check_type == "slab":
            status, msg, req_cover, req_dim = check_slab_fire(
                req.cover_mm, req.b_mm, req.fire_period_hours, req.support_condition
            )
        else:
            status, msg, req_cover, req_dim = check_column_fire(
                req.cover_mm, req.b_mm, req.h_mm, req.fire_period_hours
            )

        la_t = anchorage_length(req.bar_dia_mm, req.fy_mpa, req.fcu_mpa, "tension")
        la_c = anchorage_length(req.bar_dia_mm, req.fy_mpa, req.fcu_mpa, "compression")
        ll_t = lap_length(req.bar_dia_mm, req.fy_mpa, req.fcu_mpa, "tension")
        ll_c = lap_length(req.bar_dia_mm, req.fy_mpa, req.fcu_mpa, "compression")

        return {
            "fire_check": {
                "status": status,
                "message": msg,
                "req_cover": req_cover,
                "req_dimension": req_dim,
            },
            "anchorage_tension_mm": round(la_t, 1),
            "anchorage_compression_mm": round(la_c, 1),
            "lap_tension_mm": round(ll_t, 1),
            "lap_compression_mm": round(ll_c, 1),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
