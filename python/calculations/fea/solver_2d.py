"""Lightweight 2D Finite Element Analysis Solver (Direct Stiffness Method)."""

import numpy as np

def solve_2d_frame(nodes: list[dict], elements: list[dict], loads: list[dict], supports: list[dict]) -> dict:
    """
    Solves a 2D frame using the Direct Stiffness Method.
    Inputs:
    - nodes: [{'id': 1, 'x': 0, 'y': 0}, ...]
    - elements: [{'id': 1, 'node_i': 1, 'node_j': 2, 'E': 200e9, 'A': 0.01, 'I': 1e-5}, ...]
    - loads: [{'node_id': 2, 'fx': 0, 'fy': -10000, 'mz': 0}, ...]
    - supports: [{'node_id': 1, 'ux': True, 'uy': True, 'rz': True}, ...] (True means fixed)
    
    Returns displacements and element forces.
    """
    num_nodes = len(nodes)
    ndof = 3 * num_nodes
    
    node_idx = {n['id']: i for i, n in enumerate(nodes)}
    
    K = np.zeros((ndof, ndof))
    F = np.zeros(ndof)
    
    # Assembly
    for el in elements:
        i = node_idx[el['node_i']]
        j = node_idx[el['node_j']]
        
        xi, yi = nodes[i]['x'], nodes[i]['y']
        xj, yj = nodes[j]['x'], nodes[j]['y']
        
        L = np.hypot(xj - xi, yj - yi)
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
                
    # Apply loads
    for p in loads:
        i = node_idx[p['node_id']]
        F[3*i] += p.get('fx', 0)
        F[3*i+1] += p.get('fy', 0)
        F[3*i+2] += p.get('mz', 0)
        
    # Apply supports (Penalty Method)
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
        return {"status": "error", "message": "Singular matrix - structure is unstable"}
        
    # Format Output
    displacements = []
    for n in nodes:
        i = node_idx[n['id']]
        displacements.append({
            'node_id': n['id'],
            'ux': U[3*i],
            'uy': U[3*i+1],
            'rz': U[3*i+2]
        })
        
    return {
        "status": "success",
        "displacements": displacements,
        # Element forces could be calculated here as k_local @ T @ U_local
    }
