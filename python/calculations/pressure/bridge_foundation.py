"""Bridge foundation and pile group pressure distribution."""

from __future__ import annotations

import math
from typing import Any

from calculations.utils.formatters import round_value
from calculations.pressure._common import finish, step


def calculate_bridge_foundation(payload: dict[str, Any]) -> dict[str, Any]:
    n = float(payload.get("N", 2000))
    mx = float(payload.get("Mx", 0))
    my = float(payload.get("My", 0))
    n_piles = int(payload.get("n_piles", 4))
    xi = [float(x) for x in (payload.get("xi") or [-1, 1, -1, 1])]
    yi = [float(y) for y in (payload.get("yi") or [-1, 1, 1, -1])]
    sum_x2 = sum(x * x for x in xi)
    sum_y2 = sum(y * y for y in yi)
    loads = []
    for x, y in zip(xi, yi):
        q_p = n / n_piles
        if sum_x2 > 0:
            q_p += mx * x / sum_x2
        if sum_y2 > 0:
            q_p += my * y / sum_y2
        loads.append(q_p)
    q_max = max(loads)
    q_min = min(loads)

    steps = [
        step(1, "Pile load distribution", "Q = N/n ± M·x/Σx²", f"n={n_piles}", f"Q_max={round_value(q_max,1)}; Q_min={round_value(q_min,1)} kN", "kN", "Pile group"),
    ]

    diagram = {
        "type": "contour",
        "points": [{"pile": i + 1, "load_kN": round_value(l, 1)} for i, l in enumerate(loads)],
        "labels": [f"Max pile = {round_value(q_max,1)} kN"],
        "resultant": {"value": n, "location": "group", "unit": "kN"},
    }

    return finish({"pile_loads_kN": [round_value(l, 1) for l in loads], "q_max_kN": round_value(q_max, 1), "q_min_kN": round_value(q_min, 1)}, steps, diagram)
