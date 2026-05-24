"""Verify IFC geometry pipeline (IfcOpenShell + quantity math)."""

from __future__ import annotations

import sys


def main() -> int:
    passed = 0
    failed = 0

    def ok(name: str) -> None:
        nonlocal passed
        passed += 1
        print(f"  PASS  {name}")

    def fail(name: str, detail: str = "") -> None:
        nonlocal failed
        failed += 1
        print(f"  FAIL  {name}" + (f" — {detail}" if detail else ""))

    print("Geometry pipeline verification\n")

    # Volume of unit cube (2x2x2 triangulated box)
    from bim.ifc_geometry import _mesh_volume, _mesh_area, HAS_IFCOPENSHELL

    verts = [
        0, 0, 0, 2, 0, 0, 2, 2, 0, 0, 2, 0,
        0, 0, 2, 2, 0, 2, 2, 2, 2, 0, 2, 2,
    ]
    faces = [
        0, 1, 2, 0, 2, 3,
        4, 6, 5, 4, 7, 6,
        0, 4, 5, 0, 5, 1,
        2, 6, 7, 2, 7, 3,
        0, 3, 7, 0, 7, 4,
        1, 5, 6, 1, 6, 2,
    ]
    vol = _mesh_volume(verts, faces)
    area = _mesh_area(verts, faces)
    if abs(vol - 8.0) < 0.01:
        ok("unit cube volume = 8 m³")
    else:
        fail("unit cube volume", f"got {vol}")

    if abs(area - 24.0) < 0.05:
        ok("unit cube surface area = 24 m²")
    else:
        fail("unit cube surface area", f"got {area}")

    if HAS_IFCOPENSHELL:
        ok("IfcOpenShell available")
    else:
        fail("IfcOpenShell available", "pip install ifcopenshell")

    from bim.geometry_kernel import HAS_TRIMESH

    if HAS_TRIMESH:
        ok("trimesh available (optional CAD kernel)")
    else:
        print("  SKIP  trimesh (optional — pip install trimesh for booleans)")

    try:
        from bim.ifc_to_boq import map_element_to_boq

        mapped = map_element_to_boq(
            {
                "type": "IfcSlab",
                "name": "Test Slab",
                "globalId": "SLAB-1",
                "volume": 12.5,
                "area": 80.0,
                "length": 10,
                "width": 8,
                "height": 0.175,
            }
        )
        if mapped["items"] and mapped["items"][0]["quantity"] == 12.5:
            ok("BoQ uses solid volume from BIM element")
        else:
            fail("BoQ uses solid volume", str(mapped))
    except Exception as exc:
        fail("BoQ mapping", str(exc))

    print(f"\nResult: {passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
