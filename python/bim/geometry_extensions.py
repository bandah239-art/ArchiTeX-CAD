"""
Portable geometry kernel ported from Gile.AutoCAD GeometryExtensions.

AutoCAD-specific APIs (Editor, Region, Brep, acedTrans) are not used at runtime.
Those remain in GeometryExtensions/ for optional native AutoCAD bridge builds.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Literal

try:
    from shapely.geometry import Polygon, mapping, shape
    from shapely.ops import unary_union

    HAS_SHAPELY = True
except ImportError:
    HAS_SHAPELY = False

Point2 = tuple[float, float]
Point3 = tuple[float, float, float]
Matrix4 = list[float]  # column-major 4x4


@dataclass
class PolylineSegment:
    """Mirrors Gile PolylineSegment — start/end with optional bulge (tan(angle/4))."""

    start: Point2
    end: Point2
    bulge: float = 0.0
    start_width: float = 0.0
    end_width: float = 0.0

    @property
    def is_linear(self) -> bool:
        return abs(self.bulge) < 1e-12

    def length(self) -> float:
        x1, y1 = self.start
        x2, y2 = self.end
        chord = math.hypot(x2 - x1, y2 - y1)
        if self.is_linear:
            return chord
        angle = 4.0 * math.atan(abs(self.bulge))
        if angle < 1e-12:
            return chord
        radius = chord / (2.0 * math.sin(angle / 2.0))
        return radius * angle

    def reversed(self) -> PolylineSegment:
        return PolylineSegment(
            self.end, self.start, -self.bulge, self.end_width, self.start_width
        )


@dataclass
class Polygon2d:
    """Mirrors Gile Polygon2d — area, centroid, point-in-polygon."""

    vertices: list[Point2] = field(default_factory=list)
    area: float = 0.0
    centroid: Point2 = (0.0, 0.0)
    is_clockwise: bool = False

    @classmethod
    def from_vertices(cls, vertices: list[Point2]) -> Polygon2d:
        poly = cls(vertices=list(vertices))
        poly._initialize()
        return poly

    @classmethod
    def from_bbox(cls, min_x: float, min_y: float, max_x: float, max_y: float) -> Polygon2d:
        return cls.from_vertices([(min_x, min_y), (max_x, min_y), (max_x, max_y), (min_x, max_y)])

    def _initialize(self) -> None:
        n = len(self.vertices)
        if n < 3:
            self.area = 0.0
            self.centroid = self.vertices[0] if n else (0.0, 0.0)
            return

        cx = cy = 0.0
        signed_area = 0.0
        p0 = self.vertices[0]
        for i in range(1, n - 1):
            p1 = self.vertices[i]
            p2 = self.vertices[i + 1]
            tri = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1])
            tri_cx = (p0[0] + p1[0] + p2[0]) / 3.0
            tri_cy = (p0[1] + p1[1] + p2[1]) / 3.0
            signed_area += tri
            cx += tri_cx * tri
            cy += tri_cy * tri

        self.area = abs(signed_area / 2.0)
        if abs(signed_area) > 1e-12:
            self.centroid = (cx / signed_area, cy / signed_area)
        else:
            self.centroid = p0
        self.is_clockwise = signed_area < 0.0

    def is_point_inside(self, point: Point2) -> bool:
        """Ray-casting algorithm (same logic as Gile Polygon2d.IsPointInside)."""
        x, y = point
        n = len(self.vertices)
        inside = False
        j = n - 1
        for i in range(n):
            xi, yi = self.vertices[i]
            xj, yj = self.vertices[j]
            if ((yi > y) != (yj > y)) and (
                x < (xj - xi) * (y - yi) / (yj - yi + 1e-20) + xi
            ):
                inside = not inside
            j = i
        return inside

    def to_coords(self) -> list[list[float]]:
        return [[v[0], v[1]] for v in self.vertices]


def identity_matrix() -> Matrix4:
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]


def multiply_mat4(a: Matrix4, b: Matrix4) -> Matrix4:
    out = [0.0] * 16
    for c in range(4):
        for r in range(4):
            out[c * 4 + r] = sum(a[k * 4 + r] * b[c * 4 + k] for k in range(4))
    return out


def transform_point(matrix: Matrix4, point: Point3) -> Point3:
    x, y, z = point
    return (
        matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
        matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
        matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
    )


def flatten_xy(point: Point3) -> Point3:
    return (point[0], point[1], 0.0)


def project_to_plane(point: Point3, plane_origin: Point3, plane_normal: Point3) -> Point3:
    """Project point onto plane (WCS-style)."""
    ox, oy, oz = plane_origin
    nx, ny, nz = plane_normal
    norm = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
    nx, ny, nz = nx / norm, ny / norm, nz / norm
    px, py, pz = point
    dist = (px - ox) * nx + (py - oy) * ny + (pz - oz) * nz
    return (px - dist * nx, py - dist * ny, pz - dist * nz)


def polyline_length(segments: list[dict[str, Any]]) -> float:
    total = 0.0
    for seg in segments:
        s = PolylineSegment(
            tuple(seg["start"]),
            tuple(seg["end"]),
            float(seg.get("bulge", 0)),
        )
        total += s.length()
    return total


def polygon_area(vertices: list[Point2]) -> dict[str, Any]:
    poly = Polygon2d.from_vertices(vertices)
    return {
        "area": round(poly.area, 6),
        "centroid": [round(poly.centroid[0], 6), round(poly.centroid[1], 6)],
        "is_clockwise": poly.is_clockwise,
    }


def polygon_contains(vertices: list[Point2], point: Point2) -> dict[str, Any]:
    poly = Polygon2d.from_vertices(vertices)
    return {"inside": poly.is_point_inside(point)}


def region_boolean(
    polygons_a: list[list[Point2]],
    polygons_b: list[list[Point2]],
    operation: Literal["union", "difference", "intersection"],
) -> dict[str, Any]:
    if not HAS_SHAPELY:
        return {
            "status": "error",
            "error": "shapely not installed. Run: pip install shapely",
            "engine": "none",
        }

    try:
        shape_a = unary_union([Polygon(p) for p in polygons_a if len(p) >= 3])
        shape_b = unary_union([Polygon(p) for p in polygons_b if len(p) >= 3])
        if operation == "union":
            result = shape_a.union(shape_b)
        elif operation == "difference":
            result = shape_a.difference(shape_b)
        else:
            result = shape_a.intersection(shape_b)

        if result.is_empty:
            return {
                "status": "complete",
                "engine": "shapely",
                "operation": operation,
                "area": 0.0,
                "polygons": [],
            }

        polys: list[list[list[float]]] = []
        if result.geom_type == "Polygon":
            polys.append(mapping(result)["coordinates"][0])
        elif result.geom_type == "MultiPolygon":
            for g in result.geoms:
                polys.append(mapping(g)["coordinates"][0])

        return {
            "status": "complete",
            "engine": "shapely",
            "operation": operation,
            "area": float(result.area),
            "polygons": polys,
        }
    except Exception as exc:
        return {"status": "error", "error": str(exc), "engine": "shapely"}


def wall_footprint_polygon(
    start: Point2, end: Point2, thickness: float
) -> list[Point2]:
    """Build wall footprint rectangle from centerline segment + thickness."""
    x1, y1 = start
    x2, y2 = end
    dx, dy = x2 - x1, y2 - y1
    length = math.hypot(dx, dy)
    if length < 1e-9:
        return []
    nx, ny = -dy / length * thickness / 2, dx / length * thickness / 2
    return [
        (x1 + nx, y1 + ny),
        (x2 + nx, y2 + ny),
        (x2 - nx, y2 - ny),
        (x1 - nx, y1 - ny),
    ]


def extensions_status() -> dict[str, Any]:
    from bim.autocad_bridge import autocad_bridge_status

    bridge = autocad_bridge_status()
    return {
        "source": "Gile.AutoCAD GeometryExtensions (Python port)",
        "shapely": HAS_SHAPELY,
        "engines": {
            "2d_regions": "shapely" if HAS_SHAPELY else "unavailable",
            "3d_mesh": "trimesh (via geometry_kernel)",
            "autocad_native": bridge.get("available", False),
        },
        "autocad_bridge": bridge,
        "capabilities": [
            "polygon_area_centroid",
            "point_in_polygon",
            "polyline_length_bulge",
            "matrix_transform",
            "plane_projection",
            "region_boolean_2d",
            "wall_footprint",
            "mesh_boolean_3d",
        ],
    }
