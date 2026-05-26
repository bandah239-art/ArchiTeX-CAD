"""AI Design Brief Generator."""

import json
from datetime import datetime, timezone
from typing import Any

from ai.gemini_client import call_gemini

SYSTEM_TEMPLATE = """You are a senior structural and architectural engineer specialising in African infrastructure.
You have deep knowledge of Eurocode 2, SATCC road standards, Kenya Road Design Manual, Nigerian building codes,
Zambia Building Regulations, and African construction context including local materials, climate, and soil types.

SITE CONTEXT:
- Soil bearing capacity: {bearing_capacity} kN/m²
- Annual rainfall: {annual_rainfall} mm
- Seismic zone: {seismic_category}
- Design wind speed: {wind_speed} m/s
- Climate zone: {climate_zone}
- Country: {country}

BUDGET: USD {budget}
Exchange rate: {exchange_rate}

Output structured JSON only with key "design_brief" containing:
project_type, description, gross_floor_area, storeys, occupancy, spatial_programme (list of space/area_m2/notes),
structural_scheme (foundation_type, foundation_depth, wall_construction, roof_type, floor_type, key_structural_elements),
climate_design, materials_specification, preliminary_programme, design_risks, preliminary_cost_estimate.
All recommendations must suit the African country and site provided."""


def _fallback_brief(payload: dict[str, Any]) -> dict[str, Any]:
    """Rule-based design brief when Gemini API unavailable."""
    country = payload.get("country_code", "ZM")
    budget = float(payload.get("budget_usd", 45000))
    ptype = payload.get("project_type", "residential")
    prompt = payload.get("natural_language_prompt", "").lower()
    geo = payload.get("geo_data") or {}
    bearing = geo.get("bearing_capacity_mid", 150)
    rainfall = geo.get("annual_rainfall_mm", 842)

    bedrooms = 4 if "4 bed" in prompt or "4 bedroom" in prompt else 3
    has_pool = "pool" in prompt
    has_garage = "garage" in prompt
    is_nairobi = country == "KE" or "nairobi" in prompt or "karen" in prompt
    is_lusaka = country == "ZM" or "lusaka" in prompt

    gfa = 320 if bedrooms >= 4 else 142
    if has_pool:
        gfa += 25
    if has_garage:
        gfa += 40

    city_notes = {
        "KE": "Karen premium residential — specify local red soil founding at 1.5m. IBR or clay tile roof both common.",
        "ZM": "Specify Zambian-manufactured bricks (Kafue Brickworks). Cement: Lafarge or Zambezi. IBR: Metlika or ZamSteel.",
    }
    country_note = city_notes.get(country, "All primary materials locally available.")

    spaces = [
        {"space": "Master Bedroom", "area_m2": 22.0, "notes": "En-suite, cross-ventilation"},
        {"space": "Bedroom 2", "area_m2": 16.0, "notes": "East-facing morning light"},
        {"space": "Bedroom 3", "area_m2": 14.0, "notes": "Children's room"},
    ]
    if bedrooms >= 4:
        spaces.append({"space": "Bedroom 4", "area_m2": 14.0, "notes": "Guest or study"})
    spaces += [
        {"space": "Living/Dining", "area_m2": 38.0, "notes": "Open plan with verandah connection"},
        {"space": "Kitchen", "area_m2": 16.0, "notes": "Pantry and outdoor kitchen connection"},
        {"space": "Verandah / Covered Terrace", "area_m2": 28.0, "notes": "Essential African climate feature — min 2.4m depth"},
        {"space": "Bathrooms", "area_m2": 14.0, "notes": "Master en-suite + family bathroom"},
    ]
    if has_garage:
        spaces.append({"space": "Double Garage", "area_m2": 40.0, "notes": "Attached double garage with store"})
    if has_pool:
        spaces.append({"space": "Swimming Pool", "area_m2": 25.0, "notes": "8×3m pool with filtration plant room"})
    if is_lusaka:
        spaces.append({"space": "Staff Quarters", "area_m2": 8.5, "notes": "Separate domestic quarters per Zambian convention"})

    foundation = "Strip foundation" if bearing >= 100 else "Raft foundation"
    if "red soil" in prompt or "clay" in prompt:
        foundation = "Strip foundation at 1.5m on red lateritic soil"

    construction_cost = min(budget * 0.88, gfa * (380 if is_nairobi else 300))
    total = construction_cost * 1.175

    return {
        "design_brief": {
            "project_type": f"{ptype.title()} — {'Single Dwelling' if ptype == 'residential' else ptype}",
            "description": payload.get("natural_language_prompt", "African residential design"),
            "gross_floor_area": gfa,
            "storeys": 1 if gfa < 400 else 2,
            "occupancy": bedrooms + 2,
            "spatial_programme": spaces,
            "structural_scheme": {
                "foundation_type": foundation,
                "foundation_depth": 1.5 if is_nairobi else 1.2,
                "foundation_width": 0.6,
                "foundation_rationale": f"Bearing {bearing} kN/m² — {foundation} appropriate",
                "wall_construction": "230mm clay brick with 1:4 cement mortar",
                "roof_type": "Pitched IBR steel sheet" if not is_nairobi else "Pitched IBR or clay tile",
                "roof_pitch": 22.5,
                "roof_overhang": 0.9,
                "floor_type": "Ground-bearing slab on 300mm hardcore",
                "floor_thickness": 100,
                "columns": "Load-bearing masonry" if gfa < 350 else "RC frame at corners",
                "lintel_type": "Precast concrete lintels over all openings",
            },
            "climate_design": {
                "orientation": "Living areas north-facing (Southern Hemisphere)",
                "ventilation": "Cross-ventilation all bedrooms",
                "shading": "Verandah + 900mm roof overhangs",
                "rainfall_note": f"{rainfall}mm annual — gutters and drainage essential",
            },
            "materials_specification": {
                "primary_structure": {
                    "foundations": "Concrete C25, H10 reinforcement",
                    "walls": "230mm clay brick",
                    "roof": "76×50mm purlins, IBR 0.47mm",
                    "floor": "100mm C20 on hardcore",
                },
                "country_specific_notes": {"notes": country_note},
            },
            "preliminary_programme": {
                "foundation_weeks": 3,
                "superstructure_weeks": 10 if gfa > 250 else 8,
                "roof_weeks": 2,
                "finishes_weeks": 8,
                "total_weeks": 23 if gfa > 250 else 19,
            },
            "design_risks": [
                {"risk": "Wet season construction", "level": "Medium", "mitigation": "Start in dry season"},
                {"risk": "Soil variability", "level": "Medium", "mitigation": "3 trial pits before final design"},
            ],
            "preliminary_cost_estimate": {
                "construction_cost_usd": round(construction_cost, 0),
                "contingency_usd": round(construction_cost * 0.1, 0),
                "professional_fees_usd": round(construction_cost * 0.075, 0),
                "total_project_cost_usd": round(total, 0),
                "cost_per_m2_usd": round(construction_cost / gfa, 0),
                "budget_assessment": "WITHIN BUDGET" if total <= budget * 1.05 else "OVER BUDGET",
                "budget_variance_pct": round((total - budget) / budget * 100, 1),
            },
        },
        "source": "fallback_generator",
    }


