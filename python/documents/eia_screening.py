"""EIA preliminary screening tool."""

from typing import Any

THRESHOLDS = {
    "ZM": {
        "road_km": 50,
        "building_m2": 5000,
        "value_usd": 5_000_000,
        "water_m3_day": 500,
        "agency": "ZEMA",
    },
    "KE": {
        "value_kes": 50_000_000,
        "agency": "NEMA",
    },
    "NG": {
        "road_km": 10,
        "agency": "NESREA",
    },
}


def screen_eia(payload: dict[str, Any]) -> dict[str, Any]:
    country = payload.get("country_code", "ZM")
    ptype = payload.get("project_type", "building")
    scale = payload.get("project_scale", {})
    gfa = float(scale.get("gross_floor_area_m2", payload.get("gross_floor_area_m2", 0)))
    value = float(scale.get("value_usd", payload.get("estimated_value_usd", 0)))
    road_km = float(scale.get("road_length_km", 0))
    geo = payload.get("geo_data", {})
    proximity = payload.get("proximity_to", {})

    thresholds = THRESHOLDS.get(country, THRESHOLDS["ZM"])
    agency = thresholds.get("agency", "Environmental Agency")

    full_eia = False
    reasons = []

    if country == "ZM":
        if road_km > thresholds.get("road_km", 50):
            full_eia = True
            reasons.append(f"Road length {road_km}km exceeds ZEMA threshold ({thresholds['road_km']}km)")
        if gfa > thresholds.get("building_m2", 5000):
            full_eia = True
            reasons.append(f"Building area {gfa}m² exceeds ZEMA threshold")
        if value > thresholds.get("value_usd", 5_000_000):
            full_eia = True
            reasons.append(f"Project value USD {value:,.0f} exceeds ZEMA threshold")
    elif country == "KE" and value > 0:
        full_eia = value > 500_000
        if full_eia:
            reasons.append("Project exceeds NEMA value threshold")
    elif country == "NG" and ptype in ("industrial", "industrial_plant"):
        full_eia = True
        reasons.append("Industrial projects require mandatory EIA in Nigeria")

    if proximity.get("protected_area_km", 99) < 5:
        reasons.append("Within 5km of protected area — biodiversity assessment required")
    if proximity.get("watercourse_m", 999) < 500:
        reasons.append("Within 500m of watercourse — water resources impact assessment")

    screening = "Full EIA Required" if full_eia else "Environmental Audit / Negative Declaration"

    content = f"""
PRELIMINARY ENVIRONMENTAL SCREENING REPORT

Project: {payload.get('project_name', 'Project')}
Location: {payload.get('latitude', '')}, {payload.get('longitude', '')}
Country: {country}
Date: {payload.get('date', '')}

1. PROJECT DESCRIPTION
Type: {ptype}
Scale: GFA {gfa}m², Value USD {value:,.0f}

2. SCREENING RESULT: {screening}
Agency: {agency}
Reasons: {'; '.join(reasons) if reasons else 'Below mandatory EIA thresholds'}

3. KEY ENVIRONMENTAL CONSIDERATIONS
Water Resources: {'Flag — near watercourse' if proximity.get('watercourse_m', 999) < 500 else 'No immediate watercourse concern'}
Biodiversity: {'Flag — near protected area' if proximity.get('protected_area_km', 99) < 5 else 'Standard clearance assessment'}
Social Impact: {'Community consultation recommended' if value > 1_000_000 else 'Limited social impact expected'}
Construction impacts: Dust, noise, waste management plan required

4. RECOMMENDED MEASURES
- Erosion and sediment control during construction
- Waste management and spill prevention
- Community engagement for affected settlements
- {geo.get('recommendation', 'Site-specific measures from geo intelligence')}

5. NEXT STEPS
Submit screening to {agency}
Estimated processing: 4–12 weeks
Estimated EIA cost: USD {max(5000, value * 0.002):,.0f}

DISCLAIMER: Preliminary screening only. Consult a licensed Environmental Practitioner.
"""

    return {
        "status": "complete",
        "screening_result": screening,
        "agency": agency,
        "full_eia_required": full_eia,
        "reasons": reasons,
        "considerations": {
            "water": proximity.get("watercourse_m", 999) < 500,
            "biodiversity": proximity.get("protected_area_km", 99) < 5,
            "social_consultation": value > 1_000_000,
        },
        "content": content.strip(),
        "format": "text",
    }
