"""
ARCHITEX-CAD — EC2 Slab Design Engine
======================================
Implements calculate_slab_ec2(inputs) for one-way, two-way (Marcus method),
and flat slabs per EN 1992-1-1:2004 (Eurocode 2).

Supported checks:
  • Bending / As,req in x and y directions
  • Punching shear (EC2 cl.6.4) for flat slabs
  • Span/effective-depth deflection check (EC2 Table 7.4N)
  • Minimum reinforcement (EC2 cl.9.3.1)
  • Construction load check
  • Yield-line supplementary output (Johansen)
"""

from __future__ import annotations

import math
from typing import Any

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
ES_MPA: float = 200_000.0   # Modulus of elasticity of steel, MPa
GAMMA_S: float = 1.15        # Partial factor for steel
GAMMA_C: float = 1.5         # Partial factor for concrete
ETA: float = 1.0             # EC2 rectangular stress block η (fck ≤ 50 MPa)
LAMBDA_SB: float = 0.8       # EC2 rectangular stress block λ (fck ≤ 50 MPa)

# Marcus moment coefficients for simply-supported rectangular two-way slabs
# (equivalent to BS 8110 Table 3.14 positive field moments)
# Each row: (lx/ly,  αsx,   αsy)
MARCUS_TABLE: list[tuple[float, float, float]] = [
    (1.00, 0.044, 0.044),
    (1.10, 0.056, 0.037),
    (1.20, 0.062, 0.031),
    (1.30, 0.069, 0.027),
    (1.40, 0.075, 0.022),
    (1.50, 0.078, 0.020),
    (1.75, 0.091, 0.014),
    (2.00, 0.100, 0.012),
]


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _fctm(fck: float) -> float:
    """Mean tensile strength of concrete (EC2 Table 3.1)."""
    if fck <= 50:
        return 0.30 * fck ** (2.0 / 3.0)
    return 2.12 * math.log(1.0 + (fck + 8.0) / 10.0)


def _interpolate(table: list[tuple[float, float, float]], alpha: float) -> tuple[float, float]:
    """Linear interpolation of Marcus αsx, αsy for aspect ratio alpha = lx/ly."""
    alpha = min(max(alpha, table[0][0]), table[-1][0])
    for i in range(len(table) - 1):
        a0, sx0, sy0 = table[i]
        a1, sx1, sy1 = table[i + 1]
        if a0 <= alpha <= a1:
            t = (alpha - a0) / (a1 - a0)
            return sx0 + t * (sx1 - sx0), sy0 + t * (sy1 - sy0)
    return table[-1][1], table[-1][2]


def _k_factor(mu: float, fck: float, b_mm: float, d_mm: float) -> float:
    """EC2 moment redistribution factor K = M/(fcd·b·d²)."""
    fcd = 0.85 * fck / GAMMA_C
    return mu * 1e6 / (fcd * b_mm * d_mm ** 2)


def _as_req_ec2(
    mu_knm: float,
    fck_mpa: float,
    fyk_mpa: float,
    b_mm: float,
    d_mm: float,
    steps: list[dict],
    label: str,
) -> tuple[float, float, float]:
    """
    Compute required steel area per EC2 cl.6.1 rectangular stress block.

    Returns (As_req_mm2, z_mm, K)
    Appends a step dict to `steps`.
    """
    fcd = 0.85 * fck_mpa / GAMMA_C
    fyd = fyk_mpa / GAMMA_S

    K = _k_factor(mu_knm, fck_mpa, b_mm, d_mm)
    K_lim = 0.167  # EC2 singly-reinforced limit (ductility class B)

    if K <= 0.0:
        steps.append({
            "name": f"Flexural design ({label})",
            "clause": "EC2 cl.6.1",
            "detail": f"MEd = {mu_knm:.3f} kNm/m ≤ 0 — no tension steel required.",
            "result": "As,req = 0 mm²/m",
        })
        return 0.0, 0.95 * d_mm, 0.0

    if K > K_lim:
        # Compression reinforcement would be needed — flag but continue with K_lim
        steps.append({
            "name": f"Flexural design ({label}) — K > K_lim",
            "clause": "EC2 cl.6.1",
            "detail": (
                f"K = {K:.4f} > K_lim = {K_lim:.3f}. "
                "Compression reinforcement required or section should be deepened."
            ),
            "result": "WARNING: over-stressed section",
        })
        K = K_lim  # design with K_lim (conservative but provides a number)

    z = d_mm * (0.5 + math.sqrt(0.25 - K / 1.134))
    z = min(z, 0.95 * d_mm)

    As_req = (mu_knm * 1e6) / (fyd * z)   # mm²/m

    steps.append({
        "name": f"Flexural design ({label})",
        "clause": "EC2 cl.6.1",
        "detail": (
            f"MEd = {mu_knm:.3f} kNm/m, K = {K:.4f}, z = {z:.1f} mm, "
            f"fcd = {fcd:.2f} MPa, fyd = {fyd:.2f} MPa"
        ),
        "result": f"As,req = {As_req:.1f} mm²/m",
    })
    return As_req, z, K


