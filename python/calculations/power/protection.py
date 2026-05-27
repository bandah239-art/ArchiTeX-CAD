"""
IEC 60255-151 IDMT relay grading curves.

Standard inverse (SI):  t = 0.14 × TMS / (M^0.02 − 1)
Very inverse (VI):      t = 13.5 × TMS / (M − 1)
Extremely inverse (EI): t = 80  × TMS / (M^2 − 1)

Where M = I / Iset (multiple of pickup current), M > 1.
"""

from __future__ import annotations

import math
from typing import Any


CURVE_PARAMS = {
    "standard_inverse":   {"alpha": 0.02,  "k": 0.14},
    "very_inverse":       {"alpha": 1.0,   "k": 13.5},
    "extremely_inverse":  {"alpha": 2.0,   "k": 80.0},
}


def idmt_time(M: float, TMS: float, curve: str = "standard_inverse") -> float:
    """Calculate trip time for IDMT relay in seconds."""
    if M <= 1.0:
        return float("inf")
    p = CURVE_PARAMS.get(curve, CURVE_PARAMS["standard_inverse"])
    alpha = p["alpha"]
    k = p["k"]
    return TMS * k / (M ** alpha - 1)


def grading_chart(
    relays: list[dict],
    fault_current_a: float,
    i_range_factor: float = 10.0,
) -> dict[str, Any]:
    """
    Build time-current characteristic data for multiple relays.

    relays: list of {"id":"R1", "pickup_a":100, "tms":0.1, "curve":"standard_inverse"}
    fault_current_a: maximum fault current (A) — shown as vertical dashed line
    Returns trip-time series for log-spaced currents + grading table.
    """
    # Log-spaced current axis
    i_min = min(r["pickup_a"] for r in relays) * 1.01
    i_max = max(fault_current_a, i_min * i_range_factor)
    n_pts = 100
    currents = [i_min * (i_max / i_min) ** (i / (n_pts - 1)) for i in range(n_pts)]

    curves: list[dict] = []
    for relay in relays:
        iset = float(relay["pickup_a"])
        tms = float(relay["tms"])
        curve_type = relay.get("curve", "standard_inverse")
        times = []
        for I in currents:
            M = I / iset
            t = idmt_time(M, tms, curve_type) if M > 1.0 else None
            times.append(round(t, 4) if t is not None and t < 99 else None)
        curves.append({
            "id": relay["id"],
            "label": relay.get("label", relay["id"]),
            "pickup_a": iset,
            "tms": tms,
            "curve": curve_type,
            "times_s": times,
        })

    # Grading table at fault current
    grading_table: list[dict] = []
    for relay in relays:
        iset = float(relay["pickup_a"])
        tms = float(relay["tms"])
        M = fault_current_a / iset
        t = idmt_time(M, tms, relay.get("curve", "standard_inverse"))
        grading_table.append({
            "id": relay["id"],
            "M_at_fault": round(M, 2),
            "trip_time_s": round(t, 4) if t < 99 else ">99",
        })

    # Check grading margins (minimum 0.3 s between consecutive relays at fault current)
    sorted_by_trip = sorted(
        grading_table, key=lambda x: float(x["trip_time_s"]) if isinstance(x["trip_time_s"], float) else 999
    )
    grading_ok = True
    for i in range(1, len(sorted_by_trip)):
        t_prev = sorted_by_trip[i - 1]["trip_time_s"]
        t_curr = sorted_by_trip[i]["trip_time_s"]
        if isinstance(t_prev, float) and isinstance(t_curr, float):
            if t_curr - t_prev < 0.3:
                grading_ok = False

    return {
        "currents_a": [round(I, 2) for I in currents],
        "curves": curves,
        "grading_table": grading_table,
        "fault_current_a": fault_current_a,
        "grading_ok": grading_ok,
        "status": "ok",
    }
