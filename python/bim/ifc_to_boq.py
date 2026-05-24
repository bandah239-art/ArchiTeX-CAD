"""Map IFC/BIM elements to BoQ material quantities."""

from typing import Any

IFC_TO_SECTION = {
    "IfcWall": "B",
    "IfcSlab": "C",
    "IfcBeam": "B",
    "IfcColumn": "B",
    "IfcFooting": "A",
    "IfcFoundation": "A",
    "IfcRoof": "D",
    "IfcDoor": "B",
    "IfcWindow": "B",
    "IfcStair": "B",
    "IfcRailing": "E",
    "IfcCovering": "C",
    "IfcBuildingElementProxy": "B",
}


def _item(material_id: str, qty: float, notes: str = "") -> dict[str, Any]:
    return {"material_id": material_id, "quantity": round(max(qty, 0), 3), "notes": notes}


def _dims(element: dict[str, Any]) -> tuple[float, float, float]:
    props = element.get("properties", {})
    length = float(element.get("length") or props.get("Length") or props.get("length") or 1.0)
    width = float(element.get("width") or props.get("Width") or props.get("width") or 0.2)
    height = float(element.get("height") or props.get("Height") or props.get("depth") or 0.2)
    return length, width, height


def map_element_to_boq(element: dict[str, Any]) -> dict[str, Any]:
    """Convert a single IFC element dict to BoQ line items."""
    etype = element.get("type", "IfcBuildingElementProxy")
    name = element.get("name", etype)
    ref = element.get("globalId") or element.get("id", "EL-001")
    volume = float(element.get("volume") or 0)
    area = float(element.get("area") or 0)
    length, width, height = _dims(element)
    items: list[dict[str, Any]] = []
    section = IFC_TO_SECTION.get(etype, "B")

    if etype in ("IfcWall",):
        if volume <= 0:
            volume = length * width * height
        brick_area = area if area > 0 else length * height
        items = [
            _item("block_concrete_150" if width < 0.16 else "brick_clay_standard", brick_area / 50 if width >= 0.2 else brick_area, f"Wall {name}"),
            _item("plaster_internal", brick_area * 2, "Internal/external plaster both faces"),
        ]
    elif etype in ("IfcSlab", "IfcCovering"):
        if volume <= 0:
            volume = length * width * (height or 0.175)
        slab_area = area if area > 0 else length * width
        items = [
            _item("concrete_c25", volume, f"Slab {name}"),
            _item("formwork_soffit", slab_area, "Slab soffit formwork"),
            _item("rebar_h10", volume * 0.08, "Estimated slab reinforcement"),
        ]
        section = "C"
    elif etype in ("IfcBeam",):
        if volume <= 0:
            volume = length * width * height
        items = [
            _item("concrete_c30", volume, f"Beam {name}"),
            _item("rebar_h16", volume * 0.12, "Beam main steel estimate"),
            _item("formwork_beam_sides", length * (2 * height + width), "Beam formwork"),
        ]
    elif etype in ("IfcColumn",):
        if volume <= 0:
            volume = length * width * height
        items = [
            _item("concrete_c30", volume, f"Column {name}"),
            _item("rebar_h16", volume * 0.15, "Column steel estimate"),
            _item("formwork_column", 2 * (width + height) * length, "Column formwork"),
        ]
    elif etype in ("IfcFooting", "IfcFoundation"):
        if volume <= 0:
            volume = length * width * height
        items = [
            _item("excavation_soft", volume * 1.5, "Foundation excavation"),
            _item("concrete_c25", volume, f"Foundation {name}"),
            _item("rebar_h16", volume * 0.1, "Foundation steel"),
            _item("formwork_foundation", 2 * (length + width) * height, "Foundation formwork"),
        ]
        section = "A"
    elif etype in ("IfcRoof",):
        roof_area = area if area > 0 else length * width
        items = [
            _item("ibs_sheets_ibr", roof_area, f"Roof covering {name}"),
            _item("roof_purlin_50x76", length * 2, "Roof purlins estimate"),
        ]
        section = "D"
    else:
        items = [_item("concrete_c25", max(volume, 0.1), f"Generic element {name}")]

    return {
        "ref": ref[:12],
        "description": f"{etype.replace('Ifc', '')} — {name}",
        "section": section,
        "element_type": "bim",
        "ifc_type": etype,
        "items": items,
        "summary_text": f"{len(items)} material lines from BIM",
        "source": "bim_extraction",
    }


def extract_from_bim(payload: dict[str, Any]) -> dict[str, Any]:
    """Extract and aggregate BoQ from a list of BIM/IFC elements."""
    elements_in = payload.get("elements", [])
    project_id = payload.get("project_id", "")
    aggregated: list[dict[str, Any]] = []
    totals: dict[str, float] = {}

    for el in elements_in:
        mapped = map_element_to_boq(el)
        mapped["project_id"] = project_id
        aggregated.append(mapped)
        for item in mapped["items"]:
            mid = item["material_id"]
            totals[mid] = totals.get(mid, 0) + item["quantity"]

    return {
        "status": "complete",
        "project_id": project_id,
        "elements_processed": len(elements_in),
        "elements": aggregated,
        "material_totals": totals,
        "source": payload.get("source", "ifc"),
    }
