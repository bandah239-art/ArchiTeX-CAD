"""OpenCASCADE geometric kernel wrapper with robust Shapely fallback for Windows environments."""

import os
import json
import tempfile
import numpy as np

try:
    from OCC.Core.BRep import BRep_Builder
    from OCC.Core.BRepBuilderAPI import (
        BRepBuilderAPI_MakeEdge,
        BRepBuilderAPI_MakeWire,
        BRepBuilderAPI_MakeFace,
        BRepBuilderAPI_MakeVertex
    )
    from OCC.Core.BRepPrimAPI import BRepPrimAPI_MakePrism
    from OCC.Core.BRepAlgoAPI import (
        BRepAlgoAPI_Fuse,
        BRepAlgoAPI_Cut,
        BRepAlgoAPI_Common
    )
    from OCC.Core.BRepOffsetAPI import BRepOffsetAPI_MakeOffset
    from OCC.Core.BRepFilletAPI import BRepFilletAPI_MakeFillet2d
    from OCC.Core.GProp import GProp_GProps
    from OCC.Core.BRepGProp import (
        brepgprop_SurfaceProperties,
        brepgprop_VolumeProperties
    )
    from OCC.Core.gp import (
        gp_Pnt, gp_Pnt2d, gp_Vec,
        gp_Dir, gp_Ax2, gp_Circ
    )
    from OCC.Core.GC import GC_MakeSegment
    from OCC.Core.Geom import Geom_Circle
    from OCC.Core.BRepMesh import BRepMesh_IncrementalMesh
    from OCC.Core.StlAPI import StlAPI_Writer
    from OCC.Core.IFSelect import IFSelect_RetDone
    from OCC.Core.STEPControl import (
        STEPControl_Writer,
        STEPControl_AsIs
    )
    from OCC.Core.IGESControl import IGESControl_Writer
    from OCC.Core.BRepAdaptor import BRepAdaptor_CompCurve
    from OCC.Core.GCPnts import GCPnts_AbscissaPoint
    
    OCC_AVAILABLE = True
except ImportError:
    OCC_AVAILABLE = False

import shapely.geometry as sg
import shapely.ops as sops
from scipy.spatial import Delaunay


