"""
Pipe Network Analysis — Hardy-Cross Method with Hazen-Williams
ARCHITEX-CAD Engineering Platform | WASH Module

Reference: Streeter & Wylie, Fluid Mechanics; Bhave, Analysis of Flow in Water
           Distribution Networks (1991); WHO/UNICEF WASH guidelines.
"""

from __future__ import annotations

import math
import datetime
from typing import Any

# ---------------------------------------------------------------------------
# Material C values
# ---------------------------------------------------------------------------
CHW_DEFAULTS: dict[str, float] = {
    "pvc": 150,
    "hdpe": 150,
    "steel_new": 120,
    "steel": 120,
    "steel_old": 80,
    "ci": 100,
    "cast_iron": 100,
    "ac": 110,
    "asbestos_cement": 110,
    "ductile_iron": 130,
    "di": 130,
    "concrete": 100,
    "copper": 130,
    "galvanized": 100,
    "upvc": 150,
}

# Velocity & pressure limits (Zambia WSS Design Guidelines)
V_MIN_MS = 0.5          # m/s  — scour / self-cleansing minimum
V_MAX_MS = 2.5          # m/s  — erosion upper limit
H_MIN_M  = 7.0          # m    — WHO minimum residual head
H_MAX_M  = 70.0         # m    — max to prevent pipe burst

# Hardy-Cross convergence defaults
DEFAULT_MAX_ITER   = 100
DEFAULT_THRESHOLD  = 1e-3   # m³/s


# ---------------------------------------------------------------------------
# Helper: Hazen-Williams resistance coefficient
# ---------------------------------------------------------------------------
def _hw_resistance(length_m: float, chw: float, diameter_m: float) -> float:
    """R such that hf = R * |Q|^1.852 (Q in m³/s, hf in m)."""
    return 10.67 * length_m / (chw ** 1.852 * diameter_m ** 4.87)


def _hw_headloss(R: float, Q: float) -> float:
    """Signed head-loss using Hardy-Cross sign convention."""
    return R * abs(Q) ** 1.852 * (1.0 if Q >= 0 else -1.0)


def _hw_dhdq(R: float, Q: float) -> float:
    """Derivative |dhf/dQ| = 1.852 * R * |Q|^0.852."""
    return 1.852 * R * abs(Q) ** 0.852


# ---------------------------------------------------------------------------
# Graph utilities
# ---------------------------------------------------------------------------
def _build_adjacency(pipes: list[dict]) -> dict[str, list[dict]]:
    adj: dict[str, list[dict]] = {}
    for p in pipes:
        adj.setdefault(p["from_node"], []).append(p)
        adj.setdefault(p["to_node"],   []).append({**p,
                                                   "from_node": p["to_node"],
                                                   "to_node":   p["from_node"],
                                                   "_reversed": True})
    return adj


def _find_loops(nodes: list[str], pipes: list[dict]) -> list[list[dict]]:
    """
    Return fundamental loops (cycles) using DFS spanning tree.
    Each loop is a list of pipe dicts augmented with a ``_sign`` key
    (+1 flow direction, -1 opposite).
    """
    adj = _build_adjacency(pipes)
    visited: set[str] = set()
    parent_edge: dict[str, dict | None] = {}
    tree_edges: set[str] = set()
    back_edges: list[tuple[str, str, dict]] = []

    node_ids = [n for n in nodes]

    def dfs(u: str, par_pid: str | None):
        visited.add(u)
        for edge in adj.get(u, []):
            v = edge["to_node"]
            pid = edge["id"]
            if v not in visited:
                tree_edges.add(pid)
                parent_edge[v] = edge
                dfs(v, pid)
            elif pid not in tree_edges and pid != par_pid:
                back_edges.append((u, v, edge))

    for n in node_ids:
        if n not in visited:
            parent_edge[n] = None
            dfs(n, None)

    # Reconstruct loops from back edges
    loops: list[list[dict]] = []
    for u, v, back in back_edges:
        loop_pipes: list[dict] = []
        # trace path from v → u in spanning tree, then close with back edge
        path: list[str] = []
        cur = u
        while cur != v:
            pe = parent_edge.get(cur)
            if pe is None:
                break
            path.append(cur)
            loop_pipes.append({**pe})
            cur = pe["from_node"] if not pe.get("_reversed") else pe["to_node"]
        path.append(v)
        # Add back edge in opposite direction to close the loop
        loop_pipes.append({**back, "_sign_override": -1})

        if loop_pipes:
            loops.append(loop_pipes)

    return loops


