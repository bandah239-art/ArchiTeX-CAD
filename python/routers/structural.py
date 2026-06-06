"""Structural engineering routes (beam, slab, column, foundation, steel, timber, masonry, FEA)."""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from fastapi.responses import Response

from calculations.structural.beam import calculate_beam
from calculations.structural.slab import calculate_slab
from calculations.structural.column import calculate_column
from calculations.structural.foundation import calculate_foundation
from calculations.structural.bs8110_beam import run_bs8110_beam
from calculations.structural.bs8110_slab import run_bs8110_slab
from calculations.structural.bs8110_column import run_bs8110_column
from calculations.structural.masonry_bs5628 import run_masonry_wall
from calculations.structural.bearings import calculate_bearing
from calculations.structural.steel import calculate_steel_beam
from calculations.structural.timber import calculate_timber_beam
from calculations.structural.crack_width import run_crack_width
from calculations.structural.winkler import run_winkler
from calculations.structural.fire_and_anchorage import (
    check_beam_fire, check_slab_fire, check_column_fire,
    anchorage_length, lap_length,
)
from calculations.fea.solver_2d import run_fea_calculation
from calculations.loads.load_combinations import calculate_loads, generate_load_combinations
from calculations.loads.wind_loads import calculate_wind_loads
from calculations.materials.selector import recommend_material
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
from calculations.core.engineer_control import wrap_calculation_result
from calculations.project import project_store
from data.african_conditions import apply_local_adjustments
from calculators.structural_simulations import (
    simulate_beam_bmd_sfd, BeamSimRequest,
    simulate_foundation_pressure, FoundationPressureRequest,
)
from calculators.structural_more_simulations import (
    simulate_slab_moments, SlabSimRequest,
    simulate_pm_interaction, PMSimRequest,
    simulate_wind_facade, WindFacadeRequest,
)

router = APIRouter(tags=["structural"])

# ── Pydantic models ───────────────────────────────────────────────────────────

class FeaInputs(BaseModel):
    model_config = {"extra": "allow"}
    height: float = Field(4.0, gt=0)
    span: float = Field(6.0, gt=0)
    lateral_load: float = 20000.0
    vertical_load: float = -50000.0
    support_type: str = "fixed"
    E: float = 2.0e11
    A: float = 0.01
    I: float = 1.0e-5


class BeamInputs(BaseModel):
    model_config = {"extra": "allow"}
    span: float = Field(..., gt=0)
    dead_load: float = Field(..., ge=0)
    live_load: float = Field(..., ge=0)
    width: float = Field(..., gt=0)
    depth: float = Field(..., gt=0)
    fck: float = Field(30, gt=0)
    fyk: float = Field(500, gt=0)
    support_condition: str = "simply_supported"
    exposure_class: str = "XC1"
    design_code: str = "Eurocode2"
    country: str = "Zambia"


class SlabInputs(BaseModel):
    model_config = {"extra": "allow"}
    slab_type: str = "two_way"
    span_lx: float = Field(..., gt=0)
    span_ly: float = Field(..., gt=0)
    dead_load: float = Field(..., ge=0)
    live_load: float = Field(..., ge=0)
    depth: float = Field(..., gt=0)
    fck: float = Field(25.0, gt=0)
    fyk: float = Field(460.0, gt=0)
    support_condition: str = "simply_supported"
    country: str = "Zambia"


class ColumnInputs(BaseModel):
    model_config = {"extra": "allow"}
    height: float = Field(..., gt=0)
    width: float = Field(..., gt=0)
    depth: float = Field(..., gt=0)
    axial_load: float = Field(..., gt=0)
    moment_major: float = Field(0, ge=0)
    moment_minor: float = Field(0, ge=0)
    fck: float = Field(25.0, gt=0)
    fyk: float = Field(460.0, gt=0)
    le_factor: float = Field(1.0, gt=0)
    country: str = "Zambia"


class FoundationInputs(BaseModel):
    foundation_type: str = Field("pad", pattern="^(pad|strip|raft)$")
    column_load: float = Field(..., gt=0)
    moment_x: float = Field(0, ge=0)
    moment_y: float = Field(0, ge=0)
    soil_bearing: float = Field(..., gt=0)
    soil_unit_weight: float = Field(18, gt=0)
    foundation_depth: float = Field(..., gt=0)
    foundation_width: float = Field(1.0, gt=0)
    foundation_length: float = Field(1.0, gt=0)
    foundation_depth_concrete: float = Field(400, gt=0)
    fck: float = Field(25, gt=0)
    fyk: float = Field(500, gt=0)
    column_width: float = Field(300, gt=0)
    column_depth: float = Field(300, gt=0)
    exposure_class: str = "XC1"
    country: str = "Zambia"


