"""Server-side IFC geometry parsing via IfcOpenShell."""

from __future__ import annotations

import math
from typing import Any

try:
    import ifcopenshell
    import ifcopenshell.geom
    import ifcopenshell.util.element as element_util

    HAS_IFCOPENSHELL = True
except ImportError:
    HAS_IFCOPENSHELL = False


def _mesh_volume(verts: list[float], faces: list[int]) -> float:
    """Signed volume from triangulated mesh (verts flat xyz, faces flat indices)."""
    volume = 0.0
    for i in range(0, len(faces), 3):
        i0, i1, i2 = faces[i] * 3, faces[i + 1] * 3, faces[i + 2] * 3
        ax, ay, az = verts[i0], verts[i0 + 1], verts[i0 + 2]
        bx, by, bz = verts[i1], verts[i1 + 1], verts[i1 + 2]
        cx, cy, cz = verts[i2], verts[i2 + 1], verts[i2 + 2]
        volume += (
            ax * (by * cz - bz * cy)
            + ay * (bz * cx - bx * cz)
            + az * (bx * cy - by * cx)
        ) / 6.0
    return abs(volume)


def _mesh_area(verts: list[float], faces: list[int]) -> float:
    area = 0.0
    for i in range(0, len(faces), 3):
        i0, i1, i2 = faces[i] * 3, faces[i + 1] * 3, faces[i + 2] * 3
        ax, ay, az = verts[i0], verts[i0 + 1], verts[i0 + 2]
        bx, by, bz = verts[i1], verts[i1 + 1], verts[i1 + 2]
        cx, cy, cz = verts[i2], verts[i2 + 1], verts[i2 + 2]
        ab = (bx - ax, by - ay, bz - az)
        ac = (cx - ax, cy - ay, cz - az)
        cross = (
            ab[1] * ac[2] - ab[2] * ac[1],
            ab[2] * ac[0] - ab[0] * ac[2],
            ab[0] * ac[1] - ab[1] * ac[0],
        )
        area += 0.5 * math.sqrt(cross[0] ** 2 + cross[1] ** 2 + cross[2] ** 2)
    return area


def _bbox_dims(verts: list[float]) -> tuple[float, float, float]:
    xs = verts[0::3]
    ys = verts[1::3]
    zs = verts[2::3]
    if not xs:
        return 0.0, 0.0, 0.0
    dx = max(xs) - min(xs)
    dy = max(ys) - min(ys)
    dz = max(zs) - min(zs)
    dims = sorted([dx, dy, dz], reverse=True)
    return dims[0], dims[1], dims[2]


def _qto_from_element(product: Any) -> dict[str, float]:
    props: dict[str, float] = {}
    try:
        for qto in element_util.get_psets(product, qtos_only=True).values():
            for key, val in qto.items():
                if isinstance(val, (int, float)) and val > 0:
                    props[key] = float(val)
    except Exception:
        pass
    return props


def parse_ifc_file(path: str) -> dict[str, Any]:
    """Parse IFC file path and return elements with solid-derived quantities."""
    if not HAS_IFCOPENSHELL:
        return {
            "status": "error",
            "error": "IfcOpenShell not installed. Run: pip install ifcopenshell",
            "elements": [],
            "engine": "none",
        }

    model = ifcopenshell.open(path)
    settings = ifcopenshell.geom.settings()
    settings.set(settings.USE_WORLD_COORDS, True)

    elements: list[dict[str, Any]] = []
    triangle_count = 0

    for product in model.by_type("IfcProduct"):
        if not getattr(product, "Representation", None):
            continue
        try:
            shape = ifcopenshell.geom.create_shape(settings, product)
        except Exception:
            continue

        geom = shape.geometry
        verts = list(geom.verts)
        faces = list(geom.faces)
        if len(faces) < 3:
            continue

        volume = _mesh_volume(verts, faces)
        area = _mesh_area(verts, faces)
        length, width, height = _bbox_dims(verts)
        qto = _qto_from_element(product)

        if qto.get("NetVolume") or qto.get("Volume"):
            volume = float(qto.get("NetVolume") or qto.get("Volume"))
        if qto.get("NetArea") or qto.get("Area"):
            area = float(qto.get("NetArea") or qto.get("Area"))
        if qto.get("Length"):
            length = float(qto["Length"])

        triangle_count += len(faces) // 3
        elements.append(
            {
                "id": str(product.id()),
                "globalId": product.GlobalId,
                "type": product.is_a(),
                "name": getattr(product, "Name", None) or product.is_a(),
                "length": round(length, 4),
                "width": round(width, 4),
                "height": round(height, 4),
                "volume": round(volume, 4),
                "area": round(area, 4),
                "properties": qto,
                "triangle_count": len(faces) // 3,
            }
        )

    return {
        "status": "complete",
        "engine": "ifcopenshell",
        "element_count": len(elements),
        "triangle_count": triangle_count,
        "elements": elements,
    }


def parse_ifc_bytes(data: bytes) -> dict[str, Any]:
    """Parse IFC from uploaded bytes (writes temp file)."""
    if not HAS_IFCOPENSHELL:
        return {
            "status": "error",
            "error": "IfcOpenShell not installed",
            "elements": [],
            "engine": "none",
        }

    import tempfile
    import os

    with tempfile.NamedTemporaryFile(suffix=".ifc", delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    try:
        return parse_ifc_file(tmp_path)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
