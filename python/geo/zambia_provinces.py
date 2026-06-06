"""
Zambia province detection and localized design parameters.

Covers all 10 provinces with wind (EC1 calibration), seismic PGA (EC8),
rainfall IDF (10-year, 60-min), black cotton soil zones, and seasonal data.
"""

from __future__ import annotations

import math
from typing import Any

# Province centroids (approx.) for nearest-province detection
PROVINCE_CENTROIDS: dict[str, tuple[float, float, str]] = {
    "lusaka": (-15.42, 28.28, "Lusaka"),
    "copperbelt": (-12.97, 28.63, "Copperbelt"),
    "central": (-14.15, 28.50, "Central"),
    "eastern": (-13.70, 32.65, "Eastern"),
    "luapula": (-11.20, 29.45, "Luapula"),
    "northern": (-10.50, 31.20, "Northern"),
    "muchinga": (-10.30, 32.80, "Muchinga"),
    "southern": (-16.80, 27.00, "Southern"),
    "western": (-15.10, 23.10, "Western"),
    "north_western": (-13.50, 24.20, "North-Western"),
}

# EC1 basic wind vb0 (m/s) — aligned with wind_loads_ec1.py
PROVINCE_WIND_MS: dict[str, float] = {
    "lusaka": 30.0, "copperbelt": 28.0, "central": 30.0, "eastern": 32.0,
    "luapula": 28.0, "northern": 26.0, "muchinga": 26.0, "southern": 33.0,
    "western": 28.0, "north_western": 27.0,
}

# EC8 design ground acceleration ag (g) by province — Zambia seismically benign
PROVINCE_PGA: dict[str, float] = {
    "lusaka": 0.04, "copperbelt": 0.03, "central": 0.04, "eastern": 0.05,
    "luapula": 0.04, "northern": 0.04, "muchinga": 0.04, "southern": 0.04,
    "western": 0.03, "north_western": 0.03,
}

# 60-min rainfall intensity (mm/hr) at 10-year return — from hydrology_enhanced
PROVINCE_RAIN_10YR_60MIN: dict[str, float] = {
    "lusaka": 58, "copperbelt": 65, "central": 62, "eastern": 70,
    "luapula": 72, "northern": 74, "muchinga": 66, "southern": 50,
    "western": 53, "north_western": 60,
}

# Wet / dry season months (Zambia Meteorological Department)
WET_SEASON = [11, 12, 1, 2, 3, 4]   # Nov–Apr
DRY_SEASON = [5, 6, 7, 8, 9, 10]     # May–Oct

# Black cotton soil GPS corridors (from black_cotton_enhanced.py)
BCS_ZONES: list[dict[str, Any]] = [
    {"name": "Kafue Flats", "lat_min": -16.5, "lat_max": -14.5, "lon_min": 27.5, "lon_max": 29.0, "severity": "severe"},
    {"name": "Kabwe Central", "lat_min": -14.8, "lat_max": -13.5, "lon_min": 28.0, "lon_max": 29.5, "severity": "moderate"},
    {"name": "Eastern Corridor", "lat_min": -13.5, "lat_max": -11.5, "lon_min": 31.5, "lon_max": 33.5, "severity": "moderate"},
    {"name": "Southern Corridor", "lat_min": -18.5, "lat_max": -15.5, "lon_min": 25.5, "lon_max": 27.5, "severity": "high"},
]

# Bearing capacity estimate (kPa) by soil prior before lab test
SOIL_BEARING_PRIOR: dict[str, float] = {
    "CH_expansive": 80.0,
    "lateritic": 150.0,
    "kalahari_sand": 120.0,
    "quartzite": 200.0,
    "default": 130.0,
}


def detect_province(lat: float, lon: float) -> dict[str, Any]:
    """Return nearest Zambia province slug, display name, and distance km."""
    best_slug = "lusaka"
    best_dist = float("inf")
    for slug, (clat, clon, display) in PROVINCE_CENTROIDS.items():
        d = math.sqrt((lat - clat) ** 2 + (lon - clon) ** 2) * 111.0  # approx km
        if d < best_dist:
            best_dist = d
            best_slug = slug
    return {
        "slug": best_slug,
        "display_name": PROVINCE_CENTROIDS[best_slug][2],
        "distance_km": round(best_dist, 1),
    }


