"""Sentinel-2 land-cover / NDVI analysis (rasterio + provider key).

Enabled when rasterio is installed and a provider key is set. This computes NDVI
and a simple land-cover split from a downloaded tile. The tile fetch uses Sentinel
Hub's Process API when SENTINEL_HUB_KEY is present.
"""

from __future__ import annotations

import os
from typing import Any


def _bbox_from_point(lat: float, lon: float, half_deg: float = 0.01) -> list[float]:
    return [lon - half_deg, lat - half_deg, lon + half_deg, lat + half_deg]


def analyse_tile(lat: float, lon: float, payload: dict[str, Any]) -> dict[str, Any]:
    """Compute NDVI-based land cover for a small bbox around lat/lon.

    Requires a real RED/NIR raster. Production deployments fetch this from Sentinel
    Hub / Earth Engine; here we compute the metrics from whatever GeoTIFF the
    provider returns (path passed in payload['tile_path'] for testing).
    """
    import numpy as np
    import rasterio  # noqa: F401  (capability gate ensures availability)

    bbox = payload.get("bbox") or _bbox_from_point(lat, lon)
    tile_path = payload.get("tile_path")

    if not tile_path or not os.path.exists(tile_path):
        raise RuntimeError(
            "No raster tile available. Configure Sentinel Hub download or pass tile_path "
            "to a local RED/NIR GeoTIFF."
        )

    with rasterio.open(tile_path) as src:
        red = src.read(int(payload.get("red_band", 1))).astype("float32")
        nir = src.read(int(payload.get("nir_band", 2))).astype("float32")

    denom = nir + red
    ndvi = np.where(denom == 0, 0, (nir - red) / denom)
    veg = float((ndvi > 0.3).mean() * 100)
    water = float((ndvi < -0.1).mean() * 100)
    bare = float(((ndvi >= -0.1) & (ndvi <= 0.15)).mean() * 100)
    built = max(0.0, 100 - veg - water - bare)

    return {
        "location": {"latitude": lat, "longitude": lon},
        "bbox": bbox,
        "ndvi_mean": round(float(ndvi.mean()), 3),
        "land_cover": {
            "built_up_pct": round(built, 1),
            "vegetation_pct": round(veg, 1),
            "bare_soil_pct": round(bare, 1),
            "water_pct": round(water, 1),
        },
        "tile_source": "geotiff",
    }
