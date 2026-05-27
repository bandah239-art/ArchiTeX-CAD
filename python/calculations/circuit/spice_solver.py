"""
SPICE-lite Modified Nodal Analysis (MNA) solver.

Supported component types: R, C, L, V (independent voltage source), I (independent current source).
Ground node is always '0' or 'GND'.

MNA stamp rules:
  G = conductance / admittance matrix (n×n for n non-ground nodes)
  B = voltage-source incidence (n×m)
  RHS i-vector = independent current sources at each node
  RHS e-vector = voltage source values
"""

from __future__ import annotations

import cmath
import math
from typing import Any

import numpy as np


# ---------------------------------------------------------------------------
# Netlist helpers
# ---------------------------------------------------------------------------

def _node_index(node: str, node_map: dict[str, int]) -> int:
    """Return 0-based row index for node (ground excluded → returns -1)."""
    if node in ("0", "GND", "gnd"):
        return -1
    return node_map[node]


def _build_node_map(components: list[dict]) -> dict[str, int]:
    """Assign indices to non-ground nodes."""
    nodes: set[str] = set()
    for c in components:
        for pin in ("n+", "n-"):
            nd = c.get(pin, "0")
            if nd not in ("0", "GND", "gnd"):
                nodes.add(nd)
    return {n: i for i, n in enumerate(sorted(nodes))}


# ---------------------------------------------------------------------------
# DC operating-point solver  (R, V, I)
# ---------------------------------------------------------------------------

def solve_dc(components: list[dict]) -> dict[str, Any]:
    """
    DC operating point.

    components: list of {"type":"R","id":"R1","n+":"1","n-":"0","value":1000}, etc.
    type "E" = VCVS (op-amp ideal model): nc+ / nc- are controlling nodes, value = gain.
    Returns: node voltages (V) and branch currents through voltage sources.
    """
    node_map = _build_node_map(components)
    n = len(node_map)

    vsrcs = [c for c in components if c["type"] in ("V", "E")]
    m = len(vsrcs)
    sz = n + m

    A = np.zeros((sz, sz), dtype=float)
    rhs = np.zeros(sz, dtype=float)

    # Stamp resistors
    for c in components:
        if c["type"] != "R":
            continue
        g = 1.0 / max(float(c["value"]), 1e-15)
        p = _node_index(c["n+"], node_map)
        q = _node_index(c["n-"], node_map)
        if p >= 0:
            A[p, p] += g
        if q >= 0:
            A[q, q] += g
        if p >= 0 and q >= 0:
            A[p, q] -= g
            A[q, p] -= g

    # Stamp current sources
    for c in components:
        if c["type"] != "I":
            continue
        val = float(c["value"])
        p = _node_index(c["n+"], node_map)
        q = _node_index(c["n-"], node_map)
        if p >= 0:
            rhs[p] += val  # current source injects into n+
        if q >= 0:
            rhs[q] -= val

    # Stamp voltage sources (V) and VCVS (E) in B/C blocks
    for k, c in enumerate(vsrcs):
        col = n + k
        p = _node_index(c["n+"], node_map)
        q = _node_index(c["n-"], node_map)
        if p >= 0:
            A[p, col] += 1.0
            A[col, p] += 1.0
        if q >= 0:
            A[q, col] -= 1.0
            A[col, q] -= 1.0
        if c["type"] == "V":
            rhs[col] = float(c["value"])
        else:  # VCVS: V(n+) - V(n-) = gain × (V(nc+) - V(nc-))
            gain = float(c["value"])
            cp = _node_index(c.get("nc+", "0"), node_map)
            cq = _node_index(c.get("nc-", "0"), node_map)
            if cp >= 0:
                A[col, cp] -= gain
            if cq >= 0:
                A[col, cq] += gain
            rhs[col] = 0.0

    if sz == 0:
        return {"node_voltages": {}, "branch_currents": {}, "status": "ok"}

    try:
        x = np.linalg.solve(A, rhs)
    except np.linalg.LinAlgError:
        return {"node_voltages": {}, "branch_currents": {}, "status": "singular — check circuit connectivity"}

    voltages = {nd: round(float(x[idx]), 6) for nd, idx in node_map.items()}
    voltages["0"] = 0.0

    branch_currents: dict[str, float] = {}
    for k, c in enumerate(vsrcs):
        branch_currents[c["id"]] = round(float(x[n + k]), 6)

    # Compute resistor currents from solved voltages
    for c in components:
        if c["type"] != "R":
            continue
        vp = voltages.get(c["n+"], 0.0)
        vq = voltages.get(c["n-"], 0.0)
        ir = (vp - vq) / max(float(c["value"]), 1e-15)
        branch_currents[c["id"]] = round(ir, 6)

    return {"node_voltages": voltages, "branch_currents": branch_currents, "status": "ok"}


# ---------------------------------------------------------------------------
# AC frequency sweep  (R, C, L, V, I)
# ---------------------------------------------------------------------------

