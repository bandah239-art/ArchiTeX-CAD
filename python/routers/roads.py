"""Roads & transport routes."""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from calculations.roads.flexible_pavement import calculate_pavement
from calculations.roads.hydrology import calculate_drainage
from calculations.roads.geometric_design import calculate_geometric_design
from calculations.roads.traffic_load import calculate_traffic_load
from calculations.roads.gravel_road import run_gravel_road_design
from calculations.core.engineer_control import wrap_calculation_result
from calculations.project import project_store
from calculators.road_simulations import (
    simulate_pavement_stress, PavementStressRequest,
    simulate_esal_growth, ESALGrowthRequest,
    simulate_stormwater_hydrograph, HydrographRequest,
)

router = APIRouter(tags=["roads"])


class PavementInputs(BaseModel):
    road_class: str = Field("secondary", pattern="^(trunk|primary|secondary|feeder)$")
    traffic_count: float = Field(..., gt=0)
    heavy_vehicle_pct: float = Field(12.0, ge=0, le=100)
    design_life: int = Field(20, gt=0)
    cbr_subgrade: float = Field(6.0, gt=0)
    subbase_material: str = Field("natural_gravel")
    base_material: str = Field("crushed_stone")
    climate_zone: str = Field("semi_arid")
    country: str = Field("Zambia")


class DrainageInputs(BaseModel):
    catchment_area: float = Field(..., gt=0)
    rainfall_intensity: float = Field(0, ge=0)
    runoff_coefficient: float = Field(0.6, gt=0, le=1.0)
    pipe_gradient: float = Field(1.5, gt=0)
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


@router.post("/calculate/road/pavement")
def calculate_pavement_endpoint(inputs: PavementInputs):
    try:
        return wrap_calculation_result(calculate_pavement(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calculate/road/drainage")
def calculate_drainage_endpoint(inputs: DrainageInputs):
    try:
        return wrap_calculation_result(calculate_drainage(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/roads/geometric-design")
def calculate_geometric_design_endpoint(inputs: GeometricDesignInputs):
    try:
        return wrap_calculation_result(calculate_geometric_design(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/roads/traffic-load")
def calculate_traffic_load_endpoint(inputs: TrafficLoadInputs):
    try:
        return wrap_calculation_result(calculate_traffic_load(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/roads/gravel-design")
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
            road_length_km=inputs.road_length_km,
        )
        project_store.save_calculation(inputs.project_id, "gravel_road", inputs.model_dump(), res)
        return wrap_calculation_result(res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Simulations ───────────────────────────────────────────────────────────────

@router.post("/road/simulation/pavement-stress")
def road_pavement_sim_endpoint(req: PavementStressRequest):
    try:
        return simulate_pavement_stress(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/road/simulation/esal-growth")
def road_esal_sim_endpoint(req: ESALGrowthRequest):
    try:
        return simulate_esal_growth(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/road/simulation/stormwater-hydrograph")
def road_hydro_sim_endpoint(req: HydrographRequest):
    try:
        return simulate_stormwater_hydrograph(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Phase 2 Enhanced Roads Calculators ───────────────────────────────────────

from typing import Any as _Any

@router.post("/calculate/road/pavement/aashto")
def roads_pavement_aashto_endpoint(inputs: dict[str, _Any]):
    """AASHTO 1993 flexible pavement: ESAL calculation, SN = a1D1+a2m2D2+a3m3D3,
    Zambia climate CBR reduction, layer thicknesses, material quantities per km."""
    try:
        from calculations.roads.aashto_pavement_enhanced import calculate_pavement_aashto_enhanced
        return calculate_pavement_aashto_enhanced(inputs)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calculate/road/hydrology/enhanced")
def roads_hydrology_enhanced_endpoint(inputs: dict[str, _Any]):
    """Roads hydrology: Rational method Q=CiA, Zambia IDF curves by province,
    Kirpich/FAA Tc, Manning culvert sizing, roadside drain, storm hydrograph."""
    try:
        from calculations.roads.hydrology_enhanced import calculate_drainage_enhanced
        return calculate_drainage_enhanced(inputs)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
