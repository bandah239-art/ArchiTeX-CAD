"""Offline quick calculators for mobile companion."""

from typing import Any

MIX_RATIOS = {
    "C20": {"cement_bags_per_m3": 3.2, "sand_m3": 0.14, "aggregate_m3": 0.28, "water_l": 170},
    "C25": {"cement_bags_per_m3": 3.5, "sand_m3": 0.15, "aggregate_m3": 0.30, "water_l": 58},
    "C30": {"cement_bags_per_m3": 3.8, "sand_m3": 0.14, "aggregate_m3": 0.28, "water_l": 55},
}

REBAR_KG_PER_M = {
    "H10": 0.617,
    "H12": 0.888,
    "H16": 1.579,
    "H20": 2.466,
    "H25": 3.854,
    "H32": 6.313,
}


def concrete_mix(grade: str, volume_m3: float) -> dict[str, Any]:
    ratios = MIX_RATIOS.get(grade.upper(), MIX_RATIOS["C25"])
    return {
        "grade": grade.upper(),
        "volume_m3": volume_m3,
        "cement_bags_50kg": round(ratios["cement_bags_per_m3"] * volume_m3, 1),
        "sand_m3": round(ratios["sand_m3"] * volume_m3, 2),
        "aggregate_m3": round(ratios["aggregate_m3"] * volume_m3, 2),
        "water_litres": round(ratios["water_l"] * volume_m3, 0),
    }


def rebar_weight(bar_size: str, length_m: float, quantity: int = 1) -> dict[str, Any]:
    kg_per_m = REBAR_KG_PER_M.get(bar_size.upper(), 1.579)
    total_kg = kg_per_m * length_m * quantity
    return {
        "bar_size": bar_size.upper(),
        "length_m": length_m,
        "quantity": quantity,
        "kg_per_m": kg_per_m,
        "total_kg": round(total_kg, 1),
        "total_tonnes": round(total_kg / 1000, 3),
    }


def quick_beam_check(span_m: float, depth_mm: float, support: str = "simply_supported") -> dict[str, Any]:
    limit = 26 if support == "simply_supported" else 20
    ld = (span_m * 1000) / depth_mm if depth_mm else 0
    return {
        "span_m": span_m,
        "depth_mm": depth_mm,
        "ld_ratio": round(ld, 1),
        "limit": limit,
        "status": "PASS" if ld <= limit else "CHECK REQUIRED",
    }