def generate_design(payload: dict[str, Any]) -> dict[str, Any]:
    geo = payload.get("geo_data") or {}
    from boq.materials_database import EXCHANGE_RATES

    country = payload.get("country_code", "ZM")
    fx = EXCHANGE_RATES.get(country, EXCHANGE_RATES["ZM"])

    system = SYSTEM_TEMPLATE.format(
        bearing_capacity=geo.get("bearing_capacity_mid", 150),
        annual_rainfall=geo.get("annual_rainfall_mm", 800),
        seismic_category=geo.get("seismic_design_category", "B"),
        wind_speed=geo.get("design_wind_speed_ms", 28),
        climate_zone=geo.get("climate_zone", "Sub-humid"),
        country=country,
        budget=payload.get("budget_usd", 45000),
        exchange_rate=fx.get("rate", 26.5),
    )

    user = json_prompt(payload)
    result = call_gemini(system, user)

    if result.get("fallback") or "design_brief" not in result:
        brief = _fallback_brief(payload)
        brief["api_status"] = "fallback" if result.get("error") else "ok"
        brief["timestamp"] = datetime.now(timezone.utc).isoformat()
        return brief

    result["source"] = "gemini_api"
    result["timestamp"] = datetime.now(timezone.utc).isoformat()
    return result


def json_prompt(payload: dict[str, Any]) -> str:
    return (
        f"Project type: {payload.get('project_type', 'residential')}\n"
        f"Country: {payload.get('country_code', 'ZM')}\n"
        f"Budget USD: {payload.get('budget_usd', 45000)}\n"
        f"Design code: {payload.get('design_code', 'eurocode')}\n"
        f"Client requirements: {payload.get('natural_language_prompt', '')}\n"
        f"Geo data: {json.dumps(payload.get('geo_data', {}))}\n"
        "Generate complete design_brief JSON."
    )
