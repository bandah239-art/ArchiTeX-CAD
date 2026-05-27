"""Lightweight 2D Finite Element Analysis Solver (Direct Stiffness Method)."""

import numpy as np
from datetime import datetime, timezone

def solve_2d_frame(nodes: list[dict], elements: list[dict], loads: list[dict], supports: list[dict]) -> dict:
    """
    Solves a 2D frame using the Direct Stiffness Method.
    Inputs:
    - nodes: [{'id': 1, 'x': 0, 'y': 0}, ...]
    - elements: [{'id': 1, 'node_i': 1, 'node_j': 2, 'E': 200e9, 'A': 0.01, 'I': 1e-5, 'udl': 0.0}, ...]
    - loads: [{'node_id': 2, 'fx': 0, 'fy': -10000, 'mz': 0}, ...]
    - supports: [{'node_id': 1, 'ux': True, 'uy': True, 'rz': True}, ...] (True means fixed)
    
    Returns displacements, member forces, and diagrams.
    """
    num_nodes = len(nodes)
    ndof = 3 * num_nodes
    
    node_idx = {n['id']: i for i, n in enumerate(nodes)}
    
    K = np.zeros((ndof, ndof))
    F = np.zeros(ndof)
    
    # Pre-calculate member equivalent nodal loads & local stiffnesses
    element_data = []
    
    # Assembly
    for el in elements:
        i = node_idx[el['node_i']]
        j = node_idx[el['node_j']]
        
        xi, yi = nodes[i]['x'], nodes[i]['y']
        xj, yj = nodes[j]['x'], nodes[j]['y']
        
        L = np.hypot(xj - xi, yj - yi)
        if L < 1e-6:
            continue
            
        c = (xj - xi) / L
        s = (yj - yi) / L
        
        E = el['E']
        A = el['A']
        I = el['I']
        
        k_local = np.array([
            [E*A/L, 0, 0, -E*A/L, 0, 0],
            [0, 12*E*I/L**3, 6*E*I/L**2, 0, -12*E*I/L**3, 6*E*I/L**2],
            [0, 6*E*I/L**2, 4*E*I/L, 0, -6*E*I/L**2, 2*E*I/L],
            [-E*A/L, 0, 0, E*A/L, 0, 0],
            [0, -12*E*I/L**3, -6*E*I/L**2, 0, 12*E*I/L**3, -6*E*I/L**2],
            [0, 6*E*I/L**2, 2*E*I/L, 0, -6*E*I/L**2, 4*E*I/L]
        ])
        
        T = np.array([
            [c, s, 0, 0, 0, 0],
            [-s, c, 0, 0, 0, 0],
            [0, 0, 1, 0, 0, 0],
            [0, 0, 0, c, s, 0],
            [0, 0, 0, -s, c, 0],
            [0, 0, 0, 0, 0, 1]
        ])
        
        k_global = T.T @ k_local @ T
        
        idx = [3*i, 3*i+1, 3*i+2, 3*j, 3*j+1, 3*j+2]
        for row in range(6):
            for col in range(6):
                K[idx[row], idx[col]] += k_global[row, col]
                
        # Member load processing (UDL)
        # Fixed-end forces (FEF): forces the element ends exert on the nodes when all DOFs are fixed.
        # For downward UDL (positive w_load): reactions are upward (+wL/2) at both ends,
        # with hogging moments (-wL²/12 CW at i, +wL²/12 CCW at j) in the CCW-positive convention.
        # Equivalent nodal loads = -FEF, applied via F -= T^T @ FEF.
        w_load = float(el.get("udl", 0.0))
        f_local_fe = np.zeros(6)
        if w_load != 0:
            f_local_fe[1] = w_load * L / 2.0
            f_local_fe[2] = -w_load * (L**2) / 12.0
            f_local_fe[4] = w_load * L / 2.0
            f_local_fe[5] = w_load * (L**2) / 12.0

            f_global_fe = T.T @ f_local_fe
            for row in range(6):
                F[idx[row]] -= f_global_fe[row]
                
        element_data.append({
            "el": el,
            "L": L,
            "T": T,
            "k_local": k_local,
            "f_local_fe": f_local_fe,
            "node_i_idx": i,
            "node_j_idx": j
        })
        
    # Apply joint point loads
    for p in loads:
        i = node_idx[p['node_id']]
        F[3*i] += p.get('fx', 0)
        F[3*i+1] += p.get('fy', 0)
        F[3*i+2] += p.get('mz', 0)
        
    # Apply boundary conditions (Penalty Method)
    penalty = 1e15
    for sup in supports:
        i = node_idx[sup['node_id']]
        if sup.get('ux'):
            K[3*i, 3*i] += penalty
        if sup.get('uy'):
            K[3*i+1, 3*i+1] += penalty
        if sup.get('rz'):
            K[3*i+2, 3*i+2] += penalty
            
    # Solve
    try:
        U = np.linalg.solve(K, F)
    except np.linalg.LinAlgError:
        return {"status": "error", "message": "Singular stiffness matrix - structure is unstable"}
        
    # Format Nodal Displacements
    displacements = []
    for n in nodes:
        i = node_idx[n['id']]
        displacements.append({
            'node_id': n['id'],
            'ux': float(U[3*i]),
            'uy': float(U[3*i+1]),
            'rz': float(U[3*i+2])
        })
        
    # Compute member force distributions & diagram paths
    element_results = []
    for data in element_data:
        el = data["el"]
        L = data["L"]
        T = data["T"]
        k_local = data["k_local"]
        f_local_fe = data["f_local_fe"]
        ni = data["node_i_idx"]
        nj = data["node_j_idx"]
        
        # Element global displacements
        u_g = np.array([
            U[3*ni], U[3*ni+1], U[3*ni+2],
            U[3*nj], U[3*nj+1], U[3*nj+2]
        ])
        
        # Local displacements
        u_l = T @ u_g
        
        # Local end forces
        f_l = k_local @ u_l + f_local_fe
        
        # Evaluate axial, shear, moment, and deflection along element (11 points)
        w_load = float(el.get("udl", 0.0))
        x_vals = np.linspace(0, L, 11)
        
        moments = []
        shears = []
        axials = []
        deflections = []
        
        E = el['E']
        I = el['I']
        A = el['A']
        
        for x in x_vals:
            dx = x / L
            # Constant axial force
            axials.append(float(f_l[3]))

            # V(x) = f_l[1] - w*x  (f_l[1] is upward reaction at node i; positive shear = upward on left face)
            shears.append(float(f_l[1] - w_load * x))

            # M(x) = f_l[1]*x + f_l[2] - w*x²/2
            # f_l[2] is the moment the element exerts on node i (CCW positive = sagging at left)
            moments.append(float(f_l[1] * x + f_l[2] - 0.5 * w_load * x**2))
            
            # Transverse deflection using cubic Hermite shape functions
            h1 = 1.0 - 3.0 * (dx**2) + 2.0 * (dx**3)
            h2 = L * (dx - 2.0 * (dx**2) + (dx**3))
            h3 = 3.0 * (dx**2) - 2.0 * (dx**3)
            h4 = L * (-(dx**2) + (dx**3))
            
            w_defl_local = h1 * u_l[1] + h2 * u_l[2] + h3 * u_l[4] + h4 * u_l[5]
            if w_load != 0:
                # Add fixed-fixed UDL elastic curve deflection contribution (particular solution)
                w_defl_local += (w_load * (x**2) * ((L - x)**2)) / (24.0 * E * I)
            deflections.append(float(w_defl_local))
            
        element_results.append({
            "element_id": el["id"],
            "local_forces": f_l.tolist(),
            "x_points": x_vals.tolist(),
            "moments": moments,
            "shears": shears,
            "axials": axials,
            "deflections": deflections
        })
        
    return {
        "status": "success",
        "displacements": displacements,
        "element_results": element_results
    }


