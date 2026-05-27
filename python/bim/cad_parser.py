"""Parse DXF/DWG CAD drawings into mesh payloads for the BIM viewer (ezdxf)."""

from __future__ import annotations

import math
import os
import shutil
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any

try:
    import ezdxf
    from ezdxf.entities import (
        Arc,
        Circle,
        Insert,
        Line,
        LWPolyline,
        Mesh,
        Polyface,
        Polyline,
        Solid,
        Spline,
        Face3d,
    )
    from ezdxf.math import Matrix44, Vec3

    HAS_EZDXF = True
except ImportError:
    HAS_EZDXF = False

MAX_ENTITIES = 8_000
MAX_LINE_SEGMENTS = 200_000
LINE_RADIUS = 0.05  # fallback — overridden adaptively per drawing

LayerBuckets = dict[str, tuple[list[float], list[int]]]


def _adaptive_radius(doc) -> float:
    """Return a line ribbon radius proportional to the drawing's own extents.

    DWG files can use any unit (mm, cm, m, ft …).  A fixed 0.05 m radius is
    sub-pixel when the drawing spans tens of thousands of millimetres.  We read
    the DXF header extents and pick a radius that is ~0.3 % of the larger
    dimension, clamped to at least LINE_RADIUS.
    """
    try:
        extmin = doc.header.get('$EXTMIN')  # Vec3 or None
        extmax = doc.header.get('$EXTMAX')  # Vec3 or None
        if extmin is not None and extmax is not None:
            dx = abs(extmax.x - extmin.x)
            dy = abs(extmax.y - extmin.y)
            extent = max(dx, dy, 0.0)
            if extent > 1.0:
                return max(extent * 0.003, LINE_RADIUS)
    except Exception:
        pass
    return LINE_RADIUS

_oda_exe_cached: str | None = None


def _find_oda_executable() -> str | None:
    """Locate ODA File Converter (versioned install folders are common on Windows)."""
    global _oda_exe_cached
    if _oda_exe_cached and os.path.isfile(_oda_exe_cached):
        return _oda_exe_cached

    candidates: list[str] = []
    for name in ("ODAFileConverter", "ODAFileConverter.exe"):
        found = shutil.which(name)
        if found:
            candidates.append(found)

    if HAS_EZDXF:
        try:
            from ezdxf.addons.odafc import get_win_exec_path

            default = get_win_exec_path()
            if default:
                candidates.append(default)
        except Exception:
            pass

    if os.name == "nt":
        for env_key in ("ProgramFiles", "ProgramFiles(x86)"):
            base = os.environ.get(env_key)
            if not base:
                continue
            oda_root = Path(base) / "ODA"
            if oda_root.is_dir():
                for exe in sorted(oda_root.glob("**/ODAFileConverter.exe"), reverse=True):
                    candidates.append(str(exe))

    for path in candidates:
        if path and os.path.isfile(path):
            _oda_exe_cached = path
            return path
    return None


def _ensure_oda_configured() -> bool:
    """Point ezdxf odafc at the real ODA install path, then verify is_installed()."""
    if not HAS_EZDXF:
        return False
    try:
        from ezdxf.addons import odafc

        if odafc.is_installed():
            return True
        exe = _find_oda_executable()
        if not exe:
            return False
        ezdxf.options.set("odafc-addon", "win_exec_path", exe)
        return odafc.is_installed()
    except Exception:
        return False


def _cad_status() -> dict[str, Any]:
    oda = _ensure_oda_configured()
    oda_exe = _find_oda_executable() if oda else None
    return {
        "ezdxf": HAS_EZDXF,
        "oda_file_converter": oda,
        "oda_executable": oda_exe,
        "dwg_hint": (
            "Install ODA File Converter (free) for native DWG read, "
            "or save as DXF from AutoCAD."
        ),
    }


