"""Master geo intelligence coordinator."""

from datetime import datetime, timezone
from typing import Any

from geo.climate_intelligence import analyse_climate
from geo.seismic_intelligence import analyse_seismic
from geo.soil_intelligence import analyse_soil
from geo.terrain_analyser import analyse_terrain

COUNTRY_FLAGS = {
    "ZM": "🇿🇲",
    "KE": "🇰🇪",
    "NG": "🇳🇬",
    "GH": "🇬🇭",
    "TZ": "🇹🇿",
    "ZW": "🇿🇼",
    "BW": "🇧🇼",
    "MZ": "🇲🇿",
}


def run_site_analysis(payload: dict[str, Any]) -> dict[str, Any]:
    lat = float(payload["latitude"])
    lon = float(payload["longitude"])
    country = payload.get("country_code", "ZM").upper()
    project = payload.get("project_name", "Site Analysis")
    use_cache = payload.get("use_cache", True)
    offline_only = payload.get("offline_only", False)

    from geo.geo_cache import get_cached, set_cached

    if use_cache:
        cached = get_cached("site-analysis", lat, lon, country)
        if cached:
            cached["from_cache"] = True
            return cached

    if offline_only:
        cached = get_cached("site-analysis", lat, lon, country)
        if cached:
            cached["from_cache"] = True
            return cached
        payload_offline = {**payload, "latitude": lat, "longitude": lon}
        terrain = analyse_terrain(payload_offline)
        soil = analyse_soil({**payload_offline, "elevation_m": terrain["elevation_m"]})
        climate = analyse_climate(payload_offline)
        seismic = analyse_seismic({**payload_offline, "country_code": country})
    else:
        terrain = analyse_terrain({**payload, "latitude": lat, "longitude": lon})
        soil = analyse_soil({**payload, "latitude": lat, "longitude": lon, "elevation_m": terrain["elevation_m"]})
        climate = analyse_climate({**payload, "latitude": lat, "longitude": lon})
        seismic = analyse_seismic({**payload, "latitude": lat, "longitude": lon})

    buildability = terrain["buildability_score"]
    flood_risk = "Low" if terrain["slope_deg"] > 1 else "Moderate"

    design_params = {
        "soil_bearing_capacity_knm2": soil["bearing_capacity_mid"],
        "soil_bearing_range_knm2": soil["bearing_capacity_range_knm2"],
        "min_foundation_depth_m": soil["min_foundation_depth_m"],
        "cbr_subgrade_pct": soil["cbr_estimate_mid"],
        "cbr_range_pct": soil["cbr_range_pct"],
        "design_wind_speed_ms": climate["design_wind_speed_ms"],
        "design_wind_pressure_knm2": climate["design_wind_pressure_knm2"],
        "design_rainfall_10yr_mmhr": climate["design_rainfall_10yr_mmhr"],
        "seismic_design_category": seismic["seismic_design_category"],
        "terrain_category": climate["terrain_category"],
        "elevation_m": terrain["elevation_m"],
    }

    recommendations = [
        "Site is suitable for construction" if buildability >= 7 else "Site requires additional earthworks assessment",
        f"Terrain slope {terrain['slope_deg']}° — {terrain['slope_classification']}",
        f"Seismic risk is {seismic['sdc_description'].lower()} (SDC {seismic['seismic_design_category']})",
        "Ground investigation required — minimum 3 trial pits + lab CBR testing",
        f"Drainage design essential — {climate['annual_rainfall_mm']:.0f}mm annual rainfall",
    ]
    if climate["wet_season_months"]:
        wet = ", ".join(str(m) for m in climate["wet_season_months"][:4])
        recommendations.append(f"Protect foundations during wet season (months {wet})")

    result = {
        "status": "complete",
        "project_name": project,
        "latitude": lat,
        "longitude": lon,
        "country_code": country,
        "country_flag": COUNTRY_FLAGS.get(country, "🌍"),
        "executive_summary": {
            "buildability_score": buildability,
            "buildability_label": "GOOD" if buildability >= 7 else "MODERATE",
            "soil_conditions": soil["uscs_classification"],
            "seismic_risk": f"{seismic['sdc_description']} (SDC {seismic['seismic_design_category']})",
            "flood_risk": flood_risk,
            "annual_rainfall_mm": climate["annual_rainfall_mm"],
            "climate_zone": climate["climate_zone"],
            "design_wind_speed_ms": climate["design_wind_speed_ms"],
        },
        "terrain": terrain,
        "soil": soil,
        "climate": climate,
        "seismic": seismic,
        "design_parameters": design_params,
        "recommendations": recommendations,
        "data_sources": ["SRTM / OpenTopoData", "Open-Meteo", "USGS", "ISRIC SoilGrids"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "from_cache": False,
    }
    if use_cache and not offline_only:
        set_cached("site-analysis", lat, lon, result, country)
    return result