def check_bcs_zone(lat: float, lon: float) -> dict[str, Any]:
    for zone in BCS_ZONES:
        if zone["lat_min"] <= lat <= zone["lat_max"] and zone["lon_min"] <= lon <= zone["lon_max"]:
            return {"in_zone": True, "zone_name": zone["name"], "severity": zone["severity"]}
    return {"in_zone": False, "zone_name": None, "severity": "low"}


def get_zambia_intelligence(lat: float, lon: float) -> dict[str, Any]:
    """Full Zambia site intelligence bundle for geo_intelligence merge."""
    prov = detect_province(lat, lon)
    slug = prov["slug"]
    bcs = check_bcs_zone(lat, lon)

    wind_ms = PROVINCE_WIND_MS.get(slug, 30.0)
    pga = PROVINCE_PGA.get(slug, 0.04)
    rain_60 = PROVINCE_RAIN_10YR_60MIN.get(slug, 58)

    if bcs["in_zone"]:
        soil_prior = "CH_expansive"
        soil_type = "CH — Expansive Clay (Black Cotton Soil)"
        expansion_risk = "HIGH" if bcs["severity"] in ("severe", "high") else "MODERATE"
        foundation_rec = "Deep pad or piled foundation with lime stabilisation — BCS zone"
    elif slug == "copperbelt":
        soil_prior = "lateritic"
        soil_type = "Lateritic Gravelly Soils"
        expansion_risk = "MODERATE"
        foundation_rec = "Shallow pad footing on compacted laterite — verify CBR"
    elif slug in ("southern", "western"):
        soil_prior = "kalahari_sand"
        soil_type = "Kalahari Sandy Soils"
        expansion_risk = "LOW"
        foundation_rec = "Strip or pad footing — compact sand to 95% MDD"
    else:
        soil_prior = "quartzite"
        soil_type = "Quartzite / Weathered Rock"
        expansion_risk = "LOW"
        foundation_rec = "Shallow pad footing — standard EC7 bearing check"

    bearing_kpa = SOIL_BEARING_PRIOR.get(soil_prior, 130.0)

    # Flood risk heuristic from elevation proxy (lat-based plateau)
    if lat < -17.0:
        flood_risk = "moderate"
    elif bcs["in_zone"] and slug == "lusaka":
        flood_risk = "high"
    else:
        flood_risk = "low"

    risks = []
    if bcs["in_zone"]:
        risks.append({"risk": "Expansive black cotton soil", "severity": bcs["severity"], "mitigation": "Lime stabilisation 5%, moisture barrier, deep founding"})
    if flood_risk in ("high", "moderate"):
        risks.append({"risk": "Seasonal flooding", "severity": flood_risk, "mitigation": "Raise FFL +300mm, surface drainage, soakaway design"})
    if rain_60 > 65:
        risks.append({"risk": "High rainfall intensity", "severity": "moderate", "mitigation": f"Design drainage for {rain_60} mm/hr (10-yr, 60-min)"})
    if wind_ms >= 32:
        risks.append({"risk": "High wind exposure", "severity": "moderate", "mitigation": f"EC1 design Vb = {wind_ms} m/s, check cladding fixings"})
    risks.append({"risk": "Limited geotechnical data", "severity": "moderate", "mitigation": "Minimum 3 trial pits + lab CBR before final design"})

    return {
        "province": prov,
        "wind_basic_ms": wind_ms,
        "wind_pressure_knm2": round(0.5 * 1.2 * wind_ms ** 2 / 1000.0 * 1000, 2),
        "seismic_pga_g": pga,
        "seismic_note": "Zambia is seismically benign — EC8 SDC typically A or B",
        "rainfall_10yr_60min_mmhr": rain_60,
        "wet_season_months": WET_SEASON,
        "dry_season_months": DRY_SEASON,
        "wet_onset": "November",
        "wet_cessation": "April",
        "soil_prior": {
            "type": soil_type,
            "expansion_risk": expansion_risk,
            "bearing_capacity_kpa": bearing_kpa,
        },
        "foundation_recommendation": foundation_rec,
        "black_cotton": bcs,
        "flood_risk": flood_risk,
        "risk_register": risks[:5],
        "design_code_refs": ["EC1 EN 1991-1-4", "EC7 EN 1997-1", "EC8 EN 1998-1", "ZABS wind map"],
    }