def assemble_frame_stiffness(inputs: dict) -> tuple:
    """
    Build the clean global stiffness matrix and boundary DOF list from the same
    portal-frame geometry used by run_fea_calculation.  Returns:
        (K_global, nodes, elements, boundary_dofs)
    K_global has NO penalty terms — suitable for generalized eigenvalue problems.
    """
    height = float(inputs.get("height", 4.0))
    span = float(inputs.get("span", 6.0))
    support_type = str(inputs.get("support_type", "fixed"))
    E = float(inputs.get("E", 2.0e11))
    A = float(inputs.get("A", 0.01))
    I_val = float(inputs.get("I", 1.0e-5))

    nodes = [
        {"id": 1, "x": 0.0, "y": 0.0},
        {"id": 2, "x": 0.0, "y": height},
        {"id": 3, "x": span, "y": height},
        {"id": 4, "x": span, "y": 0.0},
    ]
    elements = [
        {"id": 1, "node_i": 1, "node_j": 2, "E": E, "A": A, "I": I_val, "udl": 0.0},
        {"id": 2, "node_i": 2, "node_j": 3, "E": E, "A": A, "I": I_val, "udl": 0.0},
        {"id": 3, "node_i": 3, "node_j": 4, "E": E, "A": A, "I": I_val, "udl": 0.0},
    ]

    num_nodes = len(nodes)
    ndof = 3 * num_nodes
    node_idx = {n["id"]: i for i, n in enumerate(nodes)}
    K = np.zeros((ndof, ndof))

    for el in elements:
        ni = node_idx[el["node_i"]]
        nj = node_idx[el["node_j"]]
        xi, yi = nodes[ni]["x"], nodes[ni]["y"]
        xj, yj = nodes[nj]["x"], nodes[nj]["y"]
        L = np.hypot(xj - xi, yj - yi)
        if L < 1e-6:
            continue
        c, s = (xj - xi) / L, (yj - yi) / L
        EA, EI = el["E"] * el["A"], el["E"] * el["I"]
        k_loc = np.array([
            [EA/L, 0, 0, -EA/L, 0, 0],
            [0, 12*EI/L**3, 6*EI/L**2, 0, -12*EI/L**3, 6*EI/L**2],
            [0, 6*EI/L**2, 4*EI/L, 0, -6*EI/L**2, 2*EI/L],
            [-EA/L, 0, 0, EA/L, 0, 0],
            [0, -12*EI/L**3, -6*EI/L**2, 0, 12*EI/L**3, -6*EI/L**2],
            [0, 6*EI/L**2, 2*EI/L, 0, -6*EI/L**2, 4*EI/L],
        ])
        T = np.array([
            [c, s, 0, 0, 0, 0], [-s, c, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0],
            [0, 0, 0, c, s, 0], [0, 0, 0, -s, c, 0], [0, 0, 0, 0, 0, 1],
        ])
        k_glob = T.T @ k_loc @ T
        dofs = [3*ni, 3*ni+1, 3*ni+2, 3*nj, 3*nj+1, 3*nj+2]
        for r in range(6):
            for col in range(6):
                K[dofs[r], dofs[col]] += k_glob[r, col]

    is_fixed = (support_type == "fixed")
    boundary_dofs: list[int] = []
    for sup_nid, flags in [(1, (True, True, is_fixed)), (4, (True, True, is_fixed))]:
        i = node_idx[sup_nid]
        if flags[0]: boundary_dofs.append(3*i)
        if flags[1]: boundary_dofs.append(3*i+1)
        if flags[2]: boundary_dofs.append(3*i+2)

    return K, nodes, elements, boundary_dofs


