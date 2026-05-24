"""Climate intelligence using Open-Meteo historical data."""

import math
from datetime import date
from typing import Any

from geo.http_client import fetch_json

MONTHLY_FALLBACK_LUSAKA = [187, 162, 145, 68, 18, 2, 0, 1, 12, 42, 98, 165]
TEMP_FALLBACK = {"mean": 21.4, "max": 32.1, "min": 8.2}


def _climate_zone(annual_mm: float) -> str:
    if annual_mm < 400:
        return "Arid"
    if annual_mm < 600:
        return "Semi-arid"
    if annual_mm < 800:
        return "Sub-humid"
    if annual_mm < 1200:
        return "Humid"
    return "Very humid"


def analyse_climate(payload: dict[str, Any]) -> dict[str, Any]:
    lat = float(payload["latitude"])
    lon = float(payload["longitude"])
    end_year = date.today().year - 1
    start_year = end_year - 9

    url = (
        "https://archive-api.open-meteo.com/v1/archive?"
        f"latitude={lat}&longitude={lon}&start_date={start_year}-01-01&end_date={end_year}-12-31"
        "&monthly=precipitation_sum,temperature_2m_max,temperature_2m_min,windspeed_10m_max"
        "&timezone=auto"
    )
    data = fetch_json(url)

    monthly_rain: list[float] = []
    monthly_tmax: list[float] = []
    monthly_tmin: list[float] = []
    monthly_wind: list[float] = []

    if data and data.get("monthly"):
        monthly = data["monthly"]
        monthly_rain = [v or 0 for v in monthly.get("precipitation_sum", [])]
        monthly_tmax = [v or 0 for v in monthly.get("temperature_2m_max", [])]
        monthly_tmin = [v or 0 for v in monthly.get("temperature_2m_min", [])]
        monthly_wind = [v or 0 for v in monthly.get("windspeed_10m_max", [])]
        source = "Open-Meteo Historical (10-year average)"
    else:
        monthly_rain = MONTHLY_FALLBACK_LUSAKA
        monthly_tmax = [28, 28, 27, 26, 24, 22, 22, 25, 30, 32, 30, 28]
        monthly_tmin = [17, 17, 16, 13, 9, 7, 7, 9, 14, 18, 18, 17]
        monthly_wind = [14] * 12
        source = "Regional fallback (Lusaka)"

    # Aggregate to calendar months (API returns all months in range)
    if len(monthly_rain) > 12:
        buckets = [0.0] * 12
        counts = [0] * 12
        for i, val in enumerate(monthly_rain):
            m = i % 12
            buckets[m] += val
            counts[m] += 1
        monthly_rain = [buckets[i] / max(counts[i], 1) for i in range(12)]

    annual_rain = sum(monthly_rain[:12]) if len(monthly_rain) >= 12 else sum(monthly_rain)
    monthly_avg = annual_rain / 12
    wet_months = [i + 1 for i, v in enumerate(monthly_rain[:12]) if v > monthly_avg]
    dry_months = [i + 1 for i, v in enumerate(monthly_rain[:12]) if v <= monthly_avg]

    mean_temp = TEMP_FALLBACK["mean"]
    if monthly_tmax and monthly_tmin:
        mean_temp = sum((a + b) / 2 for a, b in zip(monthly_tmax[:12], monthly_tmin[:12])) / min(12, len(monthly_tmax))

    mean_wind = sum(monthly_wind[:12]) / max(len(monthly_wind[:12]), 1) if monthly_wind else 14.2
    max_wind = max(monthly_wind[:12]) if monthly_wind else 67

    # Design rainfall — Gumbel simplified
    annual_max_month = max(monthly_rain[:12]) if monthly_rain else 187
    design_10yr = round(annual_max_month * 0.45 + 18, 0)
    design_25yr = round(design_10yr * 1.2, 0)

    # Wind — Eurocode basic velocity
    vb = round(max(22, min(35, 18 + mean_wind / 2)), 0)
    wind_pressure = round(0.613 * vb ** 2 / 1000, 3)  # kN/m²

    # Solar — latitude-based estimate
    ghi = round(5.5 + max(0, (15 - abs(lat))) * 0.05, 1)
    optimal_tilt = round(abs(lat) * 0.76, 0)
    peak_sun_hours = ghi
    annual_yield = round(ghi * 365 * 0.75, 0)

    cdd = sum(max(0, ((monthly_tmax[i] + monthly_tmin[i]) / 2) - 25) * 30 for i in range(min(12, len(monthly_tmax))))
    hdd = sum(max(0, 18 - ((monthly_tmax[i] + monthly_tmin[i]) / 2)) * 30 for i in range(min(12, len(monthly_tmax))))

    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    rainfall_by_month = {month_names[i]: round(monthly_rain[i], 0) for i in range(min(12, len(monthly_rain)))}

    return {
        "status": "complete",
        "source": source,
        "climate_zone": _climate_zone(annual_rain),
        "annual_rainfall_mm": round(annual_rain, 0),
        "monthly_rainfall_mm": rainfall_by_month,
        "wet_season_months": wet_months,
        "dry_season_months": dry_months,
        "design_rainfall_10yr_mmhr": design_10yr,
        "design_rainfall_25yr_mmhr": design_25yr,
        "mean_annual_temp_c": round(mean_temp, 1),
        "max_temp_c": round(max(monthly_tmax[:12]) if monthly_tmax else 32.1, 1),
        "min_temp_c": round(min(monthly_tmin[:12]) if monthly_tmin else 8.2, 1),
        "mean_wind_kmh": round(mean_wind, 1),
        "max_wind_kmh": round(max_wind, 1),
        "design_wind_speed_ms": vb,
        "design_wind_pressure_knm2": wind_pressure,
        "terrain_category": "II",
        "cooling_degree_days": round(cdd, 0),
        "heating_degree_days": round(hdd, 0),
        "ghi_kwh_m2_day": ghi,
        "peak_sun_hours": peak_sun_hours,
        "optimal_panel_tilt_deg": optimal_tilt,
        "annual_solar_yield_kwh_kwp": annual_yield,
        "solar_assessment": "EXCELLENT" if ghi >= 5.5 else "GOOD",
    }
