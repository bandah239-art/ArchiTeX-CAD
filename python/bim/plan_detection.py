"""2D plan takeoff — wall footprints and segment detection from IFC geometry."""

from __future__ import annotations

from typing import Any

from bim.geometry_extensions import (
    Polygon2d,
    polyline_length,
    wall_footprint_polygon,
)
from bim.ifc_geometry import HAS_IFCOPENSHELL, parse_ifc_file


def _wall_centerline(length: float, width: float, height: float, el_id: str) -> dict[str, Any]:
    """Derive dominant-axis centerline from bbox dimensions."""
    span = length
    thick = min(w, h) if (w := width) and (h := height) else width or 0.2
    if span <= 0:
        span = max(width, height, 1.0)
    return {
        "id": el_id,
        "start": [0.0, 0.0],
        "end": [span, 0.0],
        "length_m": span,
        "thickness_m": thick,
    }


def extract_plan_takeoff(path: str, wall_types: tuple[str, ...] = ("IfcWall",)) -> dict[str, Any]:
    """
    Extract 2D plan takeoff from IFC — wall segments, footprints, and areas.
    Uses GeometryExtensions-style polygon/segment math on projected footprints.
    """
    if not HAS_IFCOPENSHELL:
        return {
            "status": "error",
            "error": "IfcOpenShell required for plan takeoff",
            "segments": [],
            "assets": [],
        }

    parsed = parse_ifc_file(path)
    if parsed.get("status") == "error":
        return parsed

    wall_elements = [e for e in parsed.get("elements", []) if e.get("type") in wall_types]
    segments: list[dict[str, Any]] = []
    footprints: list[list[tuple[float, float]]] = []
    length_bins: dict[str, list[float]] = {}

    for el in wall_elements:
        length = float(el.get("length") or 0)
        width = float(el.get("width") or 0.2)
        height = float(el.get("height") or 2.8)
        thickness = min(width, height) if width and height else width or 0.2

        centerline = _wall_centerline(length, width, height, el.get("globalId", ""))
        fp = wall_footprint_polygon(
            tuple(centerline["start"]),
            tuple(centerline["end"]),
            thickness,
        )
        fp_area = Polygon2d.from_vertices(fp).area if fp else 0.0
        if fp:
            footprints.append(fp)

        seg_len = polyline_length(
            [{"start": centerline["start"], "end": centerline["end"], "bulge": 0}]
        )

        seg = {
            "id": el.get("globalId"),
            "name": el.get("name"),
            "type": el.get("type"),
            "length_m": round(seg_len or length, 3),
            "thickness_m": thickness,
            "height_m": max(width, height) if width and height else height or 2.8,
            "volume_m3": el.get("volume", 0),
            "footprint_area_m2": round(fp_area, 3),
            "footprint": [[p[0], p[1]] for p in fp] if fp else [],
        }
        segments.append(seg)

        bin_key = f"Wall ~{int(round(seg['length_m']))}m" if seg["length_m"] > 0 else "Wall unknown"
        length_bins.setdefault(bin_key, []).append(seg["length_m"])

    total_footprint_area = sum(s["footprint_area_m2"] for s in segments)

    assets = [
        {
            "label": label,
            "count": len(lengths),
            "avg_length_m": round(sum(lengths) / len(lengths), 2) if lengths else 0,
            "total_length_m": round(sum(lengths), 2),
        }
        for label, lengths in sorted(length_bins.items(), key=lambda x: -len(x[1]))
    ]

    return {
        "status": "complete",
        "engine": "ifcopenshell+geometry_extensions",
        "wall_count": len(segments),
        "total_wall_length_m": round(sum(s["length_m"] for s in segments), 2),
        "total_wall_volume_m3": round(sum(s["volume_m3"] for s in segments), 2),
        "total_footprint_area_m2": round(total_footprint_area, 2),
        "segments": segments,
        "assets": assets,
    }


def detect_from_raster_stub(_image_path: str) -> dict[str, Any]:
    return {
        "status": "stub",
        "message": "Raster plan detection requires opencv-python + model pipeline. Use IFC plan takeoff for now.",
        "assets": [],
    }