def _viewer_xyz(x: float, y: float, z: float) -> tuple[float, float, float]:
    """AutoCAD Z-up → viewer Y-up (matches IFC viewer convention)."""
    return (float(x), float(z), float(y))


def _transform_point(m: Matrix44, x: float, y: float, z: float) -> tuple[float, float, float]:
    v = m.transform(Vec3(x, y, z))
    return _viewer_xyz(v.x, v.y, v.z)


def _tri_indices(base: int) -> tuple[int, int, int, int, int, int]:
    return (base, base + 1, base + 2, base, base + 2, base + 3)


def _push_quad(
    verts: list[float],
    faces: list[int],
    p0: tuple[float, float, float],
    p1: tuple[float, float, float],
    p2: tuple[float, float, float],
    p3: tuple[float, float, float],
) -> None:
    base = len(verts) // 3
    for p in (p0, p1, p2, p3):
        verts.extend(p)
    i0, i1, i2, i3, i4, i5 = _tri_indices(base)
    faces.extend((i0, i1, i2, i3, i4, i5))


def _push_triangle(
    verts: list[float],
    faces: list[int],
    a: tuple[float, float, float],
    b: tuple[float, float, float],
    c: tuple[float, float, float],
) -> None:
    base = len(verts) // 3
    verts.extend((*a, *b, *c))
    faces.extend((base, base + 1, base + 2))


def _line_ribbon(
    verts: list[float],
    faces: list[int],
    p0: tuple[float, float, float],
    p1: tuple[float, float, float],
    radius: float = LINE_RADIUS,
) -> None:
    """Thin quad along a segment — 2 triangles (fast for batched linework)."""
    dx, dy, dz = p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]
    length = math.sqrt(dx * dx + dy * dy + dz * dz)
    if length < 1e-9:
        return
    ux, uy, uz = dx / length, dy / length, dz / length
    if abs(uz) < 0.9:
        px, py, pz = -uz, 0.0, ux
    else:
        px, py, pz = 0.0, 1.0, 0.0
    plen = math.sqrt(px * px + py * py + pz * pz) or 1.0
    px, py, pz = px / plen * radius, py / plen * radius, pz / plen * radius
    _push_quad(
        verts,
        faces,
        (p0[0] - px, p0[1] - py, p0[2] - pz),
        (p0[0] + px, p0[1] + py, p0[2] + pz),
        (p1[0] + px, p1[1] + py, p1[2] + pz),
        (p1[0] - px, p1[1] - py, p1[2] - pz),
    )


def _line_tube(
    verts: list[float],
    faces: list[int],
    p0: tuple[float, float, float],
    p1: tuple[float, float, float],
    radius: float = LINE_RADIUS,
) -> None:
    dx, dy, dz = p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]
    length = math.sqrt(dx * dx + dy * dy + dz * dz)
    if length < 1e-9:
        return
    # Build a thin box aligned on segment (approximation — fast & stable)
    ux, uy, uz = dx / length, dy / length, dz / length
    if abs(uz) < 0.9:
        px, py, pz = uy * 0 - uz * 1, uz * 0 - ux * 0, ux * 1 - uy * 0
    else:
        px, py, pz = 1.0, 0.0, 0.0
    plen = math.sqrt(px * px + py * py + pz * pz) or 1.0
    px, py, pz = px / plen * radius, py / plen * radius, pz / plen * radius
    qx, qy, qz = uy * pz - uz * py, uz * px - ux * pz, ux * py - uy * px
    corners = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            ox = px * sx + qx * sy
            oy = py * sx + qy * sy
            oz = pz * sx + qz * sy
            corners.append((p0[0] + ox, p0[1] + oy, p0[2] + oz))
            corners.append((p1[0] + ox, p1[1] + oy, p1[2] + oz))
    # 8 corners: 0-3 at p0 side, 4-7 at p1 — reorder as box
    c0, c1, c2, c3, c4, c5, c6, c7 = corners
    _push_quad(verts, faces, c0, c2, c6, c4)
    _push_quad(verts, faces, c1, c5, c7, c3)
    _push_quad(verts, faces, c0, c1, c5, c4)
    _push_quad(verts, faces, c2, c6, c7, c3)
    _push_quad(verts, faces, c0, c4, c5, c1)
    _push_quad(verts, faces, c2, c3, c7, c6)


