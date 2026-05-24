"""Road pavement design — AASHTO structural number method."""

import math
from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value

ROAD_WIDTHS = {"trunk": 7.4, "primary": 6.7, "secondary": 6.0, "feeder": 4.5}
E_FACTORS = {"trunk": 2.5, "primary": 2.0, "secondary": 1.5, "feeder": 0.8}
DRAINAGE_M = {"wet": 0.80, "semi_arid": 0.90, "dry": 1.00}
STANDARDS = {
    "Zambia": "SATCC / RDA Zambia — Road Design Manual 2019",
    "Kenya": "KeNHA — Kenyan Road Design Manual",
    "Nigeria": "FMWH Standards",
    "Ghana": "Ghana Highway Authority",
}


def _step(n, title, formula, sub, result, unit="", ref="", status="info"):
    return {"step_number": n, "title": title, "formula": formula, "substitution": sub,
            "result": result, "unit": unit, "reference": ref, "status": status}


def _cbr_class(cbr: float) -> str:
    if cbr < 3:
        return "Very Poor"
    if cbr < 7:
        return "Poor"
    if cbr < 15:
        return "Moderate"
    if cbr < 30:
        return "Good"
    return "Excellent"


def _solve_sn(w18: float, mr: float, max_iter=80) -> float:
    """Solve AASHTO 1993 design equation for structural number."""
    delta_psi = 1.7
    zr, so = -1.645, 0.45
    target = math.log10(max(w18, 1.0))

    def log_w18(sn: float) -> float:
        term = 0.40 + 1094.0 / (sn + 1.0) ** 5.19
        return (
            zr * so
            + 9.36 * math.log10(sn + 1.0)
            - 0.20
            + math.log10(delta_psi / 4.2)
            - 0.91 * math.log10(term)
            + 2.32 * math.log10(mr)
            - 8.07
        )

    lo, hi = 1.0, 12.0
    for _ in range(max_iter):
        mid = (lo + hi) / 2
        if log_w18(mid) < target:
            lo = mid
        else:
            hi = mid
        if hi - lo < 0.01:
            break
    return round((lo + hi) / 2, 2)


def _design_layers(sn: float, m: float) -> tuple[int, int, int]:
    """Size wearing, base, subbase to meet structural number."""
    a1, a2, a3 = 0.44, 0.14, 0.11
    d1 = 50
    sn1 = a1 * (d1 / 25.4)
    remaining = max(sn - sn1, 0.5)
    # Solve equal base/subbase thickness to consume remaining SN
    coeff = (a2 + a3) * m / 25.4
    d_base_mm = remaining / coeff * 25.4
    d2 = max(150, int(round(d_base_mm * 0.55 / 25) * 25))
    d3 = max(150, int(round(d_base_mm * 0.45 / 25) * 25))
    # Cap at SATCC typical maximums for secondary roads
    d2 = min(d2, 250)
    d3 = min(d3, 250)
    return d1, d2, d3


