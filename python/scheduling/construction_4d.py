"""4D/5D construction schedule from BIM quantities + cost phasing."""

from __future__ import annotations

from typing import Any

# Typical construction sequence by IFC type (week offsets)
SEQUENCE_ORDER = {
    "IfcFooting": 0,
    "IfcFoundation": 0,
    "IfcColumn": 2,
    "IfcBeam": 4,
    "IfcWall": 3,
    "IfcSlab": 5,
    "IfcRoof": 7,
    "IfcDoor": 8,
    "IfcWindow": 8,
    "IfcStair": 6,
    "IfcCovering": 9,
}

UNIT_COST_USD = {
    "IfcWall": 85,
    "IfcSlab": 120,
    "IfcBeam": 150,
    "IfcColumn": 180,
    "IfcFooting": 95,
    "IfcFoundation": 95,
    "IfcRoof": 65,
    "IfcDoor": 200,
    "IfcWindow": 180,
}


def build_schedule_from_bim(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Build 4D timeline + 5D cost phasing from BIM element list.
    elements: [{type, name, volume?, area?, length?}]
    """
    elements = payload.get("elements", [])
    project_name = payload.get("project_name", "Project")
    duration_weeks = int(payload.get("duration_weeks", 52))
    start_week = 0

    activities: list[dict[str, Any]] = []
    total_cost = 0.0

    grouped: dict[str, list[dict]] = {}
    for el in elements:
        etype = el.get("type", "IfcBuildingElementProxy")
        grouped.setdefault(etype, []).append(el)

    for etype, group in sorted(grouped.items(), key=lambda x: SEQUENCE_ORDER.get(x[0], 99)):
        week = start_week + SEQUENCE_ORDER.get(etype, 5)
        vol = sum(float(e.get("volume") or 0) for e in group)
        area = sum(float(e.get("area") or 0) for e in group)
        qty = vol if vol > 0 else area if area > 0 else len(group)
        unit = "m³" if vol > 0 else "m²" if area > 0 else "nr"
        rate = UNIT_COST_USD.get(etype, 100)
        cost = qty * rate
        total_cost += cost
        duration = max(1, min(8, int(len(group) / 3) + 1))

        activities.append({
            "id": etype,
            "name": f"{etype.replace('Ifc', '')} — {len(group)} elements",
            "ifc_type": etype,
            "start_week": week,
            "duration_weeks": duration,
            "quantity": round(qty, 2),
            "unit": unit,
            "cost_usd": round(cost, 2),
            "element_count": len(group),
            "element_ids": [str(e.get("globalId") or e.get("id") or f"{etype}-{i}") for i, e in enumerate(group)],
        })

    # S-curve cost phasing (logistic cumulative)
    import math

    weeks = list(range(duration_weeks + 1))
    planned_cost: list[float] = []
    for w in weeks:
        t = w / max(duration_weeks, 1)
        s = 1 / (1 + math.exp(-10 * (t - 0.5)))
        planned_cost.append(round(total_cost * s, 2))

    return {
        "status": "complete",
        "project_name": project_name,
        "duration_weeks": duration_weeks,
        "activities": activities,
        "total_cost_usd": round(total_cost, 2),
        "cost_s_curve": {
            "weeks": weeks,
            "cumulative_cost_usd": planned_cost,
        },
        "bim_element_count": len(elements),
        "engine": "construction_4d",
    }
