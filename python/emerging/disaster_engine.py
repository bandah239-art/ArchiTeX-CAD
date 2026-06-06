"""Disaster response planning engine.

Real, deterministic planning logic per hazard type (flood, earthquake, drought,
fire, storm), with population-scaled resource estimates and a phased timeline.
When ANTHROPIC_API_KEY is set, the plan is enriched with AI-generated local
guidance; otherwise the deterministic plan stands on its own.
"""

from __future__ import annotations

import math
from typing import Any

# Per-hazard response templates: phases (hours offset) and required asset classes.
_HAZARD_PLANS: dict[str, dict[str, Any]] = {
    "flood": {
        "phases": [
            (0, "Issue flood warning + map evacuation routes to high ground"),
            (2, "Evacuate low-lying zones; open elevated shelters"),
            (12, "Deploy water rescue + sandbag critical infrastructure"),
            (48, "Assess structural scour/foundation undermining on bridges & buildings"),
            (96, "Prioritise drainage clearing and emergency repairs"),
        ],
        "assets": ["water rescue boats", "sandbags", "water purification", "mobile pumps", "structural assessment team"],
        "key_risks": ["foundation scour", "contaminated water", "bridge washout"],
    },
    "earthquake": {
        "phases": [
            (0, "Search & rescue in collapsed structures (golden 72h)"),
            (6, "Rapid ATC-20 building safety tagging (green/yellow/red)"),
            (24, "Shelter displaced occupants from red-tagged buildings"),
            (72, "Detailed structural assessment + aftershock monitoring"),
            (168, "Demolition/retrofit prioritisation"),
        ],
        "assets": ["USAR team", "heavy lifting equipment", "structural engineers", "field hospital", "temporary shelter"],
        "key_risks": ["aftershock collapse", "soft-storey failure", "gas/fire secondary hazard"],
    },
    "drought": {
        "phases": [
            (0, "Activate water rationing + identify boreholes"),
            (24, "Deploy water tankers to affected settlements"),
            (168, "Drill/rehabilitate boreholes; protect livestock water"),
            (720, "Establish long-term supply (dams, pipelines)"),
        ],
        "assets": ["water tankers", "borehole drilling rig", "storage tanks", "hydrogeologist"],
        "key_risks": ["aquifer depletion", "crop failure", "sanitation collapse"],
    },
    "fire": {
        "phases": [
            (0, "Evacuate + establish firebreaks"),
            (3, "Suppress fire; protect critical assets"),
            (24, "Damage assessment of affected structures"),
            (72, "Structural safety tagging + utility restoration"),
        ],
        "assets": ["fire tenders", "firebreak equipment", "structural assessment team", "emergency shelter"],
        "key_risks": ["structural steel weakening", "spread to adjacent buildings", "smoke/air quality"],
    },
    "storm": {
        "phases": [
            (0, "Issue warning; secure loose structures & evacuate if needed"),
            (6, "Clear blocked roads; restore access"),
            (24, "Assess roof/cladding/power infrastructure damage"),
            (72, "Emergency repairs and weatherproofing"),
        ],
        "assets": ["debris clearing equipment", "tarpaulins", "power restoration crew", "structural assessment team"],
        "key_risks": ["roof loss", "power outage", "flying debris"],
    },
}


def _resource_scale(population: int) -> dict[str, Any]:
    """Sphere-standard-inspired minimum resource estimates."""
    pop = max(0, int(population))
    return {
        "affected_population": pop,
        "water_litres_per_day": pop * 15,          # Sphere: 15 L/person/day
        "shelter_units": math.ceil(pop / 5),        # ~5 persons/family shelter
        "latrines": math.ceil(pop / 20),            # 1 latrine / 20 people
        "medical_teams": max(1, math.ceil(pop / 10000)),
        "food_rations_per_day": pop,
    }


def _severity(hazard: str, population: int, intensity: float) -> str:
    score = (intensity or 0) * math.log10(max(10, population))
    if score >= 8:
        return "catastrophic"
    if score >= 5:
        return "severe"
    if score >= 2.5:
        return "moderate"
    return "minor"


def build_plan(payload: dict[str, Any]) -> dict[str, Any]:
    hazard = str(payload.get("hazard_type", "flood")).lower()
    plan = _HAZARD_PLANS.get(hazard)
    known = plan is not None
    plan = plan or _HAZARD_PLANS["flood"]

    lat = float(payload.get("latitude", 0))
    lon = float(payload.get("longitude", 0))
    population = int(payload.get("affected_population", payload.get("population", 1000)))
    intensity = float(payload.get("intensity", 0.5))  # 0-1 normalized hazard magnitude

    phases = [
        {"phase": i + 1, "hour_offset": h, "action": action}
        for i, (h, action) in enumerate(plan["phases"])
    ]

    result = {
        "status": "complete",
        "engine": "disaster_planner",
        "hazard_type": hazard,
        "recognised_hazard": known,
        "location": {"latitude": lat, "longitude": lon},
        "severity": _severity(hazard, population, intensity),
        "response_phases": phases,
        "assets_required": plan["assets"],
        "key_risks": plan["key_risks"],
        "resource_estimate": _resource_scale(population),
        "ai_enriched": False,
    }

    if payload.get("enrich_with_ai"):
        _enrich(result, payload)
    return result


def _enrich(result: dict[str, Any], payload: dict[str, Any]) -> None:
    """Best-effort AI enrichment; silently no-ops without a key."""
    try:
        from ai.claude_client import call_claude

        system = (
            "You are a disaster response engineer for African infrastructure. "
            "Return JSON with keys: local_considerations (list of strings), "
            "priority_actions (list of strings). Be specific and practical."
        )
        user = (
            f"Hazard: {result['hazard_type']}, severity: {result['severity']}, "
            f"location lat/lon: {result['location']}, affected population: "
            f"{result['resource_estimate']['affected_population']}. "
            f"Country context: {payload.get('country_code', 'ZM')}."
        )
        ai = call_claude(system, user)
        if isinstance(ai, dict) and not ai.get("fallback") and not ai.get("error"):
            result["ai_enriched"] = True
            result["local_considerations"] = ai.get("local_considerations", [])
            result["priority_actions"] = ai.get("priority_actions", [])
        else:
            result["ai_note"] = "Set ANTHROPIC_API_KEY to enable AI enrichment."
    except Exception as exc:  # pragma: no cover - network/SDK dependent
        result["ai_note"] = f"AI enrichment unavailable: {exc}"
