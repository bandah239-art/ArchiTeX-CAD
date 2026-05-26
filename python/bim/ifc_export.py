"""IFC export — create IFC4 from parsed element payloads with solid geometry."""

from __future__ import annotations

import os
import tempfile
from typing import Any

try:
    import ifcopenshell
    import ifcopenshell.api

    HAS_IFCOPENSHELL = True
except ImportError:
    HAS_IFCOPENSHELL = False


def _add_box_representation(
    ifc: Any,
    context: Any,
    product: Any,
    length: float,
    width: float,
    height: float,
) -> None:
    """Extruded box representation from element dimensions (m)."""
    l = max(length or 1.0, 0.1)
    w = max(width or 0.2, 0.05)
    h = max(height or 0.2, 0.05)
    try:
        rep = ifcopenshell.api.run(
            "geometry.add_wall_representation",
            ifc,
            context=context,
            length=l,
            height=h,
            thickness=w,
        )
        ifcopenshell.api.run("geometry.assign_representation", ifc, product=product, representation=rep)
    except Exception:
        try:
            body = ifc.create_entity(
                "IfcExtrudedAreaSolid",
                SweptArea=ifc.create_entity(
                    "IfcRectangleProfileDef",
                    ProfileType="AREA",
                    XDim=l,
                    YDim=w,
                ),
                Depth=h,
            )
            shape = ifc.create_entity(
                "IfcShapeRepresentation",
                ContextOfItems=context,
                RepresentationIdentifier="Body",
                RepresentationType="SweptSolid",
                Items=[body],
            )
            ifcopenshell.api.run("geometry.assign_representation", ifc, product=product, representation=shape)
        except Exception:
            pass


def export_ifc_from_elements(project_data: dict[str, Any]) -> dict[str, Any]:
    """
    Build IFC4 project from element list with geometry where dimensions available.
    project_data: { name, site_name, elements: [{type, name, globalId?, length?, width?, height?, volume?}] }
    """
    if not HAS_IFCOPENSHELL:
        return {"status": "error", "error": "IfcOpenShell not installed"}

    name = project_data.get("name") or "ARCHITEX-CAD Export"
    site_name = project_data.get("site_name") or "Site"
    elements = project_data.get("elements") or []

    ifc = ifcopenshell.api.run("project.create_file", version="IFC4")
    project = ifcopenshell.api.run("root.create_entity", ifc, ifc_class="IfcProject", name=name)
    ifcopenshell.api.run(
        "unit.assign_unit",
        ifc,
        units=[
            ifcopenshell.api.run("unit.add_si_unit", ifc, unit_type="LENGTHUNIT"),
            ifcopenshell.api.run("unit.add_si_unit", ifc, unit_type="AREAUNIT"),
            ifcopenshell.api.run("unit.add_si_unit", ifc, unit_type="VOLUMEUNIT"),
        ],
    )
    model_context = ifcopenshell.api.run("context.add_context", ifc, context_type="Model")

    site = ifcopenshell.api.run("root.create_entity", ifc, ifc_class="IfcSite", name=site_name)
    building = ifcopenshell.api.run("root.create_entity", ifc, ifc_class="IfcBuilding", name=name)
    storey = ifcopenshell.api.run("root.create_entity", ifc, ifc_class="IfcBuildingStorey", name="Ground Floor")
    ifcopenshell.api.run("aggregate.assign_object", ifc, relating_object=project, products=[site])
    ifcopenshell.api.run("aggregate.assign_object", ifc, relating_object=site, products=[building])
    ifcopenshell.api.run("aggregate.assign_object", ifc, relating_object=building, products=[storey])

    exported = 0
    with_geometry = 0
    type_map = {
        "IfcWall": "IfcWall",
        "IfcSlab": "IfcSlab",
        "IfcColumn": "IfcColumn",
        "IfcBeam": "IfcBeam",
        "IfcFooting": "IfcFooting",
        "IfcDoor": "IfcDoor",
        "IfcWindow": "IfcWindow",
        "IfcRoof": "IfcRoof",
    }

    offset_x = 0.0
    for el in elements:
        ifc_type = type_map.get(el.get("type", ""), "IfcBuildingElementProxy")
        try:
            product = ifcopenshell.api.run(
                "root.create_entity",
                ifc,
                ifc_class=ifc_type,
                name=el.get("name") or ifc_type,
            )
            ifcopenshell.api.run("spatial.assign_container", ifc, products=[product], relating_structure=storey)

            length = float(el.get("length") or 1.0)
            width = float(el.get("width") or 0.2)
            height = float(el.get("height") or 0.2)

            if length > 0 and (width > 0 or height > 0):
                _add_box_representation(ifc, model_context, product, length, width, height)
                with_geometry += 1
                try:
                    ifcopenshell.api.run(
                        "geometry.edit_object_placement",
                        ifc,
                        product=product,
                        matrix=[[1, 0, 0, offset_x], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]],
                    )
                except Exception:
                    pass
                offset_x += length + 0.5

            exported += 1
        except Exception:
            continue

    with tempfile.NamedTemporaryFile(suffix=".ifc", delete=False) as tmp:
        ifc.write(tmp.name)
        with open(tmp.name, "rb") as f:
            data = f.read()
        os.unlink(tmp.name)

    return {
        "status": "complete",
        "element_count": exported,
        "elements_with_geometry": with_geometry,
        "file_size_bytes": len(data),
        "ifc_bytes_b64": __import__("base64").b64encode(data).decode("ascii"),
        "schema": "IFC4",
    }
