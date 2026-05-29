"""WASH pipe network analysis — Hardy-Cross iterative method + pump sizing."""

import math
import logging
from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value

logger = logging.getLogger(__name__)

# ── Hazen-Williams C values ───────────────────────────────────────────────────
HW_C_VALUES: dict[str, int] = {
    "pvc": 150,
    "hdpe": 140,
    "steel": 120,
    "concrete": 120,
    "cast_iron": 100,
    "ductile_iron": 130,
}

# ── Zambia NWASCO / WHO minimum residual pressures ────────────────────────────
NWASCO_MIN_HEAD: dict[str, float] = {
    "residential": 7.0,    # m
    "commercial":  14.0,
    "industrial":  20.0,
    "school":      10.0,
    "clinic":      14.0,
}

# ── Zambia per capita demand (NWASCO 2022 guidelines) ─────────────────────────
NWASCO_PER_CAPITA: dict[str, float] = {  # litres/person/day
    "rural":      25.0,
    "peri_urban": 50.0,
    "urban":      80.0,
    "commercial": 150.0,
}
PEAK_FACTOR: dict[str, float] = {
    "residential": 2.0,
    "commercial":  1.5,
    "industrial":  1.2,
    "school":      3.0,
    "clinic":      2.5,
}

# ── Pipe class (PN rating) selection from working pressure ───────────────────
def _pipe_class(working_pressure_m: float) -> str:
    kpa = working_pressure_m * 9.81
    if kpa <= 600:
        return "PN6"
    if kpa <= 1000:
        return "PN10"
    return "PN16"


# ── Hazen-Williams headloss ───────────────────────────────────────────────────
def _hw_headloss(q_m3s: float, length_m: float, diam_m: float, c: float) -> float:
    """Signed headloss (m) using Hazen-Williams.  Sign matches flow direction."""
    if q_m3s == 0:
        return 0.0
    sign = 1 if q_m3s > 0 else -1
    q = abs(q_m3s)
    hf = (10.67 * length_m * q ** 1.852) / (c ** 1.852 * diam_m ** 4.87)
    return sign * hf


def _hw_dhdq(q_m3s: float, length_m: float, diam_m: float, c: float) -> float:
    """dH/dQ for Hardy-Cross denominator (always positive)."""
    q = abs(q_m3s) if abs(q_m3s) > 1e-9 else 1e-9
    return 1.852 * (10.67 * length_m * q ** 0.852) / (c ** 1.852 * diam_m ** 4.87)


# ── Darcy-Weisbach friction factor (Colebrook-White, iterative) ───────────────
def _colebrook_f(Re: float, relative_roughness: float) -> float:
    """Colebrook-White friction factor via 10 iterations of fixed-point."""
    if Re < 2300:
        return 64 / Re if Re > 0 else 0.02
    f = 0.02
    for _ in range(10):
        lhs = 1.0 / math.sqrt(f)
        rhs = -2.0 * math.log10(relative_roughness / 3.7 + 2.51 / (Re * math.sqrt(f)))
        f = (1.0 / rhs) ** 2
    return f


# ── Hardy-Cross iterative solver ─────────────────────────────────────────────
def _hardy_cross(
    pipes: list[dict],
    loops: list[list[str]],
    max_iter: int = 100,
    tol: float = 1e-4,
) -> tuple[dict[str, float], int, float]:
    """
    Run Hardy-Cross iterations for a set of loops.

    pipes: list of {id, Q_m3s (initial), length_m, diam_m, c_value}
    loops: list of lists, each containing (pipe_id, sign) tuples or just pipe_ids
    Returns: {pipe_id: Q_m3s}, iterations_used, max_residual
    """
    # Build flow dict
    Q: dict[str, float] = {p["id"]: p.get("Q_m3s", 0.001) for p in pipes}
    pipe_map: dict[str, dict] = {p["id"]: p for p in pipes}

    iters = 0
    residual = 1.0
    for iteration in range(max_iter):
        residual = 0.0
        for loop in loops:
            # Each loop entry: (pipe_id, direction_sign)
            sum_hf = 0.0
            sum_dhf_dq = 0.0
            for pid, sign in loop:
                p = pipe_map[pid]
                q_signed = sign * Q[pid]
                hf = _hw_headloss(q_signed, p["length_m"], p["diam_m"], p["c"])
                dhf = _hw_dhdq(q_signed, p["length_m"], p["diam_m"], p["c"])
                sum_hf += hf
                sum_dhf_dq += dhf

            if sum_dhf_dq < 1e-12:
                continue
            delta_q = -sum_hf / (1.852 * sum_dhf_dq)
            residual = max(residual, abs(delta_q))

            for pid, sign in loop:
                Q[pid] += sign * delta_q

        iters = iteration + 1
        if residual < tol:
            break

    return Q, iters, residual


