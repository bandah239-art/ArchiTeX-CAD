"""2D plan DXF export fallback when native AutoCAD bridge is unavailable."""

from __future__ import annotations

import base64
from typing import Any


def _rect_polyline(x0: float, y0: float, lx: float, ly: float) -> list[tuple[float, float]]:
    return [
        (x0, y0),
        (x0 + lx, y0),
        (x0 + lx, y0 + ly),
        (x0, y0 + ly),
        (x0, y0),
    ]


def build_plan_dxf(elements: list[dict[str, Any]]) -> str:
    """Minimal ASCII DXF (R12) — element footprints laid out on a grid."""
    polylines: list[tuple[str, list[tuple[float, float]]]] = []
    col = 0
    row_y = 0.0
    row_h = 0.0
    x_cursor = 0.0
    gap = 1.5

    for el in elements:
        etype = str(el.get("type", "IfcElement"))
        name = str(el.get("name", etype))[:40]
        length = max(float(el.get("length") or 1.0), 0.2)
        width = max(float(el.get("width") or 0.2), 0.2)
        pts = _rect_polyline(x_cursor, row_y, length, width)
        polylines.append((name, pts))
        row_h = max(row_h, width)
        x_cursor += length + gap
        col += 1
        if col >= 8:
            col = 0
            row_y += row_h + gap
            row_h = 0.0
            x_cursor = 0.0

    lines = [
        "0", "SECTION", "2", "HEADER", "0", "ENDSEC",
        "0", "SECTION", "2", "ENTITIES",
    ]

    for layer_name, pts in polylines:
        safe_layer = layer_name.replace(" ", "_")[:31] or "ELEMENT"
        for i in range(len(pts) - 1):
            x1, y1 = pts[i]
            x2, y2 = pts[i + 1]
            lines.extend([
                "0", "LINE", "8", safe_layer,
                "10", f"{x1:.4f}", "20", f"{y1:.4f}", "30", "0.0",
                "11", f"{x2:.4f}", "21", f"{y2:.4f}", "31", "0.0",
            ])

    lines.extend(["0", "ENDSEC", "0", "EOF"])
    return "\n".join(lines) + "\n"


def export_plan_dxf_payload(elements: list[dict[str, Any]]) -> dict[str, Any]:
    if not elements:
        return {"status": "error", "error": "No elements to export"}
    dxf = build_plan_dxf(elements)
    return {
        "status": "complete",
        "format": "dxf",
        "source": "plan_fallback",
        "element_count": len(elements),
        "dxf_b64": base64.b64encode(dxf.encode("utf-8")).decode("ascii"),
        "message": "Plan DXF generated (native AutoCAD DWG bridge not available).",
    }
