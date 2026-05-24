"""Battery storage sizing for solar hybrid systems."""

from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value


def calculate_battery(inputs: dict[str, Any]) -> dict[str, Any]:
    daily_load_kwh = float(inputs.get("daily_load_kwh", 15))
    autonomy_days = float(inputs.get("autonomy_days", 2))
    dod_pct = float(inputs.get("depth_of_discharge_pct", 80))
    system_voltage = float(inputs.get("system_voltage", 48))
    battery_type = inputs.get("battery_type", "lithium")
    country = inputs.get("country", "Zambia")

    usable_factor = dod_pct / 100
    if battery_type == "lead_acid":
        usable_factor = min(usable_factor, 0.5)

    required_kwh = daily_load_kwh * autonomy_days / usable_factor
    required_ah = (required_kwh * 1000) / system_voltage

    # Standard battery blocks
    block_ah = 200 if battery_type == "lithium" else 150
    block_count = int(required_ah / block_ah + 0.99)
    actual_ah = block_count * block_ah
    actual_kwh = actual_ah * system_voltage / 1000

    return {
        "status": "pass",
        "summary": {
            "country": country,
            "battery_type": battery_type,
            "autonomy_days": autonomy_days,
            "depth_of_discharge_pct": dod_pct,
            "system_voltage": system_voltage,
            "required_capacity_kwh": round_value(required_kwh, 1),
            "required_capacity_ah": round_value(required_ah, 0),
            "battery_blocks": block_count,
            "block_ah": block_ah,
            "installed_kwh": round_value(actual_kwh, 1),
            "installed_ah": actual_ah,
        },
        "steps": [
            {
                "step_number": 1,
                "title": "Required Storage Capacity",
                "formula": "E = E_load × autonomy / DoD",
                "substitution": f"E = {daily_load_kwh} × {autonomy_days} / {usable_factor:.2f}",
                "result": str(round_value(required_kwh, 1)),
                "unit": "kWh",
                "reference": "Off-grid storage design",
                "status": "info",
            },
        ],
        "warnings": [] if battery_type == "lithium" else ["Lead-acid limited to 50% DoD for cycle life"],
        "errors": [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