def _arc_points(arc: Arc, segments: int = 24) -> list[tuple[float, float, float]]:
    center = arc.dxf.center
    radius = float(arc.dxf.radius)
    start = math.radians(float(arc.dxf.start_angle))
    end = math.radians(float(arc.dxf.end_angle))
    if end < start:
        end += 2 * math.pi
    pts: list[tuple[float, float, float]] = []
    for i in range(segments + 1):
        t = start + (end - start) * (i / segments)
        x = center.x + radius * math.cos(t)
        y = center.y + radius * math.sin(t)
        z = center.z if hasattr(center, "z") else 0.0
        pts.append(_viewer_xyz(x, y, z))
    return pts


def _circle_points(circle: Circle, segments: int = 32) -> list[tuple[float, float, float]]:
    center = circle.dxf.center
    radius = float(circle.dxf.radius)
    z = center.z if hasattr(center, "z") else 0.0
    pts: list[tuple[float, float, float]] = []
    for i in range(segments + 1):
        t = 2 * math.pi * i / segments
        pts.append(_viewer_xyz(center.x + radius * math.cos(t), center.y + radius * math.sin(t), z))
    return pts


def _polyline_points(entity: LWPolyline | Polyline, elevation: float = 0.0) -> list[tuple[float, float, float]]:
    pts: list[tuple[float, float, float]] = []
    if isinstance(entity, LWPolyline):
        for x, y, *_ in entity.get_points("xy"):
            pts.append(_viewer_xyz(float(x), float(y), elevation))
        return pts
    for v in entity.vertices:
        loc = v.dxf.location
        z = getattr(loc, "z", elevation)
        pts.append(_viewer_xyz(loc.x, loc.y, z))
    return pts


def _face3d_mesh(entity: Face3d, matrix: Matrix44) -> tuple[list[float], list[int]] | None:
    verts: list[float] = []
    faces: list[int] = []
    raw = [
        entity.dxf.vtx0,
        entity.dxf.vtx1,
        entity.dxf.vtx2,
        entity.dxf.vtx3,
    ]
    tri_list: list[tuple[tuple[float, float, float], ...]] = []
    v0, v1, v2, v3 = raw
    p0 = _transform_point(matrix, v0.x, v0.y, v0.z)
    p1 = _transform_point(matrix, v1.x, v1.y, v1.z)
    p2 = _transform_point(matrix, v2.x, v2.y, v2.z)
    if v2 == v3:
        tri_list.append((p0, p1, p2))
    else:
        p3 = _transform_point(matrix, v3.x, v3.y, v3.z)
        tri_list.append((p0, p1, p2))
        tri_list.append((p0, p2, p3))
    for tri in tri_list:
        _push_triangle(verts, faces, tri[0], tri[1], tri[2])
    return verts, faces if verts else None


def _mesh_from_entity_mesh(entity: Mesh | Polyface, matrix: Matrix44) -> tuple[list[float], list[int]] | None:
    verts: list[float] = []
    faces: list[int] = []
    try:
        if isinstance(entity, Mesh):
            vert_locs: list[tuple[float, float, float]] = []
            for v in entity.vertices:
                loc = v.dxf.location
                vert_locs.append(_transform_point(matrix, loc.x, loc.y, loc.z))
            for p in vert_locs:
                verts.extend(p)
            for face in entity.faces:
                idx = [abs(int(i)) - 1 for i in face if int(i) != 0]
                if len(idx) >= 3:
                    for i in range(1, len(idx) - 1):
                        faces.extend((idx[0], idx[i], idx[i + 1]))
        else:
            vert_locs = []
            for v in entity.vertices:
                loc = v.dxf.location
                vert_locs.append(_transform_point(matrix, loc.x, loc.y, loc.z))
            for p in vert_locs:
                verts.extend(p)
            for face in entity.faces:
                idx = [abs(int(i)) - 1 for i in face if int(i) != 0]
                if len(idx) >= 3:
                    for i in range(1, len(idx) - 1):
                        faces.extend((idx[0], idx[i], idx[i + 1]))
    except Exception:
        return None
    return (verts, faces) if verts and faces else None


