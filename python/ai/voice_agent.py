"""ArchiTeX CAD Voice Agent — full platform-aware AI assistant.

When Claude API is available, the agent uses full LLM reasoning.
When it is not (no API key), a comprehensive local NLU engine takes
over that understands every panel, calculator, view mode, and
build command in the platform.
"""

import json
import logging
import re
from typing import Any, Dict, Optional

from .gemini_client import call_gemini

logger = logging.getLogger(__name__)

# ─── Full system prompt for Claude ───────────────────────────────────
VOICE_AGENT_PROMPT = """You are the intelligent Voice Assistant for ArchiTeX CAD — a professional infrastructure engineering, BIM, and generative design platform built for Africa.

You must respond ONLY with a raw JSON object (no markdown fences). Structure:
{
    "intent": "calculate" | "build_3d" | "navigate" | "switch_view" | "os_command" | "clarify" | "chat",
    "spoken_response": "short conversational text the voice agent speaks aloud",
    "payload": { ... }
}

──── THE PLATFORM ────
ArchiTeX CAD has the following modules accessible via the sidebar:
• viewer     — 🏗️ 3D BIM Viewer (Three.js / xeokit)
• calculator — 📐 Engineering Calculators (beam, slab, column, foundation, bearing, wind loads, pavement, drainage, traffic, solar/BESS, microgrid, transmission, hydro, biogas, wind wake, grid fault, water tower, pipe network, DEWATS, WTP, stormwater, landfill, irrigation, piles, slope, consolidation, ground improvement, tunneling, borehole, sewer, water demand, bearing capacity, settlement, slope stability, site classification, solar PV, battery storage, carbon)
• boq        — 📋 Bill of Quantities (auto-priced from BIM elements with live market rates)
• schedule   — 📅 4D Construction Scheduling
• optimizer  — 🧬 Generative Design Optimizer
• seismic    — 🌋 Seismic & Earthquake Analysis
• geo        — 🌍 Geotechnical Engineering
• vision     — 👁️ Computer Vision (site photo analysis)
• ai         — 🤖 AI Proposals & Reports
• realestate — 🏠 Real Estate Valuation
• government — 🏛️ Regulatory Compliance
• documents  — 📄 Document Management
• carbon     — 🌱 Carbon & Sustainability
• wash       — 💧 Water, Sanitation & Hygiene (WASH)
• energy     — ☀️ Energy Engineering (solar, hydro, grid, BESS)
• intelligence — 🔮 Digital Twin & IoT
• emerging   — 🚀 Emerging Technologies (AR/VR, drones, 3D printing)

View modes (top bar): bim (3D viewer), gis (GIS satellite map), sld (Electrical single-line diagram)

──── CALCULATOR IDs ────
Structural: beam, slab, column, foundation, bearing
Loads: wind_loads, load_combinations
Roads: pavement, drainage, geometric_design, traffic_load
Pressure: foundation_bearing, lateral_earth, wind_distribution, boussinesq, bridge_hydrostatic, bridge_hydrodynamic, bridge_foundation, pavement_pressure, pipe_pressure, tank_pressure, consolidation
Energy: energy_bess, energy_microgrid, energy_transmission, energy_hydro, energy_biogas, energy_wind_wake, energy_grid_fault, solar_pv, battery_storage
WASH: water_demand, wash_water_tower, wash_epanet, wash_dewats, wash_wtp, wash_stormwater, wash_landfill, wash_irrigation, borehole, sewer_design, pipe_network, treatment_plant
Geo: geo_piles, geo_slope, geo_consolidation, geo_ground_improvement, geo_tunneling, bearing_capacity, settlement, slope_stability, site_classification
Sustainability: carbon

──── INTENTS ────

1. "calculate": User wants to run an engineering calculation.
   payload: {"calculator_id": "...", "parameters": {extracted numbers}}

2. "build_3d": User wants to place/construct something in the 3D viewer.
   payload: {"type": "rod"|"box"|"sphere"|"wall"|"slab"|"column", "dimensions": {...}, "position": {...}}

3. "navigate": User wants to open a specific panel/module.
   payload: {"panel": "viewer"|"calculator"|"boq"|"schedule"|...}

4. "switch_view": User wants to switch workspace view.
   payload: {"view": "bim"|"gis"|"sld"}

5. "os_command": User wants OS-level actions (Electron desktop app only).
   payload: {"action": "minimize_app"|"maximize_app"|"open_folder"|"close_tabs"|"open_tabs"|"import_file", "target_path": "..."}

6. "clarify": Ambiguous command. spoken_response asks the clarifying question.
   payload: {}

7. "chat": General conversation, greetings, platform questions.
   payload: {}

RULES:
- NO markdown fences. Just raw JSON.
- spoken_response must be natural, conversational, and concise.
- You deeply understand civil, structural, electrical, geotechnical, water/sanitation, and energy engineering.
- When the user asks you to do something, DO IT. Map it to an intent and execute.
"""


