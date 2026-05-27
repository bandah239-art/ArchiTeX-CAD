"""
Winkler Foundation — Beam on Elastic Foundation (Hetényi 1946).

Solves the 4th-order ODE:  EI·y'''' + ks·B·y = q(x)

Numerical FEM approach — Euler-Bernoulli beam elements with distributed
Winkler spring stiffness.  Supports:
  - Uniform distributed load (UDL)
  - Central point load
  - End point load
  - Multiple point loads (via loads list)

Returns deflection, rotation, bending moment, shear, and contact pressure
at n_pts points along the beam.

References:
  Hetényi M. (1946) "Beams on Elastic Foundation", U Michigan Press.
  Bowles J.E. (1996) "Foundation Analysis and Design", 5th ed., §9-4.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np


# ---------------------------------------------------------------------------
# Element matrices
# ---------------------------------------------------------------------------

def _beam_stiffness_local(EI: float, L: float) -> np.ndarray:
    """4×4 Euler-Bernoulli beam element stiffness [w_i, θ_i, w_j, θ_j]."""
    k = EI / L**3
    return np.array([
        [ 12,   6*L,  -12,   6*L],
        [  6*L, 4*L**2, -6*L, 2*L**2],
        [-12,  -6*L,   12,  -6*L],
        [  6*L, 2*L**2, -6*L, 4*L**2],
    ]) * k


def _winkler_stiffness_local(ks: float, B: float, L: float) -> np.ndarray:
    """4×4 consistent Winkler spring matrix for one element."""
    k_w = ks * B * L / 420.0
    return np.array([
        [156,   22*L,   54,  -13*L],
        [ 22*L,  4*L**2, 13*L, -3*L**2],
        [ 54,   13*L,  156,  -22*L],
        [-13*L, -3*L**2, -22*L,  4*L**2],
    ]) * k_w


def _udl_force_vector(q: float, L: float) -> np.ndarray:
    """Consistent nodal force vector for UDL q (N/m) on element."""
    return np.array([q*L/2, q*L**2/12, q*L/2, -q*L**2/12])


# ---------------------------------------------------------------------------
# Assembler
# ---------------------------------------------------------------------------

def _assemble(n_el: int, EI: float, ks: float, B: float, L_el: float):
    """Assemble global K (2*(n_el+1) DOFs: alternating w, θ per node)."""
    n_nodes = n_el + 1
    n_dof = 2 * n_nodes
    K = np.zeros((n_dof, n_dof))
    for i in range(n_el):
        Ke = _beam_stiffness_local(EI, L_el) + _winkler_stiffness_local(ks, B, L_el)
        dofs = [2*i, 2*i+1, 2*i+2, 2*i+3]
        for r in range(4):
            for c in range(4):
                K[dofs[r], dofs[c]] += Ke[r, c]
    return K


def _apply_bc(K: np.ndarray, F: np.ndarray, fixed_dofs: list[int]):
    """Apply zero-displacement BCs via penalty method."""
    penalty = np.max(np.abs(K)) * 1e10
    for d in fixed_dofs:
        K[d, :] = 0.0
        K[:, d] = 0.0
        K[d, d] = penalty
        F[d] = 0.0


# ---------------------------------------------------------------------------
# Main solver
# ---------------------------------------------------------------------------

def run_winkler(
    L_m: float = 10.0,         # beam length (m)
    B_m: float = 1.0,          # beam width (m)
    EI_knm2: float = 50000.0,  # flexural rigidity EI (kN·m²)
    ks_knm3: float = 20000.0,  # modulus of subgrade reaction (kN/m³)
    load_type: str = "udl",    # "udl", "point_center", "point_end", "point_list"
    q_knm: float = 50.0,       # UDL (kN/m) — used for load_type="udl"
    P_kn: float = 100.0,       # point load (kN) — for point load types
    point_loads: list[dict] | None = None,  # [{"x_m": 3.0, "P_kn": 50.0}, ...]
    support: str = "free",     # "free" (both ends free), "pinned_both", "fixed_both", "cantilever"
    n_el: int = 40,            # number of elements
) -> dict[str, Any]:
    """
    Finite element solution of beam on Winkler elastic foundation.

    EI in kN·m², ks in kN/m³ — internally consistent unit system (kN, m).
    """
    L_el = L_m / n_el
    n_nodes = n_el + 1

    # Convert to SI base for λ calculation, keep kN-m for FEM
    EI = EI_knm2         # kN·m²
    ks = ks_knm3         # kN/m³
    B = B_m              # m

    # Characteristic length (Hetényi) — for reference
    k_total = ks * B     # kN/m² per unit length
    if EI > 0 and k_total > 0:
        lam = (k_total / (4.0 * EI)) ** 0.25   # 1/m
        char_length = 1.0 / lam                  # m
    else:
        lam = 0.0
        char_length = float("inf")

    # Assemble
    K = _assemble(n_el, EI, ks, B, L_el)
    F = np.zeros(2 * n_nodes)

    # Apply loads
    if load_type == "udl":
        q = q_knm  # kN/m
        for i in range(n_el):
            fe = _udl_force_vector(q, L_el)
            dofs = [2*i, 2*i+1, 2*i+2, 2*i+3]
            for j in range(4):
                F[dofs[j]] += fe[j]

    elif load_type == "point_center":
        mid = n_nodes // 2
        F[2 * mid] += P_kn

    elif load_type == "point_end":
        # Load at right end
        F[2 * (n_nodes - 1)] += P_kn

    elif load_type == "point_list" and point_loads:
        for pl in point_loads:
            x_pos = float(pl.get("x_m", 0.0))
            P_val = float(pl.get("P_kn", 0.0))
            # Find nearest node
            node = int(round(x_pos / L_el))
            node = max(0, min(n_nodes - 1, node))
            F[2 * node] += P_val

    # Boundary conditions
    fixed_dofs: list[int] = []
    if support == "pinned_both":
        fixed_dofs = [0, 2 * n_el]  # w=0 at both ends
    elif support == "fixed_both":
        fixed_dofs = [0, 1, 2 * n_el, 2 * n_el + 1]
    elif support == "cantilever":
        fixed_dofs = [0, 1]  # clamp at left end
    # "free" = no external BCs (Winkler springs provide all support)

    _apply_bc(K, F, fixed_dofs)

    # Solve
    try:
        u = np.linalg.solve(K, F)
    except np.linalg.LinAlgError:
        return {"status": "error", "error": "Singular system — check supports/loading"}

    # Extract results at each node
    x_nodes = [i * L_el for i in range(n_nodes)]
    w = [float(u[2*i]) for i in range(n_nodes)]        # deflection (m, +ve down)
    theta = [float(u[2*i+1]) for i in range(n_nodes)]  # rotation (rad)

    # Bending moments and shear forces from element curvature
    # M = EI·d²w/dx²  ≈ EI·[6/L²·w_i + 2/L·θ_i - 6/L²·w_j + 2/L·θ_j] at midpoint
    moments = []   # kN·m
    shears = []    # kN
    for i in range(n_el):
        wi, ti, wj, tj = u[2*i], u[2*i+1], u[2*i+2], u[2*i+3]
        # Midpoint moment from shape functions
        M_mid = EI * (6/(L_el**2)*(wi - wj) + 2/L_el*(ti + tj) * 0.5)
        Q_avg = EI * (12/(L_el**3)*(wi - wj) + 6/(L_el**2)*(ti + tj))
        moments.append(round(float(M_mid), 4))
        shears.append(round(float(Q_avg), 4))

    # Contact pressure p = ks × B × w (kN/m²)
    contact_pressure = [round(ks * B * wi, 4) for wi in w]

    # Build n_pts output for plotting (interpolated at element midpoints plus nodes)
    x_out = [round(x, 4) for x in x_nodes]
    w_mm = [round(wi * 1000.0, 4) for wi in w]   # convert to mm

    # Peak values
    max_defl_mm = max(abs(wi) for wi in w_mm)
    max_moment = max(abs(m) for m in moments) if moments else 0.0
    max_shear = max(abs(q) for q in shears) if shears else 0.0
    max_contact = max(abs(p) for p in contact_pressure)

    # Reference settlement (rigid plate — for comparison)
    total_load = sum(abs(F[2*i]) for i in range(n_nodes))
    uniform_settlement_mm = (total_load / (ks * B * L_m)) * 1000.0 if ks * B * L_m > 0 else 0.0

    # Classification by relative stiffness (Bowles §9-4)
    relative_stiffness = lam * L_m
    if relative_stiffness < math.pi / 4:
        beam_class = "rigid"
    elif relative_stiffness < math.pi:
        beam_class = "semi-flexible"
    else:
        beam_class = "flexible"

    steps = [
        {
            "step_number": 1,
            "title": "Characteristic Length (Hetényi)",
            "formula": "λ = (ks·B / 4EI)^0.25  |  Lc = 1/λ",
            "substitution": f"ks={ks} kN/m³, B={B}m, EI={EI} kN·m²",
            "result": f"λ = {lam:.4f} 1/m  |  Lc = {char_length:.2f} m",
            "unit": "1/m",
            "reference": "Hetényi (1946) §2",
        },
        {
            "step_number": 2,
            "title": "Relative Stiffness & Beam Classification",
            "formula": "λL classification: <π/4=rigid, <π=semi-flexible, >π=flexible",
            "substitution": f"λ×L = {lam:.4f}×{L_m} = {relative_stiffness:.3f}",
            "result": f"Beam is {beam_class.upper()} (λL = {relative_stiffness:.3f})",
            "unit": "-",
            "reference": "Bowles §9-4",
        },
        {
            "step_number": 3,
            "title": "FEM Assembly & Solution",
            "formula": "(K_beam + K_winkler)·u = F",
            "substitution": f"{n_el} elements, {2*n_nodes} DOFs, support={support}",
            "result": f"Max deflection = {max_defl_mm:.2f} mm  |  Contact pressure = {max_contact:.1f} kN/m²",
            "unit": "mm / kN/m²",
            "reference": "FEM — consistent spring matrix",
        },
        {
            "step_number": 4,
            "title": "Internal Forces",
            "formula": "M = EI·κ  |  Q = dM/dx",
            "substitution": f"EI = {EI} kN·m²",
            "result": f"Max M = {max_moment:.2f} kN·m  |  Max Q = {max_shear:.2f} kN",
            "unit": "kN·m / kN",
            "reference": "Beam theory",
        },
    ]

    # Moment and shear at all x_out points (interpolate element values)
    # Use node-based linear interpolation for plotting
    moment_out = []
    shear_out = []
    for i in range(n_nodes):
        el = min(i, n_el - 1)
        moment_out.append(moments[el])
        shear_out.append(shears[el])

    status = "pass"
    warnings = []
    if max_defl_mm > 25.0:
        warnings.append(f"Maximum deflection {max_defl_mm:.1f} mm exceeds 25 mm — review subgrade stiffness.")
    if max_contact > ks * B * max_defl_mm / 1000 * 2:
        pass  # expected
    if beam_class == "rigid":
        warnings.append("Beam behaves as rigid — contact pressure distribution is nearly uniform.")

    return {
        "status": status,
        "summary": {
            "char_length_m": round(char_length, 3),
            "lambda_per_m": round(lam, 5),
            "relative_stiffness": round(relative_stiffness, 3),
            "beam_class": beam_class,
            "max_deflection_mm": round(max_defl_mm, 3),
            "max_moment_knm": round(max_moment, 3),
            "max_shear_kn": round(max_shear, 3),
            "max_contact_pressure_knm2": round(max_contact, 3),
            "uniform_settlement_ref_mm": round(uniform_settlement_mm, 3),
            "n_elements": n_el,
        },
        "steps": steps,
        "warnings": warnings,
        "errors": [],
        "profile": {
            "x_m": x_out,
            "deflection_mm": w_mm,
            "moment_knm": moment_out,
            "shear_kn": shear_out,
            "contact_pressure_knm2": contact_pressure,
        },
    }
