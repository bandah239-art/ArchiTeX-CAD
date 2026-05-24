"""Embodied carbon and carbon credit estimates (RICS / ICE v3 factors)."""

from datetime import datetime, timezone
from typing import Any

# kgCO2e per unit — ICE Database v3 / RICS WLCA typical values
CARBON_FACTORS: dict[str, float] = {
    "concrete_m3": 200,
    "concrete_m3_rcc": 320,
    "steel_t": 1800,
    "steel_t_recycled": 500,
    "brick_kg": 0.22,
    "timber_m3": -900,
    "cement_t": 830,
    "aggregate_t": 5,
    "diesel_L": 2.68,
    "electricity_kWh": 0.5,
}


def calculate_construction_carbon(inputs: dict[str, Any]) -> dict[str, Any]:
    materials: dict[str, float] = inputs.get("materials") or {}
    transport: dict[str, list[float]] = inputs.get("transport") or {}
    energy: dict[str, float] = inputs.get("energy") or {}

    material_kg = sum(qty * CARBON_FACTORS.get(mat, 0) for mat, qty in materials.items())
    transport_kg = sum(
        dist_km * mass_t * 0.062
        for dist_km, mass_t in transport.values()
    )
    energy_kg = sum(qty * CARBON_FACTORS.get(key, 0) for key, qty in energy.items())
    total_kg = material_kg + transport_kg + energy_kg

    return {
        "status": "pass",
        "summary": {
            "material_kgCO2e": round(material_kg, 1),
            "transport_kgCO2e": round(transport_kg, 1),
            "energy_kgCO2e": round(energy_kg, 1),
            "total_kgCO2e": round(total_kg, 1),
            "total_tCO2e": round(total_kg / 1000, 3),
            "methodology": "RICS WLCA / ICE Database v3",
        },
        "steps": [
            {
                "step_number": 1,
                "title": "Embodied carbon — materials",
                "formula": "Σ quantity × ICE factor",
                "substitution": f"{len(materials)} material line(s)",
                "result": f"{round(material_kg, 1)} kgCO2e",
                "unit": "kgCO2e",
                "reference": "RICS WLCA",
                "status": "info",
            },
            {
                "step_number": 2,
                "title": "Transport emissions",
                "formula": "distance × mass × 0.062 kgCO2e/t-km",
                "substitution": f"{len(transport)} route(s)",
                "result": f"{round(transport_kg, 1)} kgCO2e",
                "unit": "kgCO2e",
                "reference": "DEFRA freight factors",
                "status": "info",
            },
        ],
        "warnings": [],
        "errors": [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def calculate_carbon_credits(inputs: dict[str, Any]) -> dict[str, Any]:
    baseline = float(inputs.get("baseline_emissions_tCO2e", 0))
    project = float(inputs.get("project_emissions_tCO2e", 0))
    sequestration = float(inputs.get("sequestration_tCO2e", 0))
    life_years = int(inputs.get("project_life_years", 20))
    price = float(inputs.get("price_per_vcu_usd", 15))

    net = baseline - project + sequestration
    vcus = max(0, net * 0.80 * life_years)

    return {
        "status": "pass",
        "summary": {
            "annual_net_reduction_tCO2e": round(net, 2),
            "total_VCUs": round(vcus, 0),
            "price_per_VCU_USD": price,
            "total_value_USD": round(vcus * price, 2),
            "methodology": inputs.get("methodology", "VCS VM0045"),
        },
        "steps": [],
        "warnings": [],
        "errors": [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
