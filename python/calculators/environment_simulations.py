from __future__ import annotations

import math
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class LandfillGasRequest(BaseModel):
    population: int = Field(default=50000, gt=0)
    waste_generation_kg_capita_day: float = Field(default=1.2, gt=0)
    design_life_years: int = Field(default=20, gt=0)
    compacted_waste_density_kg_m3: float = Field(default=800.0, gt=0)


class SoilMoistureRequest(BaseModel):
    crop_area_ha: float = Field(default=50.0, gt=0)
    crop_coefficient_kc: float = Field(default=1.1, gt=0)
    reference_evapotranspiration_mm_day: float = Field(default=6.0, gt=0)
    irrigation_efficiency: float = Field(default=0.85, gt=0, le=1.0)


class TankHoopRequest(BaseModel):
    height: float = Field(default=6.0, gt=0)
    radius: float = Field(default=4.0, gt=0)
    gamma_w: float = Field(default=9.81, gt=0)
    wind_force: float = Field(default=120.0, ge=0)
    mu: float = Field(default=0.5, gt=0)
    tank_weight: float = Field(default=800.0, ge=0)


# ---------------------------------------------------------------------------
# 1. Landfill gas generation simulation
# ---------------------------------------------------------------------------

def simulate_landfill_gas(req: LandfillGasRequest) -> dict:
    # Annual waste placed (tonnes/year)
    annual_waste_t = req.population * req.waste_generation_kg_capita_day * 365.0 / 1000.0

    # Total waste over design life (tonnes)
    total_waste_t = annual_waste_t * req.design_life_years

    # Landfill volume and area
    landfill_volume_m3 = total_waste_t * 1000.0 / req.compacted_waste_density_kg_m3
    depth_m = 10.0  # assumed depth
    landfill_area_ha = (landfill_volume_m3 / depth_m) / 10000.0  # m² → ha

    # Scholl Canyon model parameters
    L0 = 100.0   # m³ CH4 / tonne  (methane potential)
    k = 0.04     # /yr  (tropical decay rate)

    # Simulate gas generation for years 1 to design_life + 30
    sim_years = req.design_life_years + 30
    year: list[int] = []
    lfg_m3_yr: list[float] = []

    for year_t in range(1, sim_years + 1):
        # Sum contribution from each waste placement year (1 to design_life)
        total_gas = 0.0
        for y in range(1, req.design_life_years + 1):
            dt = year_t - y
            if dt >= 0:
                # Gas generated in year_t from waste placed in year y
                total_gas += annual_waste_t * L0 * k * math.exp(-k * dt)
        year.append(year_t)
        lfg_m3_yr.append(round(total_gas, 2))

    peak_lfg_m3_yr = max(lfg_m3_yr)
    peak_year = year[lfg_m3_yr.index(peak_lfg_m3_yr)]

    # Energy potential
    # kWh/yr from peak LFG: 50% CH4, calorific 9.7 kWh/m³ CH4
    kWh_yr = peak_lfg_m3_yr * 0.5 * 9.7
    power_kw = kWh_yr / 8760.0

    return {
        "year": year,
        "lfg_m3_yr": lfg_m3_yr,
        "peak_lfg_m3_yr": round(peak_lfg_m3_yr, 2),
        "power_kw": round(power_kw, 3),
        "landfill_area_ha": round(landfill_area_ha, 4),
        "total_waste_t": round(total_waste_t, 2),
        "annual_waste_t": round(annual_waste_t, 2),
        "peak_year": peak_year,
    }


# ---------------------------------------------------------------------------
# 2. Soil moisture / irrigation scheduling simulation
# ---------------------------------------------------------------------------

