"""OpenStreetMap Nominatim geocoding (search + reverse)."""

from __future__ import annotations

import urllib.parse
from typing import Any

from geo.http_client import fetch_json

NOMINATIM = "https://nominatim.openstreetmap.org"

# ISO 3166-1 alpha-2 codes supported by InfraAfrica
SUPPORTED_COUNTRIES = frozenset({"ZM", "KE", "NG", "GH", "TZ", "ZW", "BW", "MZ", "ET", "UG", "SN", "CI"})


def _normalize_country(code: str | None) -> str | None:
    if not code:
        return None
    cc = code.upper()
    return cc if cc in SUPPORTED_COUNTRIES else None


def geocode_search(query: str, limit: int = 6) -> list[dict[str, Any]]:
    """Forward geocode — address/place name to coordinates."""
    q = urllib.parse.quote(query.strip())
    if not q:
        return []
    url = f"{NOMINATIM}/search?q={q}&format=json&limit={limit}&addressdetails=1"
    data = fetch_json(url)
    if not isinstance(data, list):
        return []
    results: list[dict[str, Any]] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        addr = item.get("address") or {}
        cc = _normalize_country(addr.get("country_code"))
        results.append(
            {
                "latitude": float(item["lat"]),
                "longitude": float(item["lon"]),
                "display_name": item.get("display_name", query),
                "country_code": cc,
                "city": addr.get("city") or addr.get("town") or addr.get("village") or addr.get("state"),
            }
        )
    return results


def reverse_geocode(latitude: float, longitude: float) -> dict[str, Any]:
    """Reverse geocode — coordinates to address + country."""
    url = (
        f"{NOMINATIM}/reverse?lat={latitude}&lon={longitude}"
        f"&format=json&addressdetails=1&zoom=14"
    )
    data = fetch_json(url)
    if not isinstance(data, dict):
        return {
            "latitude": latitude,
            "longitude": longitude,
            "display_name": f"{latitude:.4f}, {longitude:.4f}",
            "country_code": None,
            "city": None,
        }
    addr = data.get("address") or {}
    cc = _normalize_country(addr.get("country_code"))
    city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("county")
    return {
        "latitude": latitude,
        "longitude": longitude,
        "display_name": data.get("display_name", f"{latitude:.4f}, {longitude:.4f}"),
        "country_code": cc,
        "city": city,
    }
