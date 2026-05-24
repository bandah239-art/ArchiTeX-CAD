"""Extract material quantities from calculation results."""

import math
import re
from typing import Any

from boq.materials_database import fck_to_concrete_key, parse_bar_size, parse_bar_spacing


def _item(material_id: str, quantity: float, notes: str = "") -> dict[str, Any]:
    return {"material_id": material_id, "quantity": round(quantity, 3), "notes": notes}


def _parse_area_from_provision(provision: str) -> float:
    match = re.search(r"(\d+)\s*mm²", provision or "")
    if match:
        return float(match.group(1))
    nums = re.findall(r"(\d+)\s*H\d+", provision or "")
    if len(nums) >= 2:
        bar = parse_bar_size(provision)
        count = int(nums[0])
        return count * math.pi * (bar / 2) ** 2
    return 0.0


def extract_beam_quantities(
    result: dict[str, Any],
    dims: dict[str, float],
    count: int = 1,
    inputs: dict[str, Any] | None = None,
) -> dict[str, Any]:
    inputs = inputs or {}
    summary = result.get("summary", {})
    width_m = dims.get("width", inputs.get("width", 300)) / 1000
    depth_m = dims.get("depth", inputs.get("depth", 500)) / 1000
    length = dims.get("length", inputs.get("span", 6))
    fck = inputs.get("fck", 30)
    concrete_key = fck_to_concrete_key(fck)

    concrete_vol = width_m * depth_m * length * count
    as_mm2 = summary.get("steel_provided_mm2", summary.get("steel_required_mm2", 0))
    steel_t = as_mm2 * length * 7850 / 1_000_000_000 * count

    bar_size = parse_bar_size(summary.get("bar_provision", ""), 20)
    rebar_key = f"rebar_h{bar_size}"
    link_note = summary.get("links_required", "")
    link_spacing = parse_bar_spacing(link_note, 200)
    link_count = max(1, int(length / (link_spacing / 1000)))
    link_length_m = (2 * (width_m * 1000 + depth_m * 1000) + 24 * 8) / 1000
    link_weight = link_count * link_length_m * 0.395 / 1000 * count

    formwork = (2 * depth_m + width_m) * length * count

    return {
        "section": "B",
        "element_type": "beam",
        "items": [
            _item(concrete_key, concrete_vol, f"Beam concrete C{fck}"),
            _item(rebar_key, steel_t, summary.get("bar_provision", "Main bars")),
            _item("rebar_links_h8", link_weight, link_note or "Shear links"),
            _item("formwork_beam_sides", formwork, "Beam formwork"),
        ],
        "summary_text": f"{concrete_vol:.2f} m³ concrete",
    }


def extract_column_quantities(
    result: dict[str, Any],
    dims: dict[str, float],
    count: int = 1,
    inputs: dict[str, Any] | None = None,
) -> dict[str, Any]:
    inputs = inputs or {}
    summary = result.get("summary", {})
    width_m = dims.get("width", inputs.get("width", 300)) / 1000
    depth_m = dims.get("depth", inputs.get("depth", 300)) / 1000
    height = dims.get("length", inputs.get("height", 3.5))
    fck = inputs.get("fck", 30)
    concrete_key = fck_to_concrete_key(fck)

    concrete_vol = width_m * depth_m * height * count
    as_mm2 = summary.get("steel_provided_mm2", summary.get("steel_required_mm2", 0))
    steel_t = as_mm2 * height * 7850 / 1_000_000_000 * count

    bar_size = parse_bar_size(summary.get("bar_provision", ""), 16)
    link_spacing_mm = summary.get("link_spacing_mm", 200)
    link_count = max(1, int(height / (link_spacing_mm / 1000)))
    link_length_m = (2 * (width_m * 1000 + depth_m * 1000) + 24 * 8) / 1000
    link_weight = link_count * link_length_m * 0.395 / 1000 * count

    perimeter = 2 * (width_m + depth_m)
    formwork = perimeter * height * count

    return {
        "section": "B",
        "element_type": "column",
        "items": [
            _item(concrete_key, concrete_vol, f"Column concrete C{fck}"),
            _item(f"rebar_h{bar_size}", steel_t, summary.get("bar_provision", "Main bars")),
            _item("rebar_links_h8", link_weight, f"{summary.get('link_size', 'H8')} links"),
            _item("formwork_column", formwork, "Column formwork"),
        ],
        "summary_text": f"{concrete_vol:.2f} m³ concrete",
    }


def extract_slab_quantities(
    result: dict[str, Any],
    dims: dict[str, float],
    count: int = 1,
    inputs: dict[str, Any] | None = None,
) -> dict[str, Any]:
    inputs = inputs or {}
    summary = result.get("summary", {})
    lx = dims.get("length", inputs.get("span_lx", 8))
    ly = dims.get("width", inputs.get("span_ly", 10))
    depth_m = dims.get("depth", inputs.get("depth", 175)) / 1000
    fck = inputs.get("fck", 30)
    concrete_key = fck_to_concrete_key(fck)

    area = lx * ly * count
    concrete_vol = area * depth_m

    asx = summary.get("steel_short_span_mm2", 0)
    asy = summary.get("steel_long_span_mm2", 0) if summary.get("steel_long_span_mm2") != "N/A" else 0
    bar_x = parse_bar_size(summary.get("provision_short_span", ""), 12)
    bar_y = parse_bar_size(summary.get("provision_long_span", ""), 12) if asy else bar_x
    spacing_x = parse_bar_spacing(summary.get("provision_short_span", ""), 200)
    spacing_y = parse_bar_spacing(summary.get("provision_long_span", ""), 200) if asy else spacing_x

    bars_x = lx * (1000 / spacing_x) + 1
    bars_y = ly * (1000 / spacing_y) + 1
    len_x = ly + 0.6
    len_y = lx + 0.6
    weight_x = bars_x * len_x * (math.pi * (bar_x / 2) ** 2) * 7850 / 1_000_000_000
    weight_y = bars_y * len_y * (math.pi * (bar_y / 2) ** 2) * 7850 / 1_000_000_000
    steel_t = (weight_x + weight_y + (asx + (asy or 0)) * 0.0001) * count

    formwork = area
    items = [
        _item(concrete_key, concrete_vol, f"Slab concrete C{fck}"),
        _item(f"rebar_h{bar_x}", steel_t * 0.6, summary.get("provision_short_span", "Short span steel")),
        _item(f"rebar_h{bar_y}", steel_t * 0.4, summary.get("provision_long_span", "Long span steel")),
        _item("formwork_soffit", formwork, "Slab soffit formwork"),
    ]

    return {
        "section": "C",
        "element_type": "slab",
        "items": items,
        "summary_text": f"{concrete_vol:.1f} m³ concrete",
    }


