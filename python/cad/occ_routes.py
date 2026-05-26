"""FastAPI routes for the OpenCASCADE CAD kernel and fallback engine."""

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from .occ_kernel import OCCKernel
import tempfile
import os

router = APIRouter(prefix="/occ")
kernel = OCCKernel()


class SketchEntities(BaseModel):
    entities: list[dict]


class OffsetRequest(BaseModel):
    entities:        list[dict]
    offset_distance: float
    join_type:       str = "arc"


class FilletRequest(BaseModel):
    entities:        list[dict]
    radius:          float
    vertex_indices:  list[int] = None


class ExtrudeRequest(BaseModel):
    entities: list[dict]
    height:   float


class BooleanRequest(BaseModel):
    entities_a: list[dict]
    entities_b: list[dict]
    operation:  str  # "union"|"subtract"|"intersect"


@router.post("/properties")
async def get_properties(req: SketchEntities):
    """
    Get precise geometric properties of a sketch.
    Area, centroid, perimeter.
    """
    try:
        wire = kernel.sketch_to_wire(req.entities)
        face = kernel.wire_to_face(wire)
        props = kernel.get_properties(face, "face")

        # Fallback perimeter or standard OCC adaptation
        perimeter = 0.0
        if kernel.occ_available:
            from OCC.Core.BRepAdaptor import BRepAdaptor_CompCurve
            from OCC.Core.GCPnts import GCPnts_AbscissaPoint
            try:
                curve = BRepAdaptor_CompCurve(wire)
                perimeter = GCPnts_AbscissaPoint.Length(curve)
            except Exception:
                pass
        else:
            if hasattr(wire, 'length'):
                perimeter = float(wire.length)

        return {
            "status":    "ok",
            "area":      props["area"],
            "centroid":  props["centroid"],
            "perimeter": perimeter,
            "unit":      "mm²"
        }
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )


@router.post("/offset")
async def offset_profile(req: OffsetRequest):
    """Offset sketch profile by exact distance."""
    try:
        wire = kernel.sketch_to_wire(req.entities)
        offset = kernel.offset_profile(
            wire,
            req.offset_distance,
            req.join_type
        )
        return {
            "status":  "ok",
            "message": f"Offset {req.offset_distance}mm applied",
            "shape":   kernel.shape_to_json(offset)
        }
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )


@router.post("/fillet")
async def add_fillet(req: FilletRequest):
    """Add precise fillets to sketch corners."""
    try:
        wire = kernel.sketch_to_wire(req.entities)
        face = kernel.wire_to_face(wire)
        filleted = kernel.add_fillet_2d(
            face,
            req.radius,
            req.vertex_indices
        )
        return {
            "status":  "ok",
            "message": f"Fillet R{req.radius}mm applied",
            "shape":   kernel.shape_to_json(filleted)
        }
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )


@router.post("/extrude")
async def extrude_sketch(req: ExtrudeRequest):
    """Extrude 2D sketch to 3D solid."""
    try:
        wire = kernel.sketch_to_wire(req.entities)
        face = kernel.wire_to_face(wire)
        solid = kernel.extrude_to_solid(
            face, req.height
        )
        props = kernel.get_properties(
            solid, "solid"
        )
        return {
            "status":   "ok",
            "height":   req.height,
            "volume":   props["volume"],
            "centroid": props["centroid"],
            "shape":    kernel.shape_to_json(solid)
        }
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )


@router.post("/boolean")
async def boolean_operation(req: BooleanRequest):
    """Boolean operations between two sketch profiles."""
    try:
        wire_a = kernel.sketch_to_wire(req.entities_a)
        wire_b = kernel.sketch_to_wire(req.entities_b)
        face_a = kernel.wire_to_face(wire_a)
        face_b = kernel.wire_to_face(wire_b)

        if req.operation == "union":
            result = kernel.boolean_union(
                face_a, face_b
            )
        elif req.operation == "subtract":
            result = kernel.boolean_subtract(
                face_a, face_b
            )
        elif req.operation == "intersect":
            result = kernel.boolean_intersect(
                face_a, face_b
            )
        else:
            raise ValueError(
                f"Unknown operation: {req.operation}"
            )

        props = kernel.get_properties(result, "face")
        return {
            "status":    "ok",
            "operation": req.operation,
            "area":      props["area"],
            "shape":     kernel.shape_to_json(result)
        }
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )


@router.post("/export/step")
async def export_step(req: ExtrudeRequest):
    """Export 3D solid to STEP format."""
    try:
        wire  = kernel.sketch_to_wire(req.entities)
        face  = kernel.wire_to_face(wire)
        solid = kernel.extrude_to_solid(
            face, req.height
        )

        with tempfile.NamedTemporaryFile(
            suffix=".step", delete=False
        ) as f:
            filepath = f.name

        success = kernel.export_step(
            solid, filepath
        )

        with open(filepath, 'rb') as f:
            content = f.read()

        try:
            os.unlink(filepath)
        except OSError:
            pass

        return Response(
            content=content,
            media_type="application/step",
            headers={
                "Content-Disposition":
                "attachment; filename=export.step"
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
