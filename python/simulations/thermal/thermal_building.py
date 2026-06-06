"""Thermal building simulation.

Always-available steady-state + degree-day baseline. When EnergyPlus (via eppy)
is configured, the response advertises that the high-fidelity engine is available
and reports its path; full IDF assembly is delegated to a provider hook.
"""

from __future__ import annotations

from typing import Any

from emerging.capabilities import check_thermal


def _steady_state(payload: dict[str, Any]) -> dict[str, Any]:
    floor = float(payload.get("floor_area_m2", 100))
    wall = float(payload.get("wall_area_m2", 200))
    roof = float(payload.get("roof_area_m2", floor))
    u_wall = float(payload.get("u_value_wall", 0.35))
    u_roof = float(payload.get("u_value_roof", 0.25))
    u_floor = float(payload.get("u_value_floor", 0.3))
    t_int = float(payload.get("internal_temp_c", 22))
    t_ext = float(payload.get("external_temp_c", 28))
    hours = float(payload.get("occupancy_hours", 12))
    cooling_degree_days = float(payload.get("cooling_degree_days", 1200))

    delta_t = abs(t_int - t_ext)
    q_wall = u_wall * wall * delta_t
    q_roof = u_roof * roof * delta_t
    q_floor = u_floor * floor * delta_t * 0.5
    q_total_w = q_wall + q_roof + q_floor
    daily_kwh = q_total_w * hours / 1000

    ua = u_wall * wall + u_roof * roof + u_floor * floor * 0.5
    annual_cdd_kwh = ua * cooling_degree_days * 24 / 1000

    return {
        "heat_loss_w": round(q_total_w, 1),
        "ua_w_per_k": round(ua, 1),
        "daily_cooling_kwh": round(daily_kwh, 2),
        "annual_cooling_kwh_est": round(daily_kwh * 250, 0),
        "annual_cooling_kwh_cdd": round(annual_cdd_kwh, 0),
        "components_w": {
            "walls": round(q_wall, 1),
            "roof": round(q_roof, 1),
            "floor": round(q_floor, 1),
        },
        "recommendation": "Improve roof insulation if U-value > 0.3 W/m²K in tropical climates.",
    }


def simulate_thermal(payload: dict[str, Any]) -> dict[str, Any]:
    """
    payload: floor_area_m2, wall_area_m2, u_value_wall, u_value_roof,
             internal_temp_c, external_temp_c, occupancy_hours, cooling_degree_days
    """
    cap = check_thermal()
    baseline = _steady_state(payload)

    if not cap["enabled"]:
        return {
            "status": "complete",
            "enabled": False,
            "engine": "steady_state_baseline",
            **baseline,
            "energyplus_available": False,
            "requires": cap["requires"],
            "setup": "Install eppy + EnergyPlus to run full hourly multi-zone simulation.",
        }

    try:
        from emerging.providers.thermal_energyplus import run_energyplus  # type: ignore

        result = run_energyplus(payload)
        return {"status": "complete", "enabled": True, "engine": "energyplus",
                "energyplus_path": cap["energyplus_path"], "baseline": baseline, **result}
    except Exception as exc:  # pragma: no cover - depends on EnergyPlus
        return {
            "status": "complete",
            "enabled": True,
            "engine": "steady_state_baseline",
            **baseline,
            "energyplus_available": True,
            "energyplus_error": str(exc),
            "note": "EnergyPlus detected but IDF run failed; returned steady-state baseline.",
        }