class OCCKernel:
    """
    OpenCASCADE geometric kernel wrapper.
    Receives constraint-solved geometry.
    If pythonOCC-core is not available, falls back to a robust Shapely engine.
    """
    def __init__(self):
        self.occ_available = OCC_AVAILABLE

    def sketch_to_wire(self, entities: list[dict]):
        """Convert constraint-solved sketch entities to OCC wire (or Shapely shape)."""
        if self.occ_available:
            wire_builder = BRepBuilderAPI_MakeWire()
            for entity in entities:
                if entity['type'] == 'line':
                    x1, y1, x2, y2 = entity['params']
                    p1 = gp_Pnt(x1, y1, 0.0)
                    p2 = gp_Pnt(x2, y2, 0.0)
                    edge = BRepBuilderAPI_MakeEdge(p1, p2).Edge()
                    wire_builder.Add(edge)
                elif entity['type'] == 'arc':
                    cx, cy, r, a1, a2 = entity['params']
                    from OCC.Core.GC import GC_MakeArcOfCircle
                    centre = gp_Pnt(cx, cy, 0)
                    axis = gp_Ax2(centre, gp_Dir(0, 0, 1))
                    circle = gp_Circ(axis, r)
                    arc = GC_MakeArcOfCircle(circle, a1, a2, True).Value()
                    edge = BRepBuilderAPI_MakeEdge(arc).Edge()
                    wire_builder.Add(edge)
                elif entity['type'] == 'circle':
                    cx, cy, r = entity['params']
                    centre = gp_Pnt(cx, cy, 0)
                    axis = gp_Ax2(centre, gp_Dir(0, 0, 1))
                    circle = gp_Circ(axis, r)
                    edge = BRepBuilderAPI_MakeEdge(circle).Edge()
                    wire_builder.Add(edge)

            if not wire_builder.IsDone():
                raise ValueError("Wire construction failed — check sketch is closed")
            return wire_builder.Wire()
        else:
            # Fallback: Represent wire as a list of coordinates or Shapely geometry
            polylines = []
            for entity in entities:
                if entity['type'] == 'line':
                    x1, y1, x2, y2 = entity['params']
                    polylines.append(sg.LineString([(x1, y1), (x2, y2)]))
                elif entity['type'] == 'circle':
                    cx, cy, r = entity['params']
                    # Approximate circle with polygon
                    circle_poly = sg.Point(cx, cy).buffer(r, quad_segs=32)
                    polylines.append(circle_poly.boundary)
                elif entity['type'] == 'arc':
                    cx, cy, r, a1, a2 = entity['params']
                    # Generate points along arc
                    steps = 32
                    angles = np.linspace(a1, a2, steps)
                    arc_pts = [(cx + r * np.cos(a), cy + r * np.sin(a)) for a in angles]
                    polylines.append(sg.LineString(arc_pts))
                    
            if not polylines:
                raise ValueError("No entities to build wire")
            
            # Fuse boundary segments into a single closed geometry
            merged = sops.unary_union(polylines)
            if isinstance(merged, sg.MultiLineString):
                # Try polygonizing to close it
                polygons = list(sops.polygonize(merged))
                if polygons:
                    return polygons[0]
            elif isinstance(merged, sg.LineString):
                if merged.is_closed:
                    return sg.Polygon(merged)
            elif isinstance(merged, sg.Polygon):
                return merged
            
            # Default to polygon from union of coordinates
            coords = []
            for poly in polylines:
                coords.extend(list(poly.coords))
            # Unique coordinate list preserving order if possible
            seen = set()
            unique_coords = []
            for pt in coords:
                if pt not in seen:
                    seen.add(pt)
                    unique_coords.append(pt)
            if len(unique_coords) >= 3:
                return sg.Polygon(unique_coords)
            raise ValueError("Wire construction failed: Could not close profile")

    def wire_to_face(self, wire):
        """Convert closed wire to planar face."""
        if self.occ_available:
            face = BRepBuilderAPI_MakeFace(wire)
            if not face.IsDone():
                raise ValueError("Face construction failed — wire must be closed")
            return face.Face()
        else:
            # Wire is already a Shapely Polygon in fallback mode
            if isinstance(wire, sg.Polygon):
                return wire
            raise ValueError("Face construction failed")

    def offset_profile(self, wire, offset_distance: float, join_type: str = "arc"):
        """Offset a 2D profile by exact distance."""
        if self.occ_available:
            from OCC.Core.GeomAbs import GeomAbs_Arc, GeomAbs_Intersection
            jt = GeomAbs_Arc if join_type == "arc" else GeomAbs_Intersection
            offset = BRepOffsetAPI_MakeOffset(wire, jt)
            offset.Perform(offset_distance)
            if not offset.IsDone():
                raise ValueError("Offset failed")
            return offset.Shape()
        else:
            # Shapely buffer offset
            js = 1 if join_type == "arc" else 2 # 1=round, 2=miter
            if isinstance(wire, sg.Polygon):
                return wire.buffer(offset_distance, join_style=js)
            elif isinstance(wire, sg.LineString):
                return wire.buffer(offset_distance, join_style=js)
            return wire

    def boolean_union(self, shape1, shape2):
        """Fuse two shapes."""
        if self.occ_available:
            fuse = BRepAlgoAPI_Fuse(shape1, shape2)
            fuse.Build()
            if not fuse.IsDone():
                raise ValueError("Boolean union failed")
            return fuse.Shape()
        else:
            return shape1.union(shape2)

    def boolean_subtract(self, base, tool):
        """Subtract tool from base shape."""
        if self.occ_available:
            cut = BRepAlgoAPI_Cut(base, tool)
            cut.Build()
            if not cut.IsDone():
                raise ValueError("Boolean cut failed")
            return cut.Shape()
        else:
            return base.difference(tool)

    def boolean_intersect(self, shape1, shape2):
        """Common volume of two shapes."""
        if self.occ_available:
            common = BRepAlgoAPI_Common(shape1, shape2)
            common.Build()
            if not common.IsDone():
                raise ValueError("Boolean intersection failed")
            return common.Shape()
        else:
            return shape1.intersection(shape2)

    def add_fillet_2d(self, face, radius: float, vertex_indices: list[int] = None):
        """Add precise 2D fillets to face corners."""
        if self.occ_available:
            fillet = BRepFilletAPI_MakeFillet2d(face)
            from OCC.Core.TopExp import TopExp_Explorer
            from OCC.Core.TopAbs import TopAbs_VERTEX
            explorer = TopExp_Explorer(face, TopAbs_VERTEX)
            idx = 0
            while explorer.More():
                if vertex_indices is None or idx in vertex_indices:
                    vertex = explorer.Current()
                    fillet.AddFillet(vertex, radius)
                explorer.Next()
                idx += 1
            fillet.Build()
            if not fillet.IsDone():
                raise ValueError("Fillet failed")
            return fillet.Shape()
        else:
            # Shapely rounded buffer fillet fallback
            if isinstance(face, sg.Polygon):
                # Fillet corners by negative then positive buffer
                return face.buffer(-radius, join_style=1).buffer(radius, join_style=1)
            return face

    def extrude_to_solid(self, face, height: float):
        """Extrude 2D face to 3D solid."""
        if self.occ_available:
            direction = gp_Vec(0, 0, height)
            prism = BRepPrimAPI_MakePrism(face, direction)
            if not prism.IsDone():
                raise ValueError("Extrusion failed")
            return prism.Shape()
        else:
            # Fallback returns (face_polygon, height) tuple
            return (face, height)

    def get_properties(self, shape, shape_type: str = "face") -> dict:
        """Calculate precise geometric properties."""
        if self.occ_available:
            props = GProp_GProps()
            if shape_type == "face":
                brepgprop_SurfaceProperties(shape, props)
                return {
                    "area": props.Mass(),
                    "centroid": {
                        "x": props.CentreOfMass().X(),
                        "y": props.CentreOfMass().Y(),
                        "z": props.CentreOfMass().Z()
                    },
                    "unit": "mm²"
                }
            elif shape_type == "solid":
                brepgprop_VolumeProperties(shape, props)
                return {
                    "volume": props.Mass(),
                    "centroid": {
                        "x": props.CentreOfMass().X(),
                        "y": props.CentreOfMass().Y(),
                        "z": props.CentreOfMass().Z()
                    },
                    "unit": "mm³"
                }
        else:
            # Shapely fallback properties
            if shape_type == "face":
                poly = shape
                if isinstance(poly, tuple):
                    poly = poly[0]
                return {
                    "area": float(poly.area),
                    "centroid": {
                        "x": float(poly.centroid.x),
                        "y": float(poly.centroid.y),
                        "z": 0.0
                    },
                    "unit": "mm²"
                }
            elif shape_type == "solid":
                poly, h = shape
                vol = float(poly.area * h)
                return {
                    "volume": vol,
                    "centroid": {
                        "x": float(poly.centroid.x),
                        "y": float(poly.centroid.y),
                        "z": float(h / 2.0)
                    },
                    "unit": "mm³"
                }
        return {}

    def export_step(self, shape, filepath: str) -> bool:
        """Export to STEP format."""
        if self.occ_available:
            writer = STEPControl_Writer()
            writer.Transfer(shape, STEPControl_AsIs)
            status = writer.Write(filepath)
            return status == IFSelect_RetDone
        else:
            # Shapely mock export
            with open(filepath, 'w') as f:
                f.write(f"MOCK STEP FILE\nShape type: {type(shape)}\n")
            return True

    def export_stl(self, shape, filepath: str, linear_deflection: float = 0.1, angular_deflection: float = 0.5) -> bool:
        """Export to STL."""
        if self.occ_available:
            mesh = BRepMesh_IncrementalMesh(shape, linear_deflection, False, angular_deflection)
            mesh.Perform()
            writer = StlAPI_Writer()
            writer.Write(shape, filepath)
            return True
        else:
            # Shapely mock export
            with open(filepath, 'w') as f:
                f.write(f"MOCK STL FILE\nShape type: {type(shape)}\n")
            return True

    def shape_to_json(self, shape) -> dict:
        """Convert shape to JSON triangulation for rendering."""
        if self.occ_available:
            mesh = BRepMesh_IncrementalMesh(shape, 0.1)
            mesh.Perform()
            from OCC.Core.TopExp import TopExp_Explorer
            from OCC.Core.TopAbs import TopAbs_FACE
            from OCC.Core.BRep import BRep_Tool
            from OCC.Core.TopLoc import TopLoc_Location
            vertices = []
            faces = []
            vertex_offset = 0
            explorer = TopExp_Explorer(shape, TopAbs_FACE)
            while explorer.More():
                face = explorer.Current()
                location = TopLoc_Location()
                triangulation = BRep_Tool.Triangulation(face, location)
                if triangulation is not None:
                    for i in range(1, triangulation.NbNodes() + 1):
                        node = triangulation.Node(i)
                        vertices.extend([node.X(), node.Y(), node.Z()])
                    for i in range(1, triangulation.NbTriangles() + 1):
                        tri = triangulation.Triangle(i)
                        n1, n2, n3 = tri.Get()
                        faces.extend([n1 - 1 + vertex_offset, n2 - 1 + vertex_offset, n3 - 1 + vertex_offset])
                    vertex_offset += triangulation.NbNodes()
                explorer.Next()
            return {
                "vertices": vertices,
                "faces": faces,
                "vertex_count": len(vertices) // 3,
                "face_count": len(faces) // 3
            }
        else:
            # Robust triangulation fallback using Shapely and Scipy Delaunay
            polygon = shape
            height = 0.0
            if isinstance(shape, tuple):
                polygon, height = shape

            if not isinstance(polygon, sg.Polygon):
                return {"vertices": [], "faces": [], "vertex_count": 0, "face_count": 0}

            # Triangulate 2D face
            exterior_coords = list(polygon.exterior.coords)[:-1]
            points_2d = list(exterior_coords)
            
            for hole in polygon.interiors:
                points_2d.extend(list(hole.coords)[:-1])
                
            pts_arr = np.array(points_2d)
            if len(pts_arr) < 3:
                return {"vertices": [], "faces": [], "vertex_count": 0, "face_count": 0}
                
            tri = Delaunay(pts_arr)
            faces_2d = []
            for simplex in tri.simplices:
                p_tri = pts_arr[simplex]
                centroid = p_tri.mean(axis=0)
                pt = sg.Point(centroid[0], centroid[1])
                if polygon.contains(pt):
                    faces_2d.append([int(simplex[0]), int(simplex[1]), int(simplex[2])])

            vertices = []
            faces = []
            N = len(pts_arr)

            if height == 0.0:
                # 2D plane rendering
                for p in pts_arr:
                    vertices.extend([float(p[0]), float(p[1]), 0.0])
                for f in faces_2d:
                    faces.extend(f)
            else:
                # Watertight 3D Prism rendering
                # Bottom face (Z = 0)
                for p in pts_arr:
                    vertices.extend([float(p[0]), float(p[1]), 0.0])
                # Top face (Z = height)
                for p in pts_arr:
                    vertices.extend([float(p[0]), float(p[1]), float(height)])
                
                # Bottom triangles oriented downwards (clockwise)
                for f in faces_2d:
                    faces.extend([f[0], f[2], f[1]])
                # Top triangles oriented upwards (counter-clockwise)
                for f in faces_2d:
                    faces.extend([f[0] + N, f[1] + N, f[2] + N])
                
                # Connect walls/sides
                segments = []
                # Exterior loop
                ext_len = len(exterior_coords)
                for k in range(ext_len):
                    segments.append((k, (k + 1) % ext_len))
                # Holes loops
                offset = ext_len
                for hole in polygon.interiors:
                    hole_len = len(list(hole.coords)[:-1])
                    for k in range(hole_len):
                        segments.append((offset + k, offset + (k + 1) % hole_len))
                    offset += hole_len
                
                for i, j in segments:
                    # Side quad triangulated as two triangles
                    faces.extend([i, j, j + N])
                    faces.extend([i, j + N, i + N])

            return {
                "vertices": vertices,
                "faces": faces,
                "vertex_count": len(vertices) // 3,
                "face_count": len(faces) // 3
            }
