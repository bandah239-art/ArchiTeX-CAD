"""African city land value database and plot valuation."""

from typing import Any

# USD per m² ranges by city and zone
LAND_VALUES: dict[str, dict[str, tuple[float, float]]] = {
    "Lusaka": {
        "Kabulonga": (45, 95),
        "Rhodes Park": (45, 95),
        "Woodlands": (25, 55),
        "Ibex Hill": (25, 55),
        "Chalala": (15, 35),
        "Avondale": (15, 35),
        "Meanwood": (8, 20),
        "Chamba Valley": (8, 20),
        "default": (8, 20),
    },
    "Nairobi": {
        "Karen": (120, 350),
        "Runda": (120, 350),
        "Muthaiga": (120, 350),
        "Westlands": (85, 200),
        "Kilimani": (85, 200),
        "South B": (40, 80),
        "South C": (40, 80),
        "Ruaka": (20, 45),
        "Ruiru": (20, 45),
        "default": (30, 70),
    },
    "Lagos": {
        "Ikoyi": (200, 600),
        "Victoria Island": (200, 600),
        "Lekki Phase 1": (100, 300),
        "Ikeja GRA": (60, 150),
        "Yaba": (30, 80),
        "Surulere": (30, 80),
        "default": (25, 60),
    },
    "Accra": {
        "Airport Residential": (80, 200),
        "Cantonments": (80, 200),
        "East Legon": (40, 100),
        "Adenta": (40, 100),
        "Tema": (15, 40),
        "default": (20, 50),
    },
}

TITLE_FACTORS = {"freehold": 1.0, "leasehold_99yr": 0.92, "leasehold_14yr": 0.70, "offer_letter": 0.55}


def _zone_rate(city: str, neighbourhood: str) -> tuple[float, float]:
    city_data = LAND_VALUES.get(city, LAND_VALUES["Lusaka"])
    for key, rates in city_data.items():
        if key.lower() in neighbourhood.lower() or neighbourhood.lower() in key.lower():
            return rates
    return city_data.get("default", (10, 25))


def value_plot(payload: dict[str, Any]) -> dict[str, Any]:
    area = float(payload["plot_area_m2"])
    asking = float(payload.get("asking_price_usd", 0))
    city = payload.get("city", "Lusaka")
    neighbourhood = payload.get("neighbourhood", "default")
    services = payload.get("services_available", {})
    title = payload.get("title_deed_type", "freehold")
    geo = payload.get("geo_data") or {}

    rate_lo, rate_hi = _zone_rate(city, neighbourhood)
    base_mid = (rate_lo + rate_hi) / 2

    frontage = float(payload.get("road_frontage_m", 15))
    if frontage >= 20:
        frontage_factor = 1.10
    elif frontage >= 10:
        frontage_factor = 1.00
    elif frontage >= 5:
        frontage_factor = 0.90
    else:
        frontage_factor = 0.75

    services_factor = 1.0
    if not services.get("water", True):
        services_factor *= 0.85
    if not services.get("electricity", True):
        services_factor *= 0.80
    if not services.get("sewerage", True):
        services_factor *= 0.90
    if not services.get("tarred_road", True):
        services_factor *= 0.82

    title_factor = TITLE_FACTORS.get(title, 0.85)

    flood_score = geo.get("flood_risk_score", 1)
    flood_factors = {1: 1.0, 2: 0.95, 3: 0.82, 4: 0.60, 5: 0.35}
    flood_factor = flood_factors.get(flood_score, 1.0)

    slope = geo.get("slope_deg", geo.get("terrain", {}).get("slope_deg", 3))
    if slope <= 5:
        slope_factor = 1.0
    elif slope <= 10:
        slope_factor = 0.93
    elif slope <= 20:
        slope_factor = 0.82
    else:
        slope_factor = 0.65

    soil_factor = 0.88 if geo.get("soil", {}).get("hazards") else 1.0

    combined = frontage_factor * services_factor * title_factor * flood_factor * slope_factor * soil_factor
    v_mid = base_mid * area * combined
    v_lo = round(v_mid * 0.875, 0)
    v_hi = round(v_mid * 1.5, 0)

    asking_per_m2 = asking / area if area else 0
    market_per_m2 = v_mid / area if area else 0
    variance = (asking - v_mid) / v_mid * 100 if v_mid else 0

    if v_lo <= asking <= v_hi:
        assessment = "FAIR VALUE — reasonable to proceed"
    elif variance > 25:
        assessment = "OVERPRICED — negotiate or walk away"
    elif variance > 10:
        assessment = "Above market — negotiate hard"
    elif variance >= -10:
        assessment = "FAIR VALUE — reasonable to proceed"
    elif variance >= -25:
        assessment = "Below market — investigate why"
    else:
        assessment = "Well below market — title risk? Investigate"

    services_score = sum(1 for k in ("water", "electricity", "sewerage", "tarred_road") if services.get(k, True)) / 4 * 10
    title_score = title_factor * 10
    location_score = min(10, base_mid / 10)
    geo_score = flood_factor * slope_factor * 10
    plot_score = round(services_score * 0.3 + title_score * 0.2 + location_score * 0.25 + geo_score * 0.25, 1)

    flags = []
    if title == "offer_letter":
        flags.append("Offer letter — obtain title before purchase")
    if flood_score >= 3:
        flags.append("Elevated flood risk — verify drainage")

    return {
        "status": "complete",
        "estimated_market_value_usd": [round(v_lo, 0), round(v_hi, 0)],
        "estimated_market_mid_usd": round(v_mid, 0),
        "asking_price_usd": asking,
        "price_per_m2_asking": round(asking_per_m2, 2),
        "price_per_m2_market": round(market_per_m2, 2),
        "variance_pct": round(variance, 1),
        "assessment": assessment,
        "plot_potential_score": plot_score,
        "adjustment_factors": {
            "frontage": frontage_factor,
            "services": round(services_factor, 3),
            "title": title_factor,
            "flood": flood_factor,
            "slope": slope_factor,
        },
        "risk_flags": flags,
    }
