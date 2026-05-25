"""D8 flood routing and inundation estimation (numpy-only, no rasterio)."""

from datetime import datetime, timezone
from typing import Any

import numpy as np

D8 = {
    1: (0, 1),
    2: (1, 1),
    4: (1, 0),
    8: (1, -1),
    16: (0, -1),
    32: (-1, -1),
    64: (-1, 0),
    128: (-1, 1),
}


def compute_flow_direction(dem: np.ndarray) -> np.ndarray:
    rows, cols = dem.shape
    flow = np.zeros((rows, cols), dtype=np.int16)
    for r in range(1, rows - 1):
        for c in range(1, cols - 1):
            best_dir = 0
            best_slope = -np.inf
            for d, (dr, dc) in D8.items():
                nr, nc = r + dr, c + dc
                dist = np.sqrt(dr * dr + dc * dc)
                slope = (dem[r, c] - dem[nr, nc]) / max(dist, 1e-6)
                if slope > best_slope:
                    best_slope = slope
                    best_dir = d
            flow[r, c] = best_dir
    return flow


def compute_flow_accumulation(flow_dir: np.ndarray) -> np.ndarray:
    rows, cols = flow_dir.shape
    accum = np.ones((rows, cols), dtype=np.float64)
    order = np.dstack(np.unravel_index(np.argsort(flow_dir.ravel()), (rows, cols)))[0]
    for r, c in order:
        d = flow_dir[r, c]
        if d in D8:
            dr, dc = D8[d]
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols:
                accum[nr, nc] += accum[r, c]
    return accum


def simulate_flood_inundation(inputs: dict[str, Any]) -> dict[str, Any]:
    size = int(inputs.get("grid_size", 64))
    cell_m = float(inputs.get("cell_size_m", 30))
    rainfall_mm = float(inputs.get("rainfall_mm", 80))
    catchment_km2 = float(inputs.get("catchment_area_km2", 2.5))
    return_period = int(inputs.get("return_period_years", 100))

    # Synthetic valley DEM for demo when no DEM uploaded
    x = np.linspace(-1, 1, size)
    y = np.linspace(-1, 1, size)
    xx, yy = np.meshgrid(x, y)
    dem = 100 + 20 * (xx**2 + yy**2) - 15 * np.exp(-((xx**2 + yy**2) / 0.3))

    flow_dir = compute_flow_direction(dem)
    flow_accum = compute_flow_accumulation(flow_dir)

    c = 0.7
    intensity = rainfall_mm / max(return_period ** 0.2, 1)
    q_peak = c * (intensity / 3600) * catchment_km2 * 1e6

    channel = flow_accum > np.percentile(flow_accum, 95)
    hand = dem - np.where(channel, dem[channel].min(), dem.min())
    depth_threshold = max(q_peak / 50, 0.5)
    flood_mask = hand < depth_threshold

    flooded_m2 = float(np.sum(flood_mask)) * cell_m * cell_m
    flood_depths = np.where(flood_mask, depth_threshold, 0.0)
    extent = size * cell_m
    origin = -extent / 2

    return {
        "status": "pass",
        "summary": {
            "peak_flow_m3s": round(q_peak, 2),
            "return_period_years": return_period,
            "flooded_area_m2": round(flooded_m2, 0),
            "flooded_area_ha": round(flooded_m2 / 10000, 3),
            "max_flood_depth_m": round(depth_threshold, 2),
            "method": "D8 routing + HAND approximation",
        },
        "flood_grid": {
            "size": size,
            "cell_size_m": cell_m,
            "origin_x": origin,
            "origin_z": origin,
            "depths": flood_depths.tolist(),
        },
        "steps": [
            {
                "step_number": 1,
                "title": "Peak flow (Rational Method)",
                "formula": "Q = C × i × A",
                "substitution": f"C={c}, i={round(intensity, 1)} mm/hr, A={catchment_km2} km²",
                "result": f"Q = {round(q_peak, 2)} m³/s",
                "unit": "m³/s",
                "reference": "Hydrology handbook",
                "status": "info",
            }
        ],
        "warnings": ["Using synthetic DEM — upload site DEM for production analysis."],
        "errors": [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
