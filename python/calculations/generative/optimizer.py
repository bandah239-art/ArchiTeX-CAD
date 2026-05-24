"""Multi-objective generative design — scipy DE + Optuna."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import numpy as np
from scipy.optimize import differential_evolution

try:
    import optuna

    HAS_OPTUNA = True
except ImportError:
    HAS_OPTUNA = False


def optimize_structural_layout(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Optimize column grid / spans for steel weight, cost, and deflection.
    Design variables: span_x, span_y, n_bays_x, n_bays_y
    """
    floor_area = float(payload.get("floor_area_m2", 400))
    span_range = (
        float(payload.get("span_min_m", 4)),
        float(payload.get("span_max_m", 12)),
    )
    n_span_range = (
        int(payload.get("n_spans_min", 2)),
        int(payload.get("n_spans_max", 8)),
    )
    w_steel = float(payload.get("weight_steel", 1.0))
    w_cost = float(payload.get("weight_cost", 1.5))
    w_defl = float(payload.get("weight_deflection", 0.1))

    aspect = np.sqrt(floor_area)

    def objective(params: np.ndarray) -> float:
        span_x, span_y, n_x, n_y = params
        n_x, n_y = int(round(n_x)), int(round(n_y))
        n_x = max(n_span_range[0], min(n_span_range[1], n_x))
        n_y = max(n_span_range[0], min(n_span_range[1], n_y))

        steel_kg_m2 = 22 + 0.8 * span_x + 0.6 * span_y
        slab_depth_mm = max(span_x, span_y) * 1000 / 30
        cost_index = steel_kg_m2 * 1.5 + slab_depth_mm * 0.01 * n_x * n_y
        E = 200_000  # MPa
        I = (slab_depth_mm / 1000) ** 3 / 12
        deflection_mm = (
            5 * 1.5 * max(span_x, span_y) ** 4 * 1000 ** 3 / (384 * E * I)
            if I > 0
            else 999
        )
        return w_steel * steel_kg_m2 + w_cost * cost_index + w_defl * deflection_mm

    bounds = [span_range, span_range, n_span_range, n_span_range]
    result = differential_evolution(
        objective,
        bounds,
        seed=42,
        maxiter=int(payload.get("max_iterations", 200)),
        popsize=15,
        tol=0.001,
        polish=True,
    )

    bx, by, nx, ny = result.x
    nx, ny = int(round(nx)), int(round(ny))
    steel = 22 + 0.8 * bx + 0.6 * by
    slab_d = max(bx, by) * 1000 / 30

    return {
        "status": "complete",
        "engine": "scipy_differential_evolution",
        "summary": {
            "optimal_span_x_m": round(float(bx), 2),
            "optimal_span_y_m": round(float(by), 2),
            "n_bays_x": nx,
            "n_bays_y": ny,
            "total_columns": (nx + 1) * (ny + 1),
            "estimated_steel_kg_m2": round(steel, 1),
            "slab_depth_mm": round(slab_d, 0),
            "objective_value": round(float(result.fun), 4),
            "converged": bool(result.success),
            "iterations": int(result.nit),
            "floor_area_m2": floor_area,
        },
        "standard": "Generative layout — Westerberg steel heuristic + L/30 slab rule",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def optimize_solar_orientation(payload: dict[str, Any]) -> dict[str, Any]:
    """Find optimal tilt/azimuth using Optuna or grid search fallback."""
    lat = float(payload.get("latitude", -15.4))
    lon = float(payload.get("longitude", 28.3))
    roof_area = float(payload.get("roof_area_m2", 80))

    def annual_score(azimuth: int, tilt: int) -> float:
        # Simplified annual irradiance proxy (southern hemisphere)
        lat_factor = np.cos(np.radians(abs(tilt - abs(lat))))
        az_factor = np.cos(np.radians(azimuth - 360))  # north = 360/0
        return -(lat_factor * az_factor * roof_area * 1000)

    best_az, best_tilt, best_val = 360, int(abs(lat)), 0.0

    if HAS_OPTUNA:
        study = optuna.create_study(direction="minimize")

        def trial_fn(trial: optuna.Trial) -> float:
            az = trial.suggest_int("azimuth", 270, 360)
            tilt = trial.suggest_int("tilt", 5, 45)
            return annual_score(az, tilt)

        study.optimize(
            trial_fn,
            n_trials=int(payload.get("n_trials", 100)),
            show_progress_bar=False,
        )
        best_az = study.best_params["azimuth"]
        best_tilt = study.best_params["tilt"]
        best_val = study.best_value
        engine = "optuna"
    else:
        for az in range(270, 361, 5):
            for tilt in range(5, 46, 5):
                v = annual_score(az, tilt)
                if v < best_val:
                    best_val, best_az, best_tilt = v, az, tilt
        engine = "grid_search"

    baseline = annual_score(360, int(abs(lat)))
    improvement = round((1 - best_val / baseline) * 100, 1) if baseline else 0

    return {
        "status": "complete",
        "engine": engine,
        "summary": {
            "optimal_azimuth_deg": best_az,
            "optimal_tilt_deg": best_tilt,
            "estimated_yield_improvement_pct": improvement,
            "roof_area_m2": roof_area,
            "latitude": lat,
            "longitude": lon,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
