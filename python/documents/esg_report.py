"""ESG / embodied carbon report from BoQ material quantities."""

from __future__ import annotations

from typing import Any

# kg CO2e per unit (indicative embodied carbon factors)
CARBON_FACTORS = {
    "concrete_c25": 350,
    "concrete_c30": 380,
    "brick_clay_standard": 240,
    "block_concrete_150": 280,
    "rebar_h10": 2100,
    "rebar_h16": 2100,
    "ibs_sheets_ibr": 1200,
    "formwork_soffit": 45,
    "formwork_beam_sides": 45,
    "excavation_soft": 12,
}


def generate_esg_report(payload: dict[str, Any]) -> dict[str, Any]:
    """
    payload: { project_name, elements: [{ items: [{material_id, quantity}] }] }
    or { material_totals: { material_id: qty } }
    """
    project_name = payload.get("project_name", "Project")
    totals: dict[str, float] = dict(payload.get("material_totals") or {})

    if not totals:
        for el in payload.get("elements", []):
            for item in el.get("items", []):
                mid = item.get("material_id", "")
                totals[mid] = totals.get(mid, 0) + float(item.get("quantity", 0))

    lines: list[dict[str, Any]] = []
    total_kg = 0.0
    for mid, qty in totals.items():
        factor = CARBON_FACTORS.get(mid, 100)
        kg = qty * factor
        total_kg += kg
        lines.append({
            "material_id": mid,
            "quantity": round(qty, 3),
            "factor_kg_co2e_per_unit": factor,
            "embodied_kg_co2e": round(kg, 1),
        })

    lines.sort(key=lambda x: -x["embodied_kg_co2e"])
    tonnes = total_kg / 1000

    return {
        "status": "complete",
        "project_name": project_name,
        "total_embodied_kg_co2e": round(total_kg, 1),
        "total_embodied_t_co2e": round(tonnes, 2),
        "material_lines": lines,
        "recommendations": [
            "Specify low-carbon concrete (30% GGBS) where structurally acceptable",
            "Source regional materials to reduce transport emissions",
            "Register verified reductions for carbon credit programmes when available",
        ],
        "document_text": (
            f"ESG Embodied Carbon Report — {project_name}\n"
            f"Total embodied carbon: {tonnes:.2f} tCO₂e\n"
            f"Based on {len(lines)} material lines from BoQ quantities."
        ),
    }