def simulate_soil_moisture(req: SoilMoistureRequest) -> dict:
    daily_ETc_mm = req.crop_coefficient_kc * req.reference_evapotranspiration_mm_day

    FC = 120.0   # mm – field capacity (plant available water, 0.6 m root depth)
    PWP = 40.0   # mm – permanent wilting point
    RAW = 0.5 * (FC - PWP)  # = 40 mm  readily available water

    # Gross irrigation per event
    net_irr_mm = RAW  # irrigate back to FC from depletion threshold
    gross_irr_mm_event = net_irr_mm / req.irrigation_efficiency

    n_days = 60
    day: list[int] = []
    soil_moisture_mm: list[float] = []
    irrigation_events_days: list[int] = []

    moisture = FC  # initial moisture

    for d in range(1, n_days + 1):
        # Deplete by daily ETc
        moisture -= daily_ETc_mm

        # Check if irrigation is needed (at or below threshold)
        if moisture <= (FC - RAW):
            moisture = FC  # irrigate back to field capacity
            irrigation_events_days.append(d)

        # Clamp to physical limits
        moisture = max(PWP, min(FC, moisture))

        day.append(d)
        soil_moisture_mm.append(round(moisture, 4))

    # Average interval between irrigation events
    if len(irrigation_events_days) >= 2:
        intervals = [
            irrigation_events_days[i + 1] - irrigation_events_days[i]
            for i in range(len(irrigation_events_days) - 1)
        ]
        irrigation_interval_days = round(sum(intervals) / len(intervals), 2)
    elif len(irrigation_events_days) == 1:
        irrigation_interval_days = float(n_days)
    else:
        irrigation_interval_days = 0.0

    return {
        "day": day,
        "soil_moisture_mm": soil_moisture_mm,
        "irrigation_events_days": irrigation_events_days,
        "daily_etc_mm": round(daily_ETc_mm, 4),
        "gross_irr_mm_event": round(gross_irr_mm_event, 4),
        "irrigation_interval_days": irrigation_interval_days,
        "FC": FC,
        "PWP": PWP,
    }


# ---------------------------------------------------------------------------
# 3. Cylindrical tank hoop stress and stability simulation
# ---------------------------------------------------------------------------

def simulate_tank_hoop_stress(req: TankHoopRequest) -> dict:
    H = req.height
    R = req.radius
    gamma_w = req.gamma_w
    wind_force = req.wind_force
    mu = req.mu
    W_tank = req.tank_weight

    n_pts = 20
    depth_m: list[float] = []
    hoop_kn_m: list[float] = []
    pressure_kpa: list[float] = []

    for i in range(n_pts):
        d = H * i / (n_pts - 1)  # depth from free surface (0=top, H=base)
        depth_m.append(round(d, 5))

        p = gamma_w * d  # kPa
        T = gamma_w * d * R  # kN/m

        pressure_kpa.append(round(p, 4))
        hoop_kn_m.append(round(T, 4))

    max_hoop_kn_m = max(hoop_kn_m)
    max_pressure_kpa = max(pressure_kpa)

    # Water weight
    W_water = gamma_w * math.pi * R ** 2 * H  # kN

    # Stability checks
    # Sliding: resisting force = mu * (W_tank + W_water)
    V_resist = mu * (W_tank + W_water)
    sliding_passes = bool(wind_force <= V_resist)

    # Overturning: moment from wind acts at H/2
    M_ot = wind_force * H / 2.0   # kNm (overturning)
    M_r = (W_tank + W_water) * R  # kNm (restoring, about base edge)
    OTR = M_r / M_ot if M_ot > 0 else float("inf")
    overturning_passes = bool(OTR >= 1.5)

    return {
        "depth_m": depth_m,
        "hoop_kn_m": hoop_kn_m,
        "pressure_kpa": pressure_kpa,
        "max_hoop_kn_m": round(max_hoop_kn_m, 4),
        "max_pressure_kpa": round(max_pressure_kpa, 4),
        "W_water_kn": round(W_water, 4),
        "OTR": round(OTR, 4),
        "sliding_passes": sliding_passes,
        "overturning_passes": overturning_passes,
    }
