from __future__ import annotations

import math
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class PavementStressRequest(BaseModel):
    cbr_subgrade: float = Field(default=6.0, gt=0)
    traffic_count: int = Field(default=500, gt=0)
    heavy_vehicle_pct: float = Field(default=12.0, ge=0, le=100)
    design_life: int = Field(default=20, gt=0)
    road_class: str = Field(default="secondary")


class ESALGrowthRequest(BaseModel):
    aadt: int = Field(default=1000, gt=0)
    growth_rate_pct: float = Field(default=4.0, ge=0)
    design_life_yrs: int = Field(default=20, gt=0)
    truck_pct: float = Field(default=10.0, ge=0, le=100)
    bus_pct: float = Field(default=5.0, ge=0, le=100)
    vdf_truck: float = Field(default=3.0, gt=0)
    vdf_bus: float = Field(default=1.2, gt=0)
    directional_split: float = Field(default=0.5, gt=0, le=1.0)
    lane_factor: float = Field(default=1.0, gt=0)


class HydrographRequest(BaseModel):
    catchment_area_ha: float = Field(default=10.0, gt=0)
    runoff_coefficient: float = Field(default=0.85, gt=0, le=1.0)
    rainfall_intensity_mm_hr: float = Field(default=75.0, gt=0)
    duration_hours: float = Field(default=2.0, gt=0)


# ---------------------------------------------------------------------------
# 1. Pavement stress (Boussinesq)
# ---------------------------------------------------------------------------

def simulate_pavement_stress(req: PavementStressRequest) -> dict:
    p = 700.0   # kPa – tyre contact pressure
    a = 0.135   # m   – tyre contact radius

    n_pts = 30
    depth_m: list[float] = []
    sigma_z_kpa: list[float] = []

    z_max = 1.2  # m

    for i in range(n_pts):
        z = z_max * i / (n_pts - 1)
        depth_m.append(round(z, 5))

        if z == 0.0:
            sigma = p  # surface
        else:
            sigma = p * (1.0 - z ** 3 / (z ** 2 + a ** 2) ** 1.5)

        sigma_z_kpa.append(round(sigma, 4))

    # Interpolate sigma at specific depths
    def interp_sigma(target_z: float) -> float:
        if target_z <= 0.0:
            return sigma_z_kpa[0]
        for idx in range(len(depth_m) - 1):
            z0 = depth_m[idx]
            z1 = depth_m[idx + 1]
            if z0 <= target_z <= z1:
                t = (target_z - z0) / (z1 - z0) if z1 != z0 else 0.0
                return sigma_z_kpa[idx] + t * (sigma_z_kpa[idx + 1] - sigma_z_kpa[idx])
        return sigma_z_kpa[-1]

    sigma_surface = sigma_z_kpa[0]
    sigma_300 = interp_sigma(0.300)
    sigma_600 = interp_sigma(0.600)

    # Layer boundaries (mm) and moduli
    E_sg = req.cbr_subgrade * 10.0  # MPa (simplified CBR correlation)

    layer_boundaries = {
        "ac_mm": 80,
        "base_mm": 150,
        "subbase_mm": 250,
    }

    layer_moduli_mpa = {
        "E_AC_mpa": 3000.0,
        "E_base_mpa": 300.0,
        "E_subbase_mpa": 150.0,
        "E_subgrade_mpa": round(E_sg, 2),
    }

    return {
        "depth_m": depth_m,
        "sigma_z_kpa": sigma_z_kpa,
        "layer_boundaries": layer_boundaries,
        "layer_moduli_mpa": layer_moduli_mpa,
        "sigma_at_surface_kpa": round(sigma_surface, 4),
        "sigma_at_300mm_kpa": round(sigma_300, 4),
        "sigma_at_600mm_kpa": round(sigma_600, 4),
    }


# ---------------------------------------------------------------------------
# 2. ESAL growth simulation
# ---------------------------------------------------------------------------

def simulate_esal_growth(req: ESALGrowthRequest) -> dict:
    r = req.growth_rate_pct / 100.0

    # Annual base ESAL (year 0 traffic level)
    truck_esal = req.aadt * (req.truck_pct / 100.0) * 365.0 * req.vdf_truck
    bus_esal = req.aadt * (req.bus_pct / 100.0) * 365.0 * req.vdf_bus
    annual_base_esal = (truck_esal + bus_esal) * req.directional_split * req.lane_factor

    year: list[int] = []
    cumulative_esal_millions: list[float] = []

    running_cumulative = 0.0

    for i in range(1, req.design_life_yrs + 1):
        esal_year_i = annual_base_esal * (1.0 + r) ** i
        running_cumulative += esal_year_i
        year.append(i)
        cumulative_esal_millions.append(round(running_cumulative / 1.0e6, 6))

    design_esal_millions = running_cumulative / 1.0e6

    return {
        "year": year,
        "cumulative_esal_millions": cumulative_esal_millions,
        "annual_base_esal": round(annual_base_esal, 2),
        "design_esal_millions": round(design_esal_millions, 6),
        "design_life_yrs": req.design_life_yrs,
    }


# ---------------------------------------------------------------------------
# 3. Stormwater hydrograph (Rational method + triangular unit hydrograph)
# ---------------------------------------------------------------------------

def simulate_stormwater_hydrograph(req: HydrographRequest) -> dict:
    C = req.runoff_coefficient
    I = req.rainfall_intensity_mm_hr
    A = req.catchment_area_ha

    # Rational formula: Q = C*I*A/360 (m³/s)
    Q_peak = C * I * A / 360.0

    Tc = req.duration_hours  # time of concentration = storm duration (simplified)
    Tp = 0.6 * Tc + req.duration_hours / 2.0   # time to peak (hours)
    Tb = 2.67 * Tp                               # base time (hours)

    n_pts = 40
    time_hr: list[float] = []
    flow_m3s: list[float] = []

    for i in range(n_pts):
        t = Tb * i / (n_pts - 1)
        time_hr.append(round(t, 5))

        if t <= Tp:
            q = Q_peak * (t / Tp) if Tp > 0 else 0.0
        else:
            denom = Tb - Tp
            q = Q_peak * (Tb - t) / denom if denom > 0 else 0.0

        flow_m3s.append(round(max(q, 0.0), 6))

    # Volume = area of triangle (m³)
    runoff_volume_m3 = Q_peak * Tb * 3600.0 / 2.0

    return {
        "time_hr": time_hr,
        "flow_m3s": flow_m3s,
        "Q_peak_m3s": round(Q_peak, 6),
        "Tp_hr": round(Tp, 4),
        "Tb_hr": round(Tb, 4),
        "runoff_volume_m3": round(runoff_volume_m3, 2),
        "C": C,
        "I": I,
        "A_ha": A,
    }
