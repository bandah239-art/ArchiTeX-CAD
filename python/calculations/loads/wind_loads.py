"""ASCE 7 / SANS 10160-3 style wind pressure analysis."""

from datetime import datetime, timezone
from typing import Any

import math

from calculations.utils.formatters import round_value

KZ_TABLE = {
    "B": {0: 0.57, 15: 0.57, 20: 0.62, 25: 0.66, 30: 0.70, 40: 0.76, 50: 0.81, 60: 0.85, 80: 0.93, 100: 0.99},
    "C": {0: 0.85, 15: 0.85, 20: 0.90, 25: 0.94, 30: 0.98, 40: 1.04, 50: 1.09, 60: 1.13, 80: 1.21},
    "D": {0: 1.03, 15: 1.03, 20: 1.08, 25: 1.12, 30: 1.16},
}


def _interpolate_kz(table: dict[float, float], height: float) -> float:
    keys = sorted(table.keys())
    if height <= keys[0]:
        return table[keys[0]]
    if height >= keys[-1]:
        return table[keys[-1]]
    for i in range(len(keys) - 1):
        if keys[i] <= height <= keys[i + 1]:
            t = (height - keys[i]) / (keys[i + 1] - keys[i])
            return table[keys[i]] + t * (table[keys[i + 1]] - table[keys[i]])
    return table[keys[-1]]


def calculate_wind_loads(inputs: dict[str, Any]) -> dict[str, Any]:
    vb = float(inputs.get("basic_wind_speed", inputs.get("basic_wind_speed_ms", 45)))
    height = float(inputs.get("building_height", inputs.get("building_height_m", 12)))
    width = float(inputs.get("building_width", inputs.get("building_width_m", 20)))
    length = float(inputs.get("building_length", inputs.get("building_length_m", 30)))
    exposure = str(inputs.get("exposure_category", inputs.get("terrain_category", "B")))
    if exposure in ("0", "I", "II", "III", "IV"):
        exposure = {"0": "D", "I": "C", "II": "B", "III": "C", "IV": "D"}.get(exposure, "B")

    Kz = _interpolate_kz(KZ_TABLE.get(exposure, KZ_TABLE["B"]), height)
    Kzt = 1.0
    Kd = 0.85
    qz = 0.613 * Kz * Kzt * Kd * vb**2

    aspect = height / max(min(length, width), 1)
    cp_windward = 0.8
    cp_leeward = -0.5 if aspect < 1 else (-0.2 if aspect > 2 else -0.3)
    cp_side = -0.7
    cp_roof = -0.9 if aspect <= 0.5 else -0.7
    g = 0.85

    p_windward = qz * g * cp_windward
    p_leeward = qz * g * cp_leeward
    p_side = qz * g * cp_side
    p_roof = qz * g * cp_roof

    base_shear = (p_windward - p_leeward) * width * height / 1000
    overturning = base_shear * height * 0.6

    steps = [
        {
            "step_number": 1,
            "title": "Velocity pressure qz",
            "formula": "qz = 0.613·Kz·Kd·V²",
            "substitution": f"Kz={round_value(Kz, 3)}, V={vb} m/s",
            "result": f"qz = {round_value(qz, 1)} Pa",
            "unit": "Pa",
            "reference": "ASCE 7-22 / SANS 10160-3",
            "status": "info",
        },
        {
            "step_number": 2,
            "title": "Base shear",
            "formula": "V = (p_windward - p_leeward) × B × h",
            "substitution": f"Δp = {round_value(p_windward - p_leeward, 1)} Pa",
            "result": f"V = {round_value(base_shear, 2)} kN",
            "unit": "kN",
            "reference": "MWFRS",
            "status": "info",
        },
    ]

    return {
        "status": "pass",
        "summary": {
            "velocity_pressure_qz_Pa": round_value(qz, 1),
            "windward_wall_Pa": round_value(p_windward, 1),
            "leeward_wall_Pa": round_value(p_leeward, 1),
            "side_walls_Pa": round_value(p_side, 1),
            "roof_uplift_Pa": round_value(p_roof, 1),
            "base_shear_kN": round_value(base_shear, 2),
            "overturning_moment_kNm": round_value(overturning, 1),
            "exposure_category": exposure,
            "standard": "ASCE 7-22 / SANS 10160-3 / EC1-4",
        },
        "steps": steps,
        "warnings": [],
        "errors": [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