def calculate_pavement(inputs: dict[str, Any]) -> dict[str, Any]:
    road_class = inputs.get("road_class", "secondary")
    aadt = inputs.get("traffic_count", inputs.get("design_traffic", 500))
    hv_pct = inputs.get("heavy_vehicle_pct", 12)
    design_life = inputs.get("design_life", 20)
    cbr = inputs.get("cbr_subgrade", inputs.get("subgrade_modulus", 6))
    climate = inputs.get("climate_zone", "semi_arid")
    country = inputs.get("country", "Zambia")
    r = 0.04

    steps: list[dict] = []
    hv = aadt * hv_pct / 100
    steps.append(_step(1, "Traffic Classification",
        "AADT; heavy vehicles = AADT × HV%",
        f"AADT={aadt}, HV%={hv_pct}, class={road_class}",
        f"Heavy vehicles = {round_value(hv, 1)}/day", "veh/day", "TRH4 / SATCC", "info"))

    g = ((1 + r) ** design_life - 1) / r
    e_factor = E_FACTORS.get(road_class, 1.5)
    # Two-way traffic cumulative factor (SATCC practice for single carriageway design lane)
    lane_factor = 1.84 if road_class in ("secondary", "feeder") else 2.0
    esals = aadt * (hv_pct / 100) * e_factor * g * 365 * lane_factor / 1e6
    steps.append(_step(2, "Design Traffic — Cumulative ESALs",
        "ESALs = AADT·HV%·E·G·365; G=[(1+r)^n-1]/r",
        f"E={e_factor}, G={round_value(g, 2)}, n={design_life}yr",
        f"Design ESALs = {round_value(esals, 2)} million", "MSA", "AASHTO / SATCC", "info"))

    mr = 1500 * cbr
    cbr_label = _cbr_class(cbr)
    steps.append(_step(3, "Subgrade CBR Classification",
        "MR = 1500·CBR",
        f"CBR={cbr}%",
        f"Classification: {cbr_label}; MR={round_value(mr, 0)} kPa", "kPa", "SATCC", "info"))

    w18 = esals * 1e6
    sn = _solve_sn(w18, mr)
    steps.append(_step(4, "Structural Number (AASHTO)",
        "log10(W18) = ZR·So + 9.36·log10(SN+1) - ...",
        f"W18={round_value(w18 / 1e6, 2)}M, MR={round_value(mr, 0)} kPa",
        f"Required SN = {round_value(sn, 2)}", "", "AASHTO 1993", "info"))

    m = DRAINAGE_M.get(climate, 0.90)
    a1, a2, a3 = 0.44, 0.14, 0.11
    d1, d2, d3 = _design_layers(sn, m)
    total = d1 + d2 + d3

    steps.append(_step(5, "Layer Thickness Design",
        "SN = a1·D1 + a2·D2·m2 + a3·D3·m3",
        f"a1={a1}, a2={a2}, a3={a3}, m={m}",
        f"Wearing={d1}mm, Base={d2}mm, Subbase={d3}mm", "mm", "AASHTO layer coefficients", "info"))

    standard = STANDARDS.get(country, "SATCC — Southern African guidelines")
    steps.append(_step(6, "African Standards Adjustment",
        "Country-specific design reference",
        f"Country={country}",
        f"Reference: {standard}", "", standard, "info"))

    steps.append(_step(7, "Total Pavement Thickness",
        "Total = D1 + D2 + D3",
        f"{d1}+{d2}+{d3}",
        f"Total thickness = {total} mm", "mm", "Pavement design", "pass"))

    width = ROAD_WIDTHS.get(road_class, 6.0)
    vol1 = d1 / 1000 * width * 1000
    vol2 = d2 / 1000 * width * 1000
    vol3 = d3 / 1000 * width * 1000
    steps.append(_step(8, "Material Quantities per km",
        "Volume = thickness × width × 1000m",
        f"Width={width}m carriageway",
        f"Wearing={round_value(vol1, 0)} m³/km; Base={round_value(vol2, 0)} m³/km; Subbase={round_value(vol3, 0)} m³/km",
        "m³/km", "BoQ estimate", "info"))

    cost_low = vol1 * 55 + vol2 * 23 + vol3 * 15
    cost_high = vol1 * 65 + vol2 * 28 + vol3 * 18
    steps.append(_step(9, "Preliminary Cost Estimate",
        "Africa-specific unit rates USD/m³",
        "Wearing USD 45-65; Base 18-28; Subbase 12-18",
        f"Pavement works: USD {round_value(cost_low, 0):,.0f}–{round_value(cost_high, 0):,.0f}/km (preliminary)",
        "USD/km", "Market rates — budget only", "info"))

    return {
        "status": "pass",
        "summary": {
            "road_class": road_class,
            "aadt": aadt,
            "heavy_vehicle_pct": hv_pct,
            "design_esals_million": round_value(esals, 2),
            "cbr_pct": cbr,
            "subgrade_class": cbr_label,
            "structural_number": round_value(sn, 2),
            "wearing_course_mm": d1,
            "base_course_mm": d2,
            "subbase_mm": d3,
            "total_thickness_mm": total,
            "design_standard": standard,
            "pavement_design": "COMPLETE ✓",
        },
        "steps": steps,
        "warnings": ["Cost estimate is preliminary — subject to market rates"],
        "errors": [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
