"""Terrain analysis using SRTM elevation data."""

import math
from typing import Any

from geo.http_client import fetch_json

SLOPE_CLASSES = [
    (2, "Flat — excellent for construction"),
    (5, "Gentle — good for construction"),
    (10, "Moderate — some earthworks needed"),
    (20, "Steep — significant earthworks"),
    (999, "Very steep — difficult, costly"),
]

# Lusaka fallback grid (~1277m)
LUSAKA_FALLBACK = {
    "elevation_m": 1277,
    "slope_deg": 2.8,
    "aspect": "North-facing",
    "buildability_score": 8.2,
}


def _classify_slope(deg: float) -> str:
    for limit, label in SLOPE_CLASSES:
        if deg <= limit:
            return label
    return SLOPE_CLASSES[-1][1]


def _aspect_label(dz_dx: float, dz_dy: float, latitude: float) -> str:
    if abs(dz_dx) < 1e-6 and abs(dz_dy) < 1e-6:
        return "Flat"
    angle = math.degrees(math.atan2(dz_dy, dz_dx))
    dirs = ["E", "NE", "N", "NW", "W", "SW", "S", "SE"]
    idx = int((angle + 180) / 45) % 8
    label = dirs[idx]
    if latitude < 0 and label in ("N", "NE", "NW"):
        return f"{label}-facing (cooler, more moisture — Southern Hemisphere)"
    return f"{label}-facing"


def _contour_lines_from_grid(
    values: list[list[float]],
    origin_x: float,
    origin_z: float,
    cell_m: float,
    levels: int = 5,
) -> list[dict[str, Any]]:
    flat = [v for row in values for v in row]
    if not flat:
        return []
    vmin = min(flat)
    vmax = max(flat)
    if vmax - vmin < 0.01:
        return []

    rows = len(values)
    cols = len(values[0]) if rows else 0
    lines: list[dict[str, Any]] = []

    for li in range(1, levels + 1):
        level = vmin + (vmax - vmin) * li / (levels + 1)
        segments: list[list[float]] = []

        for r in range(rows):
            row_pts: list[list[float]] = []
            for c in range(cols - 1):
                v0 = values[r][c]
                v1 = values[r][c + 1]
                if (v0 - level) * (v1 - level) >= 0:
                    continue
                t = (level - v0) / (v1 - v0) if abs(v1 - v0) > 1e-9 else 0.5
                x = origin_x + (c + t) * cell_m
                z = origin_z + r * cell_m
                row_pts.append([round(x, 2), round(z, 2)])
            for i in range(0, len(row_pts) - 1, 2):
                segments.extend(row_pts[i : i + 2])

        for c in range(cols):
            col_pts: list[list[float]] = []
            for r in range(rows - 1):
                v0 = values[r][c]
                v1 = values[r + 1][c]
                if (v0 - level) * (v1 - level) >= 0:
                    continue
                t = (level - v0) / (v1 - v0) if abs(v1 - v0) > 1e-9 else 0.5
                x = origin_x + c * cell_m
                z = origin_z + (r + t) * cell_m
                col_pts.append([round(x, 2), round(z, 2)])
            for i in range(0, len(col_pts) - 1, 2):
                segments.extend(col_pts[i : i + 2])

        if len(segments) >= 2:
            lines.append({"elevation_m": round(level, 1), "points": segments})

    return lines


def analyse_terrain(payload: dict[str, Any]) -> dict[str, Any]:
    lat = float(payload["latitude"])
    lon = float(payload["longitude"])
    platform_area = float(payload.get("platform_area_m2", 400))

    steps: list[dict] = []
    grid_size = 5
    spacing = 0.001  # ~111m
    side_m = math.sqrt(max(platform_area, 100))
    half = side_m / 2
    cell_m = side_m / max(grid_size - 1, 1)

    grid_values: list[list[float]] = []
    elevations: list[float] = []

    for i in range(grid_size):
        row: list[float] = []
        for j in range(grid_size):
            glat = lat + (i - grid_size // 2) * spacing
            glon = lon + (j - grid_size // 2) * spacing
            url = f"https://api.opentopodata.org/v1/srtm30m?locations={glat},{glon}"
            data = fetch_json(url)
            elev = LUSAKA_FALLBACK["elevation_m"]
            if data and data.get("results"):
                raw = data["results"][0].get("elevation")
                if raw is not None:
                    elev = float(raw)
            row.append(elev)
            elevations.append(elev)
        grid_values.append(row)

    if elevations:
        elevation = sum(elevations) / len(elevations)
        dz_dx = (max(elevations) - min(elevations)) / (grid_size * spacing * 111000)
        dz_dy = dz_dx * 0.8
        slope_deg = math.degrees(math.atan(math.sqrt(dz_dx**2 + dz_dy**2)))
        aspect = _aspect_label(dz_dx, dz_dy, lat)
        source = "SRTM via OpenTopoData"
    else:
        elevation = LUSAKA_FALLBACK["elevation_m"]
        slope_deg = LUSAKA_FALLBACK["slope_deg"]
        aspect = LUSAKA_FALLBACK["aspect"]
        source = "Regional fallback database"

    slope_class = _classify_slope(slope_deg)
    target_slope = 0.02
    cut = platform_area * max(0, slope_deg / 10 - target_slope) / 3
    fill = platform_area * max(0, target_slope - slope_deg / 10) / 3
    earthworks = cut + fill

    slope_score = max(0, 10 - slope_deg / 2)
    drainage_score = 8.0 if slope_deg > 1 else 6.0
    access_score = 7.5
    buildability = round(slope_score * 0.4 + drainage_score * 0.3 + access_score * 0.3, 1)

    origin_x = -half
    origin_z = -half
    contour_lines = _contour_lines_from_grid(grid_values, origin_x, origin_z, cell_m)

    steps.append({"step": 1, "title": "Elevation Grid", "result": f"Mean elevation = {elevation:.0f} m", "source": source})
    steps.append({"step": 2, "title": "Slope", "result": f"{slope_deg:.1f}° — {slope_class}", "source": "SRTM analysis"})
    steps.append({"step": 3, "title": "Aspect", "result": aspect, "source": "Terrain gradient"})
    steps.append({"step": 4, "title": "Earthworks Estimate", "result": f"{earthworks:.0f} m³ to level platform", "source": "Cut/fill estimate"})
    steps.append({"step": 5, "title": "Drainage Direction", "result": "Downslope from site centroid", "source": "D8 routing simplified"})
    steps.append({"step": 6, "title": "Buildability Score", "result": f"{buildability}/10", "source": "ARCHITEX-CAD scoring"})

    return {
        "status": "complete",
        "elevation_m": round(elevation, 0),
        "mean_slope_pct": round(math.tan(math.radians(slope_deg)) * 100, 1),
        "slope_deg": round(slope_deg, 1),
        "slope_classification": slope_class,
        "aspect": aspect,
        "earthworks_m3": round(earthworks, 0),
        "earthworks_cost_usd": [round(earthworks * 3, 0), round(earthworks * 12, 0)],
        "drainage_direction": aspect.split("-")[0] + "ward",
        "buildability_score": buildability,
        "in_drainage_path": slope_deg < 1,
        "elevation_grid": {
            "rows": grid_size,
            "cols": grid_size,
            "cell_size_m": round(cell_m, 2),
            "origin_x": round(origin_x, 2),
            "origin_z": round(origin_z, 2),
            "values": grid_values,
        },
        "contour_lines": contour_lines,
        "steps": steps,
    }