def _layer_bucket(layer_buckets: LayerBuckets, layer: str) -> tuple[list[float], list[int]]:
    if layer not in layer_buckets:
        layer_buckets[layer] = ([], [])
    return layer_buckets[layer]


def _append_linework(
    layer_buckets: LayerBuckets,
    layer: str,
    p0: tuple[float, float, float],
    p1: tuple[float, float, float],
    segment_counter: list[int],
    radius: float = LINE_RADIUS,
) -> None:
    if segment_counter[0] >= MAX_LINE_SEGMENTS:
        return
    verts, faces = _layer_bucket(layer_buckets, layer)
    _line_ribbon(verts, faces, p0, p1, radius)
    segment_counter[0] += 1


def _flush_layer_buckets(
    layer_buckets: LayerBuckets,
    elements: list[dict[str, Any]],
    counter: list[int],
) -> None:
    for layer, (verts, faces) in sorted(layer_buckets.items()):
        if counter[0] >= MAX_ENTITIES:
            break
        if not verts or not faces:
            continue
        counter[0] += 1
        elements.append(
            {
                "id": f"cad-layer-{counter[0]}",
                "expressId": counter[0],
                "globalId": f"cad-layer-{counter[0]}",
                "type": "CadLinework",
                "name": f"{layer}_Linework",
                "layer": layer,
                "entity_type": "LineworkLayer",
                "length": 1.0,
                "width": 1.0,
                "height": LINE_RADIUS * 2,
                "volume": 0.0,
                "area": 0.0,
                "properties": {"Layer": layer, "DXFType": "LineworkLayer"},
                "vertices": verts,
                "faces": faces,
                "triangle_count": len(faces) // 3,
            }
        )


