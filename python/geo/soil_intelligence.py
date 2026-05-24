"""Soil intelligence using ISRIC SoilGrids and African context."""

from typing import Any

from geo.http_client import fetch_json

AFRICAN_CONTEXT = {
    "ZM": {"code": "Eurocode 2 — ZS 385", "rainfall_zone": "Sub-humid", "wind_zone": "Inland plateau"},
    "KE": {"code": "KeNHA / BS EN 1990", "rainfall_zone": "Sub-humid highlands", "wind_zone": "Coastal moderate-high"},
    "NG": {"code": "FMWH / Eurocode adapted", "rainfall_zone": "Humid", "wind_zone": "Coastal moderate"},
    "GH": {"code": "Ghana Building Code", "rainfall_zone": "Humid", "wind_zone": "Coastal moderate"},
}


def _uscs(clay: float, silt: float, sand: float) -> str:
    if clay > 50:
        return "CH — High plasticity clay"
    if clay > 30:
        return "CL — Low plasticity clay"
    if clay > 15:
        return "SC — Clayey sand" if sand > silt else "SM — Silty sand"
    if sand > 70:
        return "SW — Well-graded sand"
    return "GW — Well-graded gravel/sand"


def _cbr_range(clay: float, sand: float) -> tuple[float, float]:
    if clay > 40:
        return 2, 5
    if clay > 25:
        return 4, 8
    if clay > 15:
        return 6, 15
    if sand > 60:
        return 15, 40
    return 10, 25


def _bearing_range(uscs: str) -> tuple[float, float]:
    mapping = {
        "CH": (50, 100),
        "CL": (75, 150),
        "SC": (100, 200),
        "SM": (100, 200),
        "SW": (150, 300),
        "GW": (200, 400),
    }
    key = uscs[:2]
    return mapping.get(key, (100, 200))


def _groundwater(country: str, elevation: float) -> str:
    regional = {
        "ZM": (4.0, 10.0) if elevation > 1200 else (1.5, 4.0),
        "KE": (3.0, 8.0),
        "NG": (1.0, 3.0),
        "GH": (0.5, 2.5),
    }
    lo, hi = regional.get(country, (2.0, 6.0))
    return f"{lo:.1f}–{hi:.1f} m (dry season estimate)"


def analyse_soil(payload: dict[str, Any]) -> dict[str, Any]:
    lat = float(payload["latitude"])
    lon = float(payload["longitude"])
    country = payload.get("country_code", "ZM").upper()
    elevation = float(payload.get("elevation_m", 1277))

    clay = silt = sand = ph = oc = 0.0
    url = (
        "https://rest.isric.org/soilgrids/v2.0/properties/query?"
        f"lon={lon}&lat={lat}&property=clay&property=silt&property=sand"
        "&property=phh2o&property=soc&depth=0-5cm&value=mean"
    )
    data = fetch_json(url)

    if data and data.get("properties", {}).get("layers"):
        layers = data["properties"]["layers"]
        for layer in layers:
            name = layer.get("name", "")
            vals = layer.get("depths", [{}])[0].get("values", {})
            mean = vals.get("mean")
            if mean is None:
                continue
            if name == "clay":
                clay = mean / 10
            elif name == "silt":
                silt = mean / 10
            elif name == "sand":
                sand = mean / 10
            elif name == "phh2o":
                ph = mean / 10
            elif name == "soc":
                oc = mean / 10

    if clay + silt + sand < 50:
        clay, silt, sand = 24, 18, 58
        ph = 6.8
        oc = 12
        source = "Regional fallback (Lusaka plateau)"
    else:
        source = "ISRIC SoilGrids v2.0"

    uscs = _uscs(clay, silt, sand)
    cbr_lo, cbr_hi = _cbr_range(clay, sand)
    bear_lo, bear_hi = _bearing_range(uscs)
    bearing_mid = (bear_lo + bear_hi) / 2
    cbr_mid = (cbr_lo + cbr_hi) / 2

    hazards: list[str] = []
    if clay > 40 and ph > 7.5 and country in ("NG", "ET", "TZ", "ZM"):
        hazards.append("Possible vertisol — expansive soil behaviour")
    if country in ("NG", "GH") and sand > 50:
        hazards.append("Laterite possible — good road subbase, test before structural fill")
    if elevation < 1000 and country == "ZM":
        hazards.append("Possible dambo proximity — check seasonal waterlogging")

    if "CH" in uscs:
        founding = "Consider raft or deeper founding; avoid shallow pads on expansive clay"
    elif "CL" in uscs:
        founding = "Strip/pad at 1.2m minimum depth; monitor moisture variation"
    elif uscs.startswith("S"):
        founding = "Pad foundations viable; CBR-test before road design"
    else:
        founding = "Good founding conditions; standard pad depth"

    ctx = AFRICAN_CONTEXT.get(country, AFRICAN_CONTEXT["ZM"])

    return {
        "status": "complete",
        "source": source,
        "uscs_classification": uscs,
        "clay_pct": round(clay, 1),
        "silt_pct": round(silt, 1),
        "sand_pct": round(sand, 1),
        "ph": round(ph, 1),
        "organic_carbon_gkg": round(oc, 1),
        "cbr_range_pct": [cbr_lo, cbr_hi],
        "cbr_estimate_mid": round(cbr_mid, 1),
        "bearing_capacity_range_knm2": [bear_lo, bear_hi],
        "bearing_capacity_mid": round(bearing_mid, 0),
        "min_foundation_depth_m": 1.2 if clay > 25 else 1.0,
        "founding_recommendation": founding,
        "groundwater_estimate": _groundwater(country, elevation),
        "hazards": hazards,
        "design_code": ctx["code"],
        "warnings": ["Ground investigation REQUIRED before final design — minimum 3 trial pits + CBR"],
    }
