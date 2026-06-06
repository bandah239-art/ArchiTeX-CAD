"""Energy system routes (solar, BESS, microgrid, hydro, biogas, wind, power systems)."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from calculations.energy.solar_pv import calculate_solar_pv
from calculations.energy.battery_storage import calculate_battery
from calculators.energy_bess import calculate_bess, BessRequest
from calculators.energy_microgrid import calculate_voltage_drop, MicrogridRequest
from calculators.energy_transmission import calculate_sag_tension, TransmissionRequest
from calculators.energy_hydro import calculate_hydro, HydroRequest
from calculators.energy_biogas import calculate_biogas, BiogasRequest
from calculators.energy_wind_wake import calculate_wind_wake, WindWakeRequest
from calculators.energy_grid_fault import calculate_grid_fault, GridFaultRequest
from calculators.energy_power_flow import run_power_flow, PowerFlowRequest
from calculators.energy_simulations import (
    simulate_solar_battery_day, SolarBatteryDayRequest,
    simulate_wind_wake_map, WindWakeMapRequest,
    simulate_hydro_curve, HydroCurveRequest,
)
from calculators.energy_extended_simulations import (
    simulate_voltage_drop_profile, VoltageDropRequest,
    simulate_biogas_yield_curve, BiogasYieldRequest,
    simulate_conductor_catenary, CatenaryRequest,
    simulate_fault_current_decay, FaultDecayRequest,
)
from calculations.circuit.spice_solver import solve_dc, solve_ac_sweep, solve_transient
from calculations.wind.panel_method import run_panel_cfd, building_shapes
from calculations.power.short_circuit import run_short_circuit
from calculations.power.protection import grading_chart
from calculations.power.harmonics import harmonic_spectrum
from calculations.core.engineer_control import wrap_calculation_result

router = APIRouter(tags=["energy"])


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


# ── Circuit / SPICE-lite ──────────────────────────────────────────────────────

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


# ── Wind CFD (panel method) ───────────────────────────────────────────────────

class WindCFDRequest(BaseModel):
    polygon_x: list[float]
    polygon_y: list[float]
    wind_speed_ms: float = 10.0
    wind_angle_deg: float = 0.0
    grid_nx: int = 30
    grid_ny: int = 25
    grid_margin: float = 2.5


# ── Power systems ─────────────────────────────────────────────────────────────

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


# ── /calculate/energy/* ───────────────────────────────────────────────────────

@router.post("/calculate/energy/solar")
def energy_solar(inputs: SolarPvInput):
    try:
        return wrap_calculation_result(calculate_solar_pv(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calculate/energy/battery")
def energy_battery(inputs: BatteryInput):
    try:
        return wrap_calculation_result(calculate_battery(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/energy/power-flow")
def energy_power_flow_endpoint(req: PowerFlowRequest):
    try:
        return run_power_flow(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── /energy/* ─────────────────────────────────────────────────────────────────

@router.post("/energy/bess")
def energy_bess_endpoint(req: BessRequest):
    try:
        return calculate_bess(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/energy/microgrid")
def energy_microgrid_endpoint(req: MicrogridRequest):
    try:
        return calculate_voltage_drop(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/energy/transmission")
def energy_transmission_endpoint(req: TransmissionRequest):
    try:
        return calculate_sag_tension(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/energy/hydro")
def energy_hydro_endpoint(req: HydroRequest):
    try:
        return calculate_hydro(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/energy/biogas")
def energy_biogas_endpoint(req: BiogasRequest):
    try:
        return calculate_biogas(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/energy/wind-wake")
def energy_wind_wake_endpoint(req: WindWakeRequest):
    try:
        return calculate_wind_wake(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/energy/grid-fault")
def energy_grid_fault_endpoint(req: GridFaultRequest):
    try:
        return calculate_grid_fault(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Energy simulations ────────────────────────────────────────────────────────

@router.post("/energy/simulation/solar-battery-day")
def solar_battery_day_endpoint(req: SolarBatteryDayRequest):
    try:
        return simulate_solar_battery_day(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/energy/simulation/wind-wake-map")
def wind_wake_map_endpoint(req: WindWakeMapRequest):
    try:
        return simulate_wind_wake_map(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/energy/simulation/hydro-curve")
def hydro_curve_endpoint(req: HydroCurveRequest):
    try:
        return simulate_hydro_curve(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/energy/simulation/voltage-drop")
def energy_voltage_drop_endpoint(req: VoltageDropRequest):
    try:
        return simulate_voltage_drop_profile(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/energy/simulation/biogas-yield")
def energy_biogas_yield_endpoint(req: BiogasYieldRequest):
    try:
        return simulate_biogas_yield_curve(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/energy/simulation/catenary")
def energy_catenary_endpoint(req: CatenaryRequest):
    try:
        return simulate_conductor_catenary(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/energy/simulation/fault-current-decay")
def energy_fault_decay_endpoint(req: FaultDecayRequest):
    try:
        return simulate_fault_current_decay(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Circuit / SPICE ───────────────────────────────────────────────────────────

@router.post("/circuit/dc")
def circuit_dc_endpoint(req: CircuitDCRequest):
    try:
        return solve_dc(req.components)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/circuit/ac-sweep")
def circuit_ac_endpoint(req: CircuitACRequest):
    try:
        return solve_ac_sweep(
            req.components, req.freq_start, req.freq_stop,
            req.n_pts, req.input_node, req.output_node,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/circuit/transient")
def circuit_transient_endpoint(req: CircuitTransientRequest):
    try:
        return solve_transient(req.components, req.t_stop, req.dt, req.output_nodes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Wind CFD ──────────────────────────────────────────────────────────────────

@router.post("/wind/cfd-panel")
def wind_cfd_endpoint(req: WindCFDRequest):
    try:
        return run_panel_cfd(
            req.polygon_x, req.polygon_y, req.wind_speed_ms,
            req.wind_angle_deg, req.grid_nx, req.grid_ny, req.grid_margin,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/wind/building-shapes")
def wind_shapes_endpoint():
    shapes = building_shapes()
    return {name: {"x": pts[0], "y": pts[1]} for name, pts in shapes.items()}


# ── Power systems ─────────────────────────────────────────────────────────────

@router.post("/power/short-circuit")
def power_sc_endpoint(req: ShortCircuitRequest):
    try:
        return run_short_circuit(
            req.system_voltage_kv, req.source_impedance_ohm,
            req.cable_length_km, req.cable_r_ohm_km, req.cable_x_ohm_km,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/power/relay-grading")
def power_relay_endpoint(req: RelayGradingRequest):
    try:
        return grading_chart(req.relays, req.fault_current_a, req.i_range_factor)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/power/harmonics")
def power_harmonics_endpoint(req: HarmonicRequest):
    try:
        return harmonic_spectrum(
            req.system_voltage_v, req.load_kva, req.system_impedance_ohm,
            req.cable_r_ohm, req.cable_x_ohm, req.fund_freq_hz,
            req.harmonic_profile, req.max_harmonic,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Phase 2 Enhanced Energy Calculators ──────────────────────────────────────

from typing import Any as _Any

@router.post("/energy/solar-pv/enhanced")
def energy_solar_pv_enhanced_endpoint(inputs: dict[str, _Any]):
    """Enhanced Solar PV+BESS: Zambia PSH by province, array/inverter/battery sizing,
    cable sizing (voltage drop 3%), system losses, ZMW BoQ with ZRA-compliant pricing."""
    try:
        from calculations.energy.solar_pv_enhanced import calculate_solar_pv_enhanced
        return calculate_solar_pv_enhanced(inputs)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
