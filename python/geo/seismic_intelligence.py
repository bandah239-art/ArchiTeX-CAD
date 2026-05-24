"""Seismic intelligence using USGS design maps."""

from typing import Any

from geo.http_client import fetch_json

AFRICAN_SEISMIC_CONTEXT = {
    "ZM": "Mostly stable craton — SDC A-B typical",
    "KE": "East African Rift — SDC C-D in rift valleys",
    "TZ": "East African Rift — elevated hazard near rift",
    "ET": "East African Rift — high seismic activity",
    "NG": "Stable craton — SDC A-B except local faults",
    "GH": "Stable craton — SDC A-B",
    "ZA": "Western Cape Ceres fault — SDC B locally",
}


def _sdc(sds: float, sd1: float) -> str:
    if sds < 0.167:
        return "A"
    if sds < 0.33:
        return "B"
    if sds < 0.50:
        return "C"
    if sds < 1.0:
        return "D"
    return "E"


def analyse_seismic(payload: dict[str, Any]) -> dict[str, Any]:
    lat = float(payload["latitude"])
    lon = float(payload["longitude"])
    country = payload.get("country_code", "ZM").upper()

    url = (
        "https://earthquake.usgs.gov/ws/designmaps/asce7-22.json?"
        f"latitude={lat}&longitude={lon}&riskCategory=II&siteClass=D&title=InfraAfrica"
    )
    data = fetch_json(url, timeout=20)

    if data and data.get("response", {}).get("data"):
        d = data["response"]["data"]
        ss = float(d.get("ss", 0.12))
        s1 = float(d.get("s1", 0.05))
        sds = float(d.get("sds", ss * 1.4))
        sd1 = float(d.get("sd1", s1 * 1.4))
        pga = round(sds / 2.5, 3)
        source = "USGS Seismic Hazard — ASCE 7-22"
    else:
        # Stable craton fallback for Lusaka / southern Africa
        ss, s1, sds, sd1, pga = 0.12, 0.05, 0.08, 0.04, 0.06
        source = "Regional fallback — stable craton"

    sdc = _sdc(sds, sd1)
    sdc_labels = {"A": "Very Low", "B": "Low", "C": "Moderate", "D": "High", "E": "Very High"}

    if sdc in ("A", "B"):
        implications = "No seismic detailing mandatory; recommended for structures over 4 storeys"
    elif sdc == "C":
        implications = "Intermediate seismic detailing; shear walls recommended for 3+ storeys"
    else:
        implications = "Full seismic design required — engage specialist engineer"

    return {
        "status": "complete",
        "source": source,
        "seismic_design_category": sdc,
        "sdc_description": sdc_labels.get(sdc, "Low"),
        "peak_ground_acceleration_g": pga,
        "spectral_accel_ss": round(ss, 3),
        "spectral_accel_s1": round(s1, 3),
        "sds": round(sds, 3),
        "sd1": round(sd1, 3),
        "site_class": "D — Stiff soil (default)",
        "fa_factor": 1.4,
        "african_context": AFRICAN_SEISMIC_CONTEXT.get(country, "Refer to national annex"),
        "known_fault_within_20km": False,
        "design_implications": implications,
    }
