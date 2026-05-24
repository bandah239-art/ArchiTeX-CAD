"""Compile extracted quantities into a priced Bill of Quantities."""

from datetime import datetime, timezone
from typing import Any

from boq.materials_database import EXCHANGE_RATES, get_material, get_rate, get_wastage

SECTION_TITLES = {
    "A": "SECTION A — SUBSTRUCTURE",
    "B": "SECTION B — SUPERSTRUCTURE — FRAME",
    "C": "SECTION C — SUPERSTRUCTURE — FLOORS",
    "D": "SECTION D — SUPERSTRUCTURE — ROOF",
    "E": "SECTION E — EXTERNAL WORKS",
}


def _price_item(material_id: str, quantity: float, country_code: str) -> dict[str, Any]:
    material = get_material(material_id)
    if not material:
        return {
            "material_id": material_id,
            "description": material_id,
            "unit": "item",
            "quantity": quantity,
            "rate_min": 0,
            "rate_max": 0,
            "rate_mid": 0,
            "amount_min": 0,
            "amount_max": 0,
            "amount_mid": 0,
        }

    wastage = get_wastage(material_id)
    qty = quantity * wastage
    rates = material["rates"].get(country_code.upper(), material["rates"].get("ZM", {"min": 0, "max": 0}))
    rate_min = rates["min"]
    rate_max = rates["max"]
    rate_mid = (rate_min + rate_max) / 2

    return {
        "material_id": material_id,
        "description": material["description"],
        "unit": material["unit"],
        "category": material.get("category", ""),
        "quantity": round(qty, 2),
        "rate_min": rate_min,
        "rate_max": rate_max,
        "rate_mid": round(rate_mid, 2),
        "amount_min": round(qty * rate_min, 2),
        "amount_max": round(qty * rate_max, 2),
        "amount_mid": round(qty * rate_mid, 2),
    }


def compile_boq(payload: dict[str, Any]) -> dict[str, Any]:
    country_code = payload.get("country_code", "ZM").upper()
    overhead_pct = payload.get("contractor_overhead", 15) / 100
    profit_pct = payload.get("contractor_profit", 10) / 100
    contingency_pct = payload.get("contingency", 10) / 100
    currency_display = payload.get("currency_display", "USD")
    elements = payload.get("elements", [])

    sections: dict[str, list[dict[str, Any]]] = {k: [] for k in SECTION_TITLES}
    line_no = 0

    for element in elements:
        section = element.get("section", "A")
        if section not in sections:
            section = "A"
        ref = element.get("ref", "")
        desc = element.get("description", "Element")
        for item in element.get("items", []):
            line_no += 1
            priced = _price_item(item["material_id"], item["quantity"], country_code)
            priced["line_no"] = line_no
            priced["element_ref"] = ref
            priced["element_description"] = desc
            priced["notes"] = item.get("notes", "")
            sections[section].append(priced)

    section_totals: dict[str, dict[str, float]] = {}
    for key, lines in sections.items():
        section_totals[key] = {
            "min": round(sum(l["amount_min"] for l in lines), 2),
            "max": round(sum(l["amount_max"] for l in lines), 2),
            "mid": round(sum(l["amount_mid"] for l in lines), 2),
        }

    construction_min = sum(v["min"] for v in section_totals.values())
    construction_max = sum(v["max"] for v in section_totals.values())
    construction_mid = sum(v["mid"] for v in section_totals.values())

    overhead_min = construction_min * overhead_pct
    overhead_max = construction_max * overhead_pct
    overhead_mid = construction_mid * overhead_pct

    profit_min = construction_min * profit_pct
    profit_max = construction_max * profit_pct
    profit_mid = construction_mid * profit_pct

    subtotal_min = construction_min + overhead_min + profit_min
    subtotal_max = construction_max + overhead_max + profit_max
    subtotal_mid = construction_mid + overhead_mid + profit_mid

    contingency_min = subtotal_min * contingency_pct
    contingency_max = subtotal_max * contingency_pct
    contingency_mid = subtotal_mid * contingency_pct

    total_min = subtotal_min + contingency_min
    total_max = subtotal_max + contingency_max
    total_mid = subtotal_mid + contingency_mid

    fx = EXCHANGE_RATES.get(country_code, EXCHANGE_RATES["ZM"])
    local_currency = fx["currency"]
    fx_rate = float(fx["rate"])

    return {
        "status": "complete",
        "project_id": payload.get("project_id", ""),
        "project_name": payload.get("project_name", "Untitled Project"),
        "client": payload.get("client", ""),
        "country_code": country_code,
        "currency_display": currency_display,
        "sections": sections,
        "section_titles": SECTION_TITLES,
        "section_totals": section_totals,
        "summary": {
            "construction_cost_usd": round(construction_mid, 2),
            "construction_cost_range_usd": [round(construction_min, 2), round(construction_max, 2)],
            "overhead_usd": round(overhead_mid, 2),
            "profit_usd": round(profit_mid, 2),
            "subtotal_usd": round(subtotal_mid, 2),
            "contingency_usd": round(contingency_mid, 2),
            "total_project_estimate_usd": round(total_mid, 2),
            "total_project_range_usd": [round(total_min, 2), round(total_max, 2)],
            "local_currency": local_currency,
            "exchange_rate": fx_rate,
            "total_local_currency": round(total_mid * fx_rate, 2),
            "total_local_range": [round(total_min * fx_rate, 2), round(total_max * fx_rate, 2)],
        },
        "disclaimer": (
            "Rates are indicative. Based on African market data. "
            "Obtain competitive tenders before committing to contract."
        ),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
