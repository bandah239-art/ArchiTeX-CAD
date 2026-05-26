"""Energy system simulations: 24-hour solar-battery, wind wake 2D map, hydro Q-P curve."""

import math
from pydantic import BaseModel


# ── 24-hour Solar + Battery Simulation ──────────────────────────────────────

class SolarBatteryDayRequest(BaseModel):
    installed_kwp: float = 10.0
    battery_kwh: float = 20.0
    daily_load_kwh: float = 15.0
    latitude: float = -15.0
    dod_pct: float = 80.0
    ghi_kwh_m2_day: float = 5.8


def simulate_solar_battery_day(req: SolarBatteryDayRequest) -> dict:
    sunrise = 6.0
    sunset = 18.0

    # Realistic African demand profile (per-unit multipliers, 24 hours)
    load_shape = [
        0.25, 0.20, 0.18, 0.18, 0.20, 0.35,   # 00-05 night
        0.65, 0.90, 0.75, 0.55, 0.50, 0.55,   # 06-11 morning
        0.60, 0.52, 0.52, 0.55, 0.68, 0.95,   # 12-17 afternoon
        1.00, 1.00, 0.85, 0.72, 0.55, 0.38,   # 18-23 evening peak
    ]
    total_shape = sum(load_shape)
    hourly_load = [f * req.daily_load_kwh / total_shape for f in load_shape]

    battery_max = req.battery_kwh
    battery_min = battery_max * (1 - req.dod_pct / 100)
    soc = battery_max * 0.5  # start at 50 %

    hourly = []
    total_solar = total_load = total_import = total_export = 0.0

    for h in range(24):
        if sunrise <= h <= sunset:
            angle = math.pi * (h - sunrise) / (sunset - sunrise)
            solar_kw = req.installed_kwp * math.sin(angle) * 0.85
        else:
            solar_kw = 0.0

        load_kw = hourly_load[h]
        net = solar_kw - load_kw

        if net >= 0:
            charge = min(net, battery_max - soc)
            soc += charge
            grid_export = max(0.0, net - charge)
            grid_import = 0.0
        else:
            deficit = -net
            discharge = min(deficit, soc - battery_min)
            soc -= discharge
            grid_import = max(0.0, deficit - discharge)
            grid_export = 0.0

        hourly.append({
            "hour": h,
            "solar_kw": round(solar_kw, 2),
            "load_kw": round(load_kw, 2),
            "battery_soc_pct": round((soc / battery_max) * 100, 1),
            "battery_kwh": round(soc, 2),
            "grid_import_kw": round(grid_import, 2),
            "grid_export_kw": round(grid_export, 2),
        })

        total_solar += solar_kw
        total_load += load_kw
        total_import += grid_import
        total_export += grid_export

    solar_fraction = min(100.0, total_solar / total_load * 100) if total_load else 0.0

    return {
        "status": "success",
        "hourly": hourly,
        "summary": {
            "total_solar_kwh": round(total_solar, 1),
            "total_load_kwh": round(total_load, 1),
            "grid_import_kwh": round(total_import, 1),
            "grid_export_kwh": round(total_export, 1),
            "solar_fraction_pct": round(solar_fraction, 1),
            "final_soc_pct": hourly[-1]["battery_soc_pct"],
        },
    }


# ── Wind Wake 2D Velocity Map ─────────────────────────────────────────────

class WindWakeMapRequest(BaseModel):
    rotor_diameter_m: float = 80.0
    ct: float = 0.80
    k: float = 0.075
    grid_x_diameters: int = 12
    grid_y_diameters: int = 5
    resolution: int = 40


def simulate_wind_wake_map(req: WindWakeMapRequest) -> dict:
    D = req.rotor_diameter_m
    R = D / 2.0
    x_max = req.grid_x_diameters * D
    y_half = req.grid_y_diameters * D / 2.0
    nx, ny = req.resolution, req.resolution

    xs = [i * x_max / (nx - 1) for i in range(nx)]
    ys = [-y_half + j * 2 * y_half / (ny - 1) for j in range(ny)]

    grid = []
    for y in ys:
        row = []
        for x in xs:
            if x <= 1e-3:
                row.append(1.0)
                continue
            r_wake = R + req.k * x
            deficit_centre = (1 - math.sqrt(max(0.0, 1 - req.ct))) / ((1 + req.k * x / R) ** 2)
            if abs(y) <= r_wake:
                sigma = r_wake / 2.2
                lateral = math.exp(-0.5 * (y / sigma) ** 2)
                v_ratio = max(0.0, 1.0 - deficit_centre * lateral)
            else:
                v_ratio = 1.0
            row.append(round(v_ratio, 3))
        grid.append(row)

    return {
        "status": "success",
        "grid": grid,
        "x_diameters": [round(x / D, 2) for x in xs],
        "y_diameters": [round(y / D, 2) for y in ys],
        "metadata": {
            "rotor_diameter_m": D,
            "ct": req.ct,
            "k": req.k,
            "nx": nx,
            "ny": ny,
        },
    }


# ── Hydro Q-P Curve ──────────────────────────────────────────────────────

class HydroCurveRequest(BaseModel):
    net_head_m: float = 20.0
    max_flow_m3s: float = 2.0
    system_efficiency: float = 0.85
    points: int = 40


def simulate_hydro_curve(req: HydroCurveRequest) -> dict:
    rho, g = 1000.0, 9.81
    curve = []
    for i in range(req.points + 1):
        q = i * req.max_flow_m3s / req.points
        p = rho * g * q * req.net_head_m * req.system_efficiency / 1000.0
        curve.append({"flow_m3s": round(q, 3), "power_kw": round(p, 2)})

    rated_kw = rho * g * req.max_flow_m3s * req.net_head_m * req.system_efficiency / 1000.0

    if req.net_head_m > 50:
        turbine, color = "Pelton Wheel", "#f59e0b"
    elif req.net_head_m >= 10:
        turbine, color = "Crossflow / Francis", "#3b82f6"
    else:
        turbine, color = "Kaplan / Propeller", "#10b981"

    ns = 0.0
    if req.net_head_m > 0:
        ns = 3.65 * math.sqrt(rated_kw) / (req.net_head_m ** 1.25)

    return {
        "status": "success",
        "curve": curve,
        "summary": {
            "rated_power_kw": round(rated_kw, 2),
            "rated_flow_m3s": req.max_flow_m3s,
            "net_head_m": req.net_head_m,
            "efficiency_pct": round(req.system_efficiency * 100, 1),
            "turbine_type": turbine,
            "specific_speed": round(ns, 1),
        },
        "turbine_type": turbine,
        "turbine_color": color,
    }
