"""Foundation bearing pressure — office standard: structural linear (Foundation calculator)."""

from __future__ import annotations

from typing import Any, Literal

from calculations.utils.formatters import round_value
from calculations.pressure._common import depth_table, finish, step

# Office standard — matches python/calculations/structural/foundation.py steps 8–9
OFFICE_STANDARD: Literal["structural_linear"] = "structural_linear"
BearingMethod = Literal["structural_linear", "corner_biaxial"]


def _structural_linear(q_avg: float, mx: float, my: float, b: float, l: float) -> dict[str, float]:
    q_mx = 6 * mx / (l * b * b) if l * b * b > 0 else 0.0
    q_my = 6 * my / (b * l * l) if b * l * l > 0 else 0.0
    return {
        "q_max": q_avg + q_mx + q_my,
        "q_min": q_avg - q_mx - q_my,
        "q_mx": q_mx,
        "q_my": q_my,
    }


def _corner_biaxial(q_avg: float, mx: float, my: float, b: float, l: float) -> dict[str, float]:
    zx = b * b * l / 6.0
    zy = l * l * b / 6.0
    q_mx = mx / zx if zx > 0 else 0.0
    q_my = my / zy if zy > 0 else 0.0
    corners = [
        q_avg + q_mx + q_my,
        q_avg + q_mx - q_my,
        q_avg - q_mx + q_my,
        q_avg - q_mx - q_my,
    ]
    return {"q_max": max(corners), "q_min": min(corners), "zx": zx, "zy": zy}


def _resolve_method(payload: dict[str, Any]) -> BearingMethod:
    raw = str(payload.get("bearing_method", payload.get("method", OFFICE_STANDARD))).lower()
    if raw in ("corner", "biaxial", "corner_biaxial"):
        return "corner_biaxial"
    # both / legacy / default → office standard
    return "structural_linear"


def calculate_foundation_bearing(payload: dict[str, Any]) -> dict[str, Any]:
    n = float(payload.get("N", payload.get("vertical_load", 1500)))
    mx = float(payload.get("Mx", payload.get("moment_x", 0)))
    my = float(payload.get("My", payload.get("moment_y", 0)))
    b = float(payload.get("B", payload.get("width", 2.5)))
    l = float(payload.get("L", payload.get("length", 3.0)))

    method = _resolve_method(payload)
    a = b * l
    q_avg = n / a if a > 0 else 0.0

    if method == "corner_biaxial":
        r = _corner_biaxial(q_avg, mx, my, b, l)
        pressure_step = step(
            3,
            "Eccentric bearing (biaxial corners)",
            "q = N/A ± Mx/Zx ± My/Zy; Zx = B²L/6; Zy = L²B/6",
            f"Zx={round_value(r['zx'], 3)}; Zy={round_value(r['zy'], 3)}",
            f"q_max={round_value(r['q_max'], 1)}; q_min={round_value(r['q_min'], 1)} kPa",
            "kPa",
            "Pressure blueprint (alternate)",
        )
        ref = "Alternate — biaxial corners"
    else:
        r = _structural_linear(q_avg, mx, my, b, l)
        pressure_step = step(
            3,
            "Eccentric bearing (office standard)",
            "q_max = N/A + 6·Mx/(L·B²) + 6·My/(B·L²)",
            f"q_min = N/A − 6·Mx/(L·B²) − 6·My/(B·L²)",
            f"q_max={round_value(r['q_max'], 1)}; q_min={round_value(r['q_min'], 1)} kPa",
            "kPa",
            "Foundation calculator / EC7",
        )
        ref = "Office standard — structural linear"

    q_max, q_min = r["q_max"], r["q_min"]
    tension = q_min < 0
    ex = abs(mx) / n if n > 0 else 0.0
    ey = abs(my) / n if n > 0 else 0.0
    kern_ok = ex <= b / 6.0 and ey <= l / 6.0

    steps = [
        step(1, "Foundation area", "A = B × L", f"A = {b} × {l}", f"A = {round_value(a, 3)} m²", "m²", "Foundation bearing"),
        step(2, "Average bearing pressure", "q_avg = N / A", f"q_avg = {n} / {a}", f"q_avg = {round_value(q_avg, 1)} kPa", "kPa", "Foundation bearing"),
        pressure_step,
        step(
            4,
            "Kern check",
            "e_x,max = B/6; e_y,max = L/6",
            f"ex={round_value(ex, 3)}m; ey={round_value(ey, 3)}m",
            "OK" if kern_ok and not tension else "TENSION — redesign",
            "",
            "Foundation bearing",
            "pass" if kern_ok and not tension else "fail",
        ),
    ]

    warnings: list[str] = []
    errors: list[str] = []
    status = "pass"
    if tension:
        status = "fail"
        errors.append("q_min < 0 — foundation lifts off; partial bearing or redesign required")
    elif not kern_ok:
        warnings.append("Eccentricity exceeds kern — verify reduced contact area")

    diagram_type = "trapezoidal" if abs(q_max - q_min) > 1 else "uniform"
    diagram = {
        "type": diagram_type,
        "points": [
            {"x": 0, "y": 0, "pressure": round_value(q_min, 1)},
            {"x": b, "y": 0, "pressure": round_value(q_max, 1)},
            {"x": b, "y": l, "pressure": round_value(q_max, 1)},
            {"x": 0, "y": l, "pressure": round_value(q_min, 1)},
        ],
        "labels": [
            f"q_max = {round_value(q_max, 1)} kPa",
            f"q_min = {round_value(q_min, 1)} kPa",
            f"q_avg = {round_value(q_avg, 1)} kPa",
            ref,
        ],
        "resultant": {"value": n, "location": "centroid", "unit": "kN"},
        "foundation": {"B": b, "L": l},
    }

    return finish(
        {
            "q_avg_kpa": round_value(q_avg, 1),
            "q_max_kpa": round_value(q_max, 1),
            "q_min_kpa": round_value(q_min, 1),
            "tension": tension,
            "kern_ok": kern_ok and not tension,
            "bearing_method": method,
            "office_standard": OFFICE_STANDARD,
            "depth_table": depth_table([(0, q_max, "OK" if not tension else "FAIL")]),
        },
        steps,
        diagram,
        warnings=warnings,
        errors=errors,
        status=status,
    )