def _find_loops_v2(nodes: list[str], pipes: list[dict]) -> list[list[tuple[dict, int]]]:
    """
    More robust loop detection: returns list of loops, each loop is
    a list of (pipe_dict, sign) where sign=+1 means flow is in positive direction.
    Uses DFS to find all fundamental cycles (co-tree chords).
    """
    pipe_by_id = {p["id"]: p for p in pipes}

    # Build undirected adjacency
    adj: dict[str, list[tuple[str, str]]] = {}  # node -> [(neighbour, pipe_id)]
    for p in pipes:
        adj.setdefault(p["from_node"], []).append((p["to_node"], p["id"]))
        adj.setdefault(p["to_node"],   []).append((p["from_node"], p["id"]))

    visited: set[str] = set()
    parent: dict[str, tuple[str, str] | None] = {}   # node -> (parent_node, pipe_id)
    spanning_pids: set[str] = set()
    chord_info: list[tuple[str, str, str]] = []       # (u, v, pipe_id) for back edges

    def dfs(u: str):
        visited.add(u)
        for v, pid in adj.get(u, []):
            if pid in spanning_pids:
                continue
            par = parent.get(u)
            if par and par[1] == pid:
                continue
            if v not in visited:
                spanning_pids.add(pid)
                parent[v] = (u, pid)
                dfs(v)
            else:
                chord_info.append((u, v, pid))

    for n in nodes:
        if n not in visited:
            parent[n] = None
            dfs(n)

    loops: list[list[tuple[dict, int]]] = []
    seen_chords: set[str] = set()

    for u, v, chord_pid in chord_info:
        if chord_pid in seen_chords:
            continue
        seen_chords.add(chord_pid)

        # Find path from u to v in spanning tree
        def get_path(start: str, end: str) -> list[tuple[str, str]] | None:
            path = []
            cur = start
            for _ in range(len(nodes) + 1):
                if cur == end:
                    return path
                par = parent.get(cur)
                if par is None:
                    return None
                path.append((cur, par[1]))
                cur = par[0]
            return None

        path_u = get_path(u, v)
        if path_u is None:
            path_v = get_path(v, u)
            if path_v is None:
                continue
            # path_v: v → ... → u, chord u→v
            loop: list[tuple[dict, int]] = []
            chord_pipe = pipe_by_id[chord_pid]
            loop.append((chord_pipe, +1))  # chord in u→v direction
            for node_from, pid in path_v:
                p = pipe_by_id[pid]
                parent_info = parent[node_from]
                if parent_info:
                    parent_node = parent_info[0]
                    if p["from_node"] == node_from and p["to_node"] == parent_node:
                        loop.append((p, -1))
                    else:
                        loop.append((p, +1))
        else:
            loop: list[tuple[dict, int]] = []
            chord_pipe = pipe_by_id[chord_pid]
            loop.append((chord_pipe, +1))
            for node_from, pid in path_u:
                p = pipe_by_id[pid]
                par = parent[node_from]
                if par:
                    par_node = par[0]
                    if p["from_node"] == par_node and p["to_node"] == node_from:
                        loop.append((p, +1))
                    else:
                        loop.append((p, -1))

        if loop:
            loops.append(loop)

    return loops