def _as_min_ec2(fck_mpa: float, fyk_mpa: float, d_mm: float, b_mm: float = 1000.0) -> float:
    """EC2 cl.9.3.1 minimum reinforcement per 1 m width."""
    fctm_val = _fctm(fck_mpa)
    return max(0.26 * fctm_val * b_mm * d_mm / fyk_mpa, 0.0013 * b_mm * d_mm)


def _bar_spacing(As_req: float, phi_mm: float, b_mm: float = 1000.0) -> tuple[float, float]:
    """Return (spacing_mm, As_prov_mm2) for single bar diameter in strip of width b_mm."""
    area_bar = math.pi * phi_mm ** 2 / 4.0
    if As_req <= 0:
        return 250.0, 1000.0 / 250.0 * area_bar
    spacing = min(b_mm * area_bar / As_req, 250.0)
    spacing = max(spacing, 75.0)
    # round down to nearest 25 mm
    spacing = math.floor(spacing / 25.0) * 25.0
    spacing = max(spacing, 75.0)
    As_prov = b_mm / spacing * area_bar
    return spacing, As_prov


# ---------------------------------------------------------------------------
# Deflection check — EC2 Table 7.4N
# ---------------------------------------------------------------------------

def _deflection_check(
    lx_m: float,
    d_mm: float,
    As_req: float,
    As_prov: float,
    fck_mpa: float,
    support_type: str,
    steps: list[dict],
) -> dict:
    """
    EC2 Table 7.4N span/effective-depth check.

    support_type: 'simply_supported' | 'end_span' | 'interior_span' | 'cantilever'
    """
    K_map = {
        "simply_supported": 1.0,
        "end_span": 1.3,
        "interior_span": 1.5,
        "cantilever": 0.4,
    }
    K = K_map.get(support_type, 1.0)

    rho_0 = math.sqrt(fck_mpa) / 1000.0
    rho = As_req / (1000.0 * d_mm) if As_req > 0 else rho_0 / 2.0

    if rho <= rho_0:
        F1 = K * (11.0 + 1.5 * math.sqrt(fck_mpa) * rho_0 / rho
                  + 3.2 * math.sqrt(fck_mpa) * (rho_0 / rho - 1.0) ** 1.5)
    else:
        # Assume no compression steel (ρ' = 0)
        F1 = K * (11.0 + 1.5 * math.sqrt(fck_mpa) * rho_0 / rho)

    # Span length factor (EC2 cl.7.4.2 Note 5)
    span_factor = 7.0 / lx_m if lx_m > 7.0 else 1.0

    allowable_ld = F1 * span_factor
    actual_ld = (lx_m * 1000.0) / d_mm
    ok = actual_ld <= allowable_ld

    steps.append({
        "name": "Deflection check",
        "clause": "EC2 cl.7.4.2 / Table 7.4N",
        "detail": (
            f"ρ = {rho * 100:.4f}%, ρ₀ = {rho_0 * 100:.4f}%, K = {K}, "
            f"F1 = {F1:.1f}, span_factor = {span_factor:.3f}, "
            f"Allowable l/d = {allowable_ld:.1f}, Actual l/d = {actual_ld:.1f}"
        ),
        "result": f"{'PASS' if ok else 'FAIL'}: l/d = {actual_ld:.1f} / {allowable_ld:.1f}",
    })
    return {
        "actual_ld": round(actual_ld, 2),
        "allowable_ld": round(allowable_ld, 2),
        "pass": ok,
    }


