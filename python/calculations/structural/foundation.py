"""Foundation design — pad and strip per Eurocode 2."""

import math
from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value, slab_bar_spacing

GAMMA_C = 1.5


def _step(n, title, formula, sub, result, unit="", ref="", status="info"):
    return {
        "step_number": n, "title": title, "formula": formula,
        "substitution": sub, "result": result, "unit": unit,
        "reference": ref, "status": status,
    }


def _round_up_100mm(size_m: float) -> float:
    mm = math.ceil(size_m * 1000 / 100) * 100
    return mm / 1000


def calculate_foundation(inputs: dict[str, Any]) -> dict[str, Any]:
    ftype = inputs.get("foundation_type", "pad")
    n_col = inputs["column_load"]
    mx = inputs.get("moment_x", inputs.get("moment", 0))
    my = inputs.get("moment_y", 0)
    q_allow = inputs.get("soil_bearing", inputs.get("bearing_capacity", 150))
    gamma_soil = inputs.get("soil_unit_weight", 18)
    df = inputs["foundation_depth"]
    fck = inputs["fck"]
    fyk = inputs["fyk"]
    b_col = inputs.get("column_width", 300)
    h_col = inputs.get("column_depth", b_col)
    d_conc = inputs.get("foundation_depth_concrete", 400)
    gamma_conc = 25

    steps: list[dict] = []
    warnings: list[str] = []
    errors: list[str] = []
    status = "pass"

    # Step 1
    q_net = q_allow - gamma_soil * df
    steps.append(_step(1, "Net Allowable Bearing Pressure",
        "q_net = q_allow - γ_soil·D_f",
        f"q_net = {q_allow} - {gamma_soil}×{df}",
        f"q_net = {round_value(q_net, 1)} kN/m²", "kN/m²", "Geotechnical design", "info"))

    # Step 2
    w_est = 0.10 * n_col
    total_est = n_col + w_est
    steps.append(_step(2, "Estimated Foundation Self-Weight",
        "W_est = 0.10·N_col; Total = N_col + W_est",
        f"W_est = 0.10×{n_col}",
        f"W_est = {round_value(w_est, 1)} kN; Total = {round_value(total_est, 1)} kN", "kN", "Foundation design", "info"))

    # Step 3
    a_req = total_est / q_net if q_net > 0 else 0
    steps.append(_step(3, "Required Foundation Area",
        "A_req = Total load / q_net",
        f"A_req = {round_value(total_est, 1)} / {round_value(q_net, 1)}",
        f"A_req = {round_value(a_req, 2)} m²", "m²", "Foundation design", "info"))

    # Step 4
    if ftype == "strip":
        b = inputs.get("foundation_width", max(1.0, math.sqrt(a_req)))
        l = inputs.get("foundation_length", 1.0)
    else:
        b_raw = math.sqrt(a_req) if a_req > 0 else 1.0
        b = _round_up_100mm(b_raw)
        l = b
    steps.append(_step(4, "Foundation Dimensions",
        "B = √A_req (pad); round up to nearest 100mm",
        f"√{round_value(a_req, 2)} → {round_value(b, 1)} m",
        f"B = {round_value(b, 1)} m; L = {round_value(l, 1)} m", "m", "Foundation design", "info"))

    # Step 5
    w_actual = b * l * (d_conc / 1000) * gamma_conc
    steps.append(_step(5, "Actual Self-Weight",
        "W_actual = B·L·(d_conc/1000)·25",
        f"W = {round_value(b,1)}×{round_value(l,1)}×({d_conc}/1000)×25",
        f"W_actual = {round_value(w_actual, 1)} kN", "kN", "Foundation design", "info"))

    # Step 6
    n_total = n_col + w_actual
    steps.append(_step(6, "Total Load on Soil",
        "N_total = N_col + W_actual",
        f"N_total = {n_col} + {round_value(w_actual, 1)}",
        f"N_total = {round_value(n_total, 1)} kN", "kN", "Foundation design", "info"))

    # Step 7
    ex = mx / n_total if n_total else 0
    ey = my / n_total if n_total else 0
    steps.append(_step(7, "Eccentricities",
        "ex = Mx/N_total; ey = My/N_total",
        f"ex = {round_value(ex, 4)} m; ey = {round_value(ey, 4)} m",
        f"ex = {round_value(ex*1000, 1)} mm; ey = {round_value(ey*1000, 1)} mm", "mm", "Foundation design", "info"))

    # Step 8
    q_avg = n_total / (b * l)
    q_max = q_avg + 6 * mx / (l * b ** 2) + 6 * my / (b * l ** 2)
    bearing_ok = q_max <= q_allow
    if not bearing_ok:
        status = "fail"
        errors.append(f"q_max {round_value(q_max,1)} exceeds q_allow {q_allow}")
    steps.append(_step(8, "Maximum Bearing Pressure",
        "q_max = N/(B·L) + 6·Mx/(L·B²) + 6·My/(B·L²)",
        f"q_avg = {round_value(q_avg, 1)} kN/m²",
        f"q_max = {round_value(q_max, 1)} kN/m² {'✓' if bearing_ok else '✗'} (≤ {q_allow})", "kN/m²", "EC7 / geotechnical", "pass" if bearing_ok else "fail"))

    # Step 9
    q_min = q_avg - 6 * mx / (l * b ** 2) - 6 * my / (b * l ** 2)
    tension_ok = q_min >= 0
    if not tension_ok:
        status = "fail"
        errors.append("Tension in soil — increase foundation size")
    steps.append(_step(9, "Minimum Bearing Pressure",
        "q_min = N/(B·L) - 6·Mx/(L·B²) - 6·My/(B·L²)",
        f"q_min check",
        f"q_min = {round_value(q_min, 1)} kN/m² {'✓' if tension_ok else '✗'} (≥ 0)", "kN/m²", "EC7 / geotechnical", "pass" if tension_ok else "fail"))

    # Step 10
    b_col_m = b_col / 1000
    lx = (b - b_col_m) / 2
    mx_design = q_max * lx ** 2 / 2
    steps.append(_step(10, "Design Moment at Column Face",
        "lx = (B - b_col)/2; M = q_max·lx²/2",
        f"lx = ({round_value(b,1)} - {b_col_m})/2 = {round_value(lx, 3)} m",
        f"Mx_design = {round_value(mx_design, 2)} kNm/m", "kNm/m", "Eurocode 2: Clause 6.1", "info"))

    # Step 11
    d = d_conc - 50 - 16
    steps.append(_step(11, "Effective Depth",
        "d = D_found - 50 - 16",
        f"d = {d_conc} - 66",
        f"d = {round_value(d, 0)} mm", "mm", "Eurocode 2: Clause 4.4.1", "info"))

    # Step 12
    mu_nmm = mx_design * 1e6
    k = mu_nmm / (1000 * d ** 2 * fck)
    k_ok = k <= 0.167
    if not k_ok:
        status = "fail"
        errors.append(f"K factor {round_value(k,4)} exceeds 0.167")
    steps.append(_step(12, "K Factor Check",
        "K = M/(1000·d²·fck)",
        f"K = {round_value(k, 4)}",
        f"K = {round_value(k, 4)} {'✓' if k_ok else '✗'} (≤ 0.167)", "", "Eurocode 2: Clause 6.1", "pass" if k_ok else "fail"))

    # Step 13
    z = min(d * (0.5 + math.sqrt(max(0, 0.25 - k / 1.134))), 0.95 * d)
    steps.append(_step(13, "Lever Arm",
        "z = d·[0.5 + √(0.25 - K/1.134)]; z ≤ 0.95d",
        f"z = {round_value(z, 1)} mm",
        f"z = {round_value(z, 1)} mm (≤ {round_value(0.95*d, 1)} mm)", "mm", "Eurocode 2: Clause 6.1", "info"))

    # Step 14
    as_req = mu_nmm / (0.87 * fyk * z)
    spacing, provided, provision = slab_bar_spacing(as_req, 16)
    steps.append(_step(14, "Bottom Steel (Both Directions)",
        "As,req = M/(0.87·fyk·z) per metre width",
        f"As,req = {round_value(as_req, 0)} mm²/m",
        f"Provide: {provision}", "mm²/m", "Eurocode 2: Clause 9.2.1", "info"))

    # Step 15
    as_min = 0.0013 * 1000 * d
    min_ok = as_req >= as_min
    as_design = max(as_req, as_min)
    steps.append(_step(15, "Minimum Steel Check",
        "As,min = 0.0013·1000·d",
        f"As,min = {round_value(as_min, 0)} mm²/m",
        f"As,req = {round_value(as_design, 0)} mm²/m {'✓' if min_ok or as_design >= as_min else '✗'}", "mm²/m", "Eurocode 2: Clause 9.2.1.1", "pass"))

    # Step 16 — Punching shear (pad only)
    punch_ok = True
    if ftype != "strip":
        u1 = 2 * (b_col + h_col) + 2 * math.pi * (2 * d)
        beta = 1.15
        v_ed = beta * n_col * 1000 / (u1 * d)
        k_shear = min(2.0, 1.0 + math.sqrt(200.0 / d))
        v_rd_c = 0.18 / GAMMA_C * k_shear * (100 * 0.0013 * fck) ** (1 / 3)
        punch_ok = v_ed <= v_rd_c
        if not punch_ok:
            status = "fail"
            errors.append("Punching shear check failed")
        steps.append(_step(16, "Punching Shear Check",
            "u1 = 2(b+h) + 2π(2d); vEd = β·N/(u1·d)",
            f"u1 = {round_value(u1, 0)} mm; vEd = {round_value(v_ed, 3)} N/mm²",
            f"vEd = {round_value(v_ed, 3)} {'✓' if punch_ok else '✗'} (vRd,c = {round_value(v_rd_c, 3)})", "N/mm²", "Eurocode 2: Clause 6.4", "pass" if punch_ok else "fail"))
    else:
        steps.append(_step(16, "Punching Shear Check", "N/A for strip foundation", "Strip — one-way shear governs", "N/A", "", "Eurocode 2", "info"))

    # Step 17 — One-way shear
    lx_crit = max(lx - d / 1000, 0.1)
    v_ed_force = q_max * lx_crit * l
    v_ed = v_ed_force * 1000 / (l * 1000 * d)
    k_shear = min(2.0, 1.0 + math.sqrt(200.0 / d))
    rho_l = min(0.02, as_design / (1000 * d))
    v_rd_c = 0.18 / GAMMA_C * k_shear * (100 * rho_l * fck) ** (1 / 3)
    oneway_ok = v_ed <= v_rd_c
    if not oneway_ok:
        status = "fail"
        errors.append("One-way shear check failed")
    steps.append(_step(17, "One-Way Shear Check",
        "VEd = q_max·(lx - d)·L; vEd = VEd/(L·d)",
        f"VEd = {round_value(v_ed_force, 1)} kN",
        f"vEd = {round_value(v_ed, 3)} {'✓' if oneway_ok else '✗'} (vRd,c = {round_value(v_rd_c, 3)})", "N/mm²", "Eurocode 2: Clause 6.2", "pass" if oneway_ok else "fail"))

    ftype_label = {"pad": "Pad Foundation", "strip": "Strip Foundation", "raft": "Raft Foundation"}.get(ftype, "Pad Foundation")

    return {
        "status": status,
        "summary": {
            "foundation_type": ftype_label,
            "width_m": round_value(b, 1),
            "length_m": round_value(l, 1),
            "depth_mm": d_conc,
            "net_allowable_knm2": round_value(q_net, 1),
            "q_max_knm2": round_value(q_max, 1),
            "q_min_knm2": round_value(q_min, 1),
            "steel_required_mm2": round_value(as_design, 0),
            "bar_provision": provision,
            "punching_shear_ok": punch_ok if ftype != "strip" else "N/A",
            "one_way_shear_ok": oneway_ok,
            "structural_design": "PASS ✓" if status == "pass" else "FAIL ✗",
        },
        "steps": steps,
        "warnings": warnings,
        "errors": errors,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