class SteelInputs(BaseModel):
    length: float = Field(..., gt=0)
    fy: float = Field(275, gt=0)
    w: float = Field(20, ge=0)
    Wpl: float = Field(721, gt=0)
    Aw: float = Field(22.8, gt=0)


class TimberInputs(BaseModel):
    length: float = Field(..., gt=0)
    b: float = Field(..., gt=0)
    h: float = Field(..., gt=0)
    fm_k: float = Field(24, gt=0)
    fv_k: float = Field(4.0, gt=0)
    E0_mean: float = Field(11000, gt=0)
    k_mod: float = Field(0.8, gt=0)
    w: float = Field(5, ge=0)
    w_sls: float = Field(3.5, ge=0)


class MasonryInputs(BaseModel):
    width: float = Field(..., gt=0)
    height: float = Field(..., gt=0)
    length: float = Field(..., gt=0)
    load_type: str = "udl"
    axial_load: float = Field(..., ge=0)
    moment: float = Field(0.0, ge=0)
    brick_class: str = "3"
    mortar_designation: str = "ii"
    wall_condition: str = "normal"
    restraint_top: str = "restrained"
    restraint_bottom: str = "restrained"
    openings: bool = False
    project_id: str = "default"


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


class LoadInputs(BaseModel):
    model_config = {"extra": "allow"}
    dead_load_g: float = Field(..., ge=0)
    imposed_load_q: float = Field(..., ge=0)
    wind_load_w: float = Field(0, ge=0)
    snow_load_s: float = Field(0, ge=0)
    load_type: str = Field("udl")
    design_code: str = Field("eurocode")
    structure_class: str = Field("ordinary")


class LoadCombinationsInput(BaseModel):
    gk: float = Field(..., ge=0)
    qk: float = Field(..., ge=0)
    wk: float = Field(0, ge=0)
    ek: float = Field(0, ge=0)
    code: str = Field("EC0")
    unit: str = Field("kN/m")


class WindInputs(BaseModel):
    basic_wind_speed: float = Field(45, gt=0)
    building_height: float = Field(12, gt=0)
    building_width: float = Field(20, gt=0)
    building_length: float = Field(30, gt=0)
    exposure_category: str = Field("B", pattern="^(A|B|C|D|0|I|II|III|IV)$")


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


class PressurePayload(BaseModel):
    model_config = {"extra": "allow"}


# ── BS 8110 moment coefficients ───────────────────────────────────────────────

MOMENT_COEFF: dict[str, float] = {
    "simply_supported":     1 / 8,
    "continuous":           0.086,
    "cantilever":           0.5,
    "one_end_continuous":   0.086,
    "both_ends_continuous": 0.063,
    "propped_cantilever":   0.125,
}


