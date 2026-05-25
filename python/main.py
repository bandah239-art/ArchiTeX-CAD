from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import Any

from calculations.structural.beam import calculate_beam
from calculations.structural.slab import calculate_slab
from calculations.structural.column import calculate_column
from calculations.structural.foundation import calculate_foundation
from calculations.structural.bearings import calculate_bearing
from data.african_conditions import apply_local_adjustments
from calculations.loads.load_combinations import calculate_loads, generate_load_combinations
from calculations.core.engineer_control import wrap_calculation_result
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
from ai.variant_generator import generate_variants
from ai.design_to_calculations import push_to_calculators
from ai.proposal_generator import generate_proposal
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

app = FastAPI(title="INFRAFRICA Calculation Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class BeamInputs(BaseModel):
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
    slab_type: str = Field(..., pattern="^(one_way|two_way)$")
    span_lx: float = Field(..., gt=0, description="Short span in metres")
    span_ly: float = Field(..., gt=0, description="Long span in metres")
    dead_load: float = Field(..., ge=0, description="Dead load kN/m²")
    live_load: float = Field(..., ge=0, description="Live load kN/m²")
    depth: float = Field(..., gt=0, description="Slab depth mm")
    fck: float = Field(..., gt=0, description="Concrete grade MPa")
    fyk: float = Field(..., gt=0, description="Steel grade MPa")
    support_condition: str = "simply_supported"
    country: str = "Zambia"


class ColumnInputs(BaseModel):
    height: float = Field(..., gt=0, description="Column height in metres")
    width: float = Field(..., gt=0, description="Column width in mm")
    depth: float = Field(..., gt=0, description="Column depth in mm")
    axial_load: float = Field(..., gt=0, description="Axial load kN")
    moment_major: float = Field(0, ge=0, description="Major axis moment kNm")
    moment_minor: float = Field(0, ge=0, description="Minor axis moment kNm")
    fck: float = Field(..., gt=0, description="Concrete grade MPa")
    fyk: float = Field(..., gt=0, description="Steel grade MPa")
    le_factor: float = Field(1.0, gt=0, description="Effective length factor")
    country: str = "Zambia"


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


class LoadInputs(BaseModel):
    dead_load_g: float = Field(..., ge=0, description="Dead load Gk")
    imposed_load_q: float = Field(..., ge=0, description="Imposed load Qk")
    wind_load_w: float = Field(0, ge=0, description="Wind load Wk")
    snow_load_s: float = Field(0, ge=0, description="Snow load Sk")
    load_type: str = Field("udl", pattern="^(udl|area)$")
    design_code: str = Field("eurocode", pattern="^(eurocode|aci318)$")
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
    aquifer_yield_lps: float = 2.5
    static_level_m: float = 25
    drawdown_m: float = 10
    total_depth_m: float = 45
    daily_demand_m3: float = 50
    pumping_hours: float = 8
    delivery_head_m: float = 15
    country: str = "Zambia"


class SewerDesignInput(BaseModel):
    population: int = 500
    lpcd: float = 80
    infiltration_pct: float = 20
    peak_factor: float = 2.5
    material: str = "pvc"

class PipeNetworkInput(BaseModel):
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    pipes: list[dict[str, Any]] = Field(default_factory=list)

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
    name: str = "INFRAFRICA Export"
    site_name: str = "Site"
    elements: list[dict[str, Any]] = Field(default_factory=list)


@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/wash/water-demand")
def wash_water_demand_endpoint(inputs: WashDemandInput):
    try:
        return wrap_calculation_result(calculate_water_demand(inputs.model_dump()))
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/wash/pipe-network")
def wash_pipe_network_endpoint(inputs: PipeNetworkInput):
    try:
        return wrap_calculation_result(analyze_pipe_network(inputs.model_dump()))
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/wash/sewer-design")
def wash_sewer_design_endpoint(inputs: SewerDesignInput):
    try:
        return wrap_calculation_result(calculate_sewer_design(inputs.model_dump()))
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/wash/borehole")
def wash_borehole_endpoint(inputs: BoreholeInput):
    try:
        return wrap_calculation_result(calculate_borehole(inputs.model_dump()))
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/wash/treatment-plant")
def wash_treatment_plant_endpoint(inputs: TreatmentPlantInput):
    try:
        return wrap_calculation_result(calculate_treatment_plant(inputs.model_dump()))
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/geo/bearing-capacity")
def geo_bearing_capacity_endpoint(inputs: GeoBearingCapacityInput):
    try:
        return wrap_calculation_result(calculate_bearing_capacity(inputs.model_dump()))
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/geo/settlement")
def geo_settlement_endpoint(inputs: GeoSettlementInput):
    try:
        return wrap_calculation_result(calculate_settlement(inputs.model_dump()))
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/geo/slope-stability")
def geo_slope_stability_endpoint(inputs: GeoSlopeStabilityInput):
    try:
        return wrap_calculation_result(calculate_slope_stability(inputs.model_dump()))
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/geo/site-classification")
def geo_site_classification_endpoint(inputs: GeoSiteClassificationInput):
    try:
        return wrap_calculation_result(calculate_site_classification(inputs.model_dump()))
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/calculate/beam")
def calculate_beam_endpoint(inputs: BeamInputs):
    try:
        data = apply_local_adjustments(inputs.country, inputs.model_dump())
        return wrap_calculation_result(calculate_beam(data))
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/slab")
def calculate_slab_endpoint(inputs: SlabInputs):
    try:
        data = apply_local_adjustments(inputs.country, inputs.model_dump())
        return wrap_calculation_result(calculate_slab(data))
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/column")
def calculate_column_endpoint(inputs: ColumnInputs):
    try:
        data = apply_local_adjustments(inputs.country, inputs.model_dump())
        return wrap_calculation_result(calculate_column(data))
    except (ValueError, KeyError) as e:
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
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/calculate/bearing")
def calculate_bearing_endpoint(inputs: BearingInputs):
    try:
        return wrap_calculation_result(calculate_bearing(inputs.model_dump()))
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/materials/recommend")
def materials_recommend_endpoint(inputs: MaterialSelectorInputs):
    try:
        return recommend_material(inputs.model_dump())
    except (ValueError, KeyError) as e:
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
        return calculate_loads(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/load-combinations")
def calculate_load_combinations_endpoint(inputs: LoadCombinationsInput):
    try:
        raw = generate_load_combinations(inputs.model_dump())
        steps = [
            {
                "step_number": i + 1,
                "title": f"ULS Combo {c['combo_number']}",
                "formula": c["expression"],
                "substitution": c["substitution"],
                "result": f"{c['result']} {c['unit']}",
                "unit": c["unit"],
                "reference": c["reference"],
                "status": "pass" if c.get("governing") else "info",
            }
            for i, c in enumerate(raw.get("uls_combinations", []))
        ]
        wrapped = {
            "status": "pass",
            "summary": raw.get("governing_uls", {}),
            "steps": steps,
            "warnings": [],
            "errors": [],
            "timestamp": raw.get("timestamp", ""),
            "load_combinations": raw,
        }
        return wrap_calculation_result(wrapped)
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


class PressurePayload(BaseModel):
    """Flexible payload for pressure modules."""
    model_config = {"extra": "allow"}


def _pressure_endpoint(fn, inputs: PressurePayload):
    try:
        return wrap_calculation_result(fn(inputs.model_dump()))
    except (ValueError, KeyError) as e:
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
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/carbon")
def calculate_carbon_endpoint(inputs: CarbonInputs):
    try:
        return calculate_construction_carbon(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/carbon/credits")
def calculate_carbon_credits_endpoint(inputs: CarbonCreditInputs):
    try:
        return calculate_carbon_credits(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/simulate/flood")
def simulate_flood_endpoint(inputs: FloodInputs):
    try:
        return simulate_flood_inundation(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/bim/export-ifc")
def bim_export_ifc(inputs: IfcExportInput):
    try:
        return export_ifc_from_elements(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/road/pavement")
def calculate_pavement_endpoint(inputs: PavementInputs):
    try:
        return wrap_calculation_result(calculate_pavement(inputs.model_dump()))
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/calculate/road/drainage")
def calculate_drainage_endpoint(inputs: DrainageInputs):
    try:
        return wrap_calculation_result(calculate_drainage(inputs.model_dump()))
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/roads/geometric-design")
def calculate_geometric_design_endpoint(inputs: GeometricDesignInputs):
    try:
        return wrap_calculation_result(calculate_geometric_design(inputs.model_dump()))
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/roads/traffic-load")
def calculate_traffic_load_endpoint(inputs: TrafficLoadInputs):
    try:
        return wrap_calculation_result(calculate_traffic_load(inputs.model_dump()))
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/boq/extract-quantities")
def boq_extract_quantities(inputs: ExtractQuantitiesInput):
    try:
        return extract_quantities(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/boq/compile")
def boq_compile(inputs: BoQCompileInput):
    try:
        return compile_boq(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/boq/export-excel")
def boq_export_excel(inputs: BoQCompileInput):
    try:
        boq = compile_boq(inputs.model_dump())
        data = generate_boq_excel_bytes(boq)
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=infraafrica_boq.xlsx"},
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
            headers={"Content-Disposition": f"attachment; filename=infraafrica_boq.{ext}"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/geo/site-analysis")
def geo_site_analysis(inputs: GeoSiteInput):
    try:
        return run_site_analysis(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/geo/geocode")
def geo_geocode(inputs: GeoGeocodeInput):
    try:
        return {"results": geocode_search(inputs.query)}
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/geo/reverse-geocode")
def geo_reverse_geocode(inputs: GeoReverseInput):
    try:
        return reverse_geocode(inputs.latitude, inputs.longitude)
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/geo/site-budget")
def geo_site_budget(inputs: GeoSiteBudgetInput):
    try:
        return compute_site_budget(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/geo/terrain")
def geo_terrain(inputs: GeoTerrainInput):
    try:
        return analyse_terrain(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/geo/soil")
def geo_soil(inputs: GeoSoilInput):
    try:
        return analyse_soil(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/geo/climate")
def geo_climate(inputs: GeoClimateInput):
    try:
        return analyse_climate(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/geo/seismic")
def geo_seismic(inputs: GeoSeismicInput):
    try:
        return analyse_seismic(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/geo/site-report")
def geo_site_report(inputs: GeoReportInput):
    try:
        return generate_site_report(inputs.model_dump())
    except (ValueError, KeyError) as e:
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
    except (ValueError, KeyError) as e:
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
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/bim/parse-ifc-upload")
async def bim_parse_ifc_upload(file: UploadFile = File(...)):
    try:
        data = await file.read()
        result = parse_ifc_bytes(data)
        if result.get("status") == "error":
            raise HTTPException(status_code=503, detail=result.get("error", "Parse failed"))
        return result
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/bim/geometry/boolean")
def bim_geometry_boolean(inputs: GeometryBooleanInput):
    try:
        result = boolean_operation(inputs.model_dump())
        if result.get("status") == "error":
            raise HTTPException(status_code=400, detail=result.get("error", "Boolean failed"))
        return result
    except (ValueError, KeyError) as e:
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
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/bim/geometry/intersection-volume")
def bim_geometry_intersection(inputs: GeometryBooleanInput):
    try:
        return mesh_intersection_volume(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/ai/generate-design")
def ai_generate_design(inputs: AiDesignInput):
    try:
        return generate_design(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/ai/generate-variants")
def ai_generate_variants(inputs: AiVariantInput):
    try:
        return generate_variants(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/ai/push-to-calculators")
def ai_push_to_calculators(inputs: AiPushInput):
    try:
        return push_to_calculators(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/ai/generate-proposal")
def ai_generate_proposal(inputs: AiProposalInput):
    try:
        return generate_proposal(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/real-estate/value-plot")
def re_value_plot(inputs: PlotValuationInput):
    try:
        return value_plot(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/real-estate/feasibility")
def re_feasibility(inputs: FeasibilityInput):
    try:
        return run_feasibility(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/real-estate/optimise-use")
def re_optimise_use(inputs: LandUseInput):
    try:
        return optimise_land_use(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/real-estate/mortgage")
def re_mortgage(inputs: MortgageInput):
    try:
        return calculate_mortgage(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/government/portfolio-summary")
def gov_portfolio_summary():
    init_db()
    try:
        return portfolio_summary()
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/government/projects/seed")
def gov_seed_projects():
    return {"projects": seed_demo_projects()}


@app.post("/government/projects")
def gov_create_project(inputs: GovProjectInput):
    try:
        return create_project(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/government/projects")
def gov_list_projects():
    init_db()
    return {"projects": list_projects()}


@app.get("/government/projects/{project_id}")
def gov_get_project(project_id: str):
    try:
        result = get_project_detail(project_id)
        if result.get("error"):
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except HTTPException:
        raise
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/government/projects/{project_id}")
def gov_update_project(project_id: str, inputs: GovProjectInput):
    try:
        result = update_project(project_id, inputs.model_dump())
        if not result:
            raise HTTPException(status_code=404, detail="Project not found")
        return result
    except HTTPException:
        raise
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/government/projects/{project_id}/snapshot")
def gov_add_snapshot(project_id: str, inputs: GovSnapshotInput):
    try:
        return add_snapshot(project_id, inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/government/projects/{project_id}/variation")
def gov_add_variation(project_id: str, inputs: GovVariationInput):
    try:
        return add_variation(project_id, inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/government/projects/{project_id}/certificate")
def gov_certificate(project_id: str, inputs: GovCertificateInput):
    try:
        return generate_certificate(project_id, inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/government/projects/{project_id}/timeline")
def gov_timeline(project_id: str):
    try:
        return generate_s_curve(project_id)
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/government/projects/{project_id}/cashflow")
def gov_cashflow(project_id: str):
    try:
        return cashflow_projection(project_id)
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/government/reports/{report_type}")
def gov_report(report_type: str, inputs: GovReportInput):
    try:
        return generate_report(report_type, inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/documents/generate-tender")
def doc_tender(inputs: TenderInput):
    try:
        return generate_tender(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/documents/calculation-report")
def doc_calc_report(inputs: CalcReportInput):
    try:
        return generate_calculation_report(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/documents/eia-screening")
def doc_eia(inputs: EiaScreeningInput):
    try:
        return screen_eia(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/mobile/quick-calc")
def mobile_quick_calc(inputs: MobileQuickCalcInput):
    try:
        d = inputs.model_dump()
        if d["calc_type"] == "concrete":
            return concrete_mix(d["grade"], d["volume_m3"])
        if d["calc_type"] == "rebar":
            return rebar_weight(d["bar_size"], d["length_m"], d["quantity"])
        if d["calc_type"] == "beam":
            return quick_beam_check(d["span_m"], d["depth_mm"])
        raise ValueError(f"Unknown calc_type: {d['calc_type']}")
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/sync/receive")
def sync_receive(inputs: SyncReceiveInput):
    try:
        payload = inputs.model_dump()
        payload.update(payload.pop("data", {}))
        return receive_sync_item(payload)
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/sync/items")
def sync_items():
    return {"items": list_sync_items()}


# --- TIER 2: WASH + Energy + Collaboration ---

@app.post("/calculate/wash/demand")
def wash_demand(inputs: WashDemandInput):
    try:
        return calculate_water_demand(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/wash/borehole")
def wash_borehole(inputs: BoreholeInput):
    try:
        return calculate_borehole(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/wash/sewerage")
def wash_sewerage(inputs: SewerageInput):
    try:
        return calculate_sewerage(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/energy/solar")
def energy_solar(inputs: SolarPvInput):
    try:
        return calculate_solar_pv(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/energy/battery")
def energy_battery(inputs: BatteryInput):
    try:
        return calculate_battery(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/collaboration/rooms/{project_id}")
def collab_room_status(project_id: str):
    return room_status(project_id)


@app.post("/collaboration/rooms/{project_id}/join")
def collab_join(project_id: str, inputs: CollabJoinInput):
    return join_room(project_id, inputs.user_id, inputs.user_name)


@app.post("/collaboration/rooms/{project_id}/leave")
def collab_leave(project_id: str, inputs: CollabJoinInput):
    return leave_room(project_id, inputs.user_id)


@app.websocket("/collaboration/ws/{project_id}/{user_id}")
async def collab_websocket(websocket: WebSocket, project_id: str, user_id: str):
    await websocket.accept()
    register(project_id, user_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            response = handle_message(project_id, user_id, raw)
            if response:
                await websocket.send_json(response)
                if response.get("type") == "event":
                    await broadcast(project_id, response, exclude_user=user_id)
                elif response.get("type") == "room_state":
                    await broadcast(project_id, response, exclude_user=user_id)
    except WebSocketDisconnect:
        leave_room(project_id, user_id)
        unregister(project_id, user_id)
        await broadcast(project_id, {"type": "room_state", "data": room_status(project_id)})


# --- TIER 3: Digital Twin + Predictive Maintenance ---

@app.post("/intelligence/twin/assets")
def twin_register(inputs: TwinAssetInput):
    try:
        return register_asset(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/intelligence/twin/assets")
def twin_list_assets(project_id: str = ""):
    assets = list_assets(project_id)
    if not assets:
        assets = seed_demo_assets()
    return {"assets": assets}


@app.get("/intelligence/twin/assets/{asset_id}")
def twin_get_asset(asset_id: str):
    asset = get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@app.post("/intelligence/twin/ingest")
def twin_ingest(inputs: SensorReadingInput):
    try:
        return ingest_reading(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/intelligence/predictive/{asset_id}")
def predictive_asset(asset_id: str):
    result = analyse_asset(asset_id)
    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.get("/intelligence/predictive")
def predictive_portfolio(project_id: str = ""):
    return analyse_portfolio(project_id)


@app.post("/intelligence/twin/seed")
def twin_seed():
    return {"assets": seed_demo_assets()}


# --- 4D/5D Scheduling ---
@app.post("/schedule/build-from-bim")
def schedule_build_from_bim(inputs: ScheduleBuildInput):
    try:
        return build_schedule_from_bim(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Generative design optimizer ---
@app.post("/optimize/structural")
def optimize_structural_endpoint(inputs: OptimizerInput):
    try:
        return optimize_structural_layout(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/optimize/solar")
def optimize_solar_endpoint(inputs: SolarOptimizerInput):
    try:
        return optimize_solar_orientation(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Desktop offline sync ---
@app.post("/sync/batch")
def sync_batch_endpoint(inputs: SyncBatchInput):
    try:
        return process_sync_batch(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Offline cache ---
@app.get("/cache/calc/status")
def calc_cache_status_endpoint():
    return calc_cache_status()


@app.post("/cache/calc/clear")
def calc_cache_clear_endpoint():
    return clear_calc_cache()


@app.get("/cache/project")
def project_meta_load():
    return load_project_meta()


@app.post("/cache/project")
def project_meta_save(inputs: ProjectMetaInput):
    return save_project_meta(inputs.model_dump())


# --- ESG documents ---
@app.post("/documents/esg-report")
def documents_esg_report(inputs: EsgReportInput):
    try:
        return generate_esg_report(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Emerging tech platform ---
@app.post("/emerging/blockchain/anchor")
def emerging_blockchain(inputs: EmergingInput):
    return blockchain_anchor(inputs.payload)


@app.get("/emerging/marketplace")
def emerging_marketplace(country_code: str = "ZM"):
    return marketplace_listings({"country_code": country_code})


@app.post("/emerging/disaster/plan")
def emerging_disaster(inputs: EmergingInput):
    return disaster_response_plan(inputs.payload)


@app.post("/emerging/satellite/analyse")
def emerging_satellite(inputs: EmergingInput):
    return satellite_analysis(inputs.payload)


@app.post("/emerging/drone/process")
def emerging_drone(inputs: EmergingInput):
    return drone_photogrammetry(inputs.payload)


@app.post("/emerging/voice/command")
def emerging_voice(inputs: EmergingInput):
    return voice_command(inputs.payload)


@app.post("/emerging/cv/safety")
def emerging_cv_safety(inputs: EmergingInput):
    return cv_safety_scan(inputs.payload)


@app.post("/emerging/ar/scene")
def emerging_ar(inputs: EmergingInput):
    return ar_mobile_scene(inputs.payload)


# --- Physics simulations ---
@app.post("/simulate/thermal")
def simulate_thermal_endpoint(inputs: EmergingInput):
    try:
        return simulate_thermal(inputs.payload)
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/simulate/seismic")
def simulate_seismic_endpoint(inputs: SeismicAnalysisInput):
    try:
        return simulate_seismic_response(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