# ---------------------------------------------------------------------------
# Punching shear — EC2 cl.6.4
# ---------------------------------------------------------------------------

def _punching_shear(
    vEd_kn: float,
    d_avg_mm: float,
    c1_mm: float,
    c2_mm: float,
    fck_mpa: float,
    rho_lx: float,
    rho_ly: float,
    column_type: str,
    steps: list[dict],
) -> dict:
    """
    EC2 cl.6.4 punching shear check for flat slabs.

    column_type: 'internal' | 'edge' | 'corner'
    """
    fcd = 0.85 * fck_mpa / GAMMA_C
    d = d_avg_mm

    # Eccentricity factor β
    beta_map = {"internal": 1.15, "edge": 1.40, "corner": 1.50}
    beta = beta_map.get(column_type, 1.15)

    # Basic control perimeter u1 at 2d from column face
    if column_type == "internal":
        u1 = 2.0 * (c1_mm + c2_mm) + 2.0 * math.pi * 2.0 * d
    elif column_type == "edge":
        u1 = c2_mm + 3.0 * d + 2.0 * c1_mm
    else:  # corner
        u1 = 3.0 * d + c1_mm + c2_mm

    # Column perimeter u0
    u0 = 2.0 * (c1_mm + c2_mm)

    # Design shear stress
    v_ed = beta * vEd_kn * 1000.0 / (u1 * d)  # MPa

    # Punching resistance vRd,c
    k = min(2.0, 1.0 + math.sqrt(200.0 / d))
    rho_l = min(math.sqrt(rho_lx * rho_ly), 0.02)
    C_Rdc = 0.18 / GAMMA_C
    v_min = 0.035 * k ** 1.5 * math.sqrt(fck_mpa)
    v_Rdc = max(C_Rdc * k * (100.0 * rho_l * fck_mpa) ** (1.0 / 3.0), v_min)

    # Maximum shear at column perimeter
    nu = 0.6 * (1.0 - fck_mpa / 250.0)
    v_Rdmax = 0.5 * nu * fcd

    punch_ok_max = (beta * vEd_kn * 1000.0 / (u0 * d)) <= v_Rdmax

    punching_reinf_required = v_ed > v_Rdc
    reinf_detail = ""
    if punching_reinf_required:
        # Minimum Asw per radial row (EC2 cl.6.4.3)
        # vRd,cs = 0.75·vRd,c + 1.5·(d/sr)·Asw·fywk·sin(α)/(u1·d)
        # Simplified: assume sr = 0.75d, α = 90°, fywk = 500 MPa
        sr = 0.75 * d
        fywk = min(500.0, 500.0)
        Asw_req = (v_ed - 0.75 * v_Rdc) * u1 * d / (1.5 * (d / sr) * fywk)
        Asw_min = 0.08 * math.sqrt(fck_mpa) * sr * u1 / (fywk * 1.5 * math.pi)
        reinf_detail = (
            f"Punching reinf. required: Asw,req = {Asw_req:.0f} mm²/perimeter, "
            f"Asw,min = {Asw_min:.0f} mm²/perimeter"
        )

    steps.append({
        "name": "Punching shear",
        "clause": "EC2 cl.6.4",
        "detail": (
            f"β = {beta}, u1 = {u1:.0f} mm, u0 = {u0:.0f} mm, d = {d:.1f} mm, "
            f"k = {k:.3f}, ρl = {rho_l * 100:.4f}%, "
            f"vEd = {v_ed:.4f} MPa, vRd,c = {v_Rdc:.4f} MPa, "
            f"vRd,max = {v_Rdmax:.4f} MPa. "
            + (reinf_detail if reinf_detail else "No punching reinf. required.")
        ),
        "result": (
            f"{'PASS' if not punching_reinf_required else 'REINF. REQD'}: "
            f"vEd/vRd,c = {v_ed / v_Rdc:.3f}; "
            f"Column perimeter {'PASS' if punch_ok_max else 'FAIL'}"
        ),
    })
    return {
        "v_ed_mpa": round(v_ed, 4),
        "v_Rdc_mpa": round(v_Rdc, 4),
        "v_Rdmax_mpa": round(v_Rdmax, 4),
        "beta": beta,
        "u1_mm": round(u1, 1),
        "punching_reinf_required": punching_reinf_required,
        "column_perimeter_ok": punch_ok_max,
        "pass": not punching_reinf_required and punch_ok_max,
        "detail": reinf_detail,
    }