# ─── Comprehensive local NLU engine ──────────────────────────────────

# Calculator lookup table: keyword -> (calculator_id, friendly_name)
_CALC_MAP: Dict[str, tuple[str, str]] = {
    # Structural
    "beam": ("beam", "beam"), "slab": ("slab", "slab"), "column": ("column", "column"),
    "foundation": ("foundation", "foundation"), "footing": ("foundation", "foundation"),
    "bearing": ("bearing", "bearing pad"),
    # Loads
    "wind load": ("wind_loads", "wind load"), "load combination": ("load_combinations", "load combination"),
    # Roads
    "pavement": ("pavement", "flexible pavement"), "road": ("pavement", "road pavement"),
    "drainage": ("drainage", "road drainage"), "geometric design": ("geometric_design", "geometric road design"),
    "traffic": ("traffic_load", "traffic load"),
    # Pressure
    "lateral earth": ("lateral_earth", "lateral earth pressure"), "boussinesq": ("boussinesq", "Boussinesq stress"),
    "bridge hydrostatic": ("bridge_hydrostatic", "bridge hydrostatic pressure"),
    "bridge hydrodynamic": ("bridge_hydrodynamic", "bridge hydrodynamic"),
    "bridge foundation": ("bridge_foundation", "bridge foundation"),
    "pipe pressure": ("pipe_pressure", "pipe pressure"), "tank pressure": ("tank_pressure", "tank pressure"),
    # Energy
    "solar": ("energy_bess", "solar and battery storage"), "battery": ("energy_bess", "battery energy storage"),
    "bess": ("energy_bess", "battery energy storage system"),
    "cable": ("energy_microgrid", "microgrid cable sizing"), "voltage drop": ("energy_microgrid", "voltage drop"),
    "microgrid": ("energy_microgrid", "microgrid design"),
    "transmission": ("energy_transmission", "transmission line sag-tension"),
    "sag": ("energy_transmission", "sag-tension"),
    "hydro": ("energy_hydro", "small hydropower"), "hydropower": ("energy_hydro", "hydropower"),
    "biogas": ("energy_biogas", "biogas system"), "digester": ("energy_biogas", "biogas digester"),
    "wind wake": ("energy_wind_wake", "wind farm wake analysis"), "wind turbine": ("energy_wind_wake", "wind turbine"),
    "grid fault": ("energy_grid_fault", "grid fault analysis"), "short circuit": ("energy_grid_fault", "short circuit"),
    "solar pv": ("solar_pv", "solar PV system"), "photovoltaic": ("solar_pv", "photovoltaic"),
    # WASH
    "water demand": ("water_demand", "water demand"), "water supply": ("water_demand", "water supply"),
    "water tower": ("wash_water_tower", "water tower"), "elevated tank": ("wash_water_tower", "elevated water tank"),
    "pipe network": ("wash_epanet", "pipe network"), "epanet": ("wash_epanet", "EPANET pipe network"),
    "dewats": ("wash_dewats", "decentralized wastewater"), "wastewater": ("wash_dewats", "wastewater treatment"),
    "water treatment": ("wash_wtp", "water treatment plant"), "wtp": ("wash_wtp", "water treatment"),
    "stormwater": ("wash_stormwater", "stormwater management"), "storm drain": ("wash_stormwater", "storm drainage"),
    "landfill": ("wash_landfill", "landfill design"), "solid waste": ("wash_landfill", "solid waste"),
    "irrigation": ("wash_irrigation", "irrigation system"), "sprinkler": ("wash_irrigation", "sprinkler irrigation"),
    "borehole": ("borehole", "borehole design"), "well": ("borehole", "well design"),
    "sewer": ("sewer_design", "sewer design"), "sewage": ("sewer_design", "sewage system"),
    "treatment plant": ("treatment_plant", "treatment plant"),
    # Geo
    "pile": ("geo_piles", "pile foundation"), "deep foundation": ("geo_piles", "deep foundation"),
    "slope": ("geo_slope", "slope stability"), "embankment": ("geo_slope", "embankment stability"),
    "consolidation": ("geo_consolidation", "soil consolidation"), "settlement": ("settlement", "foundation settlement"),
    "ground improvement": ("geo_ground_improvement", "ground improvement"),
    "tunnel": ("geo_tunneling", "tunneling"), "tunneling": ("geo_tunneling", "tunnel design"),
    "bearing capacity": ("bearing_capacity", "bearing capacity"),
    "slope stability": ("slope_stability", "slope stability"),
    "site classification": ("site_classification", "site classification"),
    # Sustainability
    "carbon": ("carbon", "carbon emissions"), "sustainability": ("carbon", "sustainability assessment"),
    "co2": ("carbon", "CO2 analysis"),
}