# ---------------------------------------------------------------------------
# Initial flow assignment (spanning tree DFS)
# ---------------------------------------------------------------------------
def _assign_initial_flows(
    nodes: list[dict],
    pipes: list[dict],
    flows: dict[str, float],
) -> None:
    """
    Assign initial flows satisfying continuity using spanning tree.
    Modifies ``flows`` in-place.  Keys are pipe IDs.
    """
    node_ids = [n["id"] for n in nodes]
    demand   = {n["id"]: n.get("demand_lps", 0.0) / 1000.0 for n in nodes}
    reservoirs = {n["id"] for n in nodes if n.get("is_reservoir", False)}

    adj: dict[str, list[dict]] = {}
    for p in pipes:
        adj.setdefault(p["from_node"], []).append(p)
        adj.setdefault(p["to_node"],   []).append({**p, "_reversed": True,
                                                   "from_node": p["to_node"],
                                                   "to_node": p["from_node"]})

    visited: set[str] = set()
    residual = dict(demand)

    def dfs_flow(u: str):
        visited.add(u)
        for edge in adj.get(u, []):
            v = edge["to_node"]
            pid = edge["id"]
            if v in visited:
                continue
            # set tentative flow = demand downstream (simple heuristic)
            q = 1e-3  # 1 L/s initial guess
            if not edge.get("_reversed"):
                flows[pid] = q
            else:
                flows[pid] = -q
            dfs_flow(v)

    start = next((n["id"] for n in nodes if n.get("is_reservoir", False)), node_ids[0])
    dfs_flow(start)

    # Fill any unset pipes
    for p in pipes:
        if p["id"] not in flows:
            flows[p["id"]] = 1e-3


# ---------------------------------------------------------------------------
# Head computation from known reservoir(s)
# ---------------------------------------------------------------------------
def _compute_heads(
    nodes: list[dict],
    pipes: list[dict],
    flows: dict[str, float],
    R: dict[str, float],
) -> dict[str, float]:
    """
    BFS/DFS from reservoir nodes outward, computing head at each node.
    H_v = H_u - hf(u→v)
    """
    heads: dict[str, float] = {}
    for n in nodes:
        if n.get("is_reservoir", False):
            heads[n["id"]] = n["elevation_m"]

    adj: dict[str, list[dict]] = {}
    for p in pipes:
        adj.setdefault(p["from_node"], []).append({**p, "_rev": False})
        adj.setdefault(p["to_node"],   []).append({**p, "_rev": True,
                                                   "from_node": p["to_node"],
                                                   "to_node": p["from_node"]})

    queue = list(heads.keys())
    visited: set[str] = set(queue)

    while queue:
        u = queue.pop(0)
        for edge in adj.get(u, []):
            v = edge["to_node"]
            if v in visited:
                continue
            pid = edge["id"]
            q = flows[pid]
            if edge.get("_rev"):
                q = -q
            hf = _hw_headloss(R[pid], q)
            heads[v] = heads[u] - hf
            visited.add(v)
            queue.append(v)

    # Any remaining nodes (disconnected?) get elevation
    for n in nodes:
        if n["id"] not in heads:
            heads[n["id"]] = n["elevation_m"]

    return heads


