"""Integration with Open Elevation DEM API for topographic data."""

import math
from typing import Any

def fetch_elevation(lat: float, lon: float) -> float:
    """
    Mock fetch elevation for a given coordinate.
    In production, this would call Open-Elevation or Google Maps Elevation API:
    https://api.open-elevation.com/api/v1/lookup?locations={lat},{lon}
    """
    # Simulate an elevation based on coordinates for demo purposes
    base_elevation = 1200.0  # e.g., somewhere in East Africa
    variation = math.sin(lat * 10) * 50 + math.cos(lon * 10) * 50
    return round(base_elevation + variation, 2)

def fetch_elevation_profile(path: list[dict[str, float]]) -> list[dict[str, Any]]:
    """
    Fetch an elevation profile for a series of GPS coordinates along a pipe route.
    """
    profile = []
    for idx, point in enumerate(path):
        lat = point.get("lat", 0.0)
        lon = point.get("lon", 0.0)
        elev = fetch_elevation(lat, lon)
        profile.append({
            "node_id": f"Node_{idx+1}",
            "lat": lat,
            "lon": lon,
            "elevation": elev
        })
    return profile
