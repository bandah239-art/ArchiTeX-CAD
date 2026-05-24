"""Land use optimiser — highest and best use analysis."""

from typing import Any

from real_estate.feasibility import run_feasibility


def optimise_land_use(payload: dict[str, Any]) -> dict[str, Any]:
    plot = payload.get("plot_data", {})
    area = float(plot.get("plot_area_m2", 1200))
    city = payload.get("city", "Lusaka")
    country = payload.get("country_code", "ZM")
    land_cost = float(plot.get("asking_price_usd", 75000))
    neighbourhood = plot.get("neighbourhood", "")

    is_premium = any(z in neighbourhood for z in ("Kabulonga", "Karen", "Runda", "Ikoyi", "Cantonments"))

    options = []

    # Option 1: Single high-spec house
    gfa1 = min(350, area * 0.35)
    f1 = run_feasibility({
        "plot_data": plot,
        "country_code": country,
        "city": city,
        "gross_floor_area_m2": gfa1,
        "construction_standard": "premium" if is_premium else "standard",
        "target_sale_price_per_m2": 900 if is_premium else 750,
        "land_cost_usd": land_cost,
    })
    options.append({
        "rank": 1,
        "option": "Single High-Spec House",
        "recommended": is_premium,
        "gfa_m2": gfa1,
        "build_cost_usd": f1["construction_cost_usd"],
        "market_value_usd": [f1["gross_development_value_usd"] * 0.9, f1["gross_development_value_usd"] * 1.1],
        "profit_usd": [f1["profit_usd"] * 0.85, f1["profit_usd"] * 1.15],
        "profit_on_cost_pct": f1["profit_on_cost_pct"],
        "timeline_months": 14,
        "risk": "LOW",
        "notes": "Premium residential demand strong in this zone" if is_premium else "Standard family home — good exit market",
    })

    # Option 2: Two semi-detached
    gfa2 = min(400, area * 0.4)
    f2 = run_feasibility({
        "plot_data": plot,
        "country_code": country,
        "city": city,
        "gross_floor_area_m2": gfa2,
        "units_planned": 2,
        "construction_standard": "standard",
        "target_sale_price_per_m2": 700,
        "land_cost_usd": land_cost,
    })
    options.append({
        "rank": 2,
        "option": "Two Semi-Detached Units",
        "recommended": False,
        "gfa_m2": gfa2,
        "build_cost_usd": f2["construction_cost_usd"],
        "profit_on_cost_pct": f2["profit_on_cost_pct"],
        "timeline_months": 16,
        "risk": "MEDIUM",
        "notes": "Two exit points reduces risk",
    })

    # Option 3: Apartments
    if area >= 800:
        gfa3 = min(540, area * 0.45)
        f3 = run_feasibility({
            "plot_data": plot,
            "country_code": country,
            "city": city,
            "gross_floor_area_m2": gfa3,
            "units_planned": 6,
            "construction_standard": "standard",
            "target_rental_per_month": 400,
            "land_cost_usd": land_cost,
        })
        options.append({
            "rank": 3,
            "option": "6-Unit Apartment Block",
            "recommended": False,
            "gfa_m2": gfa3,
            "build_cost_usd": f3["construction_cost_usd"],
            "profit_on_cost_pct": f3["development_yield_pct"],
            "timeline_months": 20,
            "risk": "MEDIUM-HIGH",
            "notes": "Verify zoning with local council before proceeding",
        })

    options.sort(key=lambda x: x["profit_on_cost_pct"], reverse=True)
    for i, opt in enumerate(options, 1):
        opt["rank"] = i
        opt["recommended"] = i == 1

    return {
        "status": "complete",
        "plot_area_m2": area,
        "city": city,
        "options": options,
        "recommended": options[0]["option"] if options else None,
        "not_recommended": ["Commercial office in residential zone", "Industrial — zoning unlikely"],
    }
