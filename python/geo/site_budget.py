"""Location-aware indicative construction budget from site geo intelligence."""

from __future__ import annotations

from typing import Any

from geo.geo_intelligence import run_site_analysis

# Indicative all-in construction rates USD/m² (structure + finishes, excl. land)
BASE_RATE_USD_M2: dict[str, dict[str, float]] = {
    "residential": {
        "ZM": 420,
        "KE": 480,
        "NG": 520,
        "GH": 460,
        "TZ": 440,
        "ZW": 410,
        "BW": 500,
        "MZ": 430,
    },
    "commercial": {
        "ZM": 650,
        "KE": 720,
        "NG": 780,
        "GH": 680,
        "TZ": 660,
        "ZW": 620,
        "BW": 740,
        "MZ": 640,
    },
    "industrial": {
        "ZM": 380,
        "KE": 420,
        "NG": 450,
        "GH": 400,
        "TZ": 390,
        "ZW": 360,
        "BW": 430,
        "MZ": 370,
    },
    "institutional": {
        "ZM": 550,
        "KE": 600,
        "NG": 640,
        "GH": 580,
        "TZ": 560,
        "ZW": 520,
        "BW": 620,
        "MZ": 540,
    },
    "road": {
        "ZM": 180,
        "KE": 200,
        "NG": 220,
        "GH": 190,
        "TZ": 185,
        "ZW": 170,
        "BW": 210,
        "MZ": 175,
    },
}

SEISMIC_PREMIUM_USD_M2 = {"A": 0, "B": 8, "C": 18, "D": 35, "E": 55}


def compute_site_budget(payload: dict[str, Any]) -> dict[str, Any]:
    """
    payload: latitude, longitude, country_code, project_type, gfa_m2,
             platform_area_m2, project_name, use_cache, offline_only,
             site_analysis (optional pre-computed)
    """
    lat = float(payload["latitude"])
    lon = float(payload["longitude"])
    country = str(payload.get("country_code", "ZM")).upper()
    project_type = str(payload.get("project_type", "residential")).lower()
    gfa = float(payload.get("gfa_m2", 142))
    platform_area = float(payload.get("platform_area_m2", max(gfa * 1.2, 400)))

    analysis = payload.get("site_analysis")
    if not analysis:
        analysis = run_site_analysis(
            {
                "latitude": lat,
                "longitude": lon,
                "country_code": country,
                "project_name": payload.get("project_name", "Site Budget"),
                "use_cache": payload.get("use_cache", True),
                "offline_only": payload.get("offline_only", False),
                "platform_area_m2": platform_area,
            }
        )

    terrain = analysis.get("terrain") or {}
    soil = analysis.get("soil") or {}
    seismic = analysis.get("seismic") or {}
    climate = analysis.get("climate") or {}
    exec_sum = analysis.get("executive_summary") or {}
    buildability = float(exec_sum.get("buildability_score", 7))

    rates = BASE_RATE_USD_M2.get(project_type, BASE_RATE_USD_M2["residential"])
    base_rate = rates.get(country, rates.get("ZM", 420))
    construction_base = base_rate * gfa

    ew = terrain.get("earthworks_cost_usd") or [0, 0]
    earthworks_mid = (float(ew[0]) + float(ew[1])) / 2 if len(ew) >= 2 else float(ew[0] if ew else 0)

    bearing = float(soil.get("bearing_capacity_mid", 150))
    if bearing < 80:
        foundation_premium = gfa * 35
        foundation_note = "Raft/deep founding likely — low bearing"
    elif bearing < 120:
        foundation_premium = gfa * 18
        foundation_note = "Enhanced foundations — moderate bearing"
    else:
        foundation_premium = gfa * 6
        foundation_note = "Standard strip/pad foundations"

    sdc = str(seismic.get("seismic_design_category", "B"))
    seismic_premium = SEISMIC_PREMIUM_USD_M2.get(sdc, 10) * gfa

    rainfall = float(climate.get("annual_rainfall_mm", 800))
    drainage = 600 + rainfall * 1.5
    if terrain.get("in_drainage_path"):
        drainage += 2500

    slope = float(terrain.get("slope_deg", 2))
    access_premium = max(0, (slope - 8) * gfa * 2)

    line_items = [
        {
            "id": "construction_base",
            "label": f"Base construction ({base_rate:.0f} USD/m² × {gfa:.0f} m²)",
            "amount_usd": round(construction_base, 0),
        },
        {
            "id": "earthworks",
            "label": f"Site earthworks (~{terrain.get('earthworks_m3', 0)} m³)",
            "amount_usd": round(earthworks_mid, 0),
        },
        {
            "id": "foundation",
            "label": foundation_note,
            "amount_usd": round(foundation_premium, 0),
        },
        {
            "id": "seismic",
            "label": f"Seismic detailing (SDC {sdc})",
            "amount_usd": round(seismic_premium, 0),
        },
        {
            "id": "drainage",
            "label": "Drainage & stormwater allowance",
            "amount_usd": round(drainage, 0),
        },
    ]
    if access_premium > 0:
        line_items.append(
            {
                "id": "access",
                "label": f"Steep site access/earthworks premium ({slope:.1f}°)",
                "amount_usd": round(access_premium, 0),
            }
        )

    subtotal = sum(item["amount_usd"] for item in line_items)
    if buildability < 6:
        contingency_pct = 0.22
    elif buildability < 7:
        contingency_pct = 0.15
    else:
        contingency_pct = 0.10
    contingency = subtotal * contingency_pct
    line_items.append(
        {
            "id": "contingency",
            "label": f"Contingency ({contingency_pct * 100:.0f}% — buildability {buildability}/10)",
            "amount_usd": round(contingency, 0),
        }
    )

    total_likely = subtotal + contingency
    total_min = total_likely * 0.82
    total_max = total_likely * 1.25

    return {
        "status": "complete",
        "latitude": lat,
        "longitude": lon,
        "country_code": country,
        "project_type": project_type,
        "gfa_m2": gfa,
        "budget_usd": {
            "min": round(total_min, 0),
            "likely": round(total_likely, 0),
            "max": round(total_max, 0),
        },
        "suggested_budget_usd": round(total_likely, 0),
        "line_items": line_items,
        "subtotal_usd": round(subtotal, 0),
        "contingency_pct": contingency_pct,
        "buildability_score": buildability,
        "accuracy_note": "Indicative site-adjusted budget ±20–25% until BoQ/BIM quantities are loaded",
        "assumptions": [
            f"Country material index: {country}",
            f"Gross floor area: {gfa:.0f} m²",
            "Excludes land acquisition, VAT, professional fees, and client finishes above standard",
            "Includes site prep, structure, standard finishes, and location risk contingency",
        ],
        "site_analysis": analysis,
    }