def _process_entity(
    entity: Any,
    matrix: Matrix44,
    elements: list[dict[str, Any]],
    layer_buckets: LayerBuckets,
    counter: list[int],
    segment_counter: list[int],
    warnings: list[str],
    radius: float = LINE_RADIUS,
) -> None:
    if counter[0] >= MAX_ENTITIES and segment_counter[0] >= MAX_LINE_SEGMENTS:
        return
    etype = entity.dxftype()
    layer = str(getattr(entity.dxf, "layer", "0") or "0")
    verts: list[float] = []
    faces: list[int] = []

    if etype == "LINE":
        p0 = _transform_point(matrix, entity.dxf.start.x, entity.dxf.start.y, entity.dxf.start.z)
        p1 = _transform_point(matrix, entity.dxf.end.x, entity.dxf.end.y, entity.dxf.end.z)
        _append_linework(layer_buckets, layer, p0, p1, segment_counter, radius)
        return
    if etype in ("LWPOLYLINE", "POLYLINE"):
        elev = float(getattr(entity.dxf, "elevation", 0) or 0)
        pts = _polyline_points(entity, elev)
        for i in range(len(pts) - 1):
            _append_linework(layer_buckets, layer, pts[i], pts[i + 1], segment_counter, radius)
        if getattr(entity, "closed", False) and len(pts) > 2:
            _append_linework(layer_buckets, layer, pts[-1], pts[0], segment_counter, radius)
        return
    if etype == "CIRCLE":
        pts = _circle_points(entity)
        for i in range(len(pts) - 1):
            _append_linework(layer_buckets, layer, pts[i], pts[i + 1], segment_counter, radius)
        return
    if etype == "ARC":
        pts = _arc_points(entity)
        for i in range(len(pts) - 1):
            _append_linework(layer_buckets, layer, pts[i], pts[i + 1], segment_counter, radius)
        return
    elif etype == "3DFACE":
        mesh = _face3d_mesh(entity, matrix)
        if mesh:
            verts, faces = mesh
    elif etype in ("MESH", "POLYFACE"):
        mesh = _mesh_from_entity_mesh(entity, matrix)
        if mesh:
            verts, faces = mesh
    elif etype == "SOLID":
        try:
            v0, v1, v2, v3 = entity.dxf.vtx0, entity.dxf.vtx1, entity.dxf.vtx2, entity.dxf.vtx3
            p0 = _transform_point(matrix, v0.x, v0.y, v0.z)
            p1 = _transform_point(matrix, v1.x, v1.y, v1.z)
            p2 = _transform_point(matrix, v2.x, v2.y, v2.z)
            _push_triangle(verts, faces, p0, p1, p2)
            if v2 != v3:
                p3 = _transform_point(matrix, v3.x, v3.y, v3.z)
                _push_triangle(verts, faces, p0, p2, p3)
        except Exception:
            pass
    elif etype == "INSERT":
        try:
            for ve in entity.virtual_entities():
                m2 = matrix @ ve.matrix44()
                _process_entity(ve, m2, elements, layer_buckets, counter, segment_counter, warnings, radius)
        except Exception as exc:
            warnings.append(f"Block {entity.dxf.name}: {exc}")
        return
    elif etype == "SPLINE":
        try:
            from ezdxf import path as ezdxf_path

            p = ezdxf_path.make_path(entity)
            pts = [
                _viewer_xyz(v.x, v.y, v.z)
                for v in p.flattening(distance=0.25)
            ]
            for i in range(len(pts) - 1):
                _append_linework(layer_buckets, layer, pts[i], pts[i + 1], segment_counter, radius)
        except Exception:
            pass
        return
    else:
        return

    if not verts or not faces:
        return

    if counter[0] >= MAX_ENTITIES:
        return

    counter[0] += 1
    elements.append(
        {
            "id": f"cad-{counter[0]}",
            "expressId": counter[0],
            "globalId": f"cad-{counter[0]}",
            "type": "CadEntity",
            "name": f"{layer}_{etype}",
            "layer": layer,
            "entity_type": etype,
            "length": 1.0,
            "width": 1.0,
            "height": LINE_RADIUS * 2,
            "volume": 0.0,
            "area": 0.0,
            "properties": {"Layer": layer, "DXFType": etype},
            "vertices": verts,
            "faces": faces,
            "triangle_count": len(faces) // 3,
        }
    )


def _load_doc(path: str):
    if not HAS_EZDXF:
        raise RuntimeError("ezdxf not installed. Run: pip install ezdxf")

    ext = Path(path).suffix.lower()
    if ext == ".dxf":
        return ezdxf.readfile(path)

    if ext == ".dwg":
        if not _ensure_oda_configured():
            raise RuntimeError(
                "DWG requires ODA File Converter. Install from opendesign.com/guestfiles/oda_file_converter "
                "or save as DXF from AutoCAD."
            )
        try:
            from ezdxf.addons import odafc

            return odafc.readfile(path)
        except Exception as exc:
            raise RuntimeError(
                f"DWG read failed: {exc}. Install ODA File Converter or export DXF from AutoCAD."
            ) from exc

    raise ValueError(f"Unsupported CAD extension: {ext}")


def _convert_dwg_via_oda_cli(path: str) -> str | None:
    """Optional: ODAFileConverter CLI → temp DXF path."""
    exe = _find_oda_executable()
    if not exe:
        return None
    out_dir = tempfile.mkdtemp(prefix="architex-dwg-")
    try:
        subprocess.run(
            [exe, str(Path(path).parent), out_dir, "ACAD2018", "DXF", "0", "1", Path(path).name],
            check=True,
            timeout=120,
            capture_output=True,
        )
        dxf_path = Path(out_dir) / (Path(path).stem + ".dxf")
        if dxf_path.is_file():
            return str(dxf_path)
    except Exception:
        return None
    return None


