"""WASH modality simulation functions for visualisation in the frontend."""

import math
from pydantic import BaseModel

# ─── African residential hourly demand multipliers (sum = 24) ────────────────
_RAW_PROFILE = [
    0.3, 0.2, 0.2, 0.2, 0.3, 0.5,   # 0–5 h
    1.2, 2.0, 1.8, 1.3, 1.0, 1.0,   # 6–11 h
    1.2, 0.8, 0.6, 0.6, 0.8, 1.2,   # 12–17 h
    1.8, 1.6, 1.2, 0.8, 0.5, 0.3,   # 18–23 h
]
_SCALE = 24.0 / sum(_RAW_PROFILE)
DEMAND_PROFILE = [v * _SCALE for v in _RAW_PROFILE]   # sum == 24


# ─── Water Tower 24-hour Fill / Drain ───────────────────────────────────────

class WaterTowerDayRequest(BaseModel):
    daily_demand_m3: float = 25.0     # m³/day total demand
    tank_capacity_m3: float = 12.5    # m³ tank volume
    pump_flow_m3h: float = 6.0        # pump delivery rate m³/hr
    pump_start_hour: int = 6          # hour pump switches ON (0–23)
    pump_hours: int = 8               # number of hours pump runs


def simulate_water_tower_day(req: WaterTowerDayRequest) -> dict:
    pump_set = {(req.pump_start_hour + h) % 24 for h in range(req.pump_hours)}
    avg_hourly = req.daily_demand_m3 / 24.0
    tank = req.tank_capacity_m3 * 0.5   # start at 50%

    hourly = []
    totals = dict(demand=0.0, inflow=0.0, overflow=0.0, shortfall=0.0)

    for h in range(24):
        demand_h = DEMAND_PROFILE[h] * avg_hourly
        inflow_h = req.pump_flow_m3h if h in pump_set else 0.0

        # Fill first, then satisfy demand
        raw = tank + inflow_h
        overflow_h = max(0.0, raw - req.tank_capacity_m3)
        tank = min(raw, req.tank_capacity_m3)

        raw2 = tank - demand_h
        shortfall_h = max(0.0, -raw2)
        tank = max(0.0, raw2)

        totals["demand"]    += demand_h
        totals["inflow"]    += inflow_h
        totals["overflow"]  += overflow_h
        totals["shortfall"] += shortfall_h

        hourly.append({
            "hour": h,
            "demand_m3": round(demand_h, 2),
            "inflow_m3": round(inflow_h, 2),
            "tank_level_m3": round(tank, 2),
            "tank_pct": round(tank / req.tank_capacity_m3 * 100.0, 1),
            "overflow_m3": round(overflow_h, 2),
            "shortfall_m3": round(shortfall_h, 2),
            "pump_on": h in pump_set,
        })

    return {
        "status": "ok",
        "hourly": hourly,
        "summary": {
            "daily_demand_m3": round(totals["demand"], 1),
            "total_inflow_m3": round(totals["inflow"], 1),
            "overflow_m3": round(totals["overflow"], 1),
            "shortfall_m3": round(totals["shortfall"], 1),
            "tank_capacity_m3": req.tank_capacity_m3,
            "pump_flow_m3h": req.pump_flow_m3h,
            "adequacy": "OK" if totals["shortfall"] < 0.01 else "SHORTFALL",
        },
    }


# ─── Pipe Pressure Profile (Hazen–Williams) ──────────────────────────────────

class PipePressureRequest(BaseModel):
    flow_rate_lps: float = 25.0
    pipe_length_m: float = 500.0
    pipe_material: str = "HDPE"    # HDPE | PVC | Steel | Cast Iron
    max_velocity_mps: float = 1.5
    min_pressure_m: float = 10.0   # residual pressure at delivery end


_HW_C = {"HDPE": 140, "PVC": 130, "Steel": 120, "Cast Iron": 100}

# DN standard sizes (m)
_DN = [0.050, 0.075, 0.100, 0.150, 0.200, 0.250, 0.300, 0.400, 0.500]


def simulate_pipe_pressure_profile(req: PipePressureRequest) -> dict:
    Q_m3s = req.flow_rate_lps / 1000.0
    C = _HW_C.get(req.pipe_material, 130)
    L = req.pipe_length_m

    # Minimum diameter for velocity constraint
    A_req = Q_m3s / req.max_velocity_mps
    D_req = math.sqrt(4.0 * A_req / math.pi)
    D = next((s for s in _DN if s >= D_req), _DN[-1])

    # Hazen–Williams: hf = 10.67 * L * Q^1.852 / (C^1.852 * D^4.87)
    # where Q in m³/s, D in m
    hf_total = 10.67 * L * (Q_m3s ** 1.852) / ((C ** 1.852) * (D ** 4.87))
    hf_per_m = hf_total / L

    # Pressure profile: source head must supply residual + friction loss
    head_source = req.min_pressure_m + hf_total
    velocity = Q_m3s / (math.pi * D**2 / 4.0)

    n = 25
    points = []
    for i in range(n + 1):
        x = L * i / n
        h = head_source - hf_per_m * x
        points.append({
            "distance_m": round(x, 1),
            "pressure_head_m": round(h, 2),
            "velocity_mps": round(velocity, 3),
        })

    return {
        "status": "ok",
        "points": points,
        "summary": {
            "pipe_diameter_mm": int(D * 1000),
            "velocity_mps": round(velocity, 3),
            "hf_total_m": round(hf_total, 2),
            "head_at_source_m": round(head_source, 2),
            "material": req.pipe_material,
            "C_value": C,
            "L_m": L,
        },
    }
