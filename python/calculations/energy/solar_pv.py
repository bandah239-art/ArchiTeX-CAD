"""Solar PV system sizing for African off-grid and hybrid installations."""

from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value

# kWh/m²/day by region
GHI_BY_COUNTRY = {
    "Zambia": 5.8, "Kenya": 5.5, "Nigeria": 5.2, "Ghana": 5.0,
    "Tanzania": 5.6, "Zimbabwe": 5.7, "Botswana": 6.0, "Mozambique": 5.4,
}


def calculate_solar_pv(inputs: dict[str, Any]) -> dict[str, Any]:
    daily_load_kwh = float(inputs.get("daily_load_kwh", 15))
    country = inputs.get("country", "Zambia")
    ghi = float(inputs.get("ghi_kwh_m2_day", GHI_BY_COUNTRY.get(country, 5.5)))
    panel_watt = float(inputs.get("panel_watt", 550))
    system_losses = float(inputs.get("system_losses_pct", 20))
    tilt_deg = float(inputs.get("tilt_deg", abs(float(inputs.get("latitude", -15))) * 0.9))
    latitude = float(inputs.get("latitude", -15))

    effective_sun_hours = ghi * (1 - system_losses / 100)
    required_kwp = daily_load_kwh / effective_sun_hours if effective_sun_hours else daily_load_kwh
    panel_count = int(required_kwp * 1000 / panel_watt + 0.99)
    actual_kwp = panel_count * panel_watt / 1000
    annual_yield_kwh = actual_kwp * ghi * 365 * (1 - system_losses / 100)
    inverter_kw = round_value(actual_kwp * 0.9, 1)

    return {
        "status": "pass",
        "summary": {
            "country": country,
            "daily_load_kwh": daily_load_kwh,
            "ghi_kwh_m2_day": ghi,
            "tilt_deg": round_value(tilt_deg, 1),
            "latitude": latitude,
            "required_kwp": round_value(required_kwp, 2),
            "panel_count": panel_count,
            "panel_watt": panel_watt,
            "installed_kwp": round_value(actual_kwp, 2),
            "inverter_kw": inverter_kw,
            "annual_yield_kwh": round_value(annual_yield_kwh, 0),
            "system_losses_pct": system_losses,
        },
        "steps": [
            {
                "step_number": 1,
                "title": "Required Array Capacity",
                "formula": "kWp = E_load / (GHI × (1 - losses))",
                "substitution": f"kWp = {daily_load_kwh} / ({ghi} × {1-system_losses/100:.2f})",
                "result": str(round_value(required_kwp, 2)),
                "unit": "kWp",
                "reference": "Solar resource — geo intelligence",
                "status": "info",
            },
            {
                "step_number": 2,
                "title": "Panel Count",
                "formula": "N = ceil(kWp × 1000 / P_panel)",
                "substitution": f"N = ceil({round_value(required_kwp,2)}×1000/{panel_watt})",
                "result": str(panel_count),
                "unit": "panels",
                "reference": f"{panel_watt}W modules",
                "status": "pass",
            },
        ],
        "warnings": [],
        "errors": [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
