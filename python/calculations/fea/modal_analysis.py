"""
FEA Modal Analysis — natural frequencies and mode shapes for 2D frame.

Solves the generalized eigenvalue problem: K·φ = ω²·M·φ
using the consistent mass matrix for Euler-Bernoulli beam elements.

Returns:
  - Natural frequencies f_n (Hz) and periods T_n (s)
  - Mode shape vectors φ_n (normalized to unit modal mass)
  - Effective modal masses M_n* and mass participation factors
  - Modal stiffnesses k_n*
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np


# ---------------------------------------------------------------------------
# Consistent mass matrix (local frame, 6 DOF: [ux_i, uy_i, rz_i, ux_j, uy_j, rz_j])
# ---------------------------------------------------------------------------

def _beam_mass_local(rho: float, A: float, L: float) -> np.ndarray:
    """Consistent mass matrix for 2D Euler-Bernoulli beam in local coordinates."""
    c = rho * A * L / 420.0
    M = np.array([
        [140,   0,      0,    70,    0,      0   ],
        [  0, 156,    22*L,    0,   54,   -13*L  ],
        [  0,  22*L, 4*L**2,  0,   13*L, -3*L**2],
        [ 70,   0,      0,   140,    0,      0   ],
        [  0,  54,    13*L,   0,  156,  -22*L    ],
        [  0,-13*L, -3*L**2,  0,  -22*L, 4*L**2 ],
    ], dtype=float)
    return c * M


def _rotation_matrix(dx: float, dy: float, L: float) -> np.ndarray:
    """6×6 transformation matrix from local to global frame."""
    c = dx / L
    s = dy / L
    T = np.zeros((6, 6))
    R = np.array([[c, s, 0], [-s, c, 0], [0, 0, 1]])
    T[0:3, 0:3] = R
    T[3:6, 3:6] = R
    return T


# ---------------------------------------------------------------------------
# Global assembly
# ---------------------------------------------------------------------------

def _assemble_mass(
    nodes: list[dict],
    elements: list[dict],
    rho: float = 7850.0,
) -> tuple[np.ndarray, list[int]]:
    """
    Assemble global consistent mass matrix.
    Returns (M_global, free_dof_indices).
    rho: material density kg/m³ (default steel 7850)
    """
    n_nodes = len(nodes)
    n_dof = 3 * n_nodes
    M = np.zeros((n_dof, n_dof))

    node_map = {nd["id"]: i for i, nd in enumerate(nodes)}

    for el in elements:
        ni_idx = node_map[el["node_i"]]
        nj_idx = node_map[el["node_j"]]
        ni = nodes[ni_idx]
        nj = nodes[nj_idx]
        dx = nj["x"] - ni["x"]
        dy = nj["y"] - ni["y"]
        L = math.sqrt(dx ** 2 + dy ** 2)
        if L < 1e-10:
            continue

        A = float(el.get("A", 0.01))
        T = _rotation_matrix(dx, dy, L)
        M_loc = _beam_mass_local(rho, A, L)
        M_glob = T.T @ M_loc @ T

        dofs = [3 * ni_idx, 3 * ni_idx + 1, 3 * ni_idx + 2,
                3 * nj_idx, 3 * nj_idx + 1, 3 * nj_idx + 2]
        for a, da in enumerate(dofs):
            for b, db in enumerate(dofs):
                M[da, db] += M_glob[a, b]

    return M, list(range(n_dof))


# ---------------------------------------------------------------------------
# Modal solver
# ---------------------------------------------------------------------------

def run_modal_analysis(
    nodes: list[dict],
    elements: list[dict],
    K_global: np.ndarray,
    boundary_dofs: list[int],
    rho: float = 7850.0,
    n_modes: int = 6,
) -> dict[str, Any]:
    """
    Solve generalized eigenvalue problem K·φ = ω²·M·φ.

    K_global: assembled global stiffness matrix (must be provided from static solver)
    boundary_dofs: list of DOF indices that are fixed (zero displacement)
    rho: mass density (kg/m³)
    n_modes: number of modes to extract
    """
    n_dof = K_global.shape[0]
    M_global, _ = _assemble_mass(nodes, elements, rho)

    # Free DOFs
    all_dofs = list(range(n_dof))
    free_dofs = [d for d in all_dofs if d not in boundary_dofs]

    K_ff = K_global[np.ix_(free_dofs, free_dofs)]
    M_ff = M_global[np.ix_(free_dofs, free_dofs)]

    n_free = len(free_dofs)
    n_modes_actual = min(n_modes, n_free - 1)

    try:
        # scipy generalized eigenvalue for symmetric positive-definite pair
        from scipy.linalg import eigh
        eigenvalues, eigenvectors = eigh(K_ff, M_ff, subset_by_index=[0, n_modes_actual - 1])
    except ImportError:
        # Fallback: numpy standard eigenvalue (less stable for near-singular M)
        M_inv = np.linalg.pinv(M_ff)
        A_mat = M_inv @ K_ff
        raw_vals, raw_vecs = np.linalg.eigh(A_mat)
        idx = np.argsort(raw_vals)
        eigenvalues = raw_vals[idx[:n_modes_actual]]
        eigenvectors = raw_vecs[:, idx[:n_modes_actual]]

    # Clip negative eigenvalues (numerical noise)
    eigenvalues = np.maximum(eigenvalues, 0.0)

    # Natural frequencies and periods
    omega_n = np.sqrt(eigenvalues)
    f_n = omega_n / (2 * math.pi)
    T_n = np.where(f_n > 1e-8, 1.0 / f_n, float("inf"))

    # Modal masses and participation (for horizontal excitation: direction = x)
    # Influence vector r: unit horizontal displacement at all free DOFs
    # For 3-DOF/node: x-DOF is at position 0, 3, 6, ... in the free DOF list
    r_x = np.zeros(n_free)
    r_y = np.zeros(n_free)
    for i, d in enumerate(free_dofs):
        if d % 3 == 0:
            r_x[i] = 1.0  # x-DOF
        elif d % 3 == 1:
            r_y[i] = 1.0  # y-DOF

    M_total_x = float(r_x @ M_ff @ r_x)
    M_total_y = float(r_y @ M_ff @ r_y)

    modes = []
    for k in range(n_modes_actual):
        phi = eigenvectors[:, k]
        # Modal mass (already = 1.0 if mass-normalized, but verify)
        m_k = float(phi @ M_ff @ phi)
        # Participation factors
        Gamma_x = float(phi @ M_ff @ r_x) / max(m_k, 1e-15)
        Gamma_y = float(phi @ M_ff @ r_y) / max(m_k, 1e-15)
        # Effective modal mass
        M_eff_x = (Gamma_x ** 2) * m_k
        M_eff_y = (Gamma_y ** 2) * m_k

        # Expand to full DOF vector (zeros at fixed DOFs)
        phi_full = np.zeros(n_dof)
        for i, d in enumerate(free_dofs):
            phi_full[d] = phi[i]

        # Extract per-node displacements
        shape_nodes = []
        for i, nd in enumerate(nodes):
            ux = float(phi_full[3 * i])
            uy = float(phi_full[3 * i + 1])
            rz = float(phi_full[3 * i + 2])
            shape_nodes.append({"node_id": nd["id"], "ux": ux, "uy": uy, "rz": rz})

        modes.append({
            "mode": k + 1,
            "omega_rad_s": round(float(omega_n[k]), 4),
            "freq_hz": round(float(f_n[k]), 4),
            "period_s": round(float(T_n[k]), 4),
            "modal_mass_kg": round(m_k, 2),
            "participation_x": round(Gamma_x, 4),
            "participation_y": round(Gamma_y, 4),
            "effective_mass_x_kg": round(M_eff_x, 2),
            "effective_mass_y_kg": round(M_eff_y, 2),
            "mass_participation_x_pct": round(M_eff_x / max(M_total_x, 1) * 100, 2),
            "mass_participation_y_pct": round(M_eff_y / max(M_total_y, 1) * 100, 2),
            "shape": shape_nodes,
        })

    cum_mass_x = 0.0
    for m in modes:
        cum_mass_x += m["mass_participation_x_pct"]

    return {
        "status": "ok",
        "n_modes": len(modes),
        "modes": modes,
        "total_mass_x_kg": round(M_total_x, 2),
        "total_mass_y_kg": round(M_total_y, 2),
        "cumulative_mass_participation_x_pct": round(cum_mass_x, 2),
    }