def _pressure_endpoint(fn, inputs: PressurePayload):
    try:
        return wrap_calculation_result(fn(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── FEA ───────────────────────────────────────────────────────────────────────

@router.post("/calculate/fea")
def calculate_fea_endpoint(inputs: FeaInputs):
    try:
        return wrap_calculation_result(run_fea_calculation(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Beam ──────────────────────────────────────────────────────────────────────

@router.post("/calculate/beam")
def calculate_beam_endpoint(inputs: BeamInputs):
    try:
        data = inputs.model_dump()
        dcode = data.get("design_code", "Eurocode2")
        proj_id = data.get("project_id", "default")

        if dcode in ("BS8110", "BS_8110"):
            span = data["span"]
            wu = 1.4 * data["dead_load"] + 1.6 * data["live_load"]
            coeff = MOMENT_COEFF.get(data["support_condition"], 1 / 8)
            mu_calc = wu * span ** 2 * coeff
            v_calc = wu * span / 2
            m_knm = data.get("M_knm") or mu_calc
            v_kn = data.get("V_kn") or v_calc
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


# ── Slab ──────────────────────────────────────────────────────────────────────

@router.post("/calculate/slab")
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


# ── Column ────────────────────────────────────────────────────────────────────

@router.post("/calculate/column")
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


# ── Foundation ────────────────────────────────────────────────────────────────

@router.post("/calculate/load-takedown")
def calculate_load_takedown_endpoint(payload: dict[str, Any]):
    try:
        from calculations.structural.load_takedown import run_load_takedown
        res = run_load_takedown(payload)
        return wrap_calculation_result(res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calculate/foundation")
def calculate_foundation_endpoint(inputs: FoundationInputs):
    try:
        data = apply_local_adjustments(inputs.country, inputs.model_dump())
        result = wrap_calculation_result(calculate_foundation(data))
        try:
            bearing = calculate_foundation_bearing({
                "N": inputs.column_load,
                "Mx": inputs.moment_x,
                "My": inputs.moment_y,
                "B": inputs.foundation_width,
                "L": inputs.foundation_length,
                "bearing_method": "structural_linear",
            })
            result["pressure_bearing"] = bearing
        except Exception:
            pass
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calculate/bearing")
def calculate_bearing_endpoint(inputs: BearingInputs):
    try:
        return wrap_calculation_result(calculate_bearing(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Steel / Timber ────────────────────────────────────────────────────────────

@router.post("/calculate/steel")
def calculate_steel_endpoint(inputs: SteelInputs):
    try:
        return wrap_calculation_result(calculate_steel_beam(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calculate/timber")
def calculate_timber_endpoint(inputs: TimberInputs):
    try:
        return wrap_calculation_result(calculate_timber_beam(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Masonry ───────────────────────────────────────────────────────────────────

@router.post("/calculate/masonry")
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
            openings=inputs.openings,
        )
        project_store.save_calculation(inputs.project_id, "masonry", inputs.model_dump(), res)
        return wrap_calculation_result(res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Materials ─────────────────────────────────────────────────────────────────

@router.post("/materials/recommend")
def materials_recommend_endpoint(inputs: MaterialSelectorInputs):
    try:
        return recommend_material(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Loads ─────────────────────────────────────────────────────────────────────

@router.post("/calculate/loads")
def calculate_loads_endpoint(inputs: LoadInputs):
    try:
        return wrap_calculation_result(calculate_loads(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calculate/load-combinations")
def calculate_load_combinations_endpoint(inputs: LoadCombinationsInput):
    try:
        return generate_load_combinations(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calculate/wind")
def calculate_wind_endpoint(inputs: WindInputs):
    try:
        return wrap_calculation_result(calculate_wind_loads(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Pressure modules ──────────────────────────────────────────────────────────

@router.post("/pressure/foundation-bearing")
def pressure_foundation_bearing(inputs: PressurePayload):
    return _pressure_endpoint(calculate_foundation_bearing, inputs)


@router.post("/pressure/lateral-earth")
def pressure_lateral_earth(inputs: PressurePayload):
    return _pressure_endpoint(calculate_lateral_earth, inputs)


@router.post("/pressure/wind-distribution")
def pressure_wind_distribution(inputs: PressurePayload):
    return _pressure_endpoint(calculate_wind_distribution, inputs)


@router.post("/pressure/boussinesq")
def pressure_boussinesq(inputs: PressurePayload):
    return _pressure_endpoint(calculate_boussinesq, inputs)


@router.post("/pressure/consolidation")
def pressure_consolidation(inputs: PressurePayload):
    return _pressure_endpoint(calculate_consolidation, inputs)


@router.post("/pressure/bridge-hydrostatic")
def pressure_bridge_hydrostatic(inputs: PressurePayload):
    return _pressure_endpoint(calculate_bridge_hydrostatic, inputs)


@router.post("/pressure/bridge-hydrodynamic")
def pressure_bridge_hydrodynamic(inputs: PressurePayload):
    return _pressure_endpoint(calculate_bridge_hydrodynamic, inputs)


@router.post("/pressure/bridge-foundation")
def pressure_bridge_foundation(inputs: PressurePayload):
    return _pressure_endpoint(calculate_bridge_foundation, inputs)


@router.post("/pressure/pavement-pressure")
def pressure_pavement(inputs: PressurePayload):
    return _pressure_endpoint(calculate_pavement_pressure, inputs)


@router.post("/pressure/pipe-pressure")
def pressure_pipe(inputs: PressurePayload):
    return _pressure_endpoint(calculate_pipe_pressure, inputs)


@router.post("/pressure/tank-pressure")
def pressure_tank(inputs: PressurePayload):
    return _pressure_endpoint(calculate_tank_pressure, inputs)


# ── Structural simulations ────────────────────────────────────────────────────

@router.post("/structural/simulation/beam-bmd-sfd")
def struct_beam_sim_endpoint(req: BeamSimRequest):
    try:
        return simulate_beam_bmd_sfd(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/structural/simulation/foundation-pressure")
def struct_foundation_sim_endpoint(req: FoundationPressureRequest):
    try:
        return simulate_foundation_pressure(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/structural/simulation/slab-moments")
def struct_slab_sim_endpoint(req: SlabSimRequest):
    try:
        return simulate_slab_moments(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/structural/simulation/pm-interaction")
def struct_pm_sim_endpoint(req: PMSimRequest):
    try:
        return simulate_pm_interaction(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/structural/simulation/wind-facade")
def struct_wind_sim_endpoint(req: WindFacadeRequest):
    try:
        return simulate_wind_facade(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Advanced structural checks ────────────────────────────────────────────────

@router.post("/structural/winkler")
def winkler_endpoint(req: WinklerRequest):
    try:
        return run_winkler(
            req.L_m, req.B_m, req.EI_knm2, req.ks_knm3,
            req.load_type, req.q_knm, req.P_kn,
            req.point_loads or None, req.support, req.n_el,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/structural/crack-width")
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


@router.post("/structural/fire-anchorage")
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


# ── Phase 2 Enhanced EC2 Calculators ─────────────────────────────────────────

@router.post("/calculate/beam/ec2-enhanced")
def beam_ec2_enhanced_endpoint(inputs: dict[str, Any]):
    """Full EC2 beam: T-beam, torsion (cl.6.3), crack width (cl.7.3.4),
    shear strut optimization, moment redistribution, BMD/SFD, rebar schedule."""
    try:
        from calculations.structural.beam_ec2_enhanced import calculate_beam_ec2
        return wrap_calculation_result(calculate_beam_ec2(inputs))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calculate/slab/ec2-enhanced")
def slab_ec2_enhanced_endpoint(inputs: dict[str, Any]):
    """Full EC2 slab: two-way Marcus (cl.5.3), flat slab punching shear (cl.6.4),
    yield line, span/d deflection check (Table 7.4N), construction load."""
    try:
        from calculations.structural.slab_ec2_enhanced import calculate_slab_ec2
        return wrap_calculation_result(calculate_slab_ec2(inputs))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calculate/column/ec2-enhanced")
def column_ec2_enhanced_endpoint(inputs: dict[str, Any]):
    """Full EC2 column: slender second-order nominal curvature method (cl.5.8.8),
    biaxial bending Bresler (cl.5.8.9), P-M interaction diagram, splice length (cl.8.7)."""
    try:
        from calculations.structural.column_ec2_enhanced import calculate_column_ec2
        return wrap_calculation_result(calculate_column_ec2(inputs))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calculate/foundation/ec7-enhanced")
def foundation_ec7_enhanced_endpoint(inputs: dict[str, Any]):
    """Enhanced foundation: eccentric Meyerhof effective area, combined footing,
    pile cap 2/3/4-pile (EC2 Annex H), bearing pressure diagram."""
    try:
        from calculations.structural.foundation_ec7_enhanced import calculate_foundation_ec7
        return wrap_calculation_result(calculate_foundation_ec7(inputs))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calculate/wind/ec1")
def wind_loads_ec1_endpoint(inputs: dict[str, Any]):
    """EC1 wind loads: full chain vb→vm→Iv→qp→we/wi (EN 1991-1-4),
    Zambia province wind map, Cpe for pitched/flat roofs, Cpi, Cs·Cd."""
    try:
        from calculations.loads.wind_loads_ec1 import calculate_wind_loads_ec1
        return wrap_calculation_result(calculate_wind_loads_ec1(inputs))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calculate/load-combinations/ec0")
def load_combinations_ec0_endpoint(inputs: dict[str, Any]):
    """All EC0 combination types: ULS fundamental (Eq.6.10/6.10a/6.10b),
    SLS characteristic/frequent/quasi-permanent, accidental, seismic, ACI 318, BS8110."""
    try:
        from calculations.loads.load_combinations_ec0 import generate_load_combinations_ec0
        return generate_load_combinations_ec0(inputs)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
