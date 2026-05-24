"""African materials price database for BoQ compilation."""

from typing import Any

COUNTRY_NAMES = {
    "ZM": "Zambia",
    "KE": "Kenya",
    "NG": "Nigeria",
    "GH": "Ghana",
    "TZ": "Tanzania",
    "ZW": "Zimbabwe",
    "BW": "Botswana",
    "MZ": "Mozambique",
    "ET": "Ethiopia",
    "UG": "Ugana",
}

EXCHANGE_RATES: dict[str, dict[str, float | str]] = {
    "ZM": {"currency": "ZMW", "rate": 26.5},
    "KE": {"currency": "KES", "rate": 128.0},
    "NG": {"currency": "NGN", "rate": 1580.0},
    "GH": {"currency": "GHS", "rate": 15.2},
    "TZ": {"currency": "TZS", "rate": 2680.0},
    "ZW": {"currency": "ZIG", "rate": 13.6},
    "BW": {"currency": "BWP", "rate": 13.5},
    "MZ": {"currency": "MZN", "rate": 63.5},
    "ET": {"currency": "ETB", "rate": 115.0},
    "UG": {"currency": "UGX", "rate": 3780.0},
}

_DEFAULT_COUNTRIES = ["ZM", "KE", "NG", "GH", "TZ", "ZW", "BW", "MZ"]


def _rebar_rates(base_zm: tuple[float, float]) -> dict[str, dict[str, float | str]]:
    zm_min, zm_max = base_zm
    return {
        "ZM": {"min": zm_min, "max": zm_max, "currency": "USD"},
        "KE": {"min": zm_min * 0.78, "max": zm_max * 0.78, "currency": "USD"},
        "NG": {"min": zm_min * 0.68, "max": zm_max * 0.70, "currency": "USD"},
        "GH": {"min": zm_min * 0.82, "max": zm_max * 0.82, "currency": "USD"},
        "TZ": {"min": zm_min * 0.86, "max": zm_max * 0.86, "currency": "USD"},
        "ZW": {"min": zm_min * 0.91, "max": zm_max * 0.93, "currency": "USD"},
        "BW": {"min": zm_min * 0.95, "max": zm_max * 0.96, "currency": "USD"},
        "MZ": {"min": zm_min * 0.95, "max": zm_max * 0.96, "currency": "USD"},
    }


def _earth_rates(zm_soft: tuple[float, float]) -> dict[str, dict[str, float | str]]:
    zm_min, zm_max = zm_soft
    return {cc: {"min": zm_min, "max": zm_max, "currency": "USD"} for cc in _DEFAULT_COUNTRIES}