def extract_foundation_quantities(
    result: dict[str, Any],
    dims: dict[str, float],
    count: int = 1,
    inputs: dict[str, Any] | None = None,
) -> dict[str, Any]:
    inputs = inputs or {}
    summary = result.get("summary", {})
    b = summary.get("width_m", dims.get("width", 2.7))
    l = summary.get("length_m", dims.get("length", 2.7))
    d_conc = summary.get("depth_mm", inputs.get("foundation_depth_concrete", 400)) / 1000
    df = inputs.get("foundation_depth", 1.2)
    fck = inputs.get("fck", 25)
    concrete_key = fck_to_concrete_key(fck)

    excav = (b + 0.5) * (l + 0.5) * df * count
    blinding = b * l * 0.075 * count
    concrete_vol = b * l * d_conc * count
    backfill = max(excav - concrete_vol - blinding, 0)

    bar_size = parse_bar_size(summary.get("bar_provision", ""), 16)
    spacing = parse_bar_spacing(summary.get("bar_provision", ""), 200)
    bars_x = int(l / (spacing / 1000)) + 1
    bars_y = int(b / (spacing / 1000)) + 1
    len_x = b - 0.10
    len_y = l - 0.10
    steel_kg = (
        bars_x * len_x + bars_y * len_y
    ) * (math.pi * (bar_size / 2) ** 2) * 7850 / 1_000_000
    steel_t = steel_kg / 1000 * count

    formwork = 2 * (b + l) * d_conc * count
    perimeter = 2 * (b + l) * count
    earthwork_support = perimeter * df * 1.2
    disposal = excav * 0.85

    return {
        "section": "A",
        "element_type": "foundation",
        "items": [
            _item("excavation_soft", excav, "Foundation pit excavation"),
            _item("excavation_soft", earthwork_support, "Earthwork support to excavation faces"),
            _item("fill_compacted", disposal, "Disposal of excavated material off site"),
            _item("concrete_c10", blinding, "75mm blinding concrete"),
            _item(concrete_key, concrete_vol, summary.get("foundation_type", "Pad foundation")),
            _item(f"rebar_h{bar_size}", steel_t, summary.get("bar_provision", "Foundation steel")),
            _item("formwork_foundation", formwork, "Foundation side formwork"),
            _item("fill_compacted", backfill, "Backfill and compact"),
        ],
        "summary_text": f"{concrete_vol:.1f} m³ concrete",
    }


def extract_road_quantities(
    result: dict[str, Any],
    dims: dict[str, float],
    count: int = 1,
    inputs: dict[str, Any] | None = None,
) -> dict[str, Any]:
    inputs = inputs or {}
    summary = result.get("summary", {})
    length_km = dims.get("length", 1.0)
    width = dims.get("width", 6.0)

    d1 = summary.get("wearing_course_mm", 50) / 1000
    d2 = summary.get("base_course_mm", 200) / 1000
    d3 = summary.get("subbase_mm", 200) / 1000

    vol1 = d1 * width * length_km * 1000 * count
    vol2 = d2 * width * length_km * 1000 * count
    vol3 = d3 * width * length_km * 1000 * count

    return {
        "section": "E",
        "element_type": "road",
        "items": [
            _item("asphalt_wearing", vol1, "Wearing course"),
            _item("base_crushed_stone", vol2, "Base course"),
            _item("subbase_gravel", vol3, "Subbase"),
        ],
        "summary_text": f"{summary.get('total_thickness_mm', 450)}mm pavement",
    }


EXTRACTORS = {
    "beam": extract_beam_quantities,
    "slab": extract_slab_quantities,
    "column": extract_column_quantities,
    "foundation": extract_foundation_quantities,
    "road": extract_road_quantities,
}


def extract_quantities(payload: dict[str, Any]) -> dict[str, Any]:
    calc_type = payload.get("calculation_type", "beam")
    result = payload.get("calculation_result", {})
    dims = payload.get("element_dimensions", {})
    count = int(payload.get("element_count", 1))
    inputs = payload.get("calculation_inputs", payload.get("inputs", {}))
    ref = payload.get("ref", "1")
    description = payload.get("description", f"{calc_type.title()} element")

    extractor = EXTRACTORS.get(calc_type)
    if not extractor:
        raise ValueError(f"Unsupported calculation type: {calc_type}")

    extracted = extractor(result, dims, count, inputs)
    extracted["ref"] = ref
    extracted["description"] = description
    extracted["element_count"] = count
    extracted["project_id"] = payload.get("project_id", "")
    return extracted
