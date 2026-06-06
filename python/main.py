from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from typing import Any
from datetime import datetime, timezone

from core.logging_config import get_logger, setup_logging
from core.error_middleware import register_error_handlers

setup_logging()
_log = get_logger("architex.main")

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

@asynccontextmanager
async def lifespan(application: FastAPI):
    """Run startup tasks, yield, then run shutdown tasks."""
    import os, pathlib

    # ── DB migrations ──────────────────────────────────────────────────────────
    try:
        from core.db_migrations import run_all_migrations
        data_dir = str(pathlib.Path(__file__).parent / "data")
        run_all_migrations(data_dir)
        _log.info("Database migrations complete")
    except Exception as exc:
        _log.warning("DB migrations failed (non-fatal): %s", exc)

    # ── Government DB init (legacy) ───────────────────────────────────────────
    try:
        init_db()
        _log.info("Government portfolio DB ready")
    except Exception as exc:
        _log.warning("Government DB init failed (non-fatal): %s", exc)

    _log.info("ARCHITEX-CAD engine startup complete")
    yield  # ── application running ──────────────────────────────────────────

    # ── Shutdown ───────────────────────────────────────────────────────────────
    try:
        closeOfflineDb()
    except Exception:
        pass
    _log.info("ARCHITEX-CAD engine shutdown complete")


app = FastAPI(
    title="ARCHITEX-CAD Calculation Engine",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# CORS — desktop Electron renderer + local dev only
_ALLOWED_ORIGINS = [
    "http://localhost:5190",   # ARCHITEX-CAD Vite dev (dedicated port)
    "http://localhost:5173",   # generic Vite dev
    "http://localhost:4173",   # Vite preview
    "http://127.0.0.1:5190",
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

register_error_handlers(app)

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
from routers.structural import router as structural_router
from routers.wash import router as wash_router
from routers.roads import router as roads_router
from routers.energy import router as energy_router
from routers.geo import router as geo_router
from routers.seismic import router as seismic_router
from routers.carbon import router as carbon_router

app.include_router(occ_router)
app.include_router(government_router)
app.include_router(real_estate_router)
app.include_router(intelligence_router)
app.include_router(documents_router)
app.include_router(emerging_router)
app.include_router(structural_router)
app.include_router(wash_router)
app.include_router(roads_router)
app.include_router(energy_router)
app.include_router(geo_router)
app.include_router(seismic_router)
app.include_router(carbon_router)


# ---------------------------------------------------------------------------
# Pydantic models for routes that remain in main.py
# ---------------------------------------------------------------------------

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


class ProjectSaveInputs(BaseModel):
    id: str
    name: str
    location: str = ""
    engineer: str = ""
    eiz_number: str = ""
    client: str = ""
    created_date: str = ""


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


class IfcExportInput(BaseModel):
    name: str = "ARCHITEX-CAD Export"
    site_name: str = "Site"
    elements: list[dict[str, Any]] = Field(default_factory=list)


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


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    """Return status of all subsystems: DB, OCC geometry engine, and AI providers."""
    import os

    # Database connectivity check + integrity
    db_status = "ok"
    db_integrity = "ok"
    try:
        from calculations.core.calculation_db import load_reviews
        from calculations.project.project_store import _conn as _proj_conn, integrity_check
        load_reviews("_health_check_probe_")
        _c = _proj_conn()
        db_integrity = "ok" if integrity_check(_c) else "corrupt"
        _c.close()
    except Exception as e:
        db_status = f"error: {e}"

    # OCC geometry engine check
    try:
        from bim.geometry_kernel import boolean_operation  # noqa: F401
        occ_status = "available"
    except Exception:
        occ_status = "unavailable"

    # AI provider checks (no key = degraded, not error)
    gemini_key = bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))
    anthropic_key = bool(os.environ.get("ANTHROPIC_API_KEY"))
    try:
        from ai.claude_client import _ANTHROPIC_AVAILABLE  # noqa: F401
        anthropic_pkg = _ANTHROPIC_AVAILABLE
    except Exception:
        anthropic_pkg = False

    subsystems = {
        "database": db_status,
        "db_integrity": db_integrity,
        "occ_geometry": occ_status,
        "ai_gemini": "key_present" if gemini_key else "no_key",
        "ai_anthropic": ("key_present" if anthropic_key else "no_key") if anthropic_pkg else "package_missing",
    }

    overall = "ok" if (db_status == "ok" and db_integrity == "ok") else "degraded"
    return {"status": overall, "subsystems": subsystems, "version": "1.0.0"}


# ---------------------------------------------------------------------------
# Vision routes
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Reviews
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# PDF export
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# BIM / IFC export
# ---------------------------------------------------------------------------

@app.post("/bim/export-ifc")
def bim_export_ifc(inputs: IfcExportInput):
    try:
        return export_ifc_from_elements(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# BoQ routes
# ---------------------------------------------------------------------------

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


@app.post("/boq/extract-from-bim")
def boq_extract_from_bim(inputs: BimExtractInput):
    try:
        return extract_from_bim(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# BIM & geometry routes
# ---------------------------------------------------------------------------

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


@app.post("/bim/clash-scan")
def bim_clash_scan(payload: dict[str, Any]):
    """Model-wide AABB clash scan — structural vs MEP or all pairs."""
    try:
        from bim.clash_detection import scan_model_clashes
        return scan_model_clashes(
            payload.get("elements", []),
            tolerance_m=float(payload.get("tolerance_m", 0.01)),
            min_overlap_m3=float(payload.get("min_overlap_m3", 0.001)),
            discipline_filter=payload.get("discipline_filter"),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# AI routes
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Finance
# ---------------------------------------------------------------------------

@app.post("/finance/live-pricing")
def finance_live_pricing_endpoint(req: PricingRequest):
    try:
        return get_live_pricing(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Project routes
# ---------------------------------------------------------------------------

@app.post("/project/save")
def project_save_endpoint(inputs: ProjectSaveInputs):
    try:
        return project_store.save_project(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/project/{project_id}/autosave")
def project_autosave_endpoint(project_id: str, payload: dict[str, Any]):
    """Store a rolling auto-save snapshot (max 5 per project, oldest purged automatically)."""
    try:
        return project_store.auto_save_project(project_id, payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/project/{project_id}/autosaves")
def project_autosaves_endpoint(project_id: str):
    """Retrieve available auto-save snapshots for recovery."""
    try:
        return {"snapshots": project_store.get_autosave_snapshots(project_id)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/projects")
def list_projects_endpoint():
    """List all projects ordered by most recently updated."""
    try:
        return {"projects": project_store.list_projects()}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/project/ifc-calc-link")
def project_ifc_calc_link(payload: dict[str, Any]):
    """Audit log: IFC element selection linked to calculator prefill."""
    try:
        project_id = payload.get("project_id", "default")
        module = f"ifc_bridge_{payload.get('calc_module', 'unknown')}"
        return project_store.save_calculation(
            project_id,
            module,
            {
                "ifc_global_id": payload.get("ifc_global_id"),
                "ifc_express_id": payload.get("ifc_express_id"),
                "ifc_type": payload.get("ifc_type"),
                "calc_module": payload.get("calc_module"),
                "confidence": payload.get("confidence"),
                "inputs": payload.get("inputs", {}),
            },
            {"audit": "ifc_to_calculator", "logged": True},
        )
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


# ---------------------------------------------------------------------------
# BoQ quantity verifier
# ---------------------------------------------------------------------------

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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
