from __future__ import annotations
import math
from pydantic import BaseModel, Field

# ── Voltage Drop Profile ──────────────────────────────────────────────────────

_RHO = {"copper": 1.72e-8, "aluminum": 2.82e-8}  # Ω·m at 20°C
_STD_CSA_MM2 = [1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0, 70.0, 95.0, 120.0, 150.0, 185.0, 240.0, 300.0]
_N_PROFILE = 30


class VoltageDropRequest(BaseModel):
    cable_length_m: float = Field(250.0, gt=0)
    load_current_amps: float = Field(45.0, gt=0)
    system_voltage: float = Field(230.0, gt=0)
    cable_material: str = Field("aluminum")
    max_voltage_drop_percent: float = Field(5.0, gt=0, le=30)


def simulate_voltage_drop_profile(req: VoltageDropRequest) -> dict:
    rho = _RHO.get(req.cable_material.lower(), _RHO["aluminum"])
    L = req.cable_length_m
    I = req.load_current_amps
    V_src = req.system_voltage
    max_vd_frac = req.max_voltage_drop_percent / 100.0

    # Required CSA for single-phase two-conductor run: V_drop = 2·I·ρ·L / A
    csa_req_m2 = 2.0 * I * rho * L / (V_src * max_vd_frac)
    csa_req_mm2 = csa_req_m2 * 1e6

    selected_mm2 = next((s for s in _STD_CSA_MM2 if s >= csa_req_mm2), _STD_CSA_MM2[-1])
    A_m2 = selected_mm2 * 1e-6
    R_per_m = rho / A_m2  # Ω/m per conductor

    xs = [L * i / (_N_PROFILE - 1) for i in range(_N_PROFILE)]
    vs = [round(V_src - 2.0 * I * R_per_m * x, 3) for x in xs]

    vd_v = V_src - vs[-1]
    vd_pct = vd_v / V_src * 100.0

    return {
        "x_m": xs,
        "voltage_v": vs,
        "v_source": V_src,
        "v_end": round(vs[-1], 3),
        "vd_actual_v": round(vd_v, 3),
        "vd_actual_pct": round(vd_pct, 2),
        "max_vd_pct": req.max_voltage_drop_percent,
        "csa_required_mm2": round(csa_req_mm2, 2),
        "csa_selected_mm2": selected_mm2,
        "material": req.cable_material,
        "passes": vd_pct <= req.max_voltage_drop_percent,
    }


# ── Biogas Yield Curve ────────────────────────────────────────────────────────

_WASTE_KG_PER_HEAD = {"cattle": 10.0, "poultry": 0.1, "human": 0.3}
_VS_FRACTION = 0.70
_BASE_YIELD_M3_PER_KG_VS = 0.40  # at 35°C mesophilic
_LOADING_RATE_KG_VS_M3_D = 2.0


class BiogasYieldRequest(BaseModel):
    cattle_count: int = Field(50, ge=0)
    poultry_count: int = Field(0, ge=0)
    human_count: int = Field(10, ge=0)
    temperature_c: float = Field(25.0)


def _temp_correction(T: float) -> float:
    """Gaussian efficiency curve centred at 35°C mesophilic optimum."""
    return math.exp(-0.0025 * (T - 35.0) ** 2)


def simulate_biogas_yield_curve(req: BiogasYieldRequest) -> dict:
    daily_waste_kg = (
        req.cattle_count * _WASTE_KG_PER_HEAD["cattle"]
        + req.poultry_count * _WASTE_KG_PER_HEAD["poultry"]
        + req.human_count * _WASTE_KG_PER_HEAD["human"]
    )
    vs_kgd = daily_waste_kg * _VS_FRACTION

    # Temperature curve: 5°C to 65°C in 1°C steps
    temps = [5.0 + i for i in range(61)]
    yields = [round(vs_kgd * _BASE_YIELD_M3_PER_KG_VS * _temp_correction(t), 3) for t in temps]

    f_t = _temp_correction(req.temperature_c)
    biogas_m3d = vs_kgd * _BASE_YIELD_M3_PER_KG_VS * f_t

    return {
        "temp_c": temps,
        "biogas_m3_d": yields,
        "design_temp_c": req.temperature_c,
        "design_biogas_m3_d": round(biogas_m3d, 2),
        "design_gas_energy_kwh_d": round(biogas_m3d * 6.5, 2),
        "daily_waste_kg": round(daily_waste_kg, 1),
        "vs_total_kg_d": round(vs_kgd, 2),
        "digester_vol_m3": round(vs_kgd / _LOADING_RATE_KG_VS_M3_D, 1),
        "hrt_days": 30,
        "temp_efficiency_pct": round(f_t * 100.0, 1),
    }


# ── Conductor Catenary Profile ────────────────────────────────────────────────

_ALPHA_AL = 2.3e-5  # thermal expansion coefficient for Al conductor, /°C
_T_REF = 20.0
_N_CAT = 30


class CatenaryRequest(BaseModel):
    span_length_m: float = Field(50.0, gt=0)
    conductor_weight_kg_m: float = Field(1.5, gt=0)
    max_tension_kg: float = Field(2000.0, gt=0)
    ground_clearance_m: float = Field(8.0, gt=0)
    temperature_c: float = Field(40.0)