# ── Main network analysis ─────────────────────────────────────────────────────
def analyze_pipe_network(inputs: dict[str, Any]) -> dict[str, Any]:
    try:
        nodes: list[dict] = inputs.get("nodes", [])
        pipes_in: list[dict] = inputs.get("pipes", [])
        loops_in: list[list] = inputs.get("loops", [])   # user-supplied loop definitions
        source_head_m: float = float(inputs.get("source_head_m", 50.0))
        settlement_type: str = inputs.get("settlement_type", "urban")

        status = "pass"
        warnings_out: list[str] = []
        errors_out: list[str] = []

        # ── Step 1: Per-capita demand → design flows ──────────────────────────
        design_steps = []
        node_demands: dict[str, float] = {}
        per_capita_lpd = NWASCO_PER_CAPITA.get(settlement_type, 80.0)
        total_pop = 0
        for n in nodes:
            nid = str(n.get("id", "?"))
            pop = int(n.get("population", 0))
            ntype = n.get("type", "residential").lower()
            pf = PEAK_FACTOR.get(ntype, 2.0)
            # Average daily demand → design peak flow (L/s)
            if pop > 0:
                avg_lps = (pop * per_capita_lpd) / 86400.0
                peak_lps = avg_lps * pf
            else:
                peak_lps = float(n.get("demand_lps", 0.5))
            node_demands[nid] = peak_lps
            total_pop += pop

        design_steps.append({
            "step_number": 1,
            "title": "Demand Calculation (NWASCO)",
            "formula": "Q_peak = (Pop × L_p/d) / 86400 × PF",
            "substitution": f"L_p/d = {per_capita_lpd} L/person/day ({settlement_type})",
            "result": f"Total population = {total_pop}; nodes = {len(nodes)}",
            "unit": "L/s",
            "reference": "NWASCO Design Guidelines 2022 / WHO",
            "status": "info",
        })

        # ── Step 2: Pipe geometry & initial flows ─────────────────────────────
        prepared_pipes = []
        for i, p in enumerate(pipes_in):
            pid = str(p.get("id", f"P{i+1}"))
            length_m = float(p.get("length_m", p.get("length", 100)))
            diam_mm = float(p.get("diameter_mm", 100))
            diam_m = diam_mm / 1000.0
            material = str(p.get("material", "pvc")).lower()
            c_val = float(p.get("c_value", HW_C_VALUES.get(material, 120)))
            # Initial flow: assign demand of end node as seed
            end_nid = str(p.get("end", ""))
            q_init = node_demands.get(end_nid, 0.5) / 1000.0  # L/s → m³/s
            q_init = max(q_init, 1e-4)

            area_m2 = math.pi * (diam_m / 2) ** 2
            prepared_pipes.append({
                "id": pid,
                "length_m": length_m,
                "diam_m": diam_m,
                "diam_mm": diam_mm,
                "c": c_val,
                "material": material,
                "start": str(p.get("start", "")),
                "end": end_nid,
                "Q_m3s": q_init,
                "area_m2": area_m2,
            })

        design_steps.append({
            "step_number": 2,
            "title": "Pipe Geometry & Initial Flow Assignment",
            "formula": "Q_init = demand of end node (continuity seed)",
            "substitution": f"{len(prepared_pipes)} pipes configured",
            "result": ", ".join(
                f"P{p['id']}: D={p['diam_mm']:.0f}mm L={p['length_m']:.0f}m"
                for p in prepared_pipes[:4]
            ) + ("..." if len(prepared_pipes) > 4 else ""),
            "unit": "",
            "reference": "Hazen-Williams C-values per AWWA M23",
            "status": "info",
        })

        # ── Step 3: Hardy-Cross iteration ─────────────────────────────────────
        iterations_used = 0
        max_residual = 0.0

        if loops_in:
            # User supplied loop definitions: [[{pipe_id, sign}, ...], ...]
            loops_parsed = []
            for loop in loops_in:
                parsed = []
                for entry in loop:
                    if isinstance(entry, dict):
                        parsed.append((str(entry["id"]), int(entry.get("sign", 1))))
                    else:
                        parsed.append((str(entry), 1))
                loops_parsed.append(parsed)

            Q_solved, iterations_used, max_residual = _hardy_cross(
                prepared_pipes, loops_parsed
            )
            # Apply solved flows
            for p in prepared_pipes:
                p["Q_m3s"] = Q_solved.get(p["id"], p["Q_m3s"])

            converged = max_residual < 1e-3
            design_steps.append({
                "step_number": 3,
                "title": "Hardy-Cross Network Iteration",
                "formula": "ΔQ = −ΣhL / (1.852 · Σ|hL/Q|) per loop",
                "substitution": f"{len(loops_in)} loops; max iterations = 100; tolerance = 0.0001 m³/s",
                "result": (
                    f"Converged in {iterations_used} iterations; "
                    f"max residual ΔQ = {max_residual:.6f} m³/s"
                    if converged
                    else f"DID NOT CONVERGE after {iterations_used} iterations — check loop/demand definitions"
                ),
                "unit": "m³/s",
                "reference": "Hardy-Cross (1936) / Streeter & Wylie",
                "status": "pass" if converged else "warning",
            })
            if not converged:
                warnings_out.append(
                    f"Hardy-Cross did not converge (residual = {max_residual:.4f}). "
                    "Check loop definitions and demand balance."
                )
        else:
            # Branched / serial network — no loops, flows already set from demands
            design_steps.append({
                "step_number": 3,
                "title": "Network Type: Branched (No Loops Defined)",
                "formula": "Flow assigned by nodal demand (no Hardy-Cross needed)",
                "substitution": "Supply loop definitions for looped network analysis",
                "result": "Flows set to nodal demand values — add 'loops' array for iterative balancing",
                "unit": "",
                "reference": "Hardy-Cross §3",
                "status": "info",
            })

        # ── Step 4: Pipe-by-pipe hydraulics ──────────────────────────────────
        pipe_results = []
        for p in prepared_pipes:
            q_m3s = p["Q_m3s"]
            q_lps = abs(q_m3s) * 1000
            vel = abs(q_m3s) / p["area_m2"] if p["area_m2"] > 0 else 0.0
            hf = _hw_headloss(abs(q_m3s), p["length_m"], p["diam_m"], p["c"])
            hf_per_km = (hf / p["length_m"]) * 1000 if p["length_m"] > 0 else 0.0

            # Reynolds number & Darcy-Weisbach check
            nu = 1.004e-6  # kinematic viscosity of water at 20°C
            Re = vel * p["diam_m"] / nu if nu > 0 else 0
            eps = {"pvc": 0.0015e-3, "hdpe": 0.007e-3, "steel": 0.046e-3,
                   "concrete": 0.3e-3, "cast_iron": 0.26e-3}.get(p["material"], 0.046e-3)
            rel_rough = eps / p["diam_m"]
            f_dw = _colebrook_f(Re, rel_rough)
            hf_dw = f_dw * (p["length_m"] / p["diam_m"]) * (vel ** 2) / (2 * 9.81)

            pipe_class = _pipe_class(source_head_m)

            p_status = "pass"
            if vel < 0.3:
                warnings_out.append(
                    f"Pipe {p['id']}: Velocity {vel:.2f} m/s below self-cleansing minimum 0.3 m/s"
                )
                p_status = "warning"
            elif vel > 3.0:
                warnings_out.append(
                    f"Pipe {p['id']}: Velocity {vel:.2f} m/s exceeds max 3.0 m/s (erosion risk)"
                )
                p_status = "warning"

            pipe_results.append({
                "id": p["id"],
                "diameter_mm": p["diam_mm"],
                "material": p["material"],
                "flow_lps": round_value(q_lps, 3),
                "velocity_ms": round_value(vel, 3),
                "head_loss_m": round_value(hf, 3),
                "head_loss_per_km_m": round_value(hf_per_km, 2),
                "reynolds": round_value(Re, 0),
                "friction_factor_dw": round_value(f_dw, 4),
                "head_loss_dw_m": round_value(hf_dw, 3),
                "pipe_class": pipe_class,
                "status": p_status,
            })

        design_steps.append({
            "step_number": 4,
            "title": "Pipe Hydraulics (H-W + Darcy-Weisbach)",
            "formula": (
                "hf_HW = 10.67·L·Q^1.852/(C^1.852·D^4.87); "
                "hf_DW = f·(L/D)·V²/(2g); 1/√f = −2log(ε/3.7D + 2.51/(Re√f))"
            ),
            "substitution": f"{len(pipe_results)} pipes analysed",
            "result": (
                f"Max velocity: {max((r['velocity_ms'] for r in pipe_results), default=0):.2f} m/s; "
                f"Max hf: {max((r['head_loss_m'] for r in pipe_results), default=0):.2f} m"
            ),
            "unit": "m/s, m",
            "reference": "AWWA M23 / Colebrook-White (1939)",
            "status": "pass" if not warnings_out else "warning",
        })

        # ── Step 5: Nodal pressures ───────────────────────────────────────────
        node_results = []
        # Build simple head propagation (serial path from source)
        # For looped: heads computed from converged flows
        head_at: dict[str, float] = {}
        for p in prepared_pipes:
            if p["start"] not in head_at:
                head_at[p["start"]] = source_head_m
            upstream_head = head_at.get(p["start"], source_head_m)
            hf_pipe = _hw_headloss(abs(p["Q_m3s"]), p["length_m"], p["diam_m"], p["c"])
            head_at[p["end"]] = upstream_head - hf_pipe

        for n in nodes:
            nid = str(n.get("id", "?"))
            ntype = n.get("type", "residential").lower()
            elev_m = float(n.get("elevation_m", n.get("elev", 0.0)))
            head_m = head_at.get(nid, source_head_m)
            residual_head = head_m - elev_m
            pressure_kpa = max(0.0, residual_head * 9.81)
            min_head_req = NWASCO_MIN_HEAD.get(ntype, 7.0)
            demand_lps = node_demands.get(nid, 0.0)

            n_status = "pass"
            if residual_head < min_head_req:
                n_status = "fail"
                status = "fail"
                errors_out.append(
                    f"Node {nid} ({ntype}): residual head {residual_head:.1f} m < NWASCO minimum "
                    f"{min_head_req} m. Upsize upstream pipe or boost pump pressure."
                )

            node_results.append({
                "id": nid,
                "type": ntype,
                "elevation_m": elev_m,
                "head_m": round_value(head_m, 2),
                "residual_head_m": round_value(residual_head, 2),
                "pressure_kpa": round_value(pressure_kpa, 1),
                "min_head_required_m": min_head_req,
                "demand_lps": round_value(demand_lps, 3),
                "pipe_class": _pipe_class(head_m),
                "status": n_status,
            })

        design_steps.append({
            "step_number": 5,
            "title": "Nodal Pressure & NWASCO Compliance",
            "formula": "H_node = H_source − Σhf (along path); p_res = (H − z) × 9.81 kPa",
            "substitution": f"Source head = {source_head_m} m; {len(node_results)} nodes checked",
            "result": (
                f"Min residual head = {min((r['residual_head_m'] for r in node_results), default=0):.1f} m; "
                f"NWASCO min = {min(NWASCO_MIN_HEAD.values())} m (residential)"
            ),
            "unit": "m",
            "reference": "NWASCO Design Manual / WHO Guidelines for Drinking-Water Quality",
            "status": "pass" if not errors_out else "fail",
        })

        # ── Step 6: Pump sizing (if source_head is insufficient) ──────────────
        total_demand_lps = sum(node_demands.values())
        total_demand_m3s = total_demand_lps / 1000.0
        # Static head from source to highest node
        max_elev = max((float(n.get("elevation_m", n.get("elev", 0))) for n in nodes), default=0)
        total_hf_main = sum(r["head_loss_m"] for r in pipe_results)
        required_head = max_elev + max(NWASCO_MIN_HEAD.values()) + total_hf_main

        # Pump power: P = ρgQH / (η × 1000) kW
        eta = 0.70  # pump efficiency
        pump_power_kw = (1000 * 9.81 * total_demand_m3s * required_head) / (eta * 1000)
        # Motor power with motor efficiency 0.90
        motor_power_kw = pump_power_kw / 0.90

        design_steps.append({
            "step_number": 6,
            "title": "Pump Sizing",
            "formula": "P_pump = ρgQH / (η·1000); P_motor = P_pump / η_motor",
            "substitution": (
                f"Q = {round_value(total_demand_lps, 2)} L/s; "
                f"Htotal = {round_value(required_head, 1)} m; η_pump = {eta}; η_motor = 0.90"
            ),
            "result": (
                f"Required pump: Q = {round_value(total_demand_lps, 2)} L/s @ "
                f"H = {round_value(required_head, 1)} m; "
                f"Pump power = {round_value(pump_power_kw, 1)} kW; "
                f"Motor rating = {round_value(motor_power_kw, 1)} kW"
            ),
            "unit": "kW",
            "reference": "Pump handbook; NWASCO §7",
            "status": "info",
        })

        # ── Step 7: Water hammer (Joukowsky) ──────────────────────────────────
        # Worst-case: largest pipe velocity × wave speed
        max_vel_pipe = max((r["velocity_ms"] for r in pipe_results), default=0)
        # Wave speed a ≈ 1000 m/s for PVC/HDPE (conservative)
        a_wave = 1000.0
        delta_p_kpa = (1000 * a_wave * max_vel_pipe) / 1000  # kPa
        critical_time = 2 * max((p["length_m"] for p in prepared_pipes), default=100) / a_wave

        design_steps.append({
            "step_number": 7,
            "title": "Water Hammer — Joukowsky Surge Pressure",
            "formula": "ΔP = ρ·a·ΔV; a ≈ 1000 m/s (PVC/HDPE); critical time = 2L/a",
            "substitution": (
                f"max V = {round_value(max_vel_pipe, 2)} m/s; "
                f"a = {a_wave} m/s; critical time = {round_value(critical_time, 3)} s"
            ),
            "result": (
                f"Surge ΔP ≈ {round_value(delta_p_kpa, 0)} kPa "
                f"— add air-valve / non-return valve if ΔP > pipe PN rating × 100 kPa"
            ),
            "unit": "kPa",
            "reference": "Joukowsky (1900) / AWWA M11",
            "status": "info" if delta_p_kpa < 600 else "warning",
        })

        summary = {
            "pipe_count":              len(pipe_results),
            "node_count":              len(node_results),
            "total_demand_lps":        round_value(total_demand_lps, 2),
            "iterations":              iterations_used,
            "max_residual_m3s":        round_value(max_residual, 6),
            "convergence":             "converged" if max_residual < 1e-3 else "not-converged",
            "required_pump_head_m":    round_value(required_head, 1),
            "pump_power_kw":           round_value(pump_power_kw, 1),
            "motor_rating_kw":         round_value(motor_power_kw, 1),
            "max_water_hammer_kpa":    round_value(delta_p_kpa, 0),
            "nwasco_standard":         "Verified — min 7m residential, 14m commercial",
        }

        return {
            "status": status,
            "summary": summary,
            "steps": design_steps,
            "pipe_results": pipe_results,
            "node_results": node_results,
            "warnings": warnings_out,
            "errors": errors_out,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as exc:
        logger.exception("Pipe network analysis failed")
        return {
            "status": "error",
            "errors": [str(exc)],
            "summary": {},
            "warnings": [],
            "steps": [],
            "pipe_results": [],
            "node_results": [],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
