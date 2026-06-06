"""Augmented-reality scene generation for the mobile field app.

Produces a geo-anchored overlay scene from a GPS anchor plus a set of elements.
Element positions given as lat/lon are converted to a local ENU (East-North-Up)
frame in metres relative to the anchor, with distance and compass bearing — the
data a mobile ARCore/ARKit client needs to place world-locked overlays.
"""

from __future__ import annotations

import math
from typing import Any

_EARTH_RADIUS_M = 6_378_137.0


def _enu_offset(anchor_lat: float, anchor_lon: float, lat: float, lon: float) -> tuple[float, float]:
    """Equirectangular approximation: good for the <1km spans of a building site."""
    lat0 = math.radians(anchor_lat)
    east = math.radians(lon - anchor_lon) * math.cos(lat0) * _EARTH_RADIUS_M
    north = math.radians(lat - anchor_lat) * _EARTH_RADIUS_M
    return east, north


def _bearing(east: float, north: float) -> float:
    """Compass bearing in degrees (0 = North, 90 = East)."""
    return (math.degrees(math.atan2(east, north)) + 360) % 360


def build_scene(payload: dict[str, Any]) -> dict[str, Any]:
    anchor_lat = float(payload.get("latitude", 0))
    anchor_lon = float(payload.get("longitude", 0))
    anchor_alt = float(payload.get("altitude_m", 0))
    elements = payload.get("elements") or []

    # Backward-compatible single-element shorthand.
    if not elements:
        elements = [{
            "id": payload.get("element_id", "W-001"),
            "type": payload.get("type", "bim_ghost"),
            "label": payload.get("label", "3.5m height"),
            "east_m": float(payload.get("east_m", 0)),
            "north_m": float(payload.get("north_m", 0)),
            "up_m": float(payload.get("up_m", 0)),
        }]

    overlays: list[dict[str, Any]] = []
    for el in elements:
        if "latitude" in el and "longitude" in el:
            east, north = _enu_offset(anchor_lat, anchor_lon, float(el["latitude"]), float(el["longitude"]))
            up = float(el.get("altitude_m", anchor_alt)) - anchor_alt
        else:
            east = float(el.get("east_m", 0))
            north = float(el.get("north_m", 0))
            up = float(el.get("up_m", 0))

        distance = math.sqrt(east ** 2 + north ** 2 + up ** 2)
        overlays.append({
            "type": el.get("type", "bim_ghost"),
            "element_id": el.get("id", "E-?"),
            "label": el.get("label", ""),
            "enu_m": {"east": round(east, 3), "north": round(north, 3), "up": round(up, 3)},
            "distance_m": round(distance, 2),
            "bearing_deg": round(_bearing(east, north), 1),
            "model_uri": el.get("model_uri"),
        })

    overlays.sort(key=lambda o: o["distance_m"])

    return {
        "status": "complete",
        "engine": "ar_geo_anchor",
        "anchor": {"latitude": anchor_lat, "longitude": anchor_lon, "altitude_m": anchor_alt},
        "frame": "ENU_metres_relative_to_anchor",
        "format": "glb+geo_anchor",
        "overlay_count": len(overlays),
        "overlays": overlays,
        "client_hint": "Place overlays at enu_m offsets; use bearing_deg with device compass for heading lock.",
    }