MATERIALS_DATABASE: dict[str, dict[str, Any]] = {
    "concrete_c25": {
        "description": "Ready-mix concrete Grade C25/30",
        "unit": "m³",
        "rates": {
            "ZM": {"min": 380, "max": 450, "currency": "USD"},
            "KE": {"min": 120, "max": 160, "currency": "USD"},
            "NG": {"min": 95, "max": 130, "currency": "USD"},
            "GH": {"min": 110, "max": 145, "currency": "USD"},
            "TZ": {"min": 130, "max": 170, "currency": "USD"},
            "ZW": {"min": 150, "max": 200, "currency": "USD"},
            "BW": {"min": 200, "max": 260, "currency": "USD"},
            "MZ": {"min": 160, "max": 210, "currency": "USD"},
        },
        "wastage_factor": 1.05,
        "category": "Structural Concrete",
    },
    "concrete_c30": {
        "description": "Ready-mix concrete Grade C30/37",
        "unit": "m³",
        "rates": {
            "ZM": {"min": 420, "max": 500, "currency": "USD"},
            "KE": {"min": 135, "max": 175, "currency": "USD"},
            "NG": {"min": 105, "max": 145, "currency": "USD"},
            "GH": {"min": 120, "max": 158, "currency": "USD"},
            "TZ": {"min": 145, "max": 185, "currency": "USD"},
            "ZW": {"min": 165, "max": 215, "currency": "USD"},
            "BW": {"min": 215, "max": 275, "currency": "USD"},
            "MZ": {"min": 175, "max": 225, "currency": "USD"},
        },
        "wastage_factor": 1.05,
        "category": "Structural Concrete",
    },
    "concrete_c10": {
        "description": "Blinding concrete Grade C10/12",
        "unit": "m³",
        "rates": {
            "ZM": {"min": 280, "max": 340, "currency": "USD"},
            "KE": {"min": 95, "max": 125, "currency": "USD"},
            "NG": {"min": 75, "max": 105, "currency": "USD"},
            "GH": {"min": 85, "max": 115, "currency": "USD"},
        },
        "wastage_factor": 1.05,
        "category": "Structural Concrete",
    },
    "rebar_h10": {
        "description": "High yield reinforcement bar H10",
        "unit": "tonne",
        "rates": _rebar_rates((1100, 1350)),
        "wastage_factor": 1.08,
        "category": "Reinforcement",
    },
    "rebar_h16": {
        "description": "High yield reinforcement bar H16",
        "unit": "tonne",
        "rates": _rebar_rates((1120, 1380)),
        "wastage_factor": 1.08,
        "category": "Reinforcement",
    },
    "rebar_h20": {
        "description": "High yield reinforcement bar H20",
        "unit": "tonne",
        "rates": _rebar_rates((1140, 1400)),
        "wastage_factor": 1.08,
        "category": "Reinforcement",
    },
    "rebar_h25": {
        "description": "High yield reinforcement bar H25",
        "unit": "tonne",
        "rates": _rebar_rates((1160, 1420)),
        "wastage_factor": 1.08,
        "category": "Reinforcement",
    },
    "rebar_h32": {
        "description": "High yield reinforcement bar H32",
        "unit": "tonne",
        "rates": _rebar_rates((1180, 1450)),
        "wastage_factor": 1.08,
        "category": "Reinforcement",
    },
    "rebar_links_h8": {
        "description": "High yield reinforcement links H8",
        "unit": "tonne",
        "rates": _rebar_rates((1150, 1400)),
        "wastage_factor": 1.10,
        "category": "Reinforcement",
    },
    "formwork_soffit": {
        "description": "Formwork to soffit of slabs",
        "unit": "m²",
        "rates": {
            "ZM": {"min": 18, "max": 28, "currency": "USD"},
            "KE": {"min": 8, "max": 14, "currency": "USD"},
            "NG": {"min": 6, "max": 12, "currency": "USD"},
            "GH": {"min": 7, "max": 13, "currency": "USD"},
        },
        "wastage_factor": 1.10,
        "category": "Formwork",
    },
    "formwork_beam_sides": {
        "description": "Formwork to sides and soffit of beams",
        "unit": "m²",
        "rates": {
            "ZM": {"min": 22, "max": 32, "currency": "USD"},
            "KE": {"min": 10, "max": 16, "currency": "USD"},
            "NG": {"min": 8, "max": 14, "currency": "USD"},
            "GH": {"min": 9, "max": 15, "currency": "USD"},
        },
        "wastage_factor": 1.10,
        "category": "Formwork",
    },
    "formwork_column": {
        "description": "Formwork to sides of columns",
        "unit": "m²",
        "rates": {
            "ZM": {"min": 24, "max": 34, "currency": "USD"},
            "KE": {"min": 11, "max": 17, "currency": "USD"},
            "NG": {"min": 9, "max": 15, "currency": "USD"},
            "GH": {"min": 10, "max": 16, "currency": "USD"},
        },
        "wastage_factor": 1.10,
        "category": "Formwork",
    },
    "formwork_foundation": {
        "description": "Formwork to sides of foundations",
        "unit": "m²",
        "rates": {
            "ZM": {"min": 20, "max": 28, "currency": "USD"},
            "KE": {"min": 9, "max": 15, "currency": "USD"},
            "NG": {"min": 7, "max": 13, "currency": "USD"},
            "GH": {"min": 8, "max": 14, "currency": "USD"},
        },
        "wastage_factor": 1.10,
        "category": "Formwork",
    },
    "brick_clay_standard": {
        "description": "Clay brick 230×110×75mm",
        "unit": "1000 bricks",
        "rates": {
            "ZM": {"min": 280, "max": 380, "currency": "USD"},
            "KE": {"min": 120, "max": 180, "currency": "USD"},
            "NG": {"min": 80, "max": 140, "currency": "USD"},
        },
        "wastage_factor": 1.10,
        "coverage": 50,
        "category": "Masonry",
    },
    "block_concrete_150": {
        "description": "Hollow concrete block 150mm",
        "unit": "m²",
        "rates": {
            "ZM": {"min": 22, "max": 32, "currency": "USD"},
            "KE": {"min": 10, "max": 16, "currency": "USD"},
            "NG": {"min": 8, "max": 14, "currency": "USD"},
            "GH": {"min": 9, "max": 15, "currency": "USD"},
        },
        "wastage_factor": 1.05,
        "category": "Masonry",
    },
    "ibs_sheets_ibr": {
        "description": "IBR steel roofing sheets 0.47mm BMT",
        "unit": "m²",
        "rates": {
            "ZM": {"min": 12, "max": 18, "currency": "USD"},
            "KE": {"min": 6, "max": 10, "currency": "USD"},
            "NG": {"min": 5, "max": 9, "currency": "USD"},
            "GH": {"min": 5, "max": 9, "currency": "USD"},
            "ZW": {"min": 8, "max": 14, "currency": "USD"},
        },
        "wastage_factor": 1.12,
        "category": "Roofing",
    },
    "roof_tiles_concrete": {
        "description": "Concrete roof tiles",
        "unit": "m²",
        "rates": {
            "ZM": {"min": 18, "max": 28, "currency": "USD"},
            "KE": {"min": 10, "max": 16, "currency": "USD"},
            "NG": {"min": 8, "max": 14, "currency": "USD"},
        },
        "wastage_factor": 1.10,
        "category": "Roofing",
    },
    "roof_purlin_50x76": {
        "description": "Timber purlins 50×76mm",
        "unit": "lm",
        "rates": {
            "ZM": {"min": 8, "max": 14, "currency": "USD"},
            "KE": {"min": 4, "max": 8, "currency": "USD"},
            "NG": {"min": 3, "max": 7, "currency": "USD"},
        },
        "wastage_factor": 1.08,
        "category": "Roofing",
    },
    "plaster_internal": {
        "description": "Internal cement plaster 15mm",
        "unit": "m²",
        "rates": {
            "ZM": {"min": 6, "max": 10, "currency": "USD"},
            "KE": {"min": 3, "max": 6, "currency": "USD"},
            "NG": {"min": 2, "max": 5, "currency": "USD"},
        },
        "wastage_factor": 1.10,
        "category": "Finishes",
    },
    "floor_screed_50mm": {
        "description": "Cement sand screed 50mm thick",
        "unit": "m²",
        "rates": {
            "ZM": {"min": 8, "max": 14, "currency": "USD"},
            "KE": {"min": 4, "max": 8, "currency": "USD"},
            "NG": {"min": 3, "max": 7, "currency": "USD"},
        },
        "wastage_factor": 1.08,
        "category": "Finishes",
    },
    "ceramic_tiles_floor": {
        "description": "Ceramic floor tiles supply and fix",
        "unit": "m²",
        "rates": {
            "ZM": {"min": 22, "max": 38, "currency": "USD"},
            "KE": {"min": 12, "max": 22, "currency": "USD"},
            "NG": {"min": 10, "max": 18, "currency": "USD"},
        },
        "wastage_factor": 1.10,
        "category": "Finishes",
    },
    "ceiling_gypsum": {
        "description": "Gypsum ceiling board and grid",
        "unit": "m²",
        "rates": {
            "ZM": {"min": 18, "max": 28, "currency": "USD"},
            "KE": {"min": 10, "max": 16, "currency": "USD"},
            "NG": {"min": 8, "max": 14, "currency": "USD"},
        },
        "wastage_factor": 1.08,
        "category": "Finishes",
    },
    "paint_interior": {
        "description": "Emulsion paint to internal walls — 2 coats",
        "unit": "m²",
        "rates": {
            "ZM": {"min": 4, "max": 7, "currency": "USD"},
            "KE": {"min": 2, "max": 4, "currency": "USD"},
            "NG": {"min": 2, "max": 3, "currency": "USD"},
        },
        "wastage_factor": 1.05,
        "category": "Finishes",
    },
    "paint_exterior": {
        "description": "Weather-shield paint to external walls — 2 coats",
        "unit": "m²",
        "rates": {
            "ZM": {"min": 5, "max": 9, "currency": "USD"},
            "KE": {"min": 3, "max": 5, "currency": "USD"},
            "NG": {"min": 2, "max": 4, "currency": "USD"},
        },
        "wastage_factor": 1.05,
        "category": "Finishes",
    },
    "excavation_soft": {
        "description": "Excavate in soft material, max 2m depth",
        "unit": "m³",
        "rates": _earth_rates((8, 14)),
        "wastage_factor": 1.0,
        "category": "Earthworks",
    },
    "excavation_medium": {
        "description": "Excavate in medium material",
        "unit": "m³",
        "rates": _earth_rates((12, 20)),
        "wastage_factor": 1.0,
        "category": "Earthworks",
    },
    "excavation_rock": {
        "description": "Excavate in rock — mechanical breaker",
        "unit": "m³",
        "rates": _earth_rates((18, 35)),
        "wastage_factor": 1.0,
        "category": "Earthworks",
    },
    "fill_compacted": {
        "description": "Backfill with excavated material, compacted 300mm layers",
        "unit": "m³",
        "rates": _earth_rates((6, 12)),
        "wastage_factor": 1.05,
        "category": "Earthworks",
    },
    "hardcore_300mm": {
        "description": "Hardcore filling 300mm compacted",
        "unit": "m³",
        "rates": _earth_rates((18, 28)),
        "wastage_factor": 1.05,
        "category": "Earthworks",
    },
    "asphalt_wearing": {
        "description": "Asphalt wearing course",
        "unit": "m³",
        "rates": {
            "ZM": {"min": 180, "max": 260, "currency": "USD"},
            "KE": {"min": 120, "max": 180, "currency": "USD"},
            "NG": {"min": 100, "max": 160, "currency": "USD"},
        },
        "wastage_factor": 1.05,
        "category": "Road Materials",
    },
    "base_crushed_stone": {
        "description": "Crushed stone base course",
        "unit": "m³",
        "rates": {
            "ZM": {"min": 18, "max": 28, "currency": "USD"},
            "KE": {"min": 12, "max": 20, "currency": "USD"},
            "NG": {"min": 10, "max": 18, "currency": "USD"},
        },
        "wastage_factor": 1.05,
        "category": "Road Materials",
    },
    "subbase_gravel": {
        "description": "Natural gravel subbase",
        "unit": "m³",
        "rates": {
            "ZM": {"min": 12, "max": 18, "currency": "USD"},
            "KE": {"min": 8, "max": 14, "currency": "USD"},
            "NG": {"min": 7, "max": 12, "currency": "USD"},
        },
        "wastage_factor": 1.05,
        "category": "Road Materials",
    },
    "concrete_pipe_375": {
        "description": "Concrete pipe 375mm diameter",
        "unit": "lm",
        "rates": {
            "ZM": {"min": 45, "max": 65, "currency": "USD"},
            "KE": {"min": 28, "max": 42, "currency": "USD"},
            "NG": {"min": 22, "max": 35, "currency": "USD"},
        },
        "wastage_factor": 1.03,
        "category": "Drainage",
    },
    "concrete_pipe_450": {
        "description": "Concrete pipe 450mm diameter",
        "unit": "lm",
        "rates": {
            "ZM": {"min": 55, "max": 78, "currency": "USD"},
            "KE": {"min": 35, "max": 52, "currency": "USD"},
            "NG": {"min": 28, "max": 42, "currency": "USD"},
        },
        "wastage_factor": 1.03,
        "category": "Drainage",
    },
    "hdpe_pipe_375": {
        "description": "HDPE pipe 375mm diameter",
        "unit": "lm",
        "rates": {
            "ZM": {"min": 38, "max": 55, "currency": "USD"},
            "KE": {"min": 24, "max": 38, "currency": "USD"},
            "NG": {"min": 20, "max": 32, "currency": "USD"},
        },
        "wastage_factor": 1.03,
        "category": "Drainage",
    },
}


def get_material(material_id: str) -> dict[str, Any] | None:
    return MATERIALS_DATABASE.get(material_id)


def get_rate(material_id: str, country_code: str, use_mid: bool = True) -> float:
    material = get_material(material_id)
    if not material:
        return 0.0
    rates = material.get("rates", {})
    country = country_code.upper()
    if country not in rates:
        country = "ZM"
    band = rates[country]
    if use_mid:
        return (band["min"] + band["max"]) / 2
    return band["min"]


def get_wastage(material_id: str) -> float:
    material = get_material(material_id)
    return float(material.get("wastage_factor", 1.0)) if material else 1.0


def fck_to_concrete_key(fck: float) -> str:
    if fck >= 30:
        return "concrete_c30"
    return "concrete_c25"


def parse_bar_size(provision: str, default: int = 16) -> int:
    import re

    match = re.search(r"H(\d+)", provision or "", re.IGNORECASE)
    return int(match.group(1)) if match else default


def parse_bar_spacing(provision: str, default: int = 200) -> int:
    import re

    match = re.search(r"@\s*(\d+)", provision or "")
    return int(match.group(1)) if match else default