# ---------------------------------------------------------------------------
# Main calculation entry point
# ---------------------------------------------------------------------------

def calculate_slab_ec2(inputs: dict) -> dict:  # noqa: C901
    """
    Full EC2 slab design engine.

    Parameters
    ----------
    inputs : dict
        See module docstring for full key list.

    Returns
    -------
    dict
        {status, summary, steps, warnings, errors, design_data}
    """
    steps: list[dict] = []
    warnings: list[str] = []
    errors: list[str] = []

    # ------------------------------------------------------------------
    # 0.  Parse & validate inputs
    # ------------------------------------------------------------------
    try:
        slab_type: str = inputs.get("slab_type", "two_way").lower()
        lx: float = float(inputs["lx_m"])
        ly: float = float(inputs.get("ly_m", lx))
        h_mm: float = float(inputs["h_mm"])
        c_nom: float = float(inputs.get("c_nom_mm", 25.0))
        fck: float = float(inputs["fck_mpa"])
        fyk: float = float(inputs.get("fyk_mpa", 500.0))
        gk: float = float(inputs.get("gk_kPa", 1.5))
        qk: float = float(inputs.get("qk_kPa", 3.0))
        gamma_sw: float = float(inputs.get("slab_density_kNm3", 25.0))
        support_cond: str = inputs.get("support_condition", "all_sides")

        # Flat slab / punching
        col_b: float = float(inputs.get("column_b_mm", 300.0))
        col_h: float = float(inputs.get("column_h_mm", 300.0))
        punch_vEd: float = float(inputs.get("punching_vEd_kN", 0.0))
        is_edge: bool = bool(inputs.get("is_edge_column", False))
        is_corner: bool = bool(inputs.get("is_corner_column", False))

        # Construction
        check_const: bool = bool(inputs.get("check_construction_load", True))
        const_load: float = float(inputs.get("construction_load_kPa", 1.5))

        # Bar diameters
        phi_x: float = float(inputs.get("phi_bar_x_mm", 12.0))
        phi_y: float = float(inputs.get("phi_bar_y_mm", 12.0))

    except (KeyError, TypeError, ValueError) as exc:
        return {
            "status": "error",
            "summary": {},
            "steps": steps,
            "warnings": warnings,
            "errors": [f"Input parsing error: {exc}"],
        }

    # Validation
    if ly < lx:
        warnings.append(
            f"ly ({ly} m) < lx ({lx} m). Swapping so lx is the short span."
        )
        lx, ly = ly, lx

    if h_mm < 60:
        warnings.append(f"Slab thickness h = {h_mm} mm may be too thin.")

    if fck < 20 or fck > 90:
        errors.append(f"fck = {fck} MPa outside EC2 range [20, 90] MPa.")

    # ------------------------------------------------------------------
    # 1.  Self weight and design loads
    # ------------------------------------------------------------------
    ws: float = gamma_sw * h_mm / 1000.0            # kPa
    wu: float = 1.35 * (gk + ws) + 1.5 * qk         # ULS design load kPa
    gk_total: float = gk + ws

    steps.append({
        "name": "Design loads",
        "clause": "EN 1990 Eq.6.10",
        "detail": (
            f"Self weight ws = {gamma_sw}×{h_mm}/1000 = {ws:.3f} kPa, "
            f"gk_total = {gk_total:.3f} kPa, "
            f"wu = 1.35×({gk:.3f}+{ws:.3f}) + 1.5×{qk:.3f} = {wu:.3f} kPa"
        ),
        "result": f"wu = {wu:.3f} kPa",
    })

    # ------------------------------------------------------------------
    # 2.  Effective depths
    # ------------------------------------------------------------------
    dx: float = h_mm - c_nom - phi_x / 2.0
    dy: float = h_mm - c_nom - phi_x - phi_y / 2.0

    steps.append({
        "name": "Effective depths",
        "clause": "EC2 cl.3.1 / cover",
        "detail": (
            f"dx = {h_mm} − {c_nom} − {phi_x}/2 = {dx:.1f} mm; "
            f"dy = {h_mm} − {c_nom} − {phi_x} − {phi_y}/2 = {dy:.1f} mm"
        ),
        "result": f"dx = {dx:.1f} mm, dy = {dy:.1f} mm",
    })

    # ------------------------------------------------------------------
    # 3 / 4 / 5.  Moment calculation based on slab type
    # ------------------------------------------------------------------
    ratio = ly / lx
    b = 1000.0  # design strip width mm

    Msx_knm: float = 0.0
    Msy_knm: float = 0.0
    Msx_sup_knm: float = 0.0  # hogging support moment x
    Msy_sup_knm: float = 0.0
    effective_slab_type: str = slab_type
    column_strip_ratio: float = 0.6

    if slab_type in ("one_way",) or ratio > 2.0:
        # ----- ONE-WAY SLAB -----------------------------------------------
        effective_slab_type = "one_way"
        # Continuous both ends (most common): M = wu·lx²/10 (EC2 approximate)
        # Use /8 simply supported or /10 for one continuous end or /12 for both
        support_factor = 8.0 if support_cond in ("two_short_edges",) else 10.0
        Msx_knm = wu * lx ** 2 / support_factor
        Msx_sup_knm = wu * lx ** 2 / 12.0  # hogging at support

        steps.append({
            "name": "One-way slab — span moments",
            "clause": "EC2 cl.5.4 (approximate elastic analysis)",
            "detail": (
                f"ly/lx = {ratio:.2f} > 2.0 → one-way action. "
                f"wu = {wu:.3f} kPa, lx = {lx} m. "
                f"Msx (span) = wu·lx²/{support_factor:.0f} = {Msx_knm:.3f} kNm/m. "
                f"Msx (support hogging) = wu·lx²/12 = {Msx_sup_knm:.3f} kNm/m."
            ),
            "result": f"Msx_span = {Msx_knm:.3f} kNm/m",
        })

    elif slab_type == "flat_slab":
        # ----- FLAT SLAB --------------------------------------------------
        effective_slab_type = "flat_slab"
        l_panel = (lx + ly) / 2.0
        M_total = wu * l_panel * lx ** 2 / 8.0  # per unit width
        Msx_knm = column_strip_ratio * M_total
        Msy_knm = (1.0 - column_strip_ratio) * M_total
        Msx_sup_knm = (2.0 / 3.0) * Msx_knm

        steps.append({
            "name": "Flat slab — moment distribution",
            "clause": "EC2 cl.5.4 / Annex I",
            "detail": (
                f"Total span moment M_total = {M_total:.3f} kNm/m. "
                f"Column strip (60%): Msx = {Msx_knm:.3f} kNm/m. "
                f"Middle strip (40%): Msy = {Msy_knm:.3f} kNm/m. "
                f"Hogging at support in column strip: {Msx_sup_knm:.3f} kNm/m."
            ),
            "result": (
                f"Msx (col.strip) = {Msx_knm:.3f} kNm/m, "
                f"Msy (mid.strip) = {Msy_knm:.3f} kNm/m"
            ),
        })

    else:
        # ----- TWO-WAY SLAB (Marcus) --------------------------------------
        effective_slab_type = "two_way"
        alpha_ratio = lx / ly  # ≤ 1.0 by definition (lx ≤ ly)
        alpha_sx, alpha_sy = _interpolate(MARCUS_TABLE, alpha_ratio)

        Msx_knm = alpha_sx * wu * lx ** 2
        Msy_knm = alpha_sy * wu * lx ** 2

        steps.append({
            "name": "Two-way slab — Marcus method",
            "clause": "EC2 cl.5.3.1 / Marcus coefficients",
            "detail": (
                f"lx = {lx} m, ly = {ly} m, α = lx/ly = {alpha_ratio:.3f}. "
                f"Interpolated: αsx = {alpha_sx:.4f}, αsy = {alpha_sy:.4f}. "
                f"Msx = {alpha_sx:.4f}×{wu:.3f}×{lx}² = {Msx_knm:.3f} kNm/m. "
                f"Msy = {alpha_sy:.4f}×{wu:.3f}×{lx}² = {Msy_knm:.3f} kNm/m."
            ),
            "result": (
                f"Msx = {Msx_knm:.3f} kNm/m, Msy = {Msy_knm:.3f} kNm/m"
            ),
        })

    # ------------------------------------------------------------------
    # Steel design x-direction
    # ------------------------------------------------------------------
    As_req_x, z_x, K_x = _as_req_ec2(Msx_knm, fck, fyk, b, dx, steps, "x-direction")
    As_min_x = _as_min_ec2(fck, fyk, dx, b)
    As_des_x = max(As_req_x, As_min_x)
    s_x, As_prov_x = _bar_spacing(As_des_x, phi_x, b)

    steps.append({
        "name": "Minimum reinforcement check (x)",
        "clause": "EC2 cl.9.3.1",
        "detail": (
            f"As,min = max(0.26×{_fctm(fck):.3f}×{dx:.1f}/{fyk:.0f}, "
            f"0.0013×{dx:.1f}) = {As_min_x:.1f} mm²/m. "
            f"As,req = {As_req_x:.1f} mm²/m → governing = {As_des_x:.1f} mm²/m."
        ),
        "result": f"Provide ∅{phi_x:.0f}@{s_x:.0f} mm → As,prov = {As_prov_x:.1f} mm²/m",
    })

    # ------------------------------------------------------------------
    # Steel design y-direction (two-way / flat slab only)
    # ------------------------------------------------------------------
    As_req_y: float = 0.0
    As_prov_y: float = 0.0
    s_y: float = 250.0
    z_y: float = 0.0

    if effective_slab_type in ("two_way", "flat_slab"):
        As_req_y, z_y, _ = _as_req_ec2(Msy_knm, fck, fyk, b, dy, steps, "y-direction")
        As_min_y = _as_min_ec2(fck, fyk, dy, b)
        As_des_y = max(As_req_y, As_min_y)
        s_y, As_prov_y = _bar_spacing(As_des_y, phi_y, b)

        steps.append({
            "name": "Minimum reinforcement check (y)",
            "clause": "EC2 cl.9.3.1",
            "detail": (
                f"As,min = {_as_min_ec2(fck, fyk, dy, b):.1f} mm²/m. "
                f"As,req = {As_req_y:.1f} mm²/m → governing = {As_des_y:.1f} mm²/m."
            ),
            "result": f"Provide ∅{phi_y:.0f}@{s_y:.0f} mm → As,prov = {As_prov_y:.1f} mm²/m",
        })

    # Secondary (transverse) steel for one-way slab — 20% of main steel
    if effective_slab_type == "one_way":
        As_req_y = 0.20 * As_req_x
        As_des_y = max(As_req_y, _as_min_ec2(fck, fyk, dy, b))
        s_y, As_prov_y = _bar_spacing(As_des_y, phi_y, b)
        steps.append({
            "name": "Transverse (secondary) reinforcement",
            "clause": "EC2 cl.9.3.1 (2)",
            "detail": (
                f"At least 20% of main steel: As = 0.20×{As_req_x:.1f} = {As_req_y:.1f} mm²/m. "
                f"Governing As = {As_des_y:.1f} mm²/m."
            ),
            "result": f"Provide ∅{phi_y:.0f}@{s_y:.0f} mm → As,prov = {As_prov_y:.1f} mm²/m",
        })

    # ------------------------------------------------------------------
    # 7.  Yield-line supplementary output (Johansen)
    # ------------------------------------------------------------------
    mp_yield = wu * lx ** 2 * ly ** 2 / (8.0 * (lx + ly) ** 2)
    steps.append({
        "name": "Yield-line analysis (supplementary)",
        "clause": "Johansen yield-line theory",
        "detail": (
            f"mp = wu·lx²·ly² / [8·(lx+ly)²] = "
            f"{wu:.3f}×{lx}²×{ly}² / [8×({lx}+{ly})²] = {mp_yield:.3f} kNm/m. "
            f"Elastic Msx = {Msx_knm:.3f} kNm/m. "
            f"Yield-line gives {(mp_yield / Msx_knm * 100):.1f}% of elastic value — "
            f"{'more economical' if mp_yield < Msx_knm else 'similar'}."
        ),
        "result": f"mp,yield = {mp_yield:.3f} kNm/m (supplementary, not used for design)",
    })

    # ------------------------------------------------------------------
    # 8.  Deflection check
    # ------------------------------------------------------------------
    support_type_defl = (
        "simply_supported" if support_cond in ("two_short_edges",)
        else ("end_span" if effective_slab_type == "flat_slab" else "interior_span")
    )
    defl_result = _deflection_check(lx, dx, As_req_x, As_prov_x, fck, support_type_defl, steps)

    # ------------------------------------------------------------------
    # 9.  Construction load check
    # ------------------------------------------------------------------
    const_result: dict = {}
    if check_const:
        w_const = 1.35 * ws + 1.5 * const_load
        Mu_const = w_const * lx ** 2 / 8.0
        _, _, K_const = _as_req_ec2(Mu_const, fck, fyk, b, dx, [], f"construction phase")
        fcd = 0.85 * fck / GAMMA_C
        MRd_prov = (As_prov_x * fyk / GAMMA_S * z_x) / 1e6

        const_ok = MRd_prov >= Mu_const
        const_result = {
            "w_const_kPa": round(w_const, 3),
            "Mu_const_kNm": round(Mu_const, 3),
            "MRd_prov_kNm": round(MRd_prov, 3),
            "pass": const_ok,
        }
        steps.append({
            "name": "Construction load check",
            "clause": "EN 1991-1-6 / EC2",
            "detail": (
                f"w_const = 1.35×{ws:.3f} + 1.5×{const_load} = {w_const:.3f} kPa. "
                f"Mu_const = {Mu_const:.3f} kNm/m. "
                f"MRd (provided reinf.) = {MRd_prov:.3f} kNm/m."
            ),
            "result": f"{'PASS' if const_ok else 'FAIL'}: Mu_const / MRd = {Mu_const / MRd_prov:.3f}",
        })
        if not const_ok:
            warnings.append(
                f"Construction load governs: Mu_const = {Mu_const:.2f} kNm/m > "
                f"MRd = {MRd_prov:.2f} kNm/m. Consider temporary propping."
            )

    # ------------------------------------------------------------------
    # 6.  Punching shear (flat slab only)
    # ------------------------------------------------------------------
    punch_result: dict = {}
    if effective_slab_type == "flat_slab" and punch_vEd > 0.0:
        d_avg = (dx + dy) / 2.0
        rho_lx = As_prov_x / (1000.0 * dx)
        rho_ly = As_prov_y / (1000.0 * dy)
        col_type = "corner" if is_corner else ("edge" if is_edge else "internal")
        punch_result = _punching_shear(
            punch_vEd, d_avg, col_b, col_h, fck, rho_lx, rho_ly, col_type, steps
        )
        if not punch_result.get("pass"):
            warnings.append("Punching shear check failed. Provide punching reinforcement.")

    # ------------------------------------------------------------------
    # Warnings
    # ------------------------------------------------------------------
    if K_x > 0.167:
        warnings.append(
            f"K_x = {K_x:.4f} > 0.167 in x-direction — section is over-stressed. "
            "Consider increasing slab depth."
        )
    if defl_result and not defl_result["pass"]:
        warnings.append(
            f"Deflection check FAILS: actual l/d = {defl_result['actual_ld']:.1f} > "
            f"allowable l/d = {defl_result['allowable_ld']:.1f}."
        )

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------
    status = "error" if errors else ("warning" if warnings else "ok")

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    summary: dict[str, Any] = {
        "slab_type": effective_slab_type,
        "wu_kPa": round(wu, 3),
        "Msx_kNm_per_m": round(Msx_knm, 3),
        "Msy_kNm_per_m": round(Msy_knm, 3),
        "dx_mm": round(dx, 1),
        "dy_mm": round(dy, 1),
        "As_req_x_mm2_per_m": round(As_req_x, 1),
        "As_prov_x_mm2_per_m": round(As_prov_x, 1),
        "x_reinforcement": f"∅{phi_x:.0f}@{s_x:.0f}",
        "As_req_y_mm2_per_m": round(As_req_y, 1),
        "As_prov_y_mm2_per_m": round(As_prov_y, 1),
        "y_reinforcement": f"∅{phi_y:.0f}@{s_y:.0f}",
        "deflection": defl_result,
        "punching": punch_result or None,
        "construction_check": const_result or None,
        "yield_line_mp_kNm": round(mp_yield, 3),
    }

    return {
        "status": status,
        "summary": summary,
        "steps": steps,
        "warnings": warnings,
        "errors": errors,
    }