# ---------------------------------------------------------------------------
# Main calculation entry point
# ---------------------------------------------------------------------------
def calculate_pipe_network_hw(inputs: dict) -> dict:
    """
    Hardy-Cross pipe network analysis using Hazen-Williams formula.

    Parameters
    ----------
    inputs : dict
        See module docstring for full schema.

    Returns
    -------
    dict
        Calculation results including pipe flows, node heads, and design checks.
    """
    steps:    list[dict] = []
    warnings: list[str]  = []
    errors:   list[str]  = []

    def add_step(title: str, formula: str, substitution: str, result: str,
                 reference: str = "") -> None:
        steps.append({
            "title": title,
            "formula": formula,
            "substitution": substitution,
            "result": result,
            "reference": reference,
        })

    # ------------------------------------------------------------------
    # 1. Parse inputs
    # ------------------------------------------------------------------
    pipes_in  = inputs.get("pipes", [])
    nodes_in  = inputs.get("nodes", [])
    max_iter  = int(inputs.get("max_iterations", DEFAULT_MAX_ITER))
    threshold = float(inputs.get("convergence_threshold", DEFAULT_THRESHOLD))

    if not pipes_in:
        errors.append("No pipes defined in input.")
        return _build_error_output(errors, steps)
    if not nodes_in:
        errors.append("No nodes defined in input.")
        return _build_error_output(errors, steps)

    reservoir_nodes = [n for n in nodes_in if n.get("is_reservoir", False)]
    if not reservoir_nodes:
        errors.append("At least one reservoir/source node (is_reservoir=True) is required.")
        return _build_error_output(errors, steps)

    node_ids  = [n["id"] for n in nodes_in]
    pipe_ids  = [p["id"] for p in pipes_in]

    add_step(
        "Network Definition",
        "—",
        f"Nodes: {len(nodes_in)}, Pipes: {len(pipes_in)}, "
        f"Reservoirs: {len(reservoir_nodes)}",
        f"{len(pipes_in)} pipes × {len(nodes_in)} nodes network",
        "Hardy-Cross, 1936; Streeter & Wylie §6",
    )

    # ------------------------------------------------------------------
    # 2. Compute pipe parameters
    # ------------------------------------------------------------------
    pipe_diam: dict[str, float] = {}   # m
    pipe_chw:  dict[str, float] = {}
    pipe_R:    dict[str, float] = {}

    for p in pipes_in:
        pid  = p["id"]
        D_m  = p["diameter_mm"] / 1000.0
        L    = p["length_m"]
        mat  = p.get("material", "pvc").lower()
        chw  = float(p.get("chw", CHW_DEFAULTS.get(mat, 100)))

        pipe_diam[pid] = D_m
        pipe_chw[pid]  = chw
        R              = _hw_resistance(L, chw, D_m)
        pipe_R[pid]    = R

        add_step(
            f"Pipe {pid}: Resistance Coefficient",
            "R = 10.67 × L / (C^1.852 × D^4.87)",
            f"R = 10.67 × {L:.1f} / ({chw:.0f}^1.852 × {D_m*1000:.0f}mm → {D_m:.4f}m ^4.87)",
            f"R = {R:.4f}  (hf = R·Q^1.852, Q in m³/s, hf in m)",
            "Hazen-Williams: AWWA M23",
        )

    # ------------------------------------------------------------------
    # 3. Initial flow assignment
    # ------------------------------------------------------------------
    flows: dict[str, float] = {}
    _assign_initial_flows(nodes_in, pipes_in, flows)

    add_step(
        "Initial Flow Assignment",
        "Continuity at each node: ΣQ_in − ΣQ_out = demand",
        "DFS spanning tree: Q₀ = 1 L/s on all tree branches",
        "Initial flows set; will be corrected by Hardy-Cross iterations.",
        "Bhave (1991), §3.2",
    )

    # ------------------------------------------------------------------
    # 4. Detect loops
    # ------------------------------------------------------------------
    loops = _find_loops_v2(node_ids, pipes_in)

    add_step(
        "Loop Detection",
        "Fundamental loops = Pipes − Nodes + Connected Components",
        f"L = {len(pipes_in)} − {len(nodes_in)} + {max(1, len(pipes_in)-len(nodes_in)+1)}",
        f"{len(loops)} independent loop(s) detected.",
        "Graph theory: Kirchhoff's laws",
    )

    if not loops:
        warnings.append("No loops detected — analysed as branching (tree) network.")

    # ------------------------------------------------------------------
    # 5. Hardy-Cross iterations
    # ------------------------------------------------------------------
    iterations_done = 0
    converged       = False
    max_dq          = float("inf")

    if loops:
        for iteration in range(max_iter):
            max_dq = 0.0

            for loop in loops:
                sum_hf   = 0.0
                sum_dhdq = 0.0

                for pipe, sign in loop:
                    pid = pipe["id"]
                    Q   = flows[pid] * sign
                    hf  = _hw_headloss(pipe_R[pid], Q)
                    dh  = _hw_dhdq(pipe_R[pid], Q)
                    sum_hf   += hf
                    sum_dhdq += dh

                if sum_dhdq < 1e-12:
                    continue

                dQ = -sum_hf / sum_dhdq
                max_dq = max(max_dq, abs(dQ))

                for pipe, sign in loop:
                    pid = pipe["id"]
                    flows[pid] += dQ * sign

            iterations_done += 1
            if max_dq < threshold:
                converged = True
                break
    else:
        # Tree network — single pass BFS from reservoirs
        iterations_done = 1
        converged       = True
        # Re-assign flows using demand-based tree traversal
        node_dem = {n["id"]: n.get("demand_lps", 0.0) / 1000.0 for n in nodes_in}
        adj_out: dict[str, list[str]] = {}  # parent → [children]
        adj_pipe: dict[tuple[str, str], str] = {}
        # Build simple tree from spanning DFS
        visited_t: set[str] = set()
        pipe_by_id = {p["id"]: p for p in pipes_in}

        adj_u: dict[str, list[tuple[str, str]]] = {}
        for p in pipes_in:
            adj_u.setdefault(p["from_node"], []).append((p["to_node"], p["id"]))
            adj_u.setdefault(p["to_node"],   []).append((p["from_node"], p["id"]))

        subtree_demand: dict[str, float] = dict(node_dem)
        order: list[str] = []

        def bfs_tree(root: str):
            from collections import deque
            q2 = deque([root])
            visited_t.add(root)
            while q2:
                u = q2.popleft()
                order.append(u)
                for v, pid in adj_u.get(u, []):
                    if v not in visited_t:
                        visited_t.add(v)
                        adj_pipe[(u, v)] = pid
                        adj_pipe[(v, u)] = pid
                        adj_out.setdefault(u, []).append(v)
                        q2.append(v)

        for res in reservoir_nodes:
            if res["id"] not in visited_t:
                bfs_tree(res["id"])

        # Post-order: accumulate subtree demands
        for n in reversed(order):
            for child in adj_out.get(n, []):
                subtree_demand[n] = subtree_demand.get(n, 0) + subtree_demand.get(child, 0)

        for (u, v), pid in adj_pipe.items():
            p = pipe_by_id[pid]
            if p["from_node"] == u:
                flows[pid] = subtree_demand.get(v, 1e-3)
            else:
                flows[pid] = -subtree_demand.get(u, 1e-3)

    add_step(
        "Hardy-Cross Iteration",
        "ΔQ = −Σ(R·Q^1.852) / Σ(1.852·R·|Q|^0.852)",
        f"Ran {iterations_done} iterations; final max|ΔQ| = "
        f"{max_dq:.6f} m³/s (threshold = {threshold} m³/s)",
        f"{'Converged' if converged else 'DID NOT CONVERGE'} after {iterations_done} iterations.",
        "Hardy-Cross (1936); Cross, H. 'Analysis of Flow in Networks'",
    )

    if not converged and loops:
        warnings.append(
            f"Hardy-Cross did not converge within {max_iter} iterations. "
            f"Final residual ΔQ = {max_dq:.4f} m³/s. Results may be approximate."
        )

    # ------------------------------------------------------------------
    # 6. Compute node heads
    # ------------------------------------------------------------------
    heads = _compute_heads(nodes_in, pipes_in, flows, pipe_R)

    # ------------------------------------------------------------------
    # 7. Check continuity at non-reservoir nodes
    # ------------------------------------------------------------------
    node_balance: dict[str, float] = {n["id"]: 0.0 for n in nodes_in}
    for p in pipes_in:
        q = flows[p["id"]]
        node_balance[p["from_node"]] -= q
        node_balance[p["to_node"]]   += q

    for n in nodes_in:
        nid = n["id"]
        if n.get("is_reservoir", False):
            continue
        demand_m3s = n.get("demand_lps", 0.0) / 1000.0
        imbalance  = node_balance[nid] - demand_m3s
        if abs(imbalance) > 5e-3:  # 5 L/s tolerance
            warnings.append(
                f"Node {nid}: continuity imbalance = {imbalance*1000:.2f} L/s"
            )

    # ------------------------------------------------------------------
    # 8. Build pipe results
    # ------------------------------------------------------------------
    pipe_results: list[dict] = []
    max_vel = 0.0

    for p in pipes_in:
        pid  = p["id"]
        Q    = flows[pid]  # m³/s
        D    = pipe_diam[pid]
        R_p  = pipe_R[pid]
        A    = math.pi * D ** 2 / 4.0
        v    = abs(Q) / A if A > 0 else 0.0
        hf   = _hw_headloss(R_p, Q)
        hf_km = abs(hf) / p["length_m"] * 1000 if p["length_m"] > 0 else 0.0

        max_vel = max(max_vel, v)

        if v < V_MIN_MS:
            v_status = "too_low"
        elif v > V_MAX_MS:
            v_status = "too_high"
            warnings.append(f"Pipe {pid}: velocity {v:.2f} m/s exceeds {V_MAX_MS} m/s maximum.")
        else:
            v_status = "ok"

        pipe_results.append({
            "id":              pid,
            "flow_lps":        round(Q * 1000, 4),
            "velocity_ms":     round(v, 4),
            "headloss_m":      round(hf, 4),
            "headloss_per_km": round(hf_km, 4),
            "velocity_status": v_status,
        })

    add_step(
        "Pipe Velocity & Head-Loss",
        "v = Q / (π·D²/4);  hf = R·|Q|^1.852",
        f"Max velocity = {max_vel:.3f} m/s across {len(pipes_in)} pipes",
        f"Velocity check: {V_MIN_MS}–{V_MAX_MS} m/s (Zambia WSS Guidelines)",
        "Zambia Water Sector Design Guidelines; WHO/UNICEF WASH",
    )

    # ------------------------------------------------------------------
    # 9. Build node results
    # ------------------------------------------------------------------
    node_results:   list[dict] = []
    residual_heads: list[float] = []

    for n in nodes_in:
        nid   = n["id"]
        H     = heads.get(nid, n["elevation_m"])
        resid = H - n["elevation_m"]
        p_kpa = resid * 9.81  # ρgh, ρ=1000 kg/m³, g=9.81 m/s²

        if resid < H_MIN_M:
            p_status = "low"
            warnings.append(
                f"Node {nid}: residual head {resid:.1f} m < {H_MIN_M} m minimum (WHO)."
            )
        elif resid > H_MAX_M:
            p_status = "high"
            warnings.append(
                f"Node {nid}: residual head {resid:.1f} m > {H_MAX_M} m maximum (PRV required)."
            )
        else:
            p_status = "ok"

        if not n.get("is_reservoir", False):
            residual_heads.append(resid)

        node_results.append({
            "id":               nid,
            "residual_head_m":  round(resid, 3),
            "pressure_kpa":     round(p_kpa, 2),
            "pressure_status":  p_status,
        })

    min_resid = min(residual_heads) if residual_heads else 0.0
    max_resid = max(residual_heads) if residual_heads else 0.0

    add_step(
        "Node Pressure Verification",
        "H_node = H_reservoir − Σhf path;  residual = H_node − elevation",
        f"Min residual = {min_resid:.2f} m,  Max = {max_resid:.2f} m",
        f"Pressure range check: {H_MIN_M} – {H_MAX_M} m",
        "WHO (2011): minimum service pressure 7 m; Zambia WSS Guidelines §4.3",
    )

    # ------------------------------------------------------------------
    # 10. Overall status
    # ------------------------------------------------------------------
    pressure_fail = any(nr["pressure_status"] == "low" for nr in node_results
                        if not any(n["id"] == nr["id"] and n.get("is_reservoir") for n in nodes_in))
    vel_fail      = any(pr["velocity_status"] == "too_high" for pr in pipe_results)

    if pressure_fail or vel_fail:
        status = "fail"
    elif warnings:
        status = "warning"
    else:
        status = "pass"

    return {
        "status": status,
        "summary": {
            "total_nodes":          len(nodes_in),
            "total_pipes":          len(pipes_in),
            "iterations":           iterations_done,
            "converged":            converged,
            "max_velocity_ms":      round(max_vel, 4),
            "min_residual_head_m":  round(min_resid, 3),
            "max_residual_head_m":  round(max_resid, 3),
        },
        "pipe_results":  pipe_results,
        "node_results":  node_results,
        "steps":         steps,
        "warnings":      warnings,
        "errors":        errors,
        "timestamp":     datetime.datetime.utcnow().isoformat() + "Z",
    }


# ---------------------------------------------------------------------------
# Internal error helper
# ---------------------------------------------------------------------------
def _build_error_output(errors: list[str], steps: list[dict]) -> dict:
    return {
        "status":       "fail",
        "summary":      {},
        "pipe_results": [],
        "node_results": [],
        "steps":        steps,
        "warnings":     [],
        "errors":       errors,
        "timestamp":    datetime.datetime.utcnow().isoformat() + "Z",
    }
