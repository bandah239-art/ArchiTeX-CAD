"""Seismic response — delegates to OpenSeesPy when available."""

from __future__ import annotations

from typing import Any

from simulations.seismic.opensees_runner import run_seismic_analysis


def simulate_seismic_response(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Unified seismic API.
    payload keys: analysis_type, pga_g, n_storeys, storey_height_m, storey_masses_kg, ...
    """
    building = {
        "n_storeys": payload.get("n_storeys", 4),
        "storey_height_m": payload.get("storey_height_m", 3.0),
        "bay_width_m": payload.get("bay_width_m", 6.0),
        "n_bays": payload.get("n_bays", 3),
        "storey_masses_kg": payload.get("storey_masses_kg"),
        "column_EI": payload.get("column_EI", 2.5e8),
        "beam_EI": payload.get("beam_EI", 1.5e8),
    }

    result = run_seismic_analysis({
        "building": building,
        "analysis_type": payload.get("analysis_type", "modal"),
        "pga_g": payload.get("pga_g", 0.15),
    })

    return {
        **result,
        "site_class": payload.get("site_class", "B"),
        "mass_t": payload.get("mass_t", 500),
    }