# Panel lookup table
_PANEL_MAP: Dict[str, tuple[str, str]] = {
    "viewer": ("viewer", "3D BIM viewer"), "3d": ("viewer", "3D viewer"), "bim viewer": ("viewer", "BIM viewer"),
    "calculator": ("calculator", "engineering calculators"), "calc": ("calculator", "calculators"),
    "bill of quantities": ("boq", "Bill of Quantities"), "boq": ("boq", "Bill of Quantities"),
    "schedule": ("schedule", "construction schedule"), "scheduling": ("schedule", "4D scheduling"),
    "gantt": ("schedule", "Gantt chart"),
    "optimizer": ("optimizer", "generative design optimizer"), "optimize": ("optimizer", "optimizer"),
    "seismic": ("seismic", "seismic analysis"), "earthquake": ("seismic", "earthquake analysis"),
    "geotechnical": ("geo", "geotechnical engineering"), "geo": ("geo", "geotechnical"),
    "soil": ("geo", "geotechnical soil analysis"),
    "vision": ("vision", "computer vision"), "photo": ("vision", "site photo analysis"),
    "ai": ("ai", "AI assistant panel"), "proposal": ("ai", "AI proposals"),
    "real estate": ("realestate", "real estate valuation"), "property": ("realestate", "property valuation"),
    "government": ("government", "regulatory compliance"), "regulation": ("government", "government regulations"),
    "compliance": ("government", "compliance check"),
    "document": ("documents", "document management"), "report": ("documents", "reports"),
    "carbon": ("carbon", "carbon and sustainability"), "green": ("carbon", "sustainability"),
    "wash": ("wash", "water, sanitation and hygiene"), "water": ("wash", "WASH module"),
    "sanitation": ("wash", "WASH module"),
    "energy": ("energy", "energy engineering"), "electrical": ("energy", "electrical engineering"),
    "power": ("energy", "power engineering"),
    "intelligence": ("intelligence", "digital twin"), "digital twin": ("intelligence", "digital twin"),
    "iot": ("intelligence", "IoT monitoring"),
    "emerging": ("emerging", "emerging technologies"), "drone": ("emerging", "drone technology"),
    "ar": ("emerging", "augmented reality"), "vr": ("emerging", "virtual reality"),
    "3d print": ("emerging", "3D printing"),
}

