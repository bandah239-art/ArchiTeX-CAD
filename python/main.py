from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import Any

from calculations.structural.beam import calculate_beam
from calculations.structural.slab import calculate_slab
from calculations.structural.column import calculate_column
from calculations.structural.foundation import calculate_foundation
from calculations.loads.load_combinations import calculate_loads
from calculations.civil.pavement import calculate_pavement
from calculations.civil.drainage import calculate_drainage
from boq.quantity_extractor import extract_quantities
from boq.boq_compiler import compile_boq
from boq.excel_generator import generate_boq_excel_bytes
from boq.pdf_generator import generate_boq_pdf_bytes
from geo.geo_intelligence import run_site_analysis
from geo.terrain_analyser import analyse_terrain
from geo.soil_intelligence import analyse_soil
from geo.climate_intelligence import analyse_climate
from geo.seismic_intelligence import analyse_seismic
from bim.ifc_to_boq import extract_from_bim
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


class LoadInputs(BaseModel):
    dead_load_g: float = Field(..., ge=0, description="Dead load Gk")
    imposed_load_q: float = Field(..., ge=0, description="Imposed load Qk")
    wind_load_w: float = Field(0, ge=0, description="Wind load Wk")
    snow_load_s: float = Field(0, ge=0, description="Snow load Sk")
    load_type: str = Field("udl", pattern="^(udl|area)$")
    design_code: str = Field("eurocode", pattern="^(eurocode|aci318)$")
    structure_class: str = Field("ordinary")


class PavementInputs(BaseModel):
    road_class: str = Field("secondary", pattern="^(trunk|primary|secondary|feeder)$")
    traffic_count: float = Field(..., gt=0, description="AADT vehicles/day")
    heavy_vehicle_pct: float = Field(12, ge=0, le=100, description="Heavy vehicle %")
    design_life: float = Field(20, gt=0, description="Design life years")
    cbr_subgrade: float = Field(..., gt=0, description="Subgrade CBR %")
    subbase_material: str = Field("natural_gravel")
    base_material: str = Field("crushed_stone")
    climate_zone: str = Field("semi_arid", pattern="^(wet|dry|semi_arid)$")
    country: str = Field("Zambia")


class DrainageInputs(BaseModel):
    catchment_area: float = Field(..., gt=0, description="Catchment area ha")
    rainfall_intensity: float = Field(0, ge=0, description="Rainfall intensity mm/hr")
    runoff_coefficient: float = Field(0.85, ge=0, le=1)
    pipe_gradient: float = Field(1.5, gt=0, description="Pipe gradient %")
    pipe_material: str = Field("concrete", pattern="^(concrete|hdpe|corrugated_steel)$")
    pipe_length: float = Field(100, gt=0, description="Pipe length m")
    country: str = Field("Zambia")
    region: str = Field("")


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


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/calculate/beam")
def calculate_beam_endpoint(inputs: BeamInputs):
    try:
        payload = inputs.model_dump()
        payload["imposed_load"] = payload.pop("live_load")
        return calculate_beam(payload)
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/slab")
def calculate_slab_endpoint(inputs: SlabInputs):
    try:
        return calculate_slab(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/column")
def calculate_column_endpoint(inputs: ColumnInputs):
    try:
        return calculate_column(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/foundation")
def calculate_foundation_endpoint(inputs: FoundationInputs):
    try:
        return calculate_foundation(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/loads")
def calculate_loads_endpoint(inputs: LoadInputs):
    try:
        return calculate_loads(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/road/pavement")
def calculate_pavement_endpoint(inputs: PavementInputs):
    try:
        return calculate_pavement(inputs.model_dump())
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calculate/road/drainage")
def calculate_drainage_endpoint(inputs: DrainageInputs):
    try:
        return calculate_drainage(inputs.model_dump())
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