def parse_cad_file(path: str) -> dict[str, Any]:
    if not path or not os.path.isfile(path):
        return {"status": "error", "error": f"File not found: {path or '(empty)'}", "elements": []}

    ext = Path(path).suffix.lower()
    load_path = path
    temp_dxf: str | None = None

    if ext == ".dwg":
        try:
            doc = _load_doc(path)
        except RuntimeError:
            temp_dxf = _convert_dwg_via_oda_cli(path)
            if temp_dxf:
                load_path = temp_dxf
                doc = ezdxf.readfile(load_path)
            else:
                return {
                    "status": "error",
                    "error": (
                        "Cannot read DWG without ODA File Converter. "
                        "Install from opendesign.com/guestfiles/oda_file_converter, "
                        "or save the drawing as DXF."
                    ),
                    "cad": _cad_status(),
                    "elements": [],
                }
    else:
        doc = _load_doc(load_path)

    try:
        t0 = time.perf_counter()
        msp = doc.modelspace()
        elements: list[dict[str, Any]] = []
        layer_buckets: LayerBuckets = {}
        warnings: list[str] = []
        counter = [0]
        segment_counter = [0]
        radius = _adaptive_radius(doc)

        for entity in msp:
            if segment_counter[0] >= MAX_LINE_SEGMENTS:
                warnings.append(f"Stopped at {MAX_LINE_SEGMENTS} line segments for performance.")
                break
            if counter[0] >= MAX_ENTITIES:
                warnings.append(f"Stopped at {MAX_ENTITIES} solid entities for performance.")
                break
            try:
                _process_entity(
                    entity, Matrix44(), elements, layer_buckets, counter, segment_counter, warnings, radius
                )
            except Exception as exc:
                warnings.append(f"{entity.dxftype()}: {exc}")

        if segment_counter[0] >= MAX_LINE_SEGMENTS:
            warnings.append(f"Linework capped at {MAX_LINE_SEGMENTS} segments.")

        _flush_layer_buckets(layer_buckets, elements, counter)

        if not elements:
            return {
                "status": "error",
                "error": "No supported geometry found in drawing (empty or unsupported entities).",
                "cad": _cad_status(),
                "elements": [],
                "warnings": warnings,
            }

        # Bounds in viewer space
        all_x: list[float] = []
        all_y: list[float] = []
        all_z: list[float] = []
        tri_count = 0
        for el in elements:
            v = el.get("vertices") or []
            for i in range(0, len(v), 3):
                all_x.append(v[i])
                all_y.append(v[i + 1])
                all_z.append(v[i + 2])
            tri_count += int(el.get("triangle_count") or 0)

        bounds = {
            "min": [min(all_x), min(all_y), min(all_z)],
            "max": [max(all_x), max(all_y), max(all_z)],
        }

        return {
            "status": "complete",
            "engine": "ezdxf",
            "format": ext.lstrip("."),
            "source_path": path,
            "element_count": len(elements),
            "triangle_count": tri_count,
            "line_segments": segment_counter[0],
            "parse_time_ms": round((time.perf_counter() - t0) * 1000),
            "elements": elements,
            "bounds": bounds,
            "warnings": warnings,
            "cad": _cad_status(),
        }
    finally:
        if temp_dxf and os.path.isfile(temp_dxf):
            try:
                os.unlink(temp_dxf)
            except OSError:
                pass


def parse_cad_bytes(data: bytes, filename: str = "upload.dxf") -> dict[str, Any]:
    suffix = Path(filename).suffix.lower() or ".dxf"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    try:
        return parse_cad_file(tmp_path)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
