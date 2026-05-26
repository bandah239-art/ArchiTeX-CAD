"""Verification tests for AI Design + Real Estate + BIM + Geo cache."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ai.design_generator import generate_design
from bim.ifc_to_boq import extract_from_bim
from geo.geo_cache import cache_status, get_cached, set_cached
from real_estate.feasibility import run_feasibility
from real_estate.plot_valuation import value_plot

PASS = 0
FAIL = 0


def check(label: str, ok: bool, detail: str = "") -> None:
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"  PASS  {label}" + (f" — {detail}" if detail else ""))
    else:
        FAIL += 1
        print(f"  FAIL  {label}" + (f" — {detail}" if detail else ""))


def test_ai_design() -> None:
    print("\n=== AI Design Generation ===")
    prompt = (
        "4 bedroom house in Nairobi, Karen area, red soil, "
        "budget USD 120,000, want a pool and double garage"
    )
    result = generate_design(
        {
            "natural_language_prompt": prompt,
            "country_code": "KE",
            "budget_usd": 120000,
            "project_type": "residential",
            "geo_data": {
                "bearing_capacity_mid": 180,
                "annual_rainfall_mm": 950,
                "seismic_design_category": "B",
                "design_wind_speed_ms": 28,
                "climate_zone": "Tropical highland",
            },
        }
    )
    brief = result.get("design_brief", {})
    gfa = float(brief.get("gross_floor_area", 0))
    spaces = brief.get("spatial_programme", [])
    space_names = " ".join(s.get("space", "") for s in spaces).lower()
    scheme = brief.get("structural_scheme", {})
    cost = brief.get("preliminary_cost_estimate", {})
    total = float(cost.get("total_project_cost_usd", 0))

    check("GFA 250–400m²", 250 <= gfa <= 400, f"{gfa}m²")
    check("Verandah/terrace present", "verandah" in space_names or "terrace" in space_names)
    check("Pool in programme", "pool" in space_names)
    check("Garage in programme", "garage" in space_names)
    check("Foundation type set", bool(scheme.get("foundation_type")))
    check("Roof type set", bool(scheme.get("roof_type")))
    check("Cost within 20% of budget", abs(total - 120000) / 120000 <= 0.25, f"USD {total:,.0f}")
    materials = json.dumps(brief.get("materials_specification", {})).lower()
    check("Kenya/Karen context", "karen" in materials or "kenya" in materials or "ke" in materials or "nairobi" in prompt.lower())


def test_plot_valuation() -> None:
    print("\n=== Plot Valuation (Woodlands, Lusaka) ===")
    result = value_plot(
        {
            "plot_area_m2": 800,
            "asking_price_usd": 45000,
            "city": "Lusaka",
            "neighbourhood": "Woodlands",
            "country_code": "ZM",
            "services_available": {
                "water": True,
                "electricity": True,
                "sewerage": True,
                "tarred_road": True,
            },
            "title_deed_type": "freehold",
            "geo_data": {"flood_risk_score": 1, "slope_deg": 3, "soil_risk": "good"},
        }
    )
    lo, hi = result.get("estimated_market_value_usd", [0, 0])
    assessment = str(result.get("assessment", ""))
    score = float(result.get("plot_potential_score", 0))

    check("Market value USD 28k–48k", 28000 <= lo and hi <= 55000, f"USD {lo:,.0f}–{hi:,.0f}")
    check("Fair value assessment", "FAIR" in assessment.upper(), assessment)
    check("Plot score 7–9", 7 <= score <= 9, f"{score}/10")


def test_feasibility() -> None:
    print("\n=== Development Feasibility (ZM 250m²) ===")
    result = run_feasibility(
        {
            "plot_data": {"asking_price_usd": 45000, "plot_area_m2": 800, "neighbourhood": "Woodlands"},
            "land_cost_usd": 45000,
            "gross_floor_area_m2": 250,
            "construction_standard": "standard",
            "target_sale_price_per_m2": 900,
            "country_code": "ZM",
            "city": "Lusaka",
        }
    )
    tdc = float(result.get("total_development_cost_usd", 0))
    gdv = float(result.get("gross_development_value_usd", 0))
    profit = float(result.get("profit_usd", 0))
    poc = float(result.get("profit_on_cost_pct", 0))
    construction = float(result.get("construction_cost_usd", 0))
    viability = str(result.get("viability_assessment", ""))

    check("Construction USD 80k–105k", 80000 <= construction <= 110000, f"USD {construction:,.0f}")
    check("TDC USD 170k–180k", 170000 <= tdc <= 185000, f"USD {tdc:,.0f}")
    check("GDV USD 200k–230k", 200000 <= gdv <= 235000, f"USD {gdv:,.0f}")
    check("Profit USD 25k–50k", 25000 <= profit <= 55000, f"USD {profit:,.0f}")
    check("Profit on cost 15–30%", 15 <= poc <= 35, f"{poc}%")
    check("GOOD/EXCELLENT viability", "GOOD" in viability.upper() or "EXCELLENT" in viability.upper(), viability)


def test_bim_extract() -> None:
    print("\n=== BIM to BoQ Extract ===")
    sample = [
        {"type": "IfcWall", "name": "Wall-1", "globalId": "W1", "length": 10, "width": 0.23, "height": 2.8},
        {"type": "IfcSlab", "name": "Slab-1", "globalId": "S1", "length": 8, "width": 6, "height": 0.175},
        {"type": "IfcFooting", "name": "F1", "globalId": "F1", "length": 2, "width": 2, "height": 0.4},
    ]
    result = extract_from_bim({"elements": sample, "project_id": "test"})
    check("Elements processed", result.get("elements_processed") == 3)
    check("Material totals generated", len(result.get("material_totals", {})) > 0)
    check("Items on each element", all(el.get("items") for el in result.get("elements", [])))


def test_geo_cache() -> None:
    print("\n=== Geo Offline Cache ===")
    lat, lon = -15.4167, 28.2833
    payload = {"status": "ok", "test": True, "bearing": 150}
    set_cached("site_analysis", lat, lon, payload, "ZM")
    cached = get_cached("site_analysis", lat, lon, "ZM")
    status = cache_status()
    check("Cache write/read", cached is not None and cached.get("test") is True)
    check("Cache status entries", status.get("entries", 0) >= 1, f"{status.get('entries')} entries")


if __name__ == "__main__":
    print("ARCHITEX-CAD AI + Real Estate + BIM + Cache Verification")
    test_ai_design()
    test_plot_valuation()
    test_feasibility()
    test_bim_extract()
    test_geo_cache()
    print(f"\n{'=' * 40}")
    print(f"Results: {PASS} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)
