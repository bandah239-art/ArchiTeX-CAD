"""Verification script for the OpenCASCADE CAD kernel and fallback engine."""

import os
import sys

# Add python directory to path so we can import cad modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from cad.occ_kernel import OCCKernel

def test_kernel():
    print("=== STARTING KERNEL VERIFICATION TESTS ===")
    kernel = OCCKernel()
    print(f"OCC Available: {kernel.occ_available}")

    # 1. Test Profile Area: 6000x4000 Rectangle
    rect_entities = [
        {"type": "line", "params": [0.0, 0.0, 6000.0, 0.0]},
        {"type": "line", "params": [6000.0, 0.0, 6000.0, 4000.0]},
        {"type": "line", "params": [6000.0, 4000.0, 0.0, 4000.0]},
        {"type": "line", "params": [0.0, 4000.0, 0.0, 0.0]}
    ]

    print("\n--- Test 1: Sketch to Face (6000x4000 Rectangle) ---")
    wire = kernel.sketch_to_wire(rect_entities)
    face = kernel.wire_to_face(wire)
    props = kernel.get_properties(face, "face")
    
    expected_area = 6000.0 * 4000.0
    actual_area = props["area"]
    print(f"Expected Area: {expected_area} mm²")
    print(f"Actual Area: {actual_area} mm²")
    assert abs(actual_area - expected_area) < 1e-5, f"Area mismatch! Expected {expected_area}, got {actual_area}"
    print("Test 1 Passed!")

    # 2. Test Offset: 200mm Offset
    print("\n--- Test 2: Offset Profile (200mm) ---")
    offset_wire = kernel.offset_profile(wire, 200.0)
    offset_face = kernel.wire_to_face(offset_wire)
    offset_props = kernel.get_properties(offset_face, "face")
    
    actual_offset_area = offset_props["area"]
    print(f"Base Area: {expected_area} mm²")
    print(f"Offset (200mm) Area: {actual_offset_area} mm²")
    # Area must be greater for outward offset (+200mm)
    assert actual_offset_area > expected_area, "Offset area should be greater than original area"
    print("Test 2 Passed!")

    # 3. Test Extrude: 3000mm extrusion
    print("\n--- Test 3: Extrude Face to 3D Solid (3000mm height) ---")
    solid = kernel.extrude_to_solid(face, 3000.0)
    solid_props = kernel.get_properties(solid, "solid")
    
    expected_volume = expected_area * 3000.0
    actual_volume = solid_props["volume"]
    print(f"Expected Volume: {expected_volume} mm³")
    print(f"Actual Volume: {actual_volume} mm³")
    assert abs(actual_volume - expected_volume) < 1e-5, f"Volume mismatch! Expected {expected_volume}, got {actual_volume}"
    print("Test 3 Passed!")

    # 4. Test Boolean Subtraction: 2000x2000 Square from the Rectangle
    print("\n--- Test 4: Boolean Subtraction (2000x2000 Square from 6000x4000 Rectangle) ---")
    square_entities = [
        {"type": "line", "params": [1000.0, 1000.0, 3000.0, 1000.0]},
        {"type": "line", "params": [3000.0, 1000.0, 3000.0, 3000.0]},
        {"type": "line", "params": [3000.0, 3000.0, 1000.0, 3000.0]},
        {"type": "line", "params": [1000.0, 3000.0, 1000.0, 1000.0]}
    ]
    square_wire = kernel.sketch_to_wire(square_entities)
    square_face = kernel.wire_to_face(square_wire)
    
    subtracted_face = kernel.boolean_subtract(face, square_face)
    subtracted_props = kernel.get_properties(subtracted_face, "face")
    
    expected_sub_area = expected_area - (2000.0 * 2000.0)
    actual_sub_area = subtracted_props["area"]
    print(f"Expected Subtracted Area: {expected_sub_area} mm²")
    print(f"Actual Subtracted Area: {actual_sub_area} mm²")
    assert abs(actual_sub_area - expected_sub_area) < 1e-5, f"Subtracted Area mismatch! Expected {expected_sub_area}, got {actual_sub_area}"
    print("Test 4 Passed!")

    # 5. Test JSON triangulation output
    print("\n--- Test 5: Triangulation Output (Solid Shape to JSON) ---")
    triangulation = kernel.shape_to_json(solid)
    print(f"Vertex Count: {triangulation['vertex_count']}")
    print(f"Face Count: {triangulation['face_count']}")
    assert triangulation['vertex_count'] > 0, "No vertices in triangulation!"
    assert triangulation['face_count'] > 0, "No faces in triangulation!"
    print("Test 5 Passed!")

    print("\n=== ALL KERNEL VERIFICATION TESTS PASSED SUCCESSFULLY ===")

if __name__ == "__main__":
    try:
        test_kernel()
    except Exception as e:
        print(f"Verification Failed: {e}", file=sys.stderr)
        sys.exit(1)