def _complex_admittance(c: dict, omega: float) -> complex:
    t = c["type"]
    v = float(c["value"])
    if t == "R":
        return complex(1.0 / max(v, 1e-15), 0.0)
    if t == "C":
        return complex(0.0, omega * v)
    if t == "L":
        if omega < 1e-30:
            return complex(0.0, 0.0)
        return complex(0.0, -1.0 / (omega * max(v, 1e-30)))
    return complex(0.0, 0.0)


def solve_ac_sweep(
    components: list[dict],
    freq_start: float,
    freq_stop: float,
    n_pts: int,
    input_node: str,
    output_node: str,
) -> dict[str, Any]:
    """
    AC frequency sweep — returns Bode gain (dB) and phase (deg) at output_node
    driven by 1-V AC voltage source at input_node.
    freq_start, freq_stop in Hz.
    """
    node_map = _build_node_map(components)
    n = len(node_map)

    vsrcs = [c for c in components if c["type"] in ("V", "E")]
    m = len(vsrcs)
    sz = n + m

    # Log-spaced frequencies
    freqs = np.logspace(math.log10(max(freq_start, 1e-6)), math.log10(freq_stop), n_pts).tolist()

    gain_db: list[float] = []
    phase_deg: list[float] = []

    for f in freqs:
        omega = 2.0 * math.pi * f
        A = np.zeros((sz, sz), dtype=complex)
        rhs = np.zeros(sz, dtype=complex)

        # Stamp passive components
        for c in components:
            if c["type"] not in ("R", "C", "L"):
                continue
            y = _complex_admittance(c, omega)
            p = _node_index(c["n+"], node_map)
            q = _node_index(c["n-"], node_map)
            if p >= 0:
                A[p, p] += y
            if q >= 0:
                A[q, q] += y
            if p >= 0 and q >= 0:
                A[p, q] -= y
                A[q, p] -= y

        # Stamp voltage sources (V) and VCVS (E)
        for k, c in enumerate(vsrcs):
            col = n + k
            p = _node_index(c["n+"], node_map)
            q = _node_index(c["n-"], node_map)
            if p >= 0:
                A[p, col] += 1.0
                A[col, p] += 1.0
            if q >= 0:
                A[q, col] -= 1.0
                A[col, q] -= 1.0
            if c["type"] == "V":
                rhs[col] = complex(float(c.get("ac_value", c["value"])), 0.0)
            else:  # VCVS
                gain = float(c["value"])
                cp = _node_index(c.get("nc+", "0"), node_map)
                cq = _node_index(c.get("nc-", "0"), node_map)
                if cp >= 0:
                    A[col, cp] -= gain
                if cq >= 0:
                    A[col, cq] += gain
                rhs[col] = complex(0.0, 0.0)

        # Add 1-V AC stimulus at input_node (if not already a voltage source)
        in_idx = node_map.get(input_node, -1)
        out_idx = node_map.get(output_node, -1)

        try:
            if sz == 0:
                gain_db.append(0.0)
                phase_deg.append(0.0)
                continue
            x = np.linalg.solve(A, rhs)
            v_out = x[out_idx] if out_idx >= 0 else complex(0.0)
            mag = abs(v_out)
            gdb = 20.0 * math.log10(max(mag, 1e-30))
            ph = math.degrees(cmath.phase(v_out))
            gain_db.append(round(gdb, 4))
            phase_deg.append(round(ph, 4))
        except np.linalg.LinAlgError:
            gain_db.append(float("nan"))
            phase_deg.append(float("nan"))

    return {
        "frequencies_hz": [round(f, 4) for f in freqs],
        "gain_db": gain_db,
        "phase_deg": phase_deg,
        "status": "ok",
    }


# ---------------------------------------------------------------------------
# Transient solver  (RC / RL circuits, trapezoidal integration)
# ---------------------------------------------------------------------------

