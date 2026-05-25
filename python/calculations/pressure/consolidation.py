"""Effective stress and consolidation pressure."""

from __future__ import annotations

from typing import Any

from calculations.utils.formatters import round_value
from calculations.pressure._common import depth_table, finish, step


def calculate_consolidation(payload: dict[str, Any]) -> dict[str, Any]:
    layers = payload.get("layers") or [{"gamma": 18, "thickness": 2}]
    hw = float(payload.get("water_table_depth", 999))
    sigma_v0 = 0.0
    depth = 0.0
    for layer in layers:
        gamma = float(layer.get("gamma", 18))
        h = float(layer.get("thickness", 1))
        depth += h
        gamma_eff = gamma - 9.81 if depth > hw else gamma
        sigma_v0 += gamma_eff * h
    delta = float(payload.get("delta_sigma", payload.get("foundation_stress", 75)))
    sigma_v1 = sigma_v0 + delta
    ocr = float(payload.get("OCR", payload.get("ocr", 1)))

    steps = [
        step(1, "Initial effective stress", "σ'v0 = Σ(γ'·h)", "layer sum", f"σ'v0 = {round_value(sigma_v0,1)} kPa", "kPa", "Terzaghi"),
        step(2, "Stress increase", "Δσ'v from foundation", f"Δσ={delta}", f"σ'v1 = {round_value(sigma_v1,1)} kPa", "kPa", "Boussinesq feed"),
        step(3, "OCR", "OCR = σ'p/σ'v0", f"OCR={ocr}", f"OCR = {round_value(ocr,2)}", "", "Consolidation"),
    ]

    rows = [
        (0, sigma_v0, "OK"),
        (depth, sigma_v0, "OK"),
        (depth, sigma_v1, "OK"),
    ]
    diagram = {
        "type": "contour",
        "points": [{"depth_m": z, "pressure_kpa": p} for z, p, _ in rows],
        "labels": [f"Δσ = {round_value(delta, 1)} kPa"],
        "resultant": {"value": sigma_v1, "location": "foundation level", "unit": "kPa"},
    }

    return finish(
        {
            "sigma_v0_kpa": round_value(sigma_v0, 1),
            "sigma_v1_kpa": round_value(sigma_v1, 1),
            "OCR": ocr,
            "depth_table": depth_table(rows),
        },
        steps,
        diagram,
    )