# View lookup
_VIEW_MAP: Dict[str, tuple[str, str]] = {
    "gis": ("gis", "GIS satellite map"), "satellite": ("gis", "satellite map"), "map": ("gis", "GIS map"),
    "topography": ("gis", "topographic view"),
    "sld": ("sld", "single-line diagram"), "single line": ("sld", "single-line diagram"),
    "electrical diagram": ("sld", "electrical single-line diagram"),
    "bim": ("bim", "3D BIM workspace"), "3d view": ("bim", "3D workspace"),
}

# Build object types
_BUILD_MAP: Dict[str, str] = {
    "rod": "rod", "bar": "rod", "rebar": "rod",
    "box": "box", "cube": "box", "block": "box",
    "sphere": "sphere", "ball": "sphere",
    "wall": "wall", "partition": "wall",
    "slab": "slab", "floor": "slab", "deck": "slab",
    "column": "column", "pillar": "column", "post": "column",
    "beam": "box",
}


def _extract_number(text: str, keyword: str) -> Optional[float]:
    """Extract a number near a keyword, e.g. '5 meter beam' -> 5.0"""
    patterns = [
        rf"(\d+\.?\d*)\s*(?:m|meter|meters|metre|cm|mm|ft|inch)?\s*{keyword}",
        rf"{keyword}\s*(?:of\s+)?(\d+\.?\d*)",
        rf"(\d+\.?\d*)\s*{keyword}",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return float(m.group(1))
    return None


def _local_nlu(user_text: str) -> Dict[str, Any]:
    """Comprehensive local NLU engine that understands the full ArchiTeX CAD platform."""
    text = user_text.lower().strip()

    # ── Greetings ──
    greetings_pat = r"\b(hello|hi|hey|good\s+morning|good\s+afternoon|good\s+evening|howdy|what's\s+up|how\s+are\s+you)\b"
    if re.search(greetings_pat, text):
        return {
            "intent": "chat",
            "spoken_response": (
                "Hello! I'm the ArchiTeX CAD voice assistant. "
                "I can run any engineering calculator, navigate you to any module, "
                "build 3D objects, switch workspace views, and much more. "
                "Just tell me what you need."
            ),
            "payload": {},
        }

    # ── Switch view ──
    view_triggers = ["switch to", "show me", "open the", "go to", "change to", "take me to"]
    for trigger in view_triggers:
        if trigger in text:
            remaining = text.split(trigger, 1)[1].strip()
            for keyword, (view_id, view_name) in _VIEW_MAP.items():
                if keyword in remaining:
                    return {
                        "intent": "switch_view",
                        "spoken_response": f"Switching to the {view_name}.",
                        "payload": {"view": view_id},
                    }

    # ── Navigate to panel ──
    nav_triggers = ["open", "go to", "show", "take me to", "navigate to", "launch", "bring up"]
    for trigger in nav_triggers:
        if trigger in text:
            remaining = text.split(trigger, 1)[1].strip()
            for keyword, (panel_id, panel_name) in _PANEL_MAP.items():
                if keyword in remaining:
                    return {
                        "intent": "navigate",
                        "spoken_response": f"Opening the {panel_name} module.",
                        "payload": {"panel": panel_id},
                    }

    # ── Calculate ──
    calc_triggers = ["calculate", "compute", "design", "size", "analyze", "analyse", "check", "run", "do a", "perform"]
    is_calc = any(t in text for t in calc_triggers)
    if is_calc:
        for keyword, (calc_id, calc_name) in _CALC_MAP.items():
            if keyword in text:
                params: Dict[str, Any] = {}
                # Try extracting common parameters
                for dim in ["length", "width", "height", "span", "depth", "diameter", "load", "pressure", "capacity"]:
                    val = _extract_number(text, dim)
                    if val is not None:
                        params[dim] = val
                return {
                    "intent": "calculate",
                    "spoken_response": f"Opening the {calc_name} calculator for you." + (
                        f" I've pre-filled some parameters." if params else ""
                    ),
                    "payload": {"calculator_id": calc_id, "parameters": params},
                }
        # No specific calculator matched
        return {
            "intent": "chat",
            "spoken_response": (
                "I have over 50 engineering calculators available. "
                "Tell me specifically what you want to calculate — for example, "
                "'calculate a beam', 'design a pile foundation', 'size a solar system', "
                "or 'analyze stormwater drainage'."
            ),
            "payload": {},
        }

    # ── Build 3D ──
    build_triggers = ["build", "create", "place", "construct", "add", "put", "insert", "draw"]
    if any(t in text for t in build_triggers):
        obj_type = "box"
        for keyword, mapped_type in _BUILD_MAP.items():
            if keyword in text:
                obj_type = mapped_type
                break
        dims: Dict[str, float] = {"length": 3, "width": 1, "height": 1}
        for d in ["length", "width", "height"]:
            val = _extract_number(text, d)
            if val is not None:
                dims[d] = val
        # Try extracting a general size number
        size_match = re.search(r"(\d+\.?\d*)\s*(?:m|meter|cm|mm|ft)", text)
        if size_match and all(d not in text for d in ["length", "width", "height"]):
            s = float(size_match.group(1))
            dims = {"length": s, "width": s * 0.3, "height": s * 0.3}

        return {
            "intent": "build_3d",
            "spoken_response": f"Building a {obj_type} in the 3D viewer now.",
            "payload": {
                "type": obj_type,
                "dimensions": dims,
                "position": {"x": 0, "y": 0, "z": 0},
            },
        }

    # ── What can you do / Help ──
    help_triggers = ["what can you do", "help", "capabilities", "what do you know", "tell me about yourself", "who are you", "what are you"]
    if any(h in text for h in help_triggers):
        return {
            "intent": "chat",
            "spoken_response": (
                "I am the ArchiTeX CAD voice assistant. I can do the following: "
                "First, I can run over 50 engineering calculators — beams, slabs, columns, foundations, "
                "solar systems, pipe networks, boreholes, slope stability, and much more. "
                "Second, I can navigate you to any module — just say 'open the BOQ' or 'go to energy'. "
                "Third, I can build 3D objects in the viewer — say 'build a 5 meter column'. "
                "Fourth, I can switch workspace views — say 'show me the GIS map' or 'switch to the electrical diagram'. "
                "What would you like to do?"
            ),
            "payload": {},
        }

    # ── Direct panel name match (without trigger words) ──
    for keyword, (panel_id, panel_name) in _PANEL_MAP.items():
        if text.strip() == keyword or text.strip() == panel_name.lower():
            return {
                "intent": "navigate",
                "spoken_response": f"Opening the {panel_name} module.",
                "payload": {"panel": panel_id},
            }

    # ── Direct calculator name match ──
    for keyword, (calc_id, calc_name) in _CALC_MAP.items():
        if keyword in text and len(text.split()) <= 4:
            return {
                "intent": "calculate",
                "spoken_response": f"Opening the {calc_name} calculator.",
                "payload": {"calculator_id": calc_id, "parameters": {}},
            }

    # ── Default: acknowledge and guide ──
    return {
        "intent": "chat",
        "spoken_response": (
            f"I heard: {user_text}. "
            "I can run engineering calculations, navigate to any module, build 3D objects, "
            "or switch workspace views. Try saying something like "
            "'calculate a beam', 'open the energy panel', or 'build a wall'."
        ),
        "payload": {},
    }


# ─── Main entry point ────────────────────────────────────────────────

def process_voice_command(user_text: str) -> Dict[str, Any]:
    """Process a voice command — uses Gemini if available, otherwise local NLU."""
    try:
        response = call_gemini(VOICE_AGENT_PROMPT, user_text)

        # Gemini unavailable (no API key, network error, etc.)
        if isinstance(response, dict) and response.get("error"):
            logger.info(f"Gemini unavailable ({response.get('error')}), using local NLU.")
            return _local_nlu(user_text)

        # Valid Gemini response
        if isinstance(response, dict) and "intent" in response:
            return response

        logger.error(f"Unexpected Gemini response: {response}")
        return _local_nlu(user_text)

    except Exception as e:
        logger.exception("Voice command processing error")
        return _local_nlu(user_text)
