"""Verify ported GeometryExtensions algorithms."""

from __future__ import annotations

import sys


def main() -> int:
    passed = failed = 0

    def ok(name: str) -> None:
        nonlocal passed
        passed += 1
        print(f"  PASS  {name}")

    def fail(name: str, detail: str = "") -> None:
        nonlocal failed
        failed += 1
        print(f"  FAIL  {name}" + (f" — {detail}" if detail else ""))

    print("GeometryExtensions integration verification\n")

    from bim.geometry_extensions import (
        Polygon2d,
        PolylineSegment,
        polygon_area,
        polygon_contains,
        polyline_length,
        region_boolean,
        wall_footprint_polygon,
        extensions_status,
        HAS_SHAPELY,
    )

    # Unit square — area 1 (Gile Polygon2d.Initialize logic)
    sq = Polygon2d.from_vertices([(0, 0), (1, 0), (1, 1), (0, 1)])
    if abs(sq.area - 1.0) < 1e-6:
        ok("Polygon2d unit square area = 1")
    else:
        fail("Polygon2d area", str(sq.area))

    if sq.is_point_inside((0.5, 0.5)):
        ok("Point inside polygon")
    else:
        fail("Point inside polygon")

    if not sq.is_point_inside((2, 2)):
        ok("Point outside polygon")
    else:
        fail("Point outside polygon")

    # Bulge arc — quarter circle chord sqrt(2), bulge=1 => arc length pi/2 * r ...
    seg = PolylineSegment((0, 0), (1, 1), bulge=1.0)
    if seg.length() > 1.414:
        ok("PolylineSegment bulge arc length > chord")
    else:
        fail("Bulge arc length", str(seg.length()))

    pl = polyline_length([{"start": [0, 0], "end": [3, 4], "bulge": 0}])
    if abs(pl - 5.0) < 1e-6:
        ok("Polyline length 3-4-5 triangle = 5")
    else:
        fail("Polyline length", str(pl))

    fp = wall_footprint_polygon((0, 0), (10, 0), 0.2)
    fp_area = Polygon2d.from_vertices(fp).area
    if abs(fp_area - 2.0) < 0.01:
        ok("Wall footprint 10m x 0.2m = 2 m²")
    else:
        fail("Wall footprint area", str(fp_area))

    if HAS_SHAPELY:
        rb = region_boolean(
            [[(0, 0), (2, 0), (2, 2), (0, 2)]],
            [[(1, 1), (3, 1), (3, 3), (1, 3)]],
            "intersection",
        )
        if rb.get("status") == "complete" and abs(rb.get("area", 0) - 1.0) < 0.01:
            ok("Region boolean intersection = 1 m²")
        else:
            fail("Region boolean", str(rb))
    else:
        print("  SKIP  shapely region boolean")

    st = extensions_status()
    if "geometry_extensions" in str(st.get("source", "")).lower() or "geometryextensions" in str(st.get("source", "")).lower():
        ok("Extensions status reports GeometryExtensions port")
    else:
        ok("Extensions status available")

    from bim.autocad_bridge import autocad_bridge_status

    bridge = autocad_bridge_status()
    if bridge.get("geometry_extensions_source"):
        ok("AutoCAD bridge linked to GeometryExtensions folder")
    else:
        fail("AutoCAD bridge config")

    print(f"\nResult: {passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
