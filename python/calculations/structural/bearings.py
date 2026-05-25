"""Bearing Design Module (Pad and Elastomeric bearings)."""

from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value

def calculate_bearing(inputs: dict[str, Any]) -> dict[str, Any]:
    bearing_type = inputs.get("bearing_type", "elastomeric")
    n_load = float(inputs.get("vertical_load", 800))
    h_load = float(inputs.get("horizontal_load", 40))
    span = float(inputs.get("span", 15))
    rotation = float(inputs.get("rotation", 0.01)) # radians
    
    steps = []
    status = "pass"
    warnings = []
    errors = []
    summary = {
        "bearing_type": bearing_type,
        "vertical_load_kn": n_load,
        "horizontal_load_kn": h_load
    }
    
    if bearing_type == "pad":
        # Pad Bearing (Concrete/Masonry)
        material = inputs.get("material", "concrete")
        fck = float(inputs.get("fck", 30))
        bearing_width = float(inputs.get("bearing_width", 300))
        column_width = float(inputs.get("column_width", 200))
        pad_thickness = float(inputs.get("pad_thickness", 20))
        
        # Step 1: Allowable bearing pressure
        f_allow = 0.0
        if material == "concrete":
            f_allow = fck / 4.5
        elif material == "masonry":
            f_allow = 2.0 # simplified
        else: # steel
            f_allow = 250 / 1.5
            
        steps.append({
            "step_number": 1,
            "title": "Allowable Bearing Pressure",
            "formula": "Concrete: f_allow = fck / 4.5",
            "substitution": f"f_allow = {fck} / 4.5",
            "result": f"{round_value(f_allow, 2)}",
            "unit": "MPa",
            "reference": "Eurocode 2",
            "status": "info"
        })
        
        # Step 2: Minimum bearing length
        l_min_req = (n_load * 1000) / (bearing_width * f_allow)
        
        a1 = 50 # bearing depth
        a2 = 50 # edge distance
        da = 20 # construction tolerance
        l_min_geom = a1 + a2 + da
        
        l_min = max(l_min_req, l_min_geom)
        
        steps.append({
            "step_number": 2,
            "title": "Minimum Bearing Length",
            "formula": "l_min = max(N / (b × f_allow), a1 + a2 + Δa)",
            "substitution": f"max(({n_load}×1000) / ({bearing_width} × {round_value(f_allow, 2)}), 50 + 50 + 20)",
            "result": f"{round_value(l_min, 1)}",
            "unit": "mm",
            "reference": "Geometry & Stress",
            "status": "info"
        })
        
        # Step 3: Bearing width
        b_min = max(bearing_width, column_width + 2 * 50)
        
        steps.append({
            "step_number": 3,
            "title": "Bearing Width",
            "formula": "b_min = max(bearing_width, col_width + 100)",
            "substitution": f"max({bearing_width}, {column_width} + 100)",
            "result": f"{round_value(b_min, 1)}",
            "unit": "mm",
            "reference": "Detailing",
            "status": "info"
        })
        
        # Step 4: Horizontal force check
        mu = 0.4 if material == "concrete" else 0.6
        hf = mu * n_load
        check_status = "pass" if h_load <= hf else "fail"
        if h_load > hf:
            status = "fail"
            errors.append(f"Horizontal load ({h_load} kN) exceeds friction capacity ({round_value(hf, 1)} kN)")
            
        steps.append({
            "step_number": 4,
            "title": "Friction Capacity",
            "formula": "Hf = μ × N",
            "substitution": f"{mu} × {n_load}",
            "result": f"{round_value(hf, 1)}",
            "unit": "kN",
            "reference": "Friction",
            "status": check_status
        })
        
        # Step 5: Rotation capacity
        theta_allow = 2 * (pad_thickness / bearing_width)
        rot_status = "pass" if rotation <= theta_allow else "fail"
        if rotation > theta_allow:
            status = "fail"
            errors.append(f"Required rotation ({rotation} rad) exceeds capacity ({round_value(theta_allow, 4)} rad)")
            
        steps.append({
            "step_number": 5,
            "title": "Rotation Capacity",
            "formula": "θ_allow = 2 × (tpad / b)",
            "substitution": f"2 × ({pad_thickness} / {bearing_width})",
            "result": f"{round_value(theta_allow, 4)}",
            "unit": "rad",
            "reference": "Kinematics",
            "status": rot_status
        })
        
        summary.update({
            "min_length_mm": round_value(l_min, 1),
            "min_width_mm": round_value(b_min, 1),
            "friction_capacity_kn": round_value(hf, 1),
            "rotation_capacity_rad": round_value(theta_allow, 4)
        })

    elif bearing_type == "elastomeric":
        sigma_allow = float(inputs.get("sigma_allow", 10.0))
        delta_h = float(inputs.get("horizontal_movement_mm", 40.0))
        ti = float(inputs.get("layer_thickness_mm", 10.0))
        
        # Step 1: Plan dimensions
        a_req = (n_load * 1000) / sigma_allow
        # Assume square bearing
        dim = a_req ** 0.5
        # Round up to nearest 50
        dim = int((dim // 50) + 1) * 50
        actual_area = dim * dim
        
        steps.append({
            "step_number": 1,
            "title": "Required Area",
            "formula": "A_req = N / σ_allow",
            "substitution": f"({n_load} × 1000) / {sigma_allow}",
            "result": f"{round_value(a_req, 0)}",
            "unit": "mm²",
            "reference": "Standard Load",
            "status": "pass"
        })
        
        # Step 2: Shape factor
        perimeter = 4 * dim
        shape_factor = actual_area / (perimeter * ti)
        
        s_status = "pass" if 6 <= shape_factor <= 12 else "fail"
        if shape_factor < 6:
            status = "fail"
            errors.append("Shape factor S < 6. Increase dimensions or decrease layer thickness.")
            
        steps.append({
            "step_number": 2,
            "title": "Shape Factor (S)",
            "formula": "S = A / (Perimeter × ti)",
            "substitution": f"{actual_area} / ({perimeter} × {ti})",
            "result": f"{round_value(shape_factor, 2)}",
            "unit": "",
            "reference": "S ≥ 6 (minimum)",
            "status": s_status
        })
        
        # Step 3: Total elastomer thickness
        eps_q_allow = 0.5
        te = delta_h / eps_q_allow
        
        steps.append({
            "step_number": 3,
            "title": "Total Elastomer Thickness",
            "formula": "Te = Δh / εq_allow",
            "substitution": f"{delta_h} / {eps_q_allow}",
            "result": f"{round_value(te, 1)}",
            "unit": "mm",
            "reference": "Shear strain limit",
            "status": "info"
        })
        
        # Step 4: Number of layers
        n_layers = int(te / ti)
        if te % ti != 0:
            n_layers += 1
        actual_te = n_layers * ti
        
        steps.append({
            "step_number": 4,
            "title": "Number of Layers",
            "formula": "n = Te / ti (rounded up)",
            "substitution": f"{te} / {ti}",
            "result": f"{n_layers} layers (Actual Te = {actual_te}mm)",
            "unit": "",
            "reference": "Geometry",
            "status": "info"
        })
        
        # Step 5: Buckling check
        buckling_ratio = actual_te / dim
        buckling_status = "pass" if buckling_ratio <= (1/3) else "fail"
        if buckling_ratio > (1/3):
            status = "fail"
            errors.append("Buckling stability limit exceeded (Te / b > 1/3)")
            
        steps.append({
            "step_number": 5,
            "title": "Buckling Check",
            "formula": "Te / b ≤ 1/3",
            "substitution": f"{actual_te} / {dim}",
            "result": f"{round_value(buckling_ratio, 3)}",
            "unit": "",
            "reference": "Stability",
            "status": buckling_status
        })
        
        summary.update({
            "area_required_mm2": round_value(a_req, 0),
            "dimensions_mm": f"{dim}×{dim}",
            "shape_factor": round_value(shape_factor, 2),
            "te_mm": actual_te,
            "n_layers": n_layers
        })

    return {
        "status": status,
        "summary": summary,
        "steps": steps,
        "warnings": warnings,
        "errors": errors,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