def _sag(w: float, L: float, H: float) -> float:
    return w * L * L / (8.0 * H)


def simulate_conductor_catenary(req: CatenaryRequest) -> dict:
    L = req.span_length_m
    w = req.conductor_weight_kg_m * 9.81   # N/m
    T_max = req.max_tension_kg * 9.81       # N
    gc = req.ground_clearance_m

    half_vert = w * L / 2.0
    if T_max <= half_vert:
        T_max = half_vert * 1.05
    H = math.sqrt(T_max ** 2 - half_vert ** 2)

    S_cold = _sag(w, L, H)
    attach_h = gc + S_cold  # fix attachment so cold midpoint clearance == gc

    # Hot sag: thermal expansion increases effective span
    delta_L = L * _ALPHA_AL * max(0.0, req.temperature_c - _T_REF)
    S_hot = _sag(w, L + delta_L, H)
    clearance_hot = attach_h - S_hot

    xs = [L * i / (_N_CAT - 1) for i in range(_N_CAT)]

    def profile(x: float, S: float) -> float:
        return attach_h - S + w * (x - L / 2.0) ** 2 / (2.0 * H)

    return {
        "x_m": xs,
        "y_cold_m": [round(profile(x, S_cold), 3) for x in xs],
        "y_hot_m": [round(profile(x, S_hot), 3) for x in xs],
        "sag_cold_m": round(S_cold, 3),
        "sag_hot_m": round(S_hot, 3),
        "attachment_height_m": round(attach_h, 3),
        "clearance_hot_m": round(clearance_hot, 3),
        "required_clearance_m": gc,
        "H_N": round(H, 1),
        "passes": clearance_hot >= gc,
        "temperature_c": req.temperature_c,
    }


# ── Fault Current Decay ───────────────────────────────────────────────────────

_T_SUBTRANSIENT = 0.05   # s, typical T''d
_T_TRANSIENT = 1.00      # s, typical T'd
_OMEGA = 2.0 * math.pi * 50.0
_N_FAULT = 61


class FaultDecayRequest(BaseModel):
    generator_kva: float = Field(1000.0, gt=0)
    generator_voltage_v: float = Field(400.0, gt=0)
    generator_subtransient_reactance_pu: float = Field(0.15, gt=0)
    cable_length_m: float = Field(50.0, ge=0)
    cable_resistance_ohm_km: float = Field(0.16, ge=0)
    cable_reactance_ohm_km: float = Field(0.08, ge=0)


def simulate_fault_current_decay(req: FaultDecayRequest) -> dict:
    V_LL = req.generator_voltage_v
    V_phase = V_LL / math.sqrt(3.0)
    Z_base = (V_LL ** 2) / (req.generator_kva * 1000.0)

    # Generator reactances in Ohm
    Xdd = req.generator_subtransient_reactance_pu * Z_base         # X''d
    Xd_p = 2.0 * req.generator_subtransient_reactance_pu * Z_base  # X'd ≈ 2·X''d
    Xd = 8.0 * req.generator_subtransient_reactance_pu * Z_base    # Xd ≈ 8·X''d

    # Cable impedance
    L_km = req.cable_length_m / 1000.0
    R_c = req.cable_resistance_ohm_km * L_km
    X_c = req.cable_reactance_ohm_km * L_km

    Z_dd = math.hypot(R_c, Xdd + X_c)
    Z_dp = math.hypot(R_c, Xd_p + X_c)
    Z_ss = math.hypot(R_c, Xd + X_c)

    I_dd = V_phase / Z_dd
    I_dp = V_phase / Z_dp
    I_ss = V_phase / Z_ss

    # DC offset time constant
    T_dc = (Xdd + X_c) / (_OMEGA * max(R_c, 1e-6))

    times = [3.0 * i / (_N_FAULT - 1) for i in range(_N_FAULT)]

    i_ac = [
        (I_dd - I_dp) * math.exp(-t / _T_SUBTRANSIENT)
        + (I_dp - I_ss) * math.exp(-t / _T_TRANSIENT)
        + I_ss
        for t in times
    ]
    i_dc = [math.sqrt(2.0) * I_dd * math.exp(-t / T_dc) for t in times]
    # Asymmetric peak envelope (AC + DC/√2 gives RMS equivalent)
    i_total = [i_ac[k] + i_dc[k] / math.sqrt(2.0) for k in range(_N_FAULT)]

    return {
        "time_s": [round(t, 4) for t in times],
        "i_ac_ka": [round(v / 1000, 4) for v in i_ac],
        "i_dc_ka": [round(v / 1000, 4) for v in i_dc],
        "i_total_ka": [round(v / 1000, 4) for v in i_total],
        "I_dd_ka": round(I_dd / 1000, 3),
        "I_d_ka": round(I_dp / 1000, 3),
        "I_ss_ka": round(I_ss / 1000, 3),
        "Z_base_ohm": round(Z_base, 4),
        "Xdd_ohm": round(Xdd, 4),
        "V_phase_v": round(V_phase, 1),
        "T_dc_s": round(T_dc, 4),
    }