def run_fea_calculation(inputs: dict) -> dict:
    height = float(inputs.get("height", 4.0))
    span = float(inputs.get("span", 6.0))
    lateral_load = float(inputs.get("lateral_load", 20000.0))  # N
    vertical_load = float(inputs.get("vertical_load", -50000.0))  # N
    support_type = str(inputs.get("support_type", "fixed"))
    E = float(inputs.get("E", 2.0e11))  # Pa
    A = float(inputs.get("A", 0.01))  # m^2
    I_val = float(inputs.get("I", 1.0e-5))  # m^4

    nodes = [
        {"id": 1, "x": 0.0, "y": 0.0},
        {"id": 2, "x": 0.0, "y": height},
        {"id": 3, "x": span, "y": height},
        {"id": 4, "x": span, "y": 0.0}
    ]

    # Model members. Columns have 0 UDL, Beam has UDL from vertical load / span
    # We apply vertical load as a UDL along the beam to verify UDL integration
    beam_udl = abs(vertical_load) / span if vertical_load < 0 else 0.0

    elements = [
        {"id": 1, "node_i": 1, "node_j": 2, "E": E, "A": A, "I": I_val, "udl": 0.0},
        {"id": 2, "node_i": 2, "node_j": 3, "E": E, "A": A, "I": I_val, "udl": beam_udl},
        {"id": 3, "node_i": 3, "node_j": 4, "E": E, "A": A, "I": I_val, "udl": 0.0}
    ]

    # Nodal point loads (we apply lateral load to Node 2, and point load at Node 3 if not fully UDL)
    loads = [
        {"node_id": 2, "fx": lateral_load, "fy": 0.0, "mz": 0.0}
    ]

    is_fixed = (support_type == "fixed")
    supports = [
        {"node_id": 1, "ux": True, "uy": True, "rz": is_fixed},
        {"node_id": 4, "ux": True, "uy": True, "rz": is_fixed}
    ]

    sol = solve_2d_frame(nodes, elements, loads, supports)

    if sol.get("status") == "error":
        return {
            "status": "fail",
            "summary": {"message": sol.get("message")},
            "steps": [],
            "warnings": [],
            "errors": [sol.get("message")],
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    displacements = sol.get("displacements", [])

    # Let's calculate some summary values
    ux_vals = [d["ux"] for d in displacements]
    uy_vals = [d["uy"] for d in displacements]
    max_ux = max(ux_vals, key=abs)
    max_uy = max(uy_vals, key=abs)

    summary = {
        "height_m": height,
        "span_m": span,
        "lateral_load_kn": lateral_load / 1000.0,
        "vertical_load_kn": vertical_load / 1000.0,
        "support_type": support_type,
        "max_displacement_x_mm": max_ux * 1000.0,
        "max_displacement_y_mm": max_uy * 1000.0,
    }

    # Let's create calculation steps
    steps = [
        {
            "step_number": 1,
            "title": "FEA Geometry Assembly",
            "formula": "Nodes = 4, Elements = 3, DOFs = 12",
            "substitution": f"Height = {height}m, Span = {span}m",
            "result": "Assembled Global Stiffness Matrix K (12x12)",
            "unit": "",
            "reference": "Direct Stiffness Method"
        },
        {
            "step_number": 2,
            "title": "Boundary Conditions & Loads",
            "formula": f"Supports = {support_type}",
            "substitution": f"Fx2 = {lateral_load/1000.0} kN, UDL_beam = {beam_udl/1000.0} kN/m",
            "result": "Applied Penalty Method Constraints",
            "unit": "",
            "reference": "FEA Boundary Solver"
        },
        {
            "step_number": 3,
            "title": "Solve Equilibrium Equations",
            "formula": "K * U = F",
            "substitution": "U = K^-1 * F",
            "result": f"Max Horizontal Disp = {max_ux * 1000.0:.3f} mm, Max Vertical Disp = {max_uy * 1000.0:.3f} mm",
            "unit": "mm",
            "reference": "Linear Equation Solver"
        }
    ]

    warnings = []
    limit_x = height / 250.0
    if abs(max_ux) > limit_x:
        warnings.append(f"Max horizontal deflection ({abs(max_ux)*1000.0:.1f} mm) exceeds height/250 limit ({limit_x*1000.0:.1f} mm)")
    limit_y = span / 250.0
    if abs(max_uy) > limit_y:
        warnings.append(f"Max vertical deflection ({abs(max_uy)*1000.0:.1f} mm) exceeds span/250 limit ({limit_y*1000.0:.1f} mm)")

    return {
        "status": "pass",
        "summary": summary,
        "steps": steps,
        "warnings": warnings,
        "errors": [],
        "nodes": nodes,
        "elements": elements,
        "displacements": displacements,
        "element_results": sol.get("element_results", []),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
