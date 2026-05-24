"""Optional CAD kernel — mesh booleans and intersections (server-side)."""

from __future__ import annotations

from typing import Any

from bim.geometry_extensions import region_boolean as region_boolean_2d

try:
    import trimesh
    import numpy as np

    HAS_TRIMESH = True
except ImportError:
    HAS_TRIMESH = False


def _dict_to_mesh(data: dict[str, Any]) -> Any | None:
    if not HAS_TRIMESH:
        return None
    verts = data.get("vertices", [])
    faces = data.get("faces", [])
    if not verts or not faces:
        return None
    return trimesh.Trimesh(
        vertices=np.array(verts).reshape(-1, 3),
        faces=np.array(faces).reshape(-1, 3),
        process=False,
    )


def _mesh_to_dict(mesh: Any) -> dict[str, Any]:
    return {
        "vertices": mesh.vertices.flatten().tolist(),
        "faces": mesh.faces.flatten().tolist(),
        "volume": float(mesh.volume) if mesh.is_volume else 0.0,
        "area": float(mesh.area),
    }


def boolean_operation(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Perform mesh boolean: union | difference | intersection.
    Expects mesh_a and mesh_b as {vertices: flat xyz, faces: flat indices}.
    """
    if not HAS_TRIMESH:
        return {
            "status": "error",
            "error": "trimesh not installed. Run: pip install trimesh",
            "engine": "none",
        }

    op = payload.get("operation", "intersection")
    mesh_a = _dict_to_mesh(payload.get("mesh_a", {}))
    mesh_b = _dict_to_mesh(payload.get("mesh_b", {}))
    if mesh_a is None or mesh_b is None:
        return {"status": "error", "error": "Invalid mesh_a or mesh_b", "engine": "trimesh"}

    try:
        if op == "union":
            result = trimesh.boolean.union([mesh_a, mesh_b], engine="blender")
        elif op == "difference":
            result = trimesh.boolean.difference(mesh_a, mesh_b, engine="blender")
        elif op == "intersection":
            result = trimesh.boolean.intersection(mesh_a, mesh_b, engine="blender")
        else:
            return {"status": "error", "error": f"Unknown operation: {op}", "engine": "trimesh"}

        if result is None:
            return {"status": "error", "error": "Boolean operation returned no geometry", "engine": "trimesh"}

        return {
            "status": "complete",
            "engine": "trimesh",
            "operation": op,
            "result": _mesh_to_dict(result),
        }
    except Exception as exc:
        return {"status": "error", "error": str(exc), "engine": "trimesh"}


def mesh_intersection_volume(payload: dict[str, Any]) -> dict[str, Any]:
    """Return intersection volume between two meshes (m³)."""
    result = boolean_operation({**payload, "operation": "intersection"})
    if result.get("status") != "complete":
        return result
    vol = result.get("result", {}).get("volume", 0.0)
    return {
        "status": "complete",
        "engine": result.get("engine"),
        "intersection_volume_m3": vol,
        "intersection_area_m2": result.get("result", {}).get("area", 0.0),
    }


def region_boolean(payload: dict[str, Any]) -> dict[str, Any]:
    """2D region boolean via ported GeometryExtensions + shapely."""
    return region_boolean_2d(
        payload.get("polygons_a", []),
        payload.get("polygons_b", []),
        payload.get("operation", "intersection"),
    )
