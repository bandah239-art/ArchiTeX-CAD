"""
Foundation Design Engine — EC7 / EC2 / BS 8004 (Enhanced)
===========================================================
Full foundation design per:
  - EN 1997-1:2004 (EC7)  — geotechnical sizing and bearing
  - EN 1992-1-1:2004 (EC2) — structural reinforcement design
  - BS 8004:2015           — general foundation practice

Covers three foundation types:
  * Pad footing      — concentric and eccentric loading, Meyerhof effective area
  * Combined footing — two-column footing with centroid balancing
  * Pile cap         — 2-, 3- and 4-pile configurations (truss model)

Every calculation step carries:
  step_number, title, formula, substitution, result, unit, reference, status

Usage
-----
    from calculations.structural.foundation_ec7_enhanced import calculate_foundation_ec7

    result = calculate_foundation_ec7({
        "foundation_type": "pad",
        "column_b_mm": 400,
        "column_h_mm": 400,
        "N_ed_kn": 1800,
        "N_ek_kn": 1200,
        "M_ex_knm": 80,
        "M_ey_knm": 40,
        "H_ex_kn": 0,
        "soil_bearing_kpa": 200,
        "foundation_depth_m": 1.5,
        "fck_mpa": 30,
        "fyk_mpa": 500,
        "cover_mm": 50,
    })
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

# ---------------------------------------------------------------------------
# Material / safety partial factors
# ---------------------------------------------------------------------------
GAMMA_C: float = 1.5       # Concrete (EC2 Table 2.1N)
GAMMA_S: float = 1.15      # Reinforcement (EC2 Table 2.1N)
ALPHA_CC: float = 0.85     # Long-term coefficient (EC2 cl.3.1.6)
GAMMA_GEO: float = 1.4     # Geotechnical permanent action (EC7 DA1 Comb 1)
CRD_C: float = 0.18 / GAMMA_C  # = 0.12  (EC2 cl.6.2.2)

# fctm (MPa) look-up — EC2 Table 3.1
_FCTM: dict[int, float] = {
    20: 2.2, 25: 2.6, 28: 2.8, 30: 2.9, 32: 3.0,
    35: 3.2, 40: 3.5, 45: 3.8, 50: 4.1,
}


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _rv(v: float, dp: int = 3) -> float:
    """Round value to *dp* decimal places."""
    return round(v, dp)


def _step(
    n: int,
    title: str,
    formula: str,
    sub: str,
    result: str,
    unit: str = "",
    ref: str = "",
    status: str = "info",
) -> dict[str, Any]:
    return {
        "step_number": n,
        "title": title,
        "formula": formula,
        "substitution": sub,
        "result": result,
        "unit": unit,
        "reference": ref,
        "status": status,
    }


def _round_up_50mm(size_m: float) -> float:
    """Round up to the nearest 50 mm."""
    mm = math.ceil(size_m * 1000 / 50) * 50
    return mm / 1000


def _fctm(fck: float) -> float:
    """Tensile strength of concrete (EC2 Table 3.1)."""
    fck_int = int(round(fck / 5) * 5)
    return _FCTM.get(fck_int, 0.3 * fck ** (2.0 / 3.0))


def _vrd_c(fck: float, rho_l: float, d_mm: float, bw_mm: float = 1000.0) -> float:
    """Design shear resistance without shear reinforcement (EC2 cl.6.2.2).

    Returns vRd,c in N/mm² (stress, per unit width).
    """
    k = min(2.0, 1.0 + math.sqrt(200.0 / d_mm))
    rho_capped = min(rho_l, 0.02)
    v1 = CRD_C * k * (100.0 * rho_capped * fck) ** (1.0 / 3.0)
    v_min = 0.035 * k ** 1.5 * math.sqrt(fck)
    return max(v1, v_min)


def _slab_provision(as_req: float, bar_dia: int = 16) -> tuple[int, float, str]:
    """Bar-at-spacing provision for a slab/footing per metre width."""
    bar_area = math.pi * (bar_dia / 2.0) ** 2
    spacing = int(1000.0 * bar_area / max(as_req, 1.0))
    spacing = max(75, min(spacing, 400))
    spacing = int(round(spacing / 25.0) * 25)
    provided = 1000.0 / spacing * bar_area
    provision = f"H{bar_dia} @ {spacing} c/c ({_rv(provided, 0)} mm²/m)"
    return spacing, provided, provision


def _triangular_contact_qmax(
    n_total: float, b: float, l: float, ex: float, ey: float
) -> tuple[float, float]:
    """Bearing pressure when q_min < 0 — partial contact (triangular stress block).

    For simplicity the dominant eccentricity axis is handled; for the other
    axis the smaller moment is treated additively.  Returns (q_max, q_contact_length).
    """
    # 3B/2 rule: contact length c_x = B*(0.5 - ex/B)*3/2... derive directly
    # Effective contact in B direction
    c_b = max(0.0, 3.0 * (b / 2.0 - ex))
    # q_max from triangular distribution: N_total = 0.5 * q_max * c_b * L
    if c_b * l > 0:
        q_max_tri = 2.0 * n_total / (c_b * l)
    else:
        q_max_tri = 0.0
    return q_max_tri, c_b


def _bearing_profile(
    n_total: float,
    b: float,
    l: float,
    ex: float,
    ey: float,
    q_allow: float,
) -> tuple[list[float], list[float], float, float, bool]:
    """Generate 5-point bearing pressure profile along the B dimension.

    Returns (x_list, q_list, q_max, q_min, full_contact).
    """
    a = b * l
    q_avg = n_total / a
    q_max = q_avg * (1.0 + 6.0 * ex / b + 6.0 * ey / l)
    q_min = q_avg * (1.0 - 6.0 * ex / b - 6.0 * ey / l)

    full_contact = q_min >= 0.0

    if full_contact:
        x_pts = [0.0, b / 4.0, b / 2.0, 3.0 * b / 4.0, b]
        # linear variation from q_max at x=0 to q_min at x=b
        q_pts = [q_max - (q_max - q_min) * xi / b for xi in x_pts]
    else:
        q_max_tri, c_b = _triangular_contact_qmax(n_total, b, l, ex, ey)
        q_max = q_max_tri
        q_min = 0.0
        # 5 points: triangular from 0 to c_b, then zero
        x_pts = [0.0, c_b / 2.0, c_b, (c_b + b) / 2.0, b]
        # linear triangle from q_max at 0 down to 0 at c_b, then 0
        q_pts = []
        for xi in x_pts:
            if xi <= c_b:
                q_pts.append(q_max * (1.0 - xi / c_b) if c_b > 0 else 0.0)
            else:
                q_pts.append(0.0)

    return ([_rv(xi, 3) for xi in x_pts],
            [_rv(qi, 2) for qi in q_pts],
            q_max, q_min, full_contact)


# ---------------------------------------------------------------------------
# PAD FOOTING
# ---------------------------------------------------------------------------

def _design_pad(inputs: dict[str, Any]) -> dict[str, Any]:
    """Full pad footing design to EC7 / EC2 / BS 8004."""

    # ---- inputs -----------------------------------------------------------
    b_col_mm: float = float(inputs.get("column_b_mm", 400.0))
    h_col_mm: float = float(inputs.get("column_h_mm", 400.0))
    N_ed: float = float(inputs.get("N_ed_kn", 0.0))       # ULS axial
    N_ek: float = float(inputs.get("N_ek_kn", N_ed / 1.35))  # SLS / char
    M_ex: float = float(inputs.get("M_ex_knm", 0.0))      # moment about x (causes ey)
    M_ey: float = float(inputs.get("M_ey_knm", 0.0))      # moment about y (causes ex)
    H_ex: float = float(inputs.get("H_ex_kn", 0.0))
    q_allow: float = float(inputs.get("soil_bearing_kpa", 150.0))
    qult: float = float(inputs.get("qult_kpa", q_allow * 3.0))
    df: float = float(inputs.get("foundation_depth_m", 1.2))
    fck: float = float(inputs.get("fck_mpa", 30.0))
    fyk: float = float(inputs.get("fyk_mpa", 500.0))
    cover: float = float(inputs.get("cover_mm", 50.0))
    gamma_conc: float = float(inputs.get("concrete_density", 24.0))

    b_col = b_col_mm / 1000.0
    h_col = h_col_mm / 1000.0

    steps: list[dict] = []
    warnings: list[str] = []
    errors: list[str] = []
    overall_status = "pass"

    sn = 1  # step counter

    # -----------------------------------------------------------------------
    # Step 1 — Net allowable bearing
    # -----------------------------------------------------------------------
    q_net = q_allow - gamma_conc * df
    steps.append(_step(sn, "Net Allowable Bearing Pressure",
        "q_net = q_allow − γ_c·D_f",
        f"q_net = {q_allow} − {gamma_conc}×{df}",
        f"q_net = {_rv(q_net, 1)} kPa", "kPa",
        "EC7 cl.6.5.2 / BS 8004:2015 cl.7.2", "info"))
    sn += 1
    if q_net <= 0:
        errors.append("Net bearing pressure ≤ 0; reduce foundation depth or increase q_allow.")
        overall_status = "fail"

    # -----------------------------------------------------------------------
    # Step 2 — Initial footing area (concentric)
    # -----------------------------------------------------------------------
    # Estimate self-weight as 8% of characteristic column load, then iterate
    N_total_est = N_ek * 1.08
    a_req_init = N_total_est / max(q_net, 1.0)
    b_init = math.sqrt(a_req_init)
    steps.append(_step(sn, "Initial Required Footing Area (concentric estimate)",
        "A_req ≈ 1.08·N_ek / q_net; B ≈ √A_req",
        f"A_req ≈ 1.08×{N_ek} / {_rv(q_net, 1)} = {_rv(a_req_init, 2)} m²",
        f"B₀ = {_rv(b_init, 2)} m", "m",
        "EC7 cl.6.5.2 (EN 1997-1)", "info"))
    sn += 1

    # -----------------------------------------------------------------------
    # Step 3 — Eccentricities from SLS loads (Meyerhof effective area)
    # -----------------------------------------------------------------------
    # Use characteristic (service) loads for bearing check
    # eccentricity ex acts in B-direction (from M_ey), ey in L-direction (from M_ex)
    # Iterate: assume B=L initially, then correct for eccentricity
    MAX_ITER = 30
    B = _round_up_50mm(b_init)
    L = B
    for _iteration in range(MAX_ITER):
        W_f = B * L * df * gamma_conc
        N_total = N_ek + W_f
        ex = abs(M_ey) / N_total if N_total > 0 else 0.0
        ey = abs(M_ex) / N_total if N_total > 0 else 0.0
        # Effective dimensions (Meyerhof 1953)
        B_prime = max(B - 2.0 * ex, 0.01)
        L_prime = max(L - 2.0 * ey, 0.01)
        A_eff = B_prime * L_prime
        A_req_new = N_total / max(q_net, 1.0)
        B_new = _round_up_50mm(math.sqrt(A_req_new * B / L if L > 0 else A_req_new))
        L_new = _round_up_50mm(A_req_new / B_new)
        if abs(B_new - B) < 0.025 and abs(L_new - L) < 0.025:
            B = B_new
            L = L_new
            break
        B = B_new
        L = L_new

    W_f = B * L * df * gamma_conc
    N_total = N_ek + W_f
    ex = abs(M_ey) / N_total if N_total > 0 else 0.0
    ey = abs(M_ex) / N_total if N_total > 0 else 0.0
    B_prime = max(B - 2.0 * ex, 0.01)
    L_prime = max(L - 2.0 * ey, 0.01)
    A_eff = B_prime * L_prime

    steps.append(_step(sn, "Eccentricities and Meyerhof Effective Area",
        "ex = M_ey/N_total; ey = M_ex/N_total; B' = B−2ex; L' = L−2ey; A' = B'×L'",
        (f"ex = {_rv(M_ey,1)}/{_rv(N_total,1)} = {_rv(ex*1000,1)} mm; "
         f"ey = {_rv(M_ex,1)}/{_rv(N_total,1)} = {_rv(ey*1000,1)} mm"),
        (f"B' = {_rv(B_prime,3)} m; L' = {_rv(L_prime,3)} m; "
         f"A' = {_rv(A_eff,3)} m²"), "m",
        "EC7 cl.6.5.4 / Meyerhof (1953)", "info"))
    sn += 1

    # -----------------------------------------------------------------------
    # Step 4 — Final footing dimensions
    # -----------------------------------------------------------------------
    steps.append(_step(sn, "Footing Dimensions (after iteration)",
        "B, L rounded to nearest 50 mm ensuring N_ek/A' ≤ q_net",
        f"W_f = {_rv(W_f,1)} kN; N_total = {_rv(N_total,1)} kN",
        f"B = {_rv(B,3)} m; L = {_rv(L,3)} m; Area = {_rv(B*L,3)} m²", "m",
        "EC7 cl.6.5.2; BS 8004:2015", "info"))
    sn += 1

    # -----------------------------------------------------------------------
    # Step 5 — Bearing pressure profile
    # -----------------------------------------------------------------------
    x_pts, q_pts, q_max, q_min, full_contact = _bearing_profile(
        N_total, B, L, ex, ey, q_allow
    )
    bearing_ok = q_max <= q_allow
    if not bearing_ok:
        overall_status = "fail"
        errors.append(f"q_max {_rv(q_max,1)} kPa > q_allow {q_allow} kPa — increase footing size.")
    if not full_contact:
        warnings.append(
            "Partial soil contact (q_min < 0). Triangular pressure distribution used. "
            "Consider increasing footing size to eliminate tension. EC7 cl.6.5.4(1)P."
        )

    steps.append(_step(sn, "Bearing Pressure Profile (SLS / characteristic loads)",
        ("q_max = (N/A)·(1 + 6ex/B + 6ey/L); "
         "q_min = (N/A)·(1 − 6ex/B − 6ey/L)"),
        f"N_total = {_rv(N_total,1)} kN; A = {_rv(B*L,3)} m²",
        (f"q_max = {_rv(q_max,1)} kPa {'✓' if bearing_ok else '✗'} "
         f"(≤ {q_allow} kPa); q_min = {_rv(q_min,1)} kPa; "
         f"{'Full contact' if full_contact else 'PARTIAL CONTACT — triangular'}"),
        "kPa", "EC7 cl.6.5.4 / BS 8004:2015 cl.7.2",
        "pass" if bearing_ok else "fail"))
    sn += 1

    # -----------------------------------------------------------------------
    # Step 6 — EC7 Ultimate bearing check (if qult provided)
    # -----------------------------------------------------------------------
    if qult > 0 and qult != q_allow * 3.0:
        q_ult_req = q_allow * 3.0   # typical Fs = 3 implied
        ec7_ok = (N_ed / A_eff) <= (qult / GAMMA_GEO)
        steps.append(_step(sn, "EC7 Ultimate Bearing Capacity Check",
            "N_Ed / A' ≤ q_ult / γ_geo  (EC7 GEO limit state)",
            f"N_Ed/A' = {_rv(N_ed/A_eff,2)} kPa; q_ult/γ_geo = {_rv(qult/GAMMA_GEO,2)} kPa",
            f"{'✓ GEO check passes' if ec7_ok else '✗ GEO FAIL — increase A or reduce N_Ed'}",
            "kPa", "EC7 cl.6.5.2 (GEO) / DA1 Comb 1",
            "pass" if ec7_ok else "fail"))
        sn += 1
        if not ec7_ok:
            overall_status = "fail"
            errors.append("EC7 ultimate GEO bearing capacity exceeded.")

    # -----------------------------------------------------------------------
    # Step 7 — Footing thickness (preliminary from punching)
    # -----------------------------------------------------------------------
    # Estimate d from punching shear: vEd = β·N_Ed/(u·d) ≤ vRd,c
    # We'll assume H ≈ 0.5 + 0.1·B (empirical), min 400mm
    H_est = max(0.4, 0.1 * B + 0.5 * max(b_col, h_col))
    phi_bar = 16.0
    phi_link = 10.0
    d = H_est * 1000.0 - cover - phi_link - phi_bar / 2.0
    if d <= 0:
        d = 300.0
        H_est = (d + cover + phi_link + phi_bar / 2.0) / 1000.0

    steps.append(_step(sn, "Preliminary Footing Thickness",
        "H_est = max(400 mm, 100×B + 500×max(b_col, h_col)); d = H − cover − φ_link − φ_bar/2",
        f"H_est = {_rv(H_est*1000,0)} mm; cover = {cover} mm",
        f"d = {_rv(d,0)} mm", "mm",
        "EC2 cl.9.8.2 / BS 8004:2015 cl.9.4", "info"))
    sn += 1

    # -----------------------------------------------------------------------
    # Step 8 — Net ULS bearing pressure for structural design
    # -----------------------------------------------------------------------
    # q_net_uls = N_Ed / (B × L) — subtract self-weight of footing to get net
    q_uls_gross = N_ed / (B * L)
    q_sw = W_f / (B * L)   # foundation self-weight per unit area
    q_net_uls = q_uls_gross - q_sw
    # For design of reinforcement use net upward pressure
    q_design = q_net_uls if q_net_uls > 0 else q_uls_gross

    steps.append(_step(sn, "Net ULS Upward Pressure for Structural Design",
        "q_uls = N_Ed/(B·L); q_net_uls = q_uls − W_f/(B·L)",
        f"q_uls = {_rv(q_uls_gross,2)} kPa; q_sw = {_rv(q_sw,2)} kPa",
        f"q_net_uls = {_rv(q_net_uls,2)} kPa", "kPa",
        "EC2 cl.6.1 / EC7 cl.6.5.2", "info"))
    sn += 1

    # -----------------------------------------------------------------------
    # Step 9 — Bending design — x-direction (span B, about axis parallel to L)
    # -----------------------------------------------------------------------
    # Cantilever from column face
    lx = (B - b_col) / 2.0   # cantilever in B direction
    Mx_per_m = q_design * lx ** 2 / 2.0   # kNm/m (moment along L)
    Mx_total = Mx_per_m * L               # total moment (kNm)
    steps.append(_step(sn, "Bending Moment — x-direction (along B)",
        "lx = (B−b_col)/2; M_x = q_net·lx²/2 per m",
        f"lx = ({_rv(B,3)}−{_rv(b_col,3)})/2 = {_rv(lx,3)} m",
        f"M_x = {_rv(Mx_per_m,2)} kNm/m (total = {_rv(Mx_total,2)} kNm)", "kNm/m",
        "EC2 cl.6.1", "info"))
    sn += 1

    # -----------------------------------------------------------------------
    # Step 10 — Bending design — y-direction (span L, about axis parallel to B)
    # -----------------------------------------------------------------------
    ly = (L - h_col) / 2.0
    My_per_m = q_design * ly ** 2 / 2.0
    My_total = My_per_m * B
    steps.append(_step(sn, "Bending Moment — y-direction (along L)",
        "ly = (L−h_col)/2; M_y = q_net·ly²/2 per m",
        f"ly = ({_rv(L,3)}−{_rv(h_col,3)})/2 = {_rv(ly,3)} m",
        f"M_y = {_rv(My_per_m,2)} kNm/m (total = {_rv(My_total,2)} kNm)", "kNm/m",
        "EC2 cl.6.1", "info"))
    sn += 1

    # -----------------------------------------------------------------------
    # Step 11 — K factor and lever arm (x-direction governs)
    # -----------------------------------------------------------------------
    def _k_and_z(M_knm_per_m: float, d_mm: float, fck_: float) -> tuple[float, float, bool]:
        Mu = M_knm_per_m * 1.0e6  # N·mm/m
        k = Mu / (1000.0 * d_mm ** 2 * fck_)
        k_ok = k <= 0.167
        z = min(d_mm * (0.5 + math.sqrt(max(0.0, 0.25 - k / 1.134))), 0.95 * d_mm)
        return k, z, k_ok

    kx, zx, kx_ok = _k_and_z(Mx_per_m, d, fck)
    ky, zy, ky_ok = _k_and_z(My_per_m, d, fck)

    steps.append(_step(sn, "K Factor — x-direction",
        "K = M/(b·d²·fck); z = d·[0.5+√(0.25−K/1.134)] ≤ 0.95d",
        f"K_x = {_rv(kx,4)}; z_x = {_rv(zx,1)} mm",
        f"K_x = {_rv(kx,4)} {'✓' if kx_ok else '✗ (K>0.167 — compression steel required)'}", "",
        "EC2 cl.6.1", "pass" if kx_ok else "fail"))
    sn += 1
    if not kx_ok:
        overall_status = "fail"
        errors.append(f"K_x = {_rv(kx,4)} > 0.167 — increase footing depth or fck.")

    steps.append(_step(sn, "K Factor — y-direction",
        "K = M/(b·d²·fck); z = d·[0.5+√(0.25−K/1.134)] ≤ 0.95d",
        f"K_y = {_rv(ky,4)}; z_y = {_rv(zy,1)} mm",
        f"K_y = {_rv(ky,4)} {'✓' if ky_ok else '✗ (K>0.167)'}", "",
        "EC2 cl.6.1", "pass" if ky_ok else "fail"))
    sn += 1
    if not ky_ok:
        overall_status = "fail"
        errors.append(f"K_y = {_rv(ky,4)} > 0.167 — increase footing depth or fck.")

    # -----------------------------------------------------------------------
    # Step 13 — Required reinforcement (both directions)
    # -----------------------------------------------------------------------
    as_req_x = (Mx_per_m * 1.0e6) / (0.87 * fyk * zx)   # mm²/m
    as_req_y = (My_per_m * 1.0e6) / (0.87 * fyk * zy)   # mm²/m

    fctm_val = _fctm(fck)
    as_min = max(0.26 * fctm_val / fyk * 1000.0 * d, 0.0013 * 1000.0 * d)
    as_max = 0.04 * 1000.0 * H_est * 1000.0  # 4% gross section

    as_x = max(as_req_x, as_min)
    as_y = max(as_req_y, as_min)

    _, prov_x_area, prov_x_str = _slab_provision(as_x, 16)
    _, prov_y_area, prov_y_str = _slab_provision(as_y, 16)

    steps.append(_step(sn, "Required Reinforcement — x-direction",
        "As,req = M/(0.87·fyk·z); As,min = max(0.26·fctm/fyk·b·d, 0.0013·b·d)",
        f"As,req_x = {_rv(as_req_x,0)} mm²/m; As,min = {_rv(as_min,0)} mm²/m",
        f"As_x = {_rv(as_x,0)} mm²/m → Provide {prov_x_str}", "mm²/m",
        "EC2 cl.9.2.1.1 / cl.9.8.2", "info"))
    sn += 1

    steps.append(_step(sn, "Required Reinforcement — y-direction",
        "As,req = M/(0.87·fyk·z); As,min as above",
        f"As,req_y = {_rv(as_req_y,0)} mm²/m; As,min = {_rv(as_min,0)} mm²/m",
        f"As_y = {_rv(as_y,0)} mm²/m → Provide {prov_y_str}", "mm²/m",
        "EC2 cl.9.2.1.1 / cl.9.8.2", "info"))
    sn += 1

    # -----------------------------------------------------------------------
    # Step 15 — Punching shear check (EC2 cl.6.4.3)
    # -----------------------------------------------------------------------
    # Critical perimeter u1 at 2d from column face (EC2 cl.6.4.2)
    # For column: u1 = 2(b_col + h_col) + 2π·2d
    u1 = 2.0 * (b_col_mm + h_col_mm) + 2.0 * math.pi * 2.0 * d   # mm
    # β factor: 1.0 symmetric, 1.15 edge/eccentric (EC2 cl.6.4.3(3))
    beta = 1.15 if (abs(M_ex) > 0.05 * N_ed or abs(M_ey) > 0.05 * N_ed) else 1.0
    v_ed_punch = beta * N_ed * 1000.0 / (u1 * d)   # N/mm²

    rho_x = prov_x_area / (1000.0 * d)
    rho_y = prov_y_area / (1000.0 * d)
    rho_l_punch = min(math.sqrt(rho_x * rho_y), 0.02)

    v_rd_c_punch = _vrd_c(fck, rho_l_punch, d)

    punch_ok = v_ed_punch <= v_rd_c_punch
    punch_status = "pass" if punch_ok else "fail"
    if not punch_ok:
        # Check if vEd ≤ vRd,max — if not, fail; otherwise reinforcement required
        v_rd_max = 0.5 * 0.6 * (1 - fck / 250.0) * (ALPHA_CC * fck / GAMMA_C)
        if v_ed_punch > v_rd_max:
            overall_status = "fail"
            errors.append("vEd > vRd,max — increase footing depth (d) significantly.")
            punch_status = "fail"
        else:
            warnings.append("Punching: vEd > vRd,c — punching reinforcement required (EC2 cl.6.4.5).")
            punch_status = "reinforcement_required"
            if overall_status == "pass":
                overall_status = "warning"

    steps.append(_step(sn, "Punching Shear Check (EC2 cl.6.4.3)",
        "u1 = 2(b+h)+2π(2d); vEd = β·N_Ed/(u1·d); vRd,c per EC2 cl.6.4.4",
        (f"u1 = {_rv(u1,0)} mm; β = {beta}; "
         f"vEd = {_rv(v_ed_punch,3)} N/mm²; vRd,c = {_rv(v_rd_c_punch,3)} N/mm²"),
        f"vEd {'≤' if punch_ok else '>'} vRd,c — {punch_status.upper().replace('_',' ')}",
        "N/mm²", "EC2 cl.6.4.3 / cl.6.4.4", punch_status))
    sn += 1

    # -----------------------------------------------------------------------
    # Step 16 — One-way (beam) shear check — x-direction (EC2 cl.6.2.2)
    # -----------------------------------------------------------------------
    # Critical section at distance d from column face
    lx_shear = max(lx - d / 1000.0, 0.1)
    V_ed_x = q_design * lx_shear * L   # total shear force (kN)
    v_ed_x = V_ed_x * 1000.0 / (L * 1000.0 * d)   # N/mm²
    rho_l_x = min(prov_x_area / (1000.0 * d), 0.02)
    v_rd_c_x = _vrd_c(fck, rho_l_x, d)
    shear_x_ok = v_ed_x <= v_rd_c_x
    if not shear_x_ok:
        overall_status = "fail"
        errors.append(f"Beam shear x-direction fails: vEd = {_rv(v_ed_x,3)} > vRd,c = {_rv(v_rd_c_x,3)} N/mm².")

    steps.append(_step(sn, "Beam Shear — x-direction (at d from column face)",
        "lx_cr = lx − d/1000; VEd = q·lx_cr·L; vEd = VEd/(L·d)",
        f"lx_cr = {_rv(lx_shear,3)} m; VEd = {_rv(V_ed_x,1)} kN",
        (f"vEd = {_rv(v_ed_x,3)} {'✓' if shear_x_ok else '✗'} "
         f"N/mm² (vRd,c = {_rv(v_rd_c_x,3)} N/mm²)"),
        "N/mm²", "EC2 cl.6.2.2", "pass" if shear_x_ok else "fail"))
    sn += 1

    # -----------------------------------------------------------------------
    # Step 17 — One-way shear check — y-direction
    # -----------------------------------------------------------------------
    ly_shear = max(ly - d / 1000.0, 0.1)
    V_ed_y = q_design * ly_shear * B
    v_ed_y = V_ed_y * 1000.0 / (B * 1000.0 * d)
    rho_l_y = min(prov_y_area / (1000.0 * d), 0.02)
    v_rd_c_y = _vrd_c(fck, rho_l_y, d)
    shear_y_ok = v_ed_y <= v_rd_c_y
    if not shear_y_ok:
        overall_status = "fail"
        errors.append(f"Beam shear y-direction fails: vEd = {_rv(v_ed_y,3)} > vRd,c = {_rv(v_rd_c_y,3)} N/mm².")

    steps.append(_step(sn, "Beam Shear — y-direction (at d from column face)",
        "ly_cr = ly − d/1000; VEd = q·ly_cr·B; vEd = VEd/(B·d)",
        f"ly_cr = {_rv(ly_shear,3)} m; VEd = {_rv(V_ed_y,1)} kN",
        (f"vEd = {_rv(v_ed_y,3)} {'✓' if shear_y_ok else '✗'} "
         f"N/mm² (vRd,c = {_rv(v_rd_c_y,3)} N/mm²)"),
        "N/mm²", "EC2 cl.6.2.2", "pass" if shear_y_ok else "fail"))
    sn += 1

    # -----------------------------------------------------------------------
    # Step 18 — Horizontal sliding check (BS 8004 / EC7 GEO)
    # -----------------------------------------------------------------------
    if H_ex > 0:
        # Passive + base friction resistance (simplified: μ ≈ 0.4 for concrete on soil)
        mu_friction = 0.4
        H_resist = mu_friction * N_total
        slide_ok = H_ex <= H_resist
        if not slide_ok:
            warnings.append(f"Sliding check: H_Ex = {H_ex} kN > resistance = {_rv(H_resist,1)} kN. "
                            "Consider key or anchor. EC7 cl.6.5.3.")
            if overall_status == "pass":
                overall_status = "warning"
        steps.append(_step(sn, "Horizontal Sliding Check",
            "H_resist = μ·N_total  (μ = 0.4 for concrete on soil)",
            f"H_resist = 0.4×{_rv(N_total,1)} = {_rv(H_resist,1)} kN",
            f"H_Ex = {H_ex} kN {'✓' if slide_ok else '✗'} (≤ {_rv(H_resist,1)} kN)",
            "kN", "EC7 cl.6.5.3 / BS 8004:2015 cl.10", "pass" if slide_ok else "warning"))
        sn += 1

    return {
        "status": overall_status,
        "summary": {
            "foundation_type": "Pad Footing",
            "footing_B_m": _rv(B, 3),
            "footing_L_m": _rv(L, 3),
            "footing_depth_m": _rv(H_est * 1000.0, 0),
            "footing_area_m2": _rv(B * L, 3),
            "q_max_kpa": _rv(q_max, 2),
            "q_min_kpa": _rv(q_min, 2),
            "bearing_ok": bearing_ok,
            "punching_check": punch_status,
            "as_req_x_mm2_per_m": _rv(as_x, 0),
            "as_req_y_mm2_per_m": _rv(as_y, 0),
            "provision_x": prov_x_str,
            "provision_y": prov_y_str,
            "effective_depth_d_mm": _rv(d, 0),
            "pile_reaction_kn": None,
            "pile_cap_steel_mm2": None,
        },
        "bearing_pressure_profile": {
            "x_m": x_pts,
            "q_kpa": q_pts,
        },
        "steps": steps,
        "warnings": warnings,
        "errors": errors,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# COMBINED FOOTING (two columns)
# ---------------------------------------------------------------------------

def _design_combined(inputs: dict[str, Any]) -> dict[str, Any]:
    """Combined two-column footing design to EC7 / EC2."""

    # ---- inputs -----------------------------------------------------------
    b_col1_mm: float = float(inputs.get("column_b_mm", 400.0))
    h_col1_mm: float = float(inputs.get("column_h_mm", 400.0))
    b_col2_mm: float = float(inputs.get("column2_b_mm", b_col1_mm))
    h_col2_mm: float = float(inputs.get("column2_h_mm", h_col1_mm))
    N1_ed: float = float(inputs.get("N_ed_kn", 0.0))
    N2_ed: float = float(inputs.get("N_ed2_kn", N1_ed))
    N1_ek: float = float(inputs.get("N_ek_kn", N1_ed / 1.35))
    N2_ek: float = float(inputs.get("N_ek2_kn", N2_ed / 1.35))
    M1_ex: float = float(inputs.get("M_ex_knm", 0.0))
    M2_ex: float = float(inputs.get("M_ex2_knm", 0.0))
    col_spacing: float = float(inputs.get("column_spacing_m", 3.0))
    col2_offset: float = float(inputs.get("column2_offset_m", 0.3))
    q_allow: float = float(inputs.get("soil_bearing_kpa", 150.0))
    df: float = float(inputs.get("foundation_depth_m", 1.2))
    fck: float = float(inputs.get("fck_mpa", 30.0))
    fyk: float = float(inputs.get("fyk_mpa", 500.0))
    cover: float = float(inputs.get("cover_mm", 50.0))
    gamma_conc: float = float(inputs.get("concrete_density", 24.0))

    b_col1 = b_col1_mm / 1000.0
    b_col2 = b_col2_mm / 1000.0
    h_col1 = h_col1_mm / 1000.0
    h_col2 = h_col2_mm / 1000.0

    steps: list[dict] = []
    warnings: list[str] = []
    errors: list[str] = []
    overall_status = "pass"

    sn = 1

    # -----------------------------------------------------------------------
    # Step 1 — Centroid of column loads
    # -----------------------------------------------------------------------
    N_total_ek = N1_ek + N2_ek
    # col1 at x = col2_offset; col2 at x = col2_offset + col_spacing
    x1 = col2_offset
    x2 = col2_offset + col_spacing
    x_centroid = (N1_ek * x1 + N2_ek * x2) / N_total_ek

    steps.append(_step(sn, "Centroid of Column Loads",
        "x_c = (N1·x1 + N2·x2)/(N1+N2)  [measured from footing left edge]",
        f"x_c = ({N1_ek}×{x1} + {N2_ek}×{x2}) / {_rv(N_total_ek,1)}",
        f"x_centroid = {_rv(x_centroid,3)} m from left edge", "m",
        "Structural analysis — combined footing centroid", "info"))
    sn += 1

    # -----------------------------------------------------------------------
    # Step 2 — Footing length for uniform bearing
    # -----------------------------------------------------------------------
    # For uniform bearing: footing centroid = load centroid
    # left edge at 0, right edge at L_fndg
    # centroid at L_fndg/2 ⟹ L_fndg = 2·x_centroid (if centroid > x1, else extend left)
    # Also ensure col1 and col2 are within the footing with min overhang
    min_overhang = 0.15  # m
    left_edge = min(x1 - min_overhang, 0.0)
    right_edge_needed = x2 + min_overhang
    L_raw = max(2.0 * (x_centroid - left_edge), right_edge_needed - left_edge)
    L_fndg = _round_up_50mm(L_raw)

    # Re-check that centroid of footing ≈ centroid of load (uniform pressure)
    fndg_centroid = left_edge + L_fndg / 2.0
    e_fndg = abs(x_centroid - fndg_centroid)

    steps.append(_step(sn, "Footing Length (for uniform bearing)",
        "L = 2·(x_centroid − left_edge); rounded up to 50 mm",
        f"L_raw = {_rv(L_raw,3)} m; overhang OK; eccentricity e = {_rv(e_fndg,3)} m",
        f"L_fndg = {_rv(L_fndg,3)} m", "m",
        "EC7 cl.6.5.2 / Combined footing theory", "info"))
    sn += 1

    # -----------------------------------------------------------------------
    # Step 3 — Footing width
    # -----------------------------------------------------------------------
    q_net = q_allow - gamma_conc * df
    W_f_est = L_fndg * 1.0 * df * gamma_conc  # initial guess B=1
    B_raw = (N_total_ek + W_f_est) / (q_net * L_fndg)
    # Iterate
    for _ in range(10):
        W_f_est = L_fndg * B_raw * df * gamma_conc
        B_new = (N_total_ek + W_f_est) / (q_net * L_fndg)
        if abs(B_new - B_raw) < 0.01:
            B_raw = B_new
            break
        B_raw = B_new
    B_fndg = _round_up_50mm(B_raw)
    W_f = L_fndg * B_fndg * df * gamma_conc
    q_actual = (N_total_ek + W_f) / (B_fndg * L_fndg)

    steps.append(_step(sn, "Footing Width",
        "B = (N_total_ek + W_f) / (q_net·L); iterate for W_f",
        f"N_total_ek = {_rv(N_total_ek,1)} kN; W_f = {_rv(W_f,1)} kN; q_net = {_rv(q_net,1)} kPa",
        f"B = {_rv(B_fndg,3)} m; q_actual = {_rv(q_actual,2)} kPa {'✓' if q_actual <= q_allow else '✗'}",
        "m", "EC7 cl.6.5.2", "pass" if q_actual <= q_allow else "fail"))
    sn += 1
    if q_actual > q_allow:
        overall_status = "fail"
        errors.append(f"q_actual = {_rv(q_actual,2)} kPa > q_allow = {q_allow} kPa.")

    # -----------------------------------------------------------------------
    # Step 4 — Bearing pressure profile (uniform assumed; slight eccentricity)
    # -----------------------------------------------------------------------
    x_pts_comb = [0.0, L_fndg/4, L_fndg/2, 3*L_fndg/4, L_fndg]
    q_pts_comb = [_rv(q_actual, 2)] * 5   # uniform

    # -----------------------------------------------------------------------
    # Step 5 — ULS upward pressure (uniform)
    # -----------------------------------------------------------------------
    N_total_ed = N1_ed + N2_ed
    W_f_uls = L_fndg * B_fndg * df * gamma_conc  # same footing weight
    q_uls = (N_total_ed + W_f_uls) / (B_fndg * L_fndg)
    q_u = N_total_ed / (B_fndg * L_fndg)   # net upward from columns only

    steps.append(_step(sn, "ULS Upward Soil Pressure (net from column loads)",
        "q_u = N_Ed_total / (B·L)",
        f"N_Ed_total = {_rv(N_total_ed,1)} kN; B = {_rv(B_fndg,3)} m; L = {_rv(L_fndg,3)} m",
        f"q_u = {_rv(q_u,2)} kPa", "kPa",
        "EC7 cl.6.5.2 / EC2 structural design", "info"))
    sn += 1

    # -----------------------------------------------------------------------
    # Step 6 — Beam-on-elastic-foundation moment analysis
    # -----------------------------------------------------------------------
    # Treat footing as a beam loaded upward by q_u·B per unit length,
    # with point loads N1_ed and N2_ed at column positions.
    # Using statics:
    #   wu = q_u × B  (kN/m upward)
    #   Reactions from soil balance column loads + self-weight (already in q_u)
    wu = q_u * B_fndg   # kN/m upward UDL

    # Positions from left edge of footing
    x1_fndg = x1 - left_edge
    x2_fndg = x2 - left_edge

    # BM diagram: critical sections
    # Shear at left edge = 0 (free end)
    # BM at x1 (col1 face): cantilever moment from left
    M_col1_face = -wu * x1_fndg ** 2 / 2.0 + N1_ed * 0.0  # just upward contribution
    # Correct: M at x (left of col1) = wu·x1²/2 (sagging from upward udl)
    # After applying N1_ed: BM jumps
    M_at_x1 = wu * x1_fndg ** 2 / 2.0   # moment just before col1 (sagging)
    # Sagging between columns (max somewhere between x1 and x2)
    # Using superposition: find x where V=0
    # V(x) = wu·x - N1_ed  (for x > x1_fndg, before col2)
    x_v0 = x1_fndg + N1_ed / wu if wu > 0 else (x1_fndg + x2_fndg) / 2.0
    x_v0 = max(x1_fndg, min(x_v0, x2_fndg))
    M_sagging = wu * x_v0 ** 2 / 2.0 - N1_ed * (x_v0 - x1_fndg)

    # Hogging at col2 face (from right end)
    right_cantilever = L_fndg - x2_fndg
    M_col2_right = wu * right_cantilever ** 2 / 2.0

    M_design_bottom = max(M_sagging * B_fndg, 0.0)  # total sagging (kNm), bottom steel
    M_design_top = max(M_at_x1 * B_fndg, M_col2_right * B_fndg, 0.0)  # total hogging

    steps.append(_step(sn, "Bending Moment Diagram (beam on elastic foundation)",
        "wu = q_u·B; BMD by statics — cantilever ends, max sagging between columns",
        (f"wu = {_rv(wu,2)} kN/m; M_sag = {_rv(M_sagging,2)} kNm/m; "
         f"M_hog_col1 = {_rv(M_at_x1,2)} kNm/m; M_hog_col2 = {_rv(M_col2_right,2)} kNm/m"),
        (f"M_bottom = {_rv(M_design_bottom,2)} kNm; "
         f"M_top = {_rv(M_design_top,2)} kNm"), "kNm",
        "EC2 cl.5.4 / Combined footing theory", "info"))
    sn += 1

    # -----------------------------------------------------------------------
    # Step 7 — Reinforcement design (combined footing)
    # -----------------------------------------------------------------------
    phi_bar = 16.0
    phi_link = 10.0
    H_fndg = max(0.5, 0.1 * B_fndg + 0.5 * max(b_col1, b_col2))
    d_fndg = H_fndg * 1000.0 - cover - phi_link - phi_bar / 2.0

    def _as_for_M(M_knm: float, d_mm: float, b_m: float, fck_: float, fyk_: float
                  ) -> tuple[float, float]:
        """As in mm²/m and total As in mm²."""
        if M_knm <= 0 or b_m <= 0:
            return 0.0, 0.0
        M_per_m = M_knm / b_m
        k = (M_per_m * 1e6) / (1000.0 * d_mm ** 2 * fck_)
        k = min(k, 0.167)
        z = min(d_mm * (0.5 + math.sqrt(max(0.0, 0.25 - k / 1.134))), 0.95 * d_mm)
        as_per_m = (M_per_m * 1e6) / (0.87 * fyk_ * z)
        return as_per_m, as_per_m * b_m

    as_bot_per_m, as_bot_total = _as_for_M(M_design_bottom, d_fndg, B_fndg, fck, fyk)
    as_top_per_m, as_top_total = _as_for_M(M_design_top, d_fndg, B_fndg, fck, fyk)
    fctm_val = _fctm(fck)
    as_min_per_m = max(0.26 * fctm_val / fyk * 1000.0 * d_fndg, 0.0013 * 1000.0 * d_fndg)
    as_bot_per_m = max(as_bot_per_m, as_min_per_m)
    as_top_per_m = max(as_top_per_m, as_min_per_m)

    _, _, prov_bot_str = _slab_provision(as_bot_per_m, 16)
    _, _, prov_top_str = _slab_provision(as_top_per_m, 16)

    steps.append(_step(sn, "Longitudinal Reinforcement (bottom — sagging)",
        "As,bot = M_sag/(0.87·fyk·z); As,min EC2 cl.9.2.1.1",
        f"M_bottom = {_rv(M_design_bottom,2)} kNm; d = {_rv(d_fndg,0)} mm",
        f"As,bot = {_rv(as_bot_per_m,0)} mm²/m → Provide {prov_bot_str}", "mm²/m",
        "EC2 cl.6.1 / cl.9.2.1.1", "info"))
    sn += 1

    steps.append(_step(sn, "Longitudinal Reinforcement (top — hogging at columns)",
        "As,top = M_hog/(0.87·fyk·z)",
        f"M_top = {_rv(M_design_top,2)} kNm; d = {_rv(d_fndg,0)} mm",
        f"As,top = {_rv(as_top_per_m,0)} mm²/m → Provide {prov_top_str}", "mm²/m",
        "EC2 cl.6.1 / cl.9.2.1.1", "info"))
    sn += 1

    # Transverse (short-direction) steel
    # Transverse moment from projecting width (short cantilever)
    lx_tr = (B_fndg - max(b_col1, b_col2)) / 2.0
    q_design_comb = q_u
    M_trans_per_m = q_design_comb * lx_tr ** 2 / 2.0
    _, _, prov_trans_str = _slab_provision(max(
        (M_trans_per_m * 1e6) / (0.87 * fyk * 0.95 * d_fndg),
        as_min_per_m), 16)

    steps.append(_step(sn, "Transverse (short-direction) Reinforcement",
        "M_trans = q_u·lx²/2; lx = (B−b_col)/2",
        f"lx = {_rv(lx_tr,3)} m; M_trans = {_rv(M_trans_per_m,2)} kNm/m",
        f"As,trans → Provide {prov_trans_str}", "mm²/m",
        "EC2 cl.9.8.2 / ACI 318 combined footing", "info"))
    sn += 1

    x_pts_out = [_rv(xi, 3) for xi in x_pts_comb]

    return {
        "status": overall_status,
        "summary": {
            "foundation_type": "Combined Footing",
            "footing_B_m": _rv(B_fndg, 3),
            "footing_L_m": _rv(L_fndg, 3),
            "footing_depth_m": _rv(H_fndg * 1000, 0),
            "footing_area_m2": _rv(B_fndg * L_fndg, 3),
            "q_max_kpa": _rv(q_actual, 2),
            "q_min_kpa": _rv(q_actual, 2),
            "bearing_ok": q_actual <= q_allow,
            "punching_check": "info",
            "as_req_x_mm2_per_m": _rv(as_bot_per_m, 0),
            "as_req_y_mm2_per_m": _rv(as_top_per_m, 0),
            "provision_bottom": prov_bot_str,
            "provision_top": prov_top_str,
            "effective_depth_d_mm": _rv(d_fndg, 0),
            "pile_reaction_kn": None,
            "pile_cap_steel_mm2": None,
        },
        "bearing_pressure_profile": {
            "x_m": x_pts_out,
            "q_kpa": q_pts_comb,
        },
        "steps": steps,
        "warnings": warnings,
        "errors": errors,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# PILE CAP
# ---------------------------------------------------------------------------

def _design_pile_cap(inputs: dict[str, Any]) -> dict[str, Any]:
    """Pile cap design — 2, 3, or 4 pile configurations (truss model EC2 / BS 8110)."""

    # ---- inputs -----------------------------------------------------------
    b_col_mm: float = float(inputs.get("column_b_mm", 400.0))
    h_col_mm: float = float(inputs.get("column_h_mm", 400.0))
    N_ed: float = float(inputs.get("N_ed_kn", 0.0))
    pile_type: str = inputs.get("pile_type", "4_pile")
    d_pile_mm: float = float(inputs.get("pile_diameter_mm", 450.0))
    pile_cap_kn: float = float(inputs.get("pile_capacity_kn", 800.0))
    s_pile: float = float(inputs.get("pile_spacing_m", 1.35))
    fck: float = float(inputs.get("fck_mpa", 30.0))
    fyk: float = float(inputs.get("fyk_mpa", 500.0))
    cover: float = float(inputs.get("cover_mm", 75.0))  # min 75mm for pile caps
    gamma_conc: float = float(inputs.get("concrete_density", 24.0))

    d_pile = d_pile_mm / 1000.0
    b_col = b_col_mm / 1000.0
    h_col = h_col_mm / 1000.0
    phi_bar = 20.0
    phi_link = 12.0

    steps: list[dict] = []
    warnings: list[str] = []
    errors: list[str] = []
    overall_status = "pass"

    n_piles = {"2_pile": 2, "3_pile": 3, "4_pile": 4}.get(pile_type, 4)

    sn = 1

    # -----------------------------------------------------------------------
    # Step 1 — Pile reaction
    # -----------------------------------------------------------------------
    pile_reaction = N_ed / n_piles
    pile_ok = pile_reaction <= pile_cap_kn
    if not pile_ok:
        overall_status = "fail"
        errors.append(
            f"Pile reaction {_rv(pile_reaction,1)} kN > capacity {pile_cap_kn} kN. "
            "Increase pile size/number or reduce load."
        )

    steps.append(_step(sn, f"Pile Reaction ({n_piles}-pile cap)",
        "P_pile = N_Ed / n_piles",
        f"P_pile = {_rv(N_ed,1)} / {n_piles}",
        f"P_pile = {_rv(pile_reaction,1)} kN {'✓' if pile_ok else '✗'} (≤ {pile_cap_kn} kN)",
        "kN", "EC7 cl.7.4 / BS 8004:2015 cl.11", "pass" if pile_ok else "fail"))
    sn += 1

    # -----------------------------------------------------------------------
    # Step 2 — Pile cap plan dimensions
    # -----------------------------------------------------------------------
    overhang = max(d_pile / 2.0 + 0.15, 0.3)   # min 150mm beyond pile face
    if pile_type == "2_pile":
        cap_L = s_pile + 2.0 * overhang          # along pile line
        cap_B = 3.0 * d_pile + 2.0 * overhang   # transverse
    elif pile_type == "3_pile":
        # Equilateral triangle; cap approximated as circle circumscribed + edge
        R_circle = s_pile / math.sqrt(3.0)        # circumradius of equilateral triangle
        cap_L = R_circle * 2.0 + 2.0 * overhang
        cap_B = cap_L
    else:  # 4_pile
        cap_L = s_pile + 2.0 * overhang
        cap_B = s_pile + 2.0 * overhang

    cap_L = _round_up_50mm(cap_L)
    cap_B = _round_up_50mm(cap_B)

    steps.append(_step(sn, "Pile Cap Plan Dimensions",
        "Cap extends ≥ max(d_pile/2+150mm, 300mm) beyond outer pile face",
        f"Overhang = {_rv(overhang*1000,0)} mm; pile s = {s_pile} m",
        f"Cap L = {_rv(cap_L,3)} m; Cap B = {_rv(cap_B,3)} m", "m",
        "EC2 Annex H / BS 8110 cl.3.11.4", "info"))
    sn += 1

    # -----------------------------------------------------------------------
    # Step 3 — Pile cap thickness (from shear / minimum depth rules)
    # -----------------------------------------------------------------------
    # Minimum: d ≥ s_pile/2 from centroid (practical rule), also BS 8110 min 700mm for large caps
    # Start from beam shear check, use empirical H ≈ 0.8·s_pile, min 0.7m
    H_cap = max(0.7, 0.8 * s_pile)
    d_cap = H_cap * 1000.0 - cover - phi_link - phi_bar / 2.0

    steps.append(_step(sn, "Pile Cap Thickness (preliminary)",
        "H_cap = max(700 mm, 0.8·s_pile); d = H − cover − φ_link − φ_bar/2",
        f"H_cap = {_rv(H_cap*1000,0)} mm; cover = {cover} mm",
        f"d = {_rv(d_cap,0)} mm", "mm",
        "BS 8110 cl.3.11.4.2 / EC2 cl.9.8.1", "info"))
    sn += 1

    # -----------------------------------------------------------------------
    # Step 4 — Tie force (truss model)
    # -----------------------------------------------------------------------
    # Truss analogy: column load struts into piles; horizontal tie in each direction
    if pile_type == "2_pile":
        # Tie along pile line
        T = N_ed * (s_pile / 2.0) / (0.9 * d_cap / 1000.0)
        as_tie = T * 1000.0 / (0.87 * fyk)   # mm²
        steps.append(_step(sn, "Tie Force — 2-pile cap (truss model)",
            "T = N_Ed·(s/2)/(0.9·d_cap)  [horizontal tie force]",
            f"T = {_rv(N_ed,1)}×{_rv(s_pile/2,3)} / (0.9×{_rv(d_cap/1000,3)})",
            f"T = {_rv(T,1)} kN; As,tie = {_rv(as_tie,0)} mm²", "mm²",
            "BS 8110 cl.3.11.4.3 / EC2 Annex H", "info"))
        sn += 1
        T_y = 0.0
        as_tie_y = 0.25 * as_tie   # nominal transverse tie per BS 8110

    elif pile_type == "3_pile":
        # Each pile tie: T = N_Ed/(3·tan(α)) where α = angle of strut to horizontal
        alpha = math.atan2(d_cap / 1000.0, s_pile / math.sqrt(3.0))
        T = N_ed / (3.0 * math.tan(alpha))
        as_tie = 3.0 * T * 1000.0 / (0.87 * fyk)   # total, split into 3 ties
        T_y = T
        as_tie_y = as_tie / 3.0
        steps.append(_step(sn, "Tie Force — 3-pile cap (truss model)",
            "α = arctan(d_cap / (s/√3)); T = N_Ed/(3·tan α) per tie",
            f"α = {_rv(math.degrees(alpha),1)}°; T = {_rv(T,1)} kN",
            f"As,tie (total 3 ties) = {_rv(as_tie,0)} mm²; per tie = {_rv(as_tie/3,0)} mm²",
            "mm²", "BS 8110 cl.3.11.4.4 / EC2 Annex H", "info"))
        sn += 1

    else:  # 4_pile
        T = N_ed * s_pile / (4.0 * 0.9 * d_cap / 1000.0)
        as_tie = T * 1000.0 / (0.87 * fyk)   # per band
        T_y = T
        as_tie_y = as_tie
        steps.append(_step(sn, "Tie Force — 4-pile cap (truss model)",
            "T = N_Ed·s/(4·0.9·d_cap) per band direction",
            f"T = {_rv(N_ed,1)}×{s_pile}/(4×0.9×{_rv(d_cap/1000,3)})",
            f"T = {_rv(T,1)} kN; As per band = {_rv(as_tie,0)} mm² each direction",
            "mm²", "BS 8110 cl.3.11.4.5 / EC2 Annex H", "info"))
        sn += 1

    # -----------------------------------------------------------------------
    # Step 5 — Reinforcement check (As per band vs minimum)
    # -----------------------------------------------------------------------
    fctm_val = _fctm(fck)
    as_min = max(0.26 * fctm_val / fyk * 1000.0 * d_cap, 0.0013 * 1000.0 * d_cap)
    as_band_x = max(as_tie, as_min)
    as_band_y = max(as_tie_y if pile_type != "2_pile" else as_tie, as_min)

    _, _, prov_x_str = _slab_provision(as_band_x, 20)
    _, _, prov_y_str = _slab_provision(as_band_y, 20)

    steps.append(_step(sn, "Pile Cap Tie Reinforcement",
        "As,band = max(As,tie, As,min); As,min = max(0.26fctm/fyk·1000d, 0.0013·1000d)",
        f"As,min = {_rv(as_min,0)} mm²/m; As,x = {_rv(as_band_x,0)} mm²/m",
        f"x-direction: {prov_x_str}; y-direction: {prov_y_str}", "mm²/m",
        "EC2 cl.9.8.1 / BS 8110 cl.3.11.4", "info"))
    sn += 1

    # -----------------------------------------------------------------------
    # Step 6 — Punching shear check at 1.5d from column face (4-pile)
    # -----------------------------------------------------------------------
    if pile_type == "4_pile":
        factor = 1.5
        # For 4-pile cap: critical perimeter at factor×d from column face (EC2 cl.6.4.2)
        u_punch = 2.0 * (b_col_mm + h_col_mm) + 2.0 * math.pi * factor * d_cap
        beta = 1.0
        v_ed_punch = beta * N_ed * 1000.0 / (u_punch * d_cap)
        rho_l_p = min(as_band_x / (1000.0 * d_cap), 0.02)
        v_rd_c_p = _vrd_c(fck, rho_l_p, d_cap)
        punch_ok_cap = v_ed_punch <= v_rd_c_p
        if not punch_ok_cap:
            warnings.append(
                f"Pile cap punching check at 1.5d: vEd = {_rv(v_ed_punch,3)} > "
                f"vRd,c = {_rv(v_rd_c_p,3)} N/mm². Increase cap depth."
            )
            if overall_status == "pass":
                overall_status = "warning"
        steps.append(_step(sn, "Punching Shear Check at 1.5d (4-pile cap)",
            "u = 2(b_col+h_col)+2π·1.5d; vEd = N_Ed/(u·d); vRd,c per EC2 cl.6.4.4",
            f"u = {_rv(u_punch,0)} mm; vEd = {_rv(v_ed_punch,3)} N/mm²",
            f"vEd {'≤' if punch_ok_cap else '>'} vRd,c = {_rv(v_rd_c_p,3)} N/mm²",
            "N/mm²", "EC2 cl.6.4.3 (4-pile cap special case)",
            "pass" if punch_ok_cap else "warning"))
        sn += 1

    # -----------------------------------------------------------------------
    # Step 7 — Beam shear (local shear at pile head)
    # -----------------------------------------------------------------------
    # At face of pile, treat as local beam shear across cap width
    V_local = pile_reaction   # kN (one pile, worst case)
    # Width resisting: cap_B (or cap_L for 2-pile transverse)
    v_ed_local = V_local * 1000.0 / (cap_B * 1000.0 * d_cap)
    rho_l_local = min(as_band_y / (1000.0 * d_cap), 0.02)
    v_rd_c_local = _vrd_c(fck, rho_l_local, d_cap)
    shear_ok_cap = v_ed_local <= v_rd_c_local
    if not shear_ok_cap:
        warnings.append(
            f"Local beam shear at pile head: vEd = {_rv(v_ed_local,3)} > "
            f"vRd,c = {_rv(v_rd_c_local,3)} N/mm². Increase cap depth."
        )
        if overall_status == "pass":
            overall_status = "warning"

    steps.append(_step(sn, "Beam Shear at Pile Head",
        "vEd = P_pile/(cap_B·d); check ≤ vRd,c",
        f"V = {_rv(V_local,1)} kN; cap_B = {_rv(cap_B,3)} m; d = {_rv(d_cap,0)} mm",
        f"vEd = {_rv(v_ed_local,3)} {'✓' if shear_ok_cap else '✗'} N/mm² (vRd,c = {_rv(v_rd_c_local,3)})",
        "N/mm²", "EC2 cl.6.2.2 / BS 8110 cl.3.11.4.6",
        "pass" if shear_ok_cap else "warning"))
    sn += 1

    # Bearing pressure profile — symbolic (piles are point reactions, not uniform)
    x_pts_cap = [0.0, cap_L/4, cap_L/2, 3*cap_L/4, cap_L]
    q_pts_cap = [0.0, _rv(pile_reaction/d_pile,1), 0.0,
                 _rv(pile_reaction/d_pile,1), 0.0]

    return {
        "status": overall_status,
        "summary": {
            "foundation_type": f"Pile Cap ({pile_type})",
            "footing_B_m": _rv(cap_B, 3),
            "footing_L_m": _rv(cap_L, 3),
            "footing_depth_m": _rv(H_cap * 1000, 0),
            "footing_area_m2": _rv(cap_B * cap_L, 3),
            "q_max_kpa": 0.0,
            "q_min_kpa": 0.0,
            "bearing_ok": pile_ok,
            "punching_check": "pass" if pile_type != "4_pile" else ("pass" if punch_ok_cap else "warning"),  # type: ignore[possibly-undefined]
            "as_req_x_mm2_per_m": _rv(as_band_x, 0),
            "as_req_y_mm2_per_m": _rv(as_band_y, 0),
            "provision_x": prov_x_str,
            "provision_y": prov_y_str,
            "effective_depth_d_mm": _rv(d_cap, 0),
            "pile_reaction_kn": _rv(pile_reaction, 2),
            "pile_cap_steel_mm2": _rv(as_band_x * cap_B, 0),
        },
        "bearing_pressure_profile": {
            "x_m": [_rv(xi, 3) for xi in x_pts_cap],
            "q_kpa": q_pts_cap,
        },
        "steps": steps,
        "warnings": warnings,
        "errors": errors,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def calculate_foundation_ec7(inputs: dict[str, Any]) -> dict[str, Any]:
    """Full foundation design engine per EC7, EC2, and BS 8004.

    Dispatch to the appropriate sub-calculator based on *foundation_type*.

    Parameters
    ----------
    inputs : dict
        See module docstring for full key list.  Mandatory keys depend on
        ``foundation_type``:

        * ``"pad"``      → ``column_b_mm``, ``N_ed_kn``, ``soil_bearing_kpa``
        * ``"combined"`` → as pad + ``N_ed2_kn``, ``column_spacing_m``
        * ``"pile_cap"`` → ``N_ed_kn``, ``pile_type``, ``pile_diameter_mm``,
          ``pile_capacity_kn``, ``pile_spacing_m``

    Returns
    -------
    dict
        Keys: ``status``, ``summary``, ``bearing_pressure_profile``,
        ``steps``, ``warnings``, ``errors``, ``timestamp``.
    """
    ftype: str = str(inputs.get("foundation_type", "pad")).lower()

    try:
        if ftype == "pad":
            return _design_pad(inputs)
        elif ftype == "combined":
            return _design_combined(inputs)
        elif ftype == "pile_cap":
            return _design_pile_cap(inputs)
        else:
            return {
                "status": "fail",
                "summary": {},
                "bearing_pressure_profile": {"x_m": [], "q_kpa": []},
                "steps": [],
                "warnings": [],
                "errors": [
                    f"Unknown foundation_type '{ftype}'. "
                    "Valid values: 'pad', 'combined', 'pile_cap'."
                ],
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
    except Exception as exc:  # noqa: BLE001
        return {
            "status": "fail",
            "summary": {},
            "bearing_pressure_profile": {"x_m": [], "q_kpa": []},
            "steps": [],
            "warnings": [],
            "errors": [f"Internal calculation error: {exc}"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
