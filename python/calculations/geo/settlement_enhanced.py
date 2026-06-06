"""
Enhanced Settlement Analysis
==============================
Covers:
- Immediate elastic settlement (Janbu-Bjerrum-Kjaernsli)
- Terzaghi 1D consolidation settlement (primary + secondary)
- Time-settlement curve: T50, T90, T99 milestones
- Secondary consolidation (Cα)
- Differential settlement check (Skempton & McDonald criterion)

Usage
-----
    from calculations.geo.settlement_enhanced import calculate_settlement_enhanced

    result = calculate_settlement_enhanced({
        "q_kpa": 120.0,          # net foundation pressure
        "B_m": 2.5,              # footing width
        "L_m": 3.0,              # footing length
        "Df_m": 1.2,             # foundation depth
        "Es_mpa": 15.0,          # Young's modulus of soil
        "poisson": 0.3,
        "H_m": 8.0,              # compressible layer thickness
        "Cc": 0.35,              # compression index
        "Cr": 0.06,              # recompression index
        "e0": 0.85,              # initial void ratio
        "sigma_v0_kpa": 80.0,   # initial effective vertical stress
        "sigma_vc_kpa": 90.0,   # pre-consolidation pressure
        "cv_m2yr": 1.2,          # coefficient of consolidation
        "Ca": 0.015,             # secondary compression index
        "t_ref_yr": 1.0,         # end of primary (reference time)
        "t_design_yr": 50.0,
        "drainage": "double",    # "single" or "double"
        "foundation_type": "isolated",   # "isolated" or "raft"
        "adjacent_settlements": [15, 22, 8],  # mm (for differential check)
        "column_spacing_m": 5.0,
    })
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

_STEP = list[dict[str, Any]]


def _step(ref: str, formula: str, subs: str, result: float, unit: str,
          status: str = "info", note: str = "") -> dict[str, Any]:
    return {
        "reference": ref, "formula": formula, "substitution": subs,
        "result": round(result, 4), "unit": unit, "status": status, "note": note,
    }


# ---------------------------------------------------------------------------
# 1. Elastic (Immediate) settlement — Janbu et al. 1956 / Bowles 1996
# ---------------------------------------------------------------------------

def _immediate_settlement(q: float, B: float, L: float, Es: float, nu: float,
                          Df: float, H: float, steps: _STEP) -> float:
    """Returns Si (mm)."""
    # Shape factor μ1 (Janbu 1956 — Table 2-6 Bowles)
    H_B = H / B
    L_B = L / B

    # μ₀ correction for depth of embedment
    mu0 = 1.0 - 0.4 * (Df / B) if (Df / B) < 0.5 else 0.8
    # μ₁ from chart / simplified expression (Bowles 1996 Table 5-9)
    mu1 = 0.446 + 0.026 * math.log(max(L_B, 1.0)) + 0.14 * math.log(max(H_B, 0.5))
    mu1 = max(0.1, min(2.0, mu1))

    # Influence factor Is for flexible rectangular footing (Steinbrenner 1934)
    F1 = (1.0 / math.pi) * (
        math.atan(L_B * 0.5) + L_B * 0.5 * math.log(
            (1.0 + math.sqrt(L_B ** 2 + 1.0)) / max(L_B, 0.001)
        )
    )
    Is = F1 * (1.0 - nu ** 2) * 2.0
    Is = max(0.5, min(2.0, Is))

    Si = mu0 * mu1 * q * B * (1.0 - nu ** 2) / (Es * 1000.0)   # m
    Si_mm = Si * 1000.0
    steps.append(_step(
        "Bowles (1996) Table 5-9", "Si = μ₀ · μ₁ · q · B · (1−ν²) / Es",
        f"μ₀={mu0:.3f}, μ₁={mu1:.3f}, q={q} kPa, B={B} m, Es={Es} MPa → Si={Si_mm:.1f} mm",
        Si_mm, "mm",
        note="Janbu-Bjerrum-Kjaernsli immediate elastic settlement",
    ))
    return Si_mm


# ---------------------------------------------------------------------------
# 2. Terzaghi 1D primary consolidation settlement
# ---------------------------------------------------------------------------

def _consolidation_settlement(H: float, Cc: float, Cr: float, e0: float,
                               sv0: float, svc: float, Dsv: float,
                               steps: _STEP) -> float:
    """Returns Sc (mm). Accounts for OCR (over-consolidated / normally consolidated)."""
    sv_final = sv0 + Dsv
    steps.append(_step(
        "Terzaghi (1943)", "Δσᵥ (stress increase at mid-layer)",
        f"σᵥ₀={sv0} kPa, Δσᵥ={Dsv:.2f} kPa → σᵥf={sv_final:.2f} kPa",
        Dsv, "kPa",
    ))

    if sv_final <= svc:
        # Over-consolidated: use Cr only
        Sc = (Cr / (1.0 + e0)) * H * 1000.0 * math.log10(sv_final / max(sv0, 0.001))
        steps.append(_step(
            "Terzaghi — OC layer", "Sc = Cr/(1+e₀) · H · log(σᵥf/σᵥ₀)",
            f"Cr={Cr}, e₀={e0}, H={H}m → Sc={Sc:.1f} mm",
            Sc, "mm", status="info", note="OC layer — only recompression index Cr applies",
        ))
    elif sv0 >= svc:
        # Normally consolidated throughout
        Sc = (Cc / (1.0 + e0)) * H * 1000.0 * math.log10(sv_final / max(sv0, 0.001))
        steps.append(_step(
            "Terzaghi — NC layer", "Sc = Cc/(1+e₀) · H · log(σᵥf/σᵥ₀)",
            f"Cc={Cc}, e₀={e0}, H={H}m → Sc={Sc:.1f} mm",
            Sc, "mm", status="info", note="NC layer — virgin compression applies",
        ))
    else:
        # Partial over-consolidation (σv0 < σvc < σvf)
        Sc1 = (Cr / (1.0 + e0)) * H * 1000.0 * math.log10(svc / max(sv0, 0.001))
        Sc2 = (Cc / (1.0 + e0)) * H * 1000.0 * math.log10(sv_final / max(svc, 0.001))
        Sc = Sc1 + Sc2
        steps.append(_step(
            "Terzaghi — partly OC", "Sc = Sc_OC + Sc_NC  (split at σ'pc)",
            f"Sc_OC={Sc1:.1f} + Sc_NC={Sc2:.1f} = {Sc:.1f} mm",
            Sc, "mm", status="info",
        ))
    return Sc


# ---------------------------------------------------------------------------
# 3. Time-settlement (Terzaghi 1D drainage)
# ---------------------------------------------------------------------------

def _Tv(U: float) -> float:
    """Time factor from degree of consolidation U (0–1)."""
    if U <= 0.6:
        return math.pi / 4.0 * U ** 2
    return -0.933 * math.log10(1.0 - U) - 0.085


def _time_settlement_curve(Sc_mm: float, cv: float, H_dr: float,
                            n_points: int = 20) -> tuple[list[float], list[float]]:
    """Returns (t_years, S_mm) lists for the time-settlement curve."""
    t_list = []
    S_list = []
    for i in range(1, n_points + 1):
        U = i / n_points
        Tv = _Tv(U)
        t = Tv * H_dr ** 2 / max(cv, 1e-6)   # years
        t_list.append(round(t, 3))
        S_list.append(round(U * Sc_mm, 2))
    return t_list, S_list


def _time_for_U(U: float, cv: float, H_dr: float) -> float:
    """Time (years) to reach degree of consolidation U."""
    Tv = _Tv(U)
    return Tv * H_dr ** 2 / max(cv, 1e-6)


# ---------------------------------------------------------------------------
# 4. Secondary consolidation
# ---------------------------------------------------------------------------

def _secondary_settlement(Ca: float, e0: float, H: float,
                           t_ref: float, t_design: float, steps: _STEP) -> float:
    """Ss = Cα·H·log(t2/t1)  (Mesri 1973)."""
    if t_design <= t_ref:
        return 0.0
    Ss = (Ca / (1.0 + e0)) * H * 1000.0 * math.log10(t_design / t_ref)
    steps.append(_step(
        "Mesri (1973)", "Ss = Cα/(1+e₀) · H · log(t₂/t₁)",
        f"Cα={Ca}, e₀={e0}, H={H}m, t₁={t_ref}yr, t₂={t_design}yr → Ss={Ss:.1f} mm",
        Ss, "mm",
    ))
    return Ss


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def calculate_settlement_enhanced(inputs: dict[str, Any]) -> dict[str, Any]:
    steps: _STEP = []
    warnings: list[str] = []
    errors: list[str] = []

    try:
        q = float(inputs["q_kpa"])
        B = float(inputs["B_m"])
        L = float(inputs.get("L_m", B))
        Df = float(inputs.get("Df_m", 1.0))
        Es = float(inputs.get("Es_mpa", 10.0))
        nu = float(inputs.get("poisson", 0.3))
        H = float(inputs["H_m"])
        Cc = float(inputs.get("Cc", 0.3))
        Cr = float(inputs.get("Cr", Cc / 5.0))
        e0 = float(inputs.get("e0", 0.8))
        sv0 = float(inputs.get("sigma_v0_kpa", q / 2.0))
        svc = float(inputs.get("sigma_vc_kpa", sv0 * 1.1))
        cv = float(inputs.get("cv_m2yr", 1.0))
        Ca = float(inputs.get("Ca", 0.005))
        t_ref = float(inputs.get("t_ref_yr", 1.0))
        t_design = float(inputs.get("t_design_yr", 25.0))
        drainage = inputs.get("drainage", "double")
        foundation_type = inputs.get("foundation_type", "isolated")
        adj_settlements = inputs.get("adjacent_settlements", [])
        col_spacing = float(inputs.get("column_spacing_m", 5.0))

        # Drainage path
        H_dr = H / 2.0 if drainage == "double" else H
        steps.append(_step(
            "Terzaghi (1943)", "Drainage path H_dr",
            f"drainage={drainage}, H={H}m → H_dr={H_dr}m",
            H_dr, "m",
        ))

        # Stress increase at mid-layer — Boussinesq simplified (2:1 spread)
        z_mid = H / 2.0 + Df
        factor_21 = (B * L) / ((B + z_mid) * (L + z_mid))
        Dsv = q * factor_21
        steps.append(_step(
            "2:1 stress distribution", "Δσᵥ = q·B·L / (B+z)(L+z)",
            f"z_mid={z_mid:.2f}m → Δσᵥ={Dsv:.2f} kPa",
            Dsv, "kPa",
        ))

        # 1. Immediate settlement
        Si = _immediate_settlement(q, B, L, Es, nu, Df, H, steps)

        # 2. Primary consolidation
        Sc = _consolidation_settlement(H, Cc, Cr, e0, sv0, svc, Dsv, steps)

        # 3. Secondary
        Ss = _secondary_settlement(Ca, e0, H, t_ref, t_design, steps)

        # 4. Total
        S_total = Si + Sc + Ss
        steps.append(_step(
            "Summary", "S_total = Si + Sc + Ss",
            f"{Si:.1f} + {Sc:.1f} + {Ss:.1f} = {S_total:.1f} mm",
            S_total, "mm",
        ))

        # Time milestones
        t50 = _time_for_U(0.50, cv, H_dr)
        t90 = _time_for_U(0.90, cv, H_dr)
        t99 = _time_for_U(0.99, cv, H_dr)
        steps.append(_step(
            "Terzaghi time factor", "t = Tv · H_dr² / cv",
            f"T₅₀={_Tv(0.5):.4f}, T₉₀={_Tv(0.9):.4f}",
            t90, "years  (to 90% consolidation)",
        ))

        # Time-settlement curve
        t_curve, S_curve = _time_settlement_curve(Sc, cv, H_dr, n_points=20)

        # Differential settlement check (Skempton & McDonald 1956)
        diff_status = "n/a"
        max_diff_mm = 0.0
        if adj_settlements:
            all_settlements = [S_total] + list(adj_settlements)
            diffs = []
            for i in range(len(all_settlements) - 1):
                diffs.append(abs(all_settlements[i] - all_settlements[i + 1]))
            max_diff_mm = max(diffs)
            # Angular distortion limit: 1/500 for sensitive structures, 1/300 general
            limit_mm = col_spacing * 1000.0 / 300.0
            diff_status = "pass" if max_diff_mm <= limit_mm else "fail"
            steps.append(_step(
                "Skempton & McDonald (1956)", "δ/L ≤ 1/300 (general structures)",
                f"max diff={max_diff_mm:.1f}mm, limit={limit_mm:.1f}mm",
                max_diff_mm, "mm",
                status=diff_status,
                note="Angular distortion criterion",
            ))

        # Acceptance check per foundation type
        limits = {"isolated": 25, "raft": 50, "bridge": 25, "default": 25}
        limit = limits.get(foundation_type, 25)
        total_status = "pass" if S_total <= limit else "warning" if S_total <= limit * 2 else "fail"
        if total_status != "pass":
            warnings.append(f"S_total={S_total:.1f}mm exceeds typical limit of {limit}mm for {foundation_type} foundations")

        return {
            "status": total_status,
            "summary": {
                "immediate_Si_mm": round(Si, 1),
                "primary_Sc_mm": round(Sc, 1),
                "secondary_Ss_mm": round(Ss, 1),
                "total_settlement_mm": round(S_total, 1),
                "allowable_mm": limit,
                "t50_years": round(t50, 2),
                "t90_years": round(t90, 2),
                "t99_years": round(t99, 2),
                "differential_mm": round(max_diff_mm, 1),
                "differential_status": diff_status,
                "drainage_path_m": H_dr,
                "stress_increase_kpa": round(Dsv, 2),
            },
            "time_settlement_curve": {
                "t_years": t_curve,
                "S_mm": S_curve,
                "milestones": {
                    "t50": round(t50, 3), "s50_mm": round(0.5 * Sc, 1),
                    "t90": round(t90, 3), "s90_mm": round(0.9 * Sc, 1),
                    "t99": round(t99, 3), "s99_mm": round(0.99 * Sc, 1),
                },
            },
            "steps": steps,
            "warnings": warnings,
            "errors": errors,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as exc:
        return {
            "status": "error", "summary": {}, "time_settlement_curve": {},
            "steps": steps, "warnings": warnings, "errors": [str(exc)],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
