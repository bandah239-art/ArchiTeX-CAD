"""Zambian Site Intelligence data lookup and calculations."""

import math
from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value
from geo.zambia_provinces import get_zambia_intelligence

# Legacy city IDF curves (kept for backward compatibility)
ZAMBIA_IDF = {
    "Lusaka": {
        2: {"a": 650.0, "b": 12.0, "c": 0.85},
        5: {"a": 820.0, "b": 14.0, "c": 0.86},
        10: {"a": 980.0, "b": 15.0, "c": 0.87},
        25: {"a": 1180.0, "b": 16.0, "c": 0.88},
        50: {"a": 1350.0, "b": 18.0, "c": 0.90},
        100: {"a": 1550.0, "b": 20.0, "c": 0.92},
    },
    "Ndola": {
        2: {"a": 700.0, "b": 13.0, "c": 0.84},
        10: {"a": 1050.0, "b": 16.0, "c": 0.86},
        50: {"a": 1420.0, "b": 19.0, "c": 0.89},
        100: {"a": 1620.0, "b": 21.0, "c": 0.91},
    },
    "Livingstone": {
        2: {"a": 550.0, "b": 11.0, "c": 0.86},
        10: {"a": 840.0, "b": 14.0, "c": 0.88},
        50: {"a": 1150.0, "b": 17.0, "c": 0.91},
        100: {"a": 1320.0, "b": 19.0, "c": 0.93},
    },
    "Chipata": {
        2: {"a": 620.0, "b": 12.0, "c": 0.85},
        10: {"a": 940.0, "b": 15.0, "c": 0.87},
        50: {"a": 1290.0, "b": 18.0, "c": 0.90},
        100: {"a": 1480.0, "b": 20.0, "c": 0.92},
    },
}


def get_zambia_site_data(lat: float, lon: float) -> dict[str, Any]:
    """Retrieve localized wind, seismic, rainfall, and soil parameters for Zambia (10 provinces)."""
    zm = get_zambia_intelligence(lat, lon)
    slug = zm["province"]["slug"]
    display = zm["province"]["display_name"]

    # Map province slug to legacy city for IDF curve lookup
    city_map = {
        "lusaka": "Lusaka", "copperbelt": "Ndola", "southern": "Livingstone",
        "eastern": "Chipata", "central": "Lusaka", "luapula": "Chipata",
        "northern": "Chipata", "muchinga": "Chipata", "western": "Livingstone",
        "north_western": "Ndola",
    }
    closest_city = city_map.get(slug, "Lusaka")
    city_idf = ZAMBIA_IDF.get(closest_city, ZAMBIA_IDF["Lusaka"])
    param_10yr = city_idf.get(10, city_idf[list(city_idf.keys())[0]])
    t_min = 15.0
    intensity_10yr = param_10yr["a"] / ((t_min + param_10yr["b"]) ** param_10yr["c"])

    wind_speed = zm["wind_basic_ms"]
    basic_pressure = zm["wind_pressure_knm2"] / 1000.0  # kPa
    pga = zm["seismic_pga_g"]
    bcs = zm["black_cotton"]

    if bcs["in_zone"]:
        soil_risk = zm["soil_prior"]["expansion_risk"]
        soil_type = zm["soil_prior"]["type"]
        soil_color = "red" if bcs["severity"] in ("severe", "high") else "yellow"
    else:
        soil_risk = zm["soil_prior"]["expansion_risk"]
        soil_type = zm["soil_prior"]["type"]
        soil_color = "green" if soil_risk == "LOW" else "yellow"

    return {
        "status": "ok",
        "coordinates": {"latitude": lat, "longitude": lon},
        "region": {
            "closest_city": closest_city,
            "province": display,
            "province_slug": slug,
            "altitude_m": zm.get("elevation_m", 1200),
            "altitude_note": "Altitude affects concrete mix design. No correction required below 2000m in Zambia.",
        },
        "wind": {
            "zone_speed_ms": wind_speed,
            "basic_pressure_kpa": round_value(basic_pressure, 3),
            "design_code": "EC1 / ZABS",
        },
        "seismic": {
            "pga_g": pga,
            "design_ground_type": "B",
            "narrative": zm["seismic_note"],
        },
        "hydrology": {
            "fitted_city": closest_city,
            "idf_intensity_15min_10yr_mm_hr": round_value(intensity_10yr, 1),
            "idf_intensity_60min_10yr_mm_hr": zm["rainfall_10yr_60min_mmhr"],
            "coefficients": city_idf,
            "wet_season_months": zm["wet_season_months"],
            "dry_season_months": zm["dry_season_months"],
        },
        "soil_prior": {
            "soil_type": soil_type,
            "expansion_risk": soil_risk,
            "risk_color": soil_color,
            "bearing_capacity_kpa": zm["soil_prior"]["bearing_capacity_kpa"],
        },
        "black_cotton": bcs,
        "foundation_recommendation": zm["foundation_recommendation"],
        "flood_risk": zm["flood_risk"],
        "risk_register": zm["risk_register"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