def solve_transient(
    components: list[dict],
    t_stop: float,
    dt: float,
    output_nodes: list[str],
) -> dict[str, Any]:
    """
    Transient analysis using backward-Euler companion models.
    Capacitor: I_cap = C/dt * (v_new - v_old)  → companion = Norton (I = C/dt * v_old, R = dt/C)
    Inductor:  V_ind = L/dt * (i_new - i_old)  → companion = Thevenin (V = L/dt * i_old, R = L/dt)
    """
    node_map = _build_node_map(components)
    n = len(node_map)

    # Separate component types
    resistors = [c for c in components if c["type"] == "R"]
    caps = [c for c in components if c["type"] == "C"]
    vsrcs = [c for c in components if c["type"] == "V"]
    vcvs = [c for c in components if c["type"] == "E"]
    isrcs = [c for c in components if c["type"] == "I"]

    # Companion model for inductors (extra voltage source per inductor)
    inductors = [c for c in components if c["type"] == "L"]
    m = len(vsrcs) + len(vcvs) + len(inductors)
    sz = n + m

    n_steps = max(2, int(t_stop / dt) + 1)
    times = [i * dt for i in range(n_steps)]

    # State: capacitor voltages and inductor currents
    cap_v = {c["id"]: 0.0 for c in caps}   # voltage across capacitor
    ind_i = {c["id"]: 0.0 for c in inductors}  # current through inductor

    out_traces: dict[str, list[float]] = {nd: [] for nd in output_nodes}

    for step in range(n_steps):
        t = times[step]
        A = np.zeros((sz, sz), dtype=float)
        rhs = np.zeros(sz, dtype=float)

        # Stamp resistors
        for c in resistors:
            g = 1.0 / max(float(c["value"]), 1e-15)
            p = _node_index(c["n+"], node_map)
            q = _node_index(c["n-"], node_map)
            if p >= 0: A[p, p] += g
            if q >= 0: A[q, q] += g
            if p >= 0 and q >= 0:
                A[p, q] -= g; A[q, p] -= g

        # Stamp capacitors (backward-Euler companion Norton model)
        for c in caps:
            g_eq = float(c["value"]) / dt
            i_eq = g_eq * cap_v[c["id"]]
            p = _node_index(c["n+"], node_map)
            q = _node_index(c["n-"], node_map)
            if p >= 0:
                A[p, p] += g_eq
                rhs[p] += i_eq
            if q >= 0:
                A[q, q] += g_eq
                rhs[q] -= i_eq
            if p >= 0 and q >= 0:
                A[p, q] -= g_eq; A[q, p] -= g_eq

        # Stamp current sources
        for c in isrcs:
            val = float(c["value"])
            p = _node_index(c["n+"], node_map)
            q = _node_index(c["n-"], node_map)
            if p >= 0: rhs[p] += val  # current source injects into n+
            if q >= 0: rhs[q] -= val

        # Stamp voltage sources
        for k, c in enumerate(vsrcs):
            col = n + k
            p = _node_index(c["n+"], node_map)
            q = _node_index(c["n-"], node_map)
            if p >= 0:
                A[p, col] += 1.0; A[col, p] += 1.0
            if q >= 0:
                A[q, col] -= 1.0; A[col, q] -= 1.0
            # Time-varying source: support "waveform" key
            wf = c.get("waveform", "dc")
            if wf == "sin":
                amp = float(c.get("amplitude", c["value"]))
                freq = float(c.get("frequency", 1000.0))
                rhs[col] = amp * math.sin(2.0 * math.pi * freq * t)
            elif wf == "pulse":
                amp = float(c.get("amplitude", c["value"]))
                pw = float(c.get("pulse_width", t_stop / 2))
                period = float(c.get("period", t_stop))
                t_mod = t % period
                rhs[col] = amp if t_mod < pw else 0.0
            else:
                rhs[col] = float(c["value"])

        # Stamp VCVS (E elements)
        for k, c in enumerate(vcvs):
            col = n + len(vsrcs) + k
            p = _node_index(c["n+"], node_map)
            q = _node_index(c["n-"], node_map)
            gain = float(c["value"])
            if p >= 0:
                A[p, col] += 1.0; A[col, p] += 1.0
            if q >= 0:
                A[q, col] -= 1.0; A[col, q] -= 1.0
            cp = _node_index(c.get("nc+", "0"), node_map)
            cq = _node_index(c.get("nc-", "0"), node_map)
            if cp >= 0:
                A[col, cp] -= gain
            if cq >= 0:
                A[col, cq] += gain
            rhs[col] = 0.0

        # Stamp inductors (backward-Euler companion voltage source)
        for k, c in enumerate(inductors):
            col = n + len(vsrcs) + len(vcvs) + k
            r_eq = float(c["value"]) / dt
            v_eq = r_eq * ind_i[c["id"]]
            p = _node_index(c["n+"], node_map)
            q = _node_index(c["n-"], node_map)
            if p >= 0:
                A[p, p] += 1.0 / r_eq if r_eq > 1e-15 else 0
                A[p, col] += 1.0; A[col, p] += 1.0
            if q >= 0:
                A[q, col] -= 1.0; A[col, q] -= 1.0
            rhs[col] = v_eq

        try:
            x = np.linalg.solve(A, rhs)
        except np.linalg.LinAlgError:
            break

        # Extract node voltages
        v_sol: dict[str, float] = {"0": 0.0}
        for nd, idx in node_map.items():
            v_sol[nd] = float(x[idx])

        # Update capacitor voltages
        for c in caps:
            vp = v_sol.get(c["n+"], 0.0)
            vq = v_sol.get(c["n-"], 0.0)
            cap_v[c["id"]] = vp - vq

        # Update inductor currents
        for k, c in enumerate(inductors):
            col = n + len(vsrcs) + len(vcvs) + k
            ind_i[c["id"]] = float(x[col])

        for nd in output_nodes:
            out_traces[nd].append(round(v_sol.get(nd, 0.0), 6))

    return {
        "time_s": [round(t, 8) for t in times[:len(next(iter(out_traces.values()), times))]],
        "voltages": out_traces,
        "status": "ok",
    }
