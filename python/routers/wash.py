"""WASH (Water, Sanitation & Hygiene) routes."""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from calculations.wash.water_demand import calculate_water_demand
from calculations.wash.borehole import calculate_borehole
from calculations.wash.sewer_design import calculate_sewer_design
from calculations.wash.pipe_network import analyze_pipe_network
from calculations.wash.treatment_plant import calculate_treatment_plant
from calculations.wash.water_hammer import run_water_hammer
from calculators.wash_water_tower import calculate_water_tower, WaterTowerRequest
from calculators.wash_epanet import calculate_pipe_network, PipeNetworkRequest
from calculators.wash_dewats import calculate_dewats, DewatsRequest
from calculators.wash_wtp import calculate_wtp, WTPRequest
from calculators.wash_stormwater import calculate_stormwater, StormwaterRequest
from calculators.wash_landfill import calculate_landfill, LandfillRequest
from calculators.wash_irrigation import calculate_irrigation, IrrigationRequest
from calculators.wash_simulations import (
    simulate_water_tower_day, WaterTowerDayRequest,
    simulate_pipe_pressure_profile, PipePressureRequest,
)
from calculators.environment_simulations import (
    simulate_landfill_gas, LandfillGasRequest,
    simulate_soil_moisture, SoilMoistureRequest,
    simulate_tank_hoop_stress, TankHoopRequest,
)
from calculations.core.engineer_control import wrap_calculation_result

router = APIRouter(tags=["wash"])


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


class PipeNetworkLegacyInput(BaseModel):
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


# ── Legacy /wash/* endpoints ──────────────────────────────────────────────────

@router.post("/wash/water-demand")
def wash_water_demand_endpoint(inputs: WashDemandInput):
    try:
        return wrap_calculation_result(calculate_water_demand(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/wash/pipe-network")
def wash_pipe_network_endpoint(inputs: PipeNetworkLegacyInput):
    try:
        return wrap_calculation_result(analyze_pipe_network(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/wash/sewer-design")
def wash_sewer_design_endpoint(inputs: SewerDesignInput):
    try:
        return wrap_calculation_result(calculate_sewer_design(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/wash/borehole")
def wash_borehole_endpoint(inputs: BoreholeInput):
    try:
        return wrap_calculation_result(calculate_borehole(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/wash/treatment-plant")
def wash_treatment_plant_endpoint(inputs: TreatmentPlantInput):
    try:
        return wrap_calculation_result(calculate_treatment_plant(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── /calculate/wash/* aliases ─────────────────────────────────────────────────

@router.post("/calculate/wash/demand")
def wash_demand(inputs: WashDemandInput):
    try:
        return wrap_calculation_result(calculate_water_demand(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calculate/wash/borehole")
def wash_borehole(inputs: BoreholeInput):
    try:
        return wrap_calculation_result(calculate_borehole(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calculate/wash/sewerage")
def wash_sewerage(inputs: SewerDesignInput):
    try:
        return wrap_calculation_result(calculate_sewer_design(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Calculator-based endpoints ────────────────────────────────────────────────

@router.post("/wash/water-tower")
def wash_water_tower_endpoint(req: WaterTowerRequest):
    try:
        return calculate_water_tower(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/wash/epanet")
def wash_epanet_endpoint(req: PipeNetworkRequest):
    try:
        return calculate_pipe_network(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/wash/dewats")
def wash_dewats_endpoint(req: DewatsRequest):
    try:
        return calculate_dewats(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/wash/wtp")
def wash_wtp_endpoint(req: WTPRequest):
    try:
        return calculate_wtp(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/wash/stormwater")
def wash_stormwater_endpoint(req: StormwaterRequest):
    try:
        return calculate_stormwater(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/wash/landfill")
def wash_landfill_endpoint(req: LandfillRequest):
    try:
        return calculate_landfill(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/wash/irrigation")
def wash_irrigation_endpoint(req: IrrigationRequest):
    try:
        return calculate_irrigation(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Simulations ───────────────────────────────────────────────────────────────

@router.post("/wash/simulation/water-tower-day")
def wash_tower_sim_endpoint(req: WaterTowerDayRequest):
    try:
        return simulate_water_tower_day(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/wash/simulation/pipe-pressure")
def wash_pipe_sim_endpoint(req: PipePressureRequest):
    try:
        return simulate_pipe_pressure_profile(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/wash/water-hammer")
def water_hammer_endpoint(req: WaterHammerRequest):
    try:
        return run_water_hammer(
            req.D_mm, req.t_mm, req.L_m, req.V0_ms,
            req.Tc_s, req.H_static_m, req.E_pipe_gpa,
            req.pipe_material, safety_factor=req.safety_factor,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Environment simulations (grouped here as WASH-adjacent) ───────────────────

@router.post("/env/simulation/landfill-gas")
def env_landfill_sim_endpoint(req: LandfillGasRequest):
    try:
        return simulate_landfill_gas(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/env/simulation/soil-moisture")
def env_soil_sim_endpoint(req: SoilMoistureRequest):
    try:
        return simulate_soil_moisture(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/env/simulation/tank-hoop-stress")
def env_tank_sim_endpoint(req: TankHoopRequest):
    try:
        return simulate_tank_hoop_stress(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Phase 2 Enhanced WASH Calculators ────────────────────────────────────────

from typing import Any as _Any

@router.post("/wash/water-demand/enhanced")
def wash_demand_enhanced_endpoint(inputs: dict[str, _Any]):
    """Water demand: geometric/arithmetic/logistic population projection,
    per-capita by community type, PHF/PDF peak factors, NRW 25%, institutions."""
    try:
        from calculations.wash.water_demand_enhanced import calculate_water_demand_enhanced
        return calculate_water_demand_enhanced(inputs)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/wash/borehole/enhanced")
def wash_borehole_enhanced_endpoint(inputs: dict[str, _Any]):
    """Borehole design: Theis drawdown + Cooper-Jacob simplification,
    TDH pump power, standard motor selection, casing sizing, gravel pack spec."""
    try:
        from calculations.wash.borehole_enhanced import calculate_borehole_enhanced
        return calculate_borehole_enhanced(inputs)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/wash/pipe-network/hw")
def wash_pipe_network_hw_endpoint(inputs: dict[str, _Any]):
    """Pipe network analysis: Hazen-Williams headloss + Hardy-Cross iteration,
    pressure zones min 7m/max 70m, velocity 0.5–2.5 m/s check."""
    try:
        from calculations.wash.pipe_network_hw import calculate_pipe_network_hw
        return calculate_pipe_network_hw(inputs)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
