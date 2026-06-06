"""
Enhanced Geotechnical Bearing Capacity Calculator.

Implements Terzaghi (1943), Meyerhof (1963), Hansen (1970), and Vesic (1973)
methods with full shape, depth, inclination, and water-table corrections.

References:
  - Terzaghi, K. (1943). Theoretical Soil Mechanics. Wiley.
  - Meyerhof, G.G. (1963). Some Recent Research on Bearing Capacity of Foundations.
    Canadian Geotechnical Journal, 1(1), 16–26.
  - Hansen, J.B. (1970). A Revised and Extended Formula for Bearing Capacity.
    Danish Geotechnical Institute Bulletin 28.
  - Vesic, A.S. (1973). Analysis of Ultimate Loads of Shallow Foundations.
    ASCE JSMFD, 99(1), 45–73.
  - Bowles, J.E. (1996). Foundation Analysis and Design, 5th ed. McGraw-Hill.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
GAMMA_W_KNM3 = 9.81   # unit weight of water (kN/m³)
PHI_MIN_DEG  = 0.001  # minimum phi to avoid division-by-zero (virtually cohesive)


# ---------------------------------------------------------------------------
# Internal step builder
# ---------------------------------------------------------------------------

def _step(
    description: str,
    formula: str,
    substitution: str,
    result: float,
    reference: str,
    unit: str = "",
) -> dict[str, Any]:
    return {
        "description": description,
        "formula": formula,
        "substitution": substitution,
        "result": round_value(result, 4),
        "unit": unit,
        "reference": reference,
    }


# ---------------------------------------------------------------------------
# Bearing capacity factors
# ---------------------------------------------------------------------------

def _bc_factors_standard(phi_deg: float) -> tuple[float, float, float]:
    """
    General bearing capacity factors Nq, Nc, Nγ (Meyerhof/Hansen/Vesic Nq, Nc form).

    Uses:
      Nq = e^(π·tanφ) · tan²(45 + φ/2)
      Nc = (Nq − 1) · cotφ   [or 5.14 for φ=0]
    Nγ is method-specific and returned as 0 here; callers set their own Nγ.
    """
    if phi_deg < 0.01:
        return 1.0, 5.14, 0.0
    phi_r = math.radians(phi_deg)
    Nq = math.exp(math.pi * math.tan(phi_r)) * math.tan(math.radians(45 + phi_deg / 2)) ** 2
    Nc = (Nq - 1.0) / math.tan(phi_r)
    return Nq, Nc, 0.0


def _bc_factors_terzaghi(phi_deg: float) -> tuple[float, float, float]:
    """
    Terzaghi (1943) bearing capacity factors.

    Nq = e^(π·tanφ) · tan²(45 + φ/2)
    Nc = (Nq − 1) / tanφ      [Nq - 1 / tan φ]
    Nγ ≈ 2·(Nq + 1)·tanφ      [Terzaghi 1943 approximation]
    """
    if phi_deg < 0.01:
        return 1.0, 5.7, 0.0
    phi_r = math.radians(phi_deg)
    Nq = math.exp(math.pi * math.tan(phi_r)) * math.tan(math.radians(45 + phi_deg / 2)) ** 2
    Nc = (Nq - 1.0) / math.tan(phi_r)
    Ngamma = 2.0 * (Nq + 1.0) * math.tan(phi_r)
    return Nq, Nc, Ngamma


def _bc_factors_meyerhof(phi_deg: float) -> tuple[float, float, float]:
    """
    Meyerhof (1963) bearing capacity factors.

    Nq = e^(π·tanφ) · tan²(45 + φ/2)
    Nc = (Nq − 1) · cotφ
    Nγ = (Nq − 1) · tan(1.4φ)
    """
    if phi_deg < 0.01:
        return 1.0, 5.14, 0.0
    phi_r = math.radians(phi_deg)
    Nq = math.exp(math.pi * math.tan(phi_r)) * math.tan(math.radians(45 + phi_deg / 2)) ** 2
    Nc = (Nq - 1.0) / math.tan(phi_r)
    Ngamma = (Nq - 1.0) * math.tan(math.radians(1.4 * phi_deg))
    return Nq, Nc, Ngamma


def _bc_factors_hansen(phi_deg: float) -> tuple[float, float, float]:
    """
    Hansen (1970) bearing capacity factors.

    Nq = e^(π·tanφ) · tan²(45 + φ/2)
    Nc = (Nq − 1) · cotφ
    Nγ = 1.5 · (Nq − 1) · tanφ
    """
    if phi_deg < 0.01:
        return 1.0, 5.14, 0.0
    phi_r = math.radians(phi_deg)
    Nq = math.exp(math.pi * math.tan(phi_r)) * math.tan(math.radians(45 + phi_deg / 2)) ** 2
    Nc = (Nq - 1.0) / math.tan(phi_r)
    Ngamma = 1.5 * (Nq - 1.0) * math.tan(phi_r)
    return Nq, Nc, Ngamma


def _bc_factors_vesic(phi_deg: float) -> tuple[float, float, float]:
    """
    Vesic (1973) bearing capacity factors.

    Nq = e^(π·tanφ) · tan²(45 + φ/2)
    Nc = (Nq − 1) · cotφ
    Nγ = 2 · (Nq + 1) · tanφ
    """
    if phi_deg < 0.01:
        return 1.0, 5.14, 0.0
    phi_r = math.radians(phi_deg)
    Nq = math.exp(math.pi * math.tan(phi_r)) * math.tan(math.radians(45 + phi_deg / 2)) ** 2
    Nc = (Nq - 1.0) / math.tan(phi_r)
    Ngamma = 2.0 * (Nq + 1.0) * math.tan(phi_r)
    return Nq, Nc, Ngamma


# ---------------------------------------------------------------------------
# Water table correction
# ---------------------------------------------------------------------------

def _water_table_correction(
    gamma: float,
    Df: float,
    B: float,
    dw: float,
) -> tuple[float, float, bool]:
    """
    Compute effective overburden pressure q and effective unit weight γ_eff.

    Cases (dw = depth to water table below ground surface):
      dw = 0         : WT at surface — use γ' throughout
      0 < dw ≤ Df   : partial correction to overburden pressure q
      Df < dw ≤ Df+B: linear interpolation of γ_eff below footing
      dw > Df + B   : no correction
    """
    gamma_sub = gamma - GAMMA_W_KNM3   # submerged unit weight
    gamma_sub = max(gamma_sub, 5.0)    # practical lower bound

    if dw <= 0.0:
        # WT at or above surface
        q = gamma_sub * Df
        gamma_eff = gamma_sub
        corrected = True
    elif dw <= Df:
        # WT between surface and foundation level
        q = gamma * dw + gamma_sub * (Df - dw)
        gamma_eff = gamma_sub
        corrected = True
    elif dw <= Df + B:
        # WT below foundation but within B
        q = gamma * Df
        ratio = (dw - Df) / B
        gamma_eff = gamma_sub + ratio * (gamma - gamma_sub)
        corrected = True
    else:
        # WT deep — no correction
        q = gamma * Df
        gamma_eff = gamma
        corrected = False

    return q, gamma_eff, corrected


# ---------------------------------------------------------------------------
# Effective area for eccentric loading
# ---------------------------------------------------------------------------

def _effective_dimensions(
    B: float, L: float, ex: float, ey: float
) -> tuple[float, float]:
    """Return Meyerhof effective dimensions B' = B−2ex, L' = L−2ey."""
    Beff = max(B - 2.0 * ex, 0.01)
    Leff = max(L - 2.0 * ey, 0.01)
    return Beff, Leff


# ---------------------------------------------------------------------------
# Shape factors
# ---------------------------------------------------------------------------

def _shape_factors_meyerhof(
    B: float, L: float, phi_deg: float, Nq: float, Nc: float
) -> tuple[float, float, float]:
    """Meyerhof shape factors (Fcs, Fqs, Fγs)."""
    phi_r = math.radians(phi_deg)
    kp = math.tan(math.radians(45 + phi_deg / 2)) ** 2
    if phi_deg <= 0.01:
        Fcs = 1.0 + 0.2 * (B / L)
        Fqs = 1.0
        Fgs = 1.0
    elif phi_deg >= 10:
        Fcs = 1.0 + 0.2 * (B / L) * kp
        Fqs = 1.0 + 0.1 * (B / L) * kp
        Fgs = 1.0 + 0.1 * (B / L) * kp
    else:
        Fcs = 1.0
        Fqs = 1.0
        Fgs = 1.0
    return Fcs, Fqs, Fgs


def _shape_factors_hansen(
    B: float, L: float, phi_deg: float, Nq: float, Nc: float
) -> tuple[float, float, float]:
    """Hansen (1970) shape factors."""
    phi_r = math.radians(phi_deg)
    sc = 1.0 + (B / L) * (Nq / Nc) if Nc > 0 else 1.0
    sq = 1.0 + (B / L) * math.sin(phi_r)
    sg = max(1.0 - 0.4 * (B / L), 0.6)
    return sc, sq, sg


def _shape_factors_vesic(
    B: float, L: float, phi_deg: float, Nq: float, Nc: float
) -> tuple[float, float, float]:
    """Vesic (1973) shape factors (same as Hansen)."""
    return _shape_factors_hansen(B, L, phi_deg, Nq, Nc)


def _shape_factors_terzaghi(
    footing_type: str,
) -> tuple[float, float, float]:
    """
    Terzaghi empirical shape factors (applied as multipliers to Nc and Nγ terms).
    Returns (sc, sq, sg) modifiers — already absorbed into qu formula variant.
    """
    # These are embedded in the formula selection, not separate factors
    return 1.0, 1.0, 1.0


# ---------------------------------------------------------------------------
# Depth factors
# ---------------------------------------------------------------------------

def _depth_factors_meyerhof(
    phi_deg: float, Df: float, B: float
) -> tuple[float, float, float]:
    """Meyerhof depth correction factors."""
    phi_r = math.radians(phi_deg)
    ratio = Df / B
    if ratio <= 1.0:
        Fcd = 1.0 + 0.4 * ratio
        Fqd = 1.0 + 2.0 * math.tan(phi_r) * (1.0 - math.sin(phi_r)) ** 2 * ratio
    else:
        Fcd = 1.0 + 0.4 * math.atan(ratio)
        Fqd = 1.0 + 2.0 * math.tan(phi_r) * (1.0 - math.sin(phi_r)) ** 2 * math.atan(ratio)
    Fgd = 1.0
    return Fcd, Fqd, Fgd


def _depth_factors_hansen(
    phi_deg: float, Df: float, B: float
) -> tuple[float, float, float]:
    """Hansen (1970) depth correction factors using arctan(Df/B)."""
    phi_r = math.radians(phi_deg)
    k = math.atan(Df / B) if B > 0 else 0.0
    dc = 1.0 + 0.4 * k
    dq = 1.0 + 2.0 * math.tan(phi_r) * (1.0 - math.sin(phi_r)) ** 2 * k
    dg = 1.0
    return dc, dq, dg


# ---------------------------------------------------------------------------
# Inclination factors
# ---------------------------------------------------------------------------

def _inclination_factors_meyerhof(
    alpha_deg: float, phi_deg: float
) -> tuple[float, float, float]:
    """Meyerhof inclination factors for load inclination angle α."""
    if alpha_deg <= 0 or phi_deg < 0.01:
        return 1.0, 1.0, 1.0
    alpha_r = math.radians(alpha_deg)
    phi_r   = math.radians(phi_deg)
    Fci = max((1.0 - alpha_deg / 90.0) ** 2, 0.0)
    Fqi = Fci
    Fgi = max((1.0 - alpha_deg / phi_deg) ** 2, 0.0)
    return Fci, Fqi, Fgi


def _inclination_factors_hansen(
    H: float, V: float, c: float, phi_deg: float, A_eff: float
) -> tuple[float, float, float]:
    """
    Hansen inclination factors using horizontal H and vertical V load.
    A_eff = effective foundation area (m²).
    """
    if H <= 0 or phi_deg < 0.01:
        return 1.0, 1.0, 1.0
    phi_r = math.radians(phi_deg)
    cot_phi = 1.0 / math.tan(phi_r) if phi_deg > 0.1 else 1e6
    denom = V + A_eff * c * cot_phi
    if denom <= 0:
        return 1.0, 1.0, 1.0
    iq = max((1.0 - 0.5 * H / denom) ** 5, 0.0)
    Nq, _, _ = _bc_factors_hansen(phi_deg)
    if Nq > 1.0:
        ig = max(iq - (1.0 - iq) / (Nq - 1.0), 0.0)
    else:
        ig = 0.0
    ic = iq - (1.0 - iq) / (Nq * math.tan(phi_r)) if phi_deg > 0.1 else 0.0
    return ic, iq, ig


# ---------------------------------------------------------------------------
# Individual method calculators
# ---------------------------------------------------------------------------

def _terzaghi(
    footing_type: str,
    B: float,
    c: float,
    phi_deg: float,
    q: float,
    gamma_eff: float,
    steps: list,
) -> float:
    """Terzaghi (1943) ultimate bearing capacity."""
    Nq, Nc, Ngamma = _bc_factors_terzaghi(phi_deg)
    steps.append(
        _step(
            "Terzaghi bearing capacity factors",
            "Nq = e^(π·tanφ)·tan²(45+φ/2); Nc = (Nq−1)/tanφ; Nγ = 2(Nq+1)tanφ",
            f"φ={phi_deg}° → Nq={round(Nq,3)}, Nc={round(Nc,3)}, Nγ={round(Ngamma,3)}",
            Nq, "Terzaghi 1943", "",
        )
    )

    if footing_type == "strip":
        qu = c * Nc + q * Nq + 0.5 * gamma_eff * B * Ngamma
        formula = "qu = c·Nc + q·Nq + 0.5·γ'·B·Nγ"
        subs = (
            f"{c}×{round(Nc,3)} + {round(q,3)}×{round(Nq,3)} "
            f"+ 0.5×{round(gamma_eff,3)}×{B}×{round(Ngamma,3)}"
        )
    elif footing_type == "square":
        qu = 1.3 * c * Nc + q * Nq + 0.4 * gamma_eff * B * Ngamma
        formula = "qu = 1.3·c·Nc + q·Nq + 0.4·γ'·B·Nγ"
        subs = (
            f"1.3×{c}×{round(Nc,3)} + {round(q,3)}×{round(Nq,3)} "
            f"+ 0.4×{round(gamma_eff,3)}×{B}×{round(Ngamma,3)}"
        )
    elif footing_type == "circular":
        qu = 1.3 * c * Nc + q * Nq + 0.3 * gamma_eff * B * Ngamma
        formula = "qu = 1.3·c·Nc + q·Nq + 0.3·γ'·B·Nγ"
        subs = (
            f"1.3×{c}×{round(Nc,3)} + {round(q,3)}×{round(Nq,3)} "
            f"+ 0.3×{round(gamma_eff,3)}×{B}×{round(Ngamma,3)}"
        )
    else:
        # rectangular treated as strip with Terzaghi
        qu = c * Nc + q * Nq + 0.5 * gamma_eff * B * Ngamma
        formula = "qu = c·Nc + q·Nq + 0.5·γ'·B·Nγ (rectangular→strip)"
        subs = (
            f"{c}×{round(Nc,3)} + {round(q,3)}×{round(Nq,3)} "
            f"+ 0.5×{round(gamma_eff,3)}×{B}×{round(Ngamma,3)}"
        )

    steps.append(
        _step(
            f"Terzaghi ultimate bearing capacity ({footing_type})",
            formula, subs, qu, "Terzaghi 1943", "kPa",
        )
    )
    return qu


def _meyerhof(
    footing_type: str,
    B: float,
    L: float,
    c: float,
    phi_deg: float,
    q: float,
    gamma_eff: float,
    Df: float,
    alpha_deg: float,
    steps: list,
) -> float:
    """Meyerhof (1963) ultimate bearing capacity with shape, depth, inclination."""
    Nq, Nc, Ngamma = _bc_factors_meyerhof(phi_deg)
    Fcs, Fqs, Fgs = _shape_factors_meyerhof(B, L, phi_deg, Nq, Nc)
    Fcd, Fqd, Fgd = _depth_factors_meyerhof(phi_deg, Df, B)
    Fci, Fqi, Fgi = _inclination_factors_meyerhof(alpha_deg, phi_deg)

    steps.append(
        _step(
            "Meyerhof BC factors",
            "Nq=e^(π·tanφ)·tan²(45+φ/2); Nc=(Nq−1)·cotφ; Nγ=(Nq−1)·tan(1.4φ)",
            f"φ={phi_deg}° → Nq={round(Nq,3)}, Nc={round(Nc,3)}, Nγ={round(Ngamma,3)}",
            Nq, "Meyerhof 1963", "",
        )
    )
    steps.append(
        _step(
            "Meyerhof shape factors",
            "Fcs=1+0.2(B/L)Kp; Fqs=Fγs=1+0.1(B/L)Kp (φ>10°)",
            f"Fcs={round(Fcs,3)}, Fqs={round(Fqs,3)}, Fγs={round(Fgs,3)}",
            Fcs, "Meyerhof 1963", "",
        )
    )
    steps.append(
        _step(
            "Meyerhof depth factors",
            "Fcd=1+0.4(Df/B); Fqd=1+2tanφ(1−sinφ)²(Df/B); Fγd=1",
            f"Fcd={round(Fcd,3)}, Fqd={round(Fqd,3)}, Fγd={round(Fgd,3)}",
            Fcd, "Meyerhof 1963", "",
        )
    )
    if alpha_deg > 0:
        steps.append(
            _step(
                "Meyerhof inclination factors",
                "Fci=Fqi=(1−α/90)²; Fγi=(1−α/φ)²",
                f"α={alpha_deg}° → Fci={round(Fci,3)}, Fqi={round(Fqi,3)}, Fγi={round(Fgi,3)}",
                Fci, "Meyerhof 1963", "",
            )
        )

    qu = (
        c  * Nc * Fcs * Fcd * Fci
        + q * Nq * Fqs * Fqd * Fqi
        + 0.5 * gamma_eff * B * Ngamma * Fgs * Fgd * Fgi
    )
    subs = (
        f"{c}×{round(Nc,3)}×{round(Fcs,3)}×{round(Fcd,3)}×{round(Fci,3)} "
        f"+ {round(q,3)}×{round(Nq,3)}×{round(Fqs,3)}×{round(Fqd,3)}×{round(Fqi,3)} "
        f"+ 0.5×{round(gamma_eff,3)}×{B}×{round(Ngamma,3)}×{round(Fgs,3)}×{round(Fgd,3)}×{round(Fgi,3)}"
    )
    steps.append(
        _step(
            "Meyerhof ultimate bearing capacity",
            "qu = c·Nc·Fcs·Fcd·Fci + q·Nq·Fqs·Fqd·Fqi + 0.5γ'BNγ·Fγs·Fγd·Fγi",
            subs, qu, "Meyerhof 1963", "kPa",
        )
    )
    return qu


def _hansen(
    footing_type: str,
    B: float,
    L: float,
    c: float,
    phi_deg: float,
    q: float,
    gamma_eff: float,
    Df: float,
    H: float,
    V: float,
    steps: list,
) -> float:
    """Hansen (1970) ultimate bearing capacity with shape, depth, inclination."""
    Nq, Nc, Ngamma = _bc_factors_hansen(phi_deg)
    sc, sq, sg = _shape_factors_hansen(B, L, phi_deg, Nq, Nc)
    dc, dq, dg = _depth_factors_hansen(phi_deg, Df, B)
    A_eff = B * L
    ic, iq, ig = _inclination_factors_hansen(H, V, c, phi_deg, A_eff)

    steps.append(
        _step(
            "Hansen BC factors",
            "Nq=e^(π·tanφ)·tan²(45+φ/2); Nc=(Nq−1)·cotφ; Nγ=1.5(Nq−1)·tanφ",
            f"φ={phi_deg}° → Nq={round(Nq,3)}, Nc={round(Nc,3)}, Nγ={round(Ngamma,3)}",
            Nq, "Hansen 1970", "",
        )
    )
    steps.append(
        _step(
            "Hansen shape factors",
            "sc=1+(B/L)(Nq/Nc); sq=1+(B/L)sinφ; sγ=1−0.4(B/L)",
            f"sc={round(sc,3)}, sq={round(sq,3)}, sγ={round(sg,3)}",
            sc, "Hansen 1970", "",
        )
    )
    steps.append(
        _step(
            "Hansen depth factors",
            "dc=1+0.4·arctan(Df/B); dq=1+2tanφ(1−sinφ)²arctan(Df/B); dγ=1",
            f"dc={round(dc,3)}, dq={round(dq,3)}, dγ={round(dg,3)}",
            dc, "Hansen 1970", "",
        )
    )
    if H > 0:
        steps.append(
            _step(
                "Hansen inclination factors",
                "iq=(1−0.5H/(V+Aeff·c·cotφ))^5; iγ from iq",
                f"H={H}, V={V} → ic={round(ic,3)}, iq={round(iq,3)}, iγ={round(ig,3)}",
                iq, "Hansen 1970", "",
            )
        )

    qu = (
        c  * Nc * sc * dc * ic
        + q * Nq * sq * dq * iq
        + 0.5 * gamma_eff * B * Ngamma * sg * dg * ig
    )
    subs = (
        f"{c}×{round(Nc,3)}×{round(sc,3)}×{round(dc,3)}×{round(ic,3)} "
        f"+ {round(q,3)}×{round(Nq,3)}×{round(sq,3)}×{round(dq,3)}×{round(iq,3)} "
        f"+ 0.5×{round(gamma_eff,3)}×{B}×{round(Ngamma,3)}×{round(sg,3)}×{round(dg,3)}×{round(ig,3)}"
    )
    steps.append(
        _step(
            "Hansen ultimate bearing capacity",
            "qu = c·Nc·sc·dc·ic + q·Nq·sq·dq·iq + 0.5γ'BNγ·sγ·dγ·iγ",
            subs, qu, "Hansen 1970", "kPa",
        )
    )
    return qu


def _vesic(
    footing_type: str,
    B: float,
    L: float,
    c: float,
    phi_deg: float,
    q: float,
    gamma_eff: float,
    Df: float,
    alpha_deg: float,
    steps: list,
) -> float:
    """Vesic (1973) — same factor structure as Hansen but Nγ = 2(Nq+1)tanφ."""
    Nq, Nc, Ngamma = _bc_factors_vesic(phi_deg)
    sc, sq, sg = _shape_factors_vesic(B, L, phi_deg, Nq, Nc)
    dc, dq, dg = _depth_factors_hansen(phi_deg, Df, B)   # same as Hansen
    Fci, Fqi, Fgi = _inclination_factors_meyerhof(alpha_deg, phi_deg)

    steps.append(
        _step(
            "Vesic BC factors",
            "Nq=e^(π·tanφ)·tan²(45+φ/2); Nc=(Nq−1)·cotφ; Nγ=2(Nq+1)tanφ",
            f"φ={phi_deg}° → Nq={round(Nq,3)}, Nc={round(Nc,3)}, Nγ={round(Ngamma,3)}",
            Nq, "Vesic 1973", "",
        )
    )

    qu = (
        c  * Nc * sc * dc * Fci
        + q * Nq * sq * dq * Fqi
        + 0.5 * gamma_eff * B * Ngamma * sg * dg * Fgi
    )
    subs = (
        f"{c}×{round(Nc,3)}×{round(sc,3)}×{round(dc,3)} "
        f"+ {round(q,3)}×{round(Nq,3)}×{round(sq,3)}×{round(dq,3)} "
        f"+ 0.5×{round(gamma_eff,3)}×{B}×{round(Ngamma,3)}×{round(sg,3)}×{round(dg,3)}"
    )
    steps.append(
        _step(
            "Vesic ultimate bearing capacity",
            "qu = c·Nc·sc·dc·ic + q·Nq·sq·dq·iq + 0.5γ'BNγ·sγ·dγ·iγ",
            subs, qu, "Vesic 1973", "kPa",
        )
    )
    return qu


# ---------------------------------------------------------------------------
# Layered soil check
# ---------------------------------------------------------------------------

def _layered_soil_warning(
    qu_layer1: float,
    c2: float,
    phi2_deg: float,
    q: float,
    gamma_eff: float,
    B: float,
    L: float,
    Df: float,
) -> list[str]:
    """
    Simplified check: compute Terzaghi strip qu for layer-2 properties.
    If qu_layer2 < qu_layer1, issue weak-layer warning.
    """
    warns: list[str] = []
    Nq2, Nc2, Ng2 = _bc_factors_terzaghi(phi2_deg)
    qu2 = c2 * Nc2 + q * Nq2 + 0.5 * gamma_eff * B * Ng2
    if qu2 < qu_layer1:
        warns.append(
            f"Weak layer below footing — layer-2 ultimate capacity "
            f"({round(qu2, 1)} kPa) < layer-1 capacity ({round(qu_layer1, 1)} kPa). "
            f"Bearing capacity may be governed by the weaker lower layer. "
            f"Consider punching shear analysis (Meyerhof & Hanna 1978)."
        )
    return warns


# ---------------------------------------------------------------------------
# Pressure profile (simple trapezoidal from eccentricity)
# ---------------------------------------------------------------------------

def _pressure_profile(
    B: float, V: float, ex: float, num_points: int = 11
) -> dict[str, list[float]]:
    """
    Trapezoidal pressure distribution under eccentric footing.

    q(x) = V/B × (1 ± 6e/B)  for strip footings.
    """
    q_avg = V / B if B > 0 else 0.0
    x_vals: list[float] = []
    p_vals: list[float] = []
    for i in range(num_points):
        x = -B / 2 + i * B / (num_points - 1)
        e_term = 6.0 * ex * x / (B ** 2) if B > 0 else 0.0
        p = q_avg * (1.0 + e_term)
        x_vals.append(round(x, 4))
        p_vals.append(round(max(p, 0.0), 3))
    return {"x_m": x_vals, "pressure_kpa": p_vals}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def calculate_bearing_capacity_enhanced(inputs: dict) -> dict:
    """
    Enhanced bearing capacity calculator supporting Terzaghi, Meyerhof, Hansen,
    Vesic, or all methods simultaneously.

    Parameters
    ----------
    inputs : dict
        method                  : str   — "terzaghi"|"meyerhof"|"hansen"|"vesic"|"all"
        footing_type            : str   — "strip"|"square"|"rectangular"|"circular"
        B_m                     : float — footing width (m)
        L_m                     : float — footing length (m), default = B (square)
        Df_m                    : float — foundation depth (m)
        cohesion_kpa            : float — c (kPa)
        friction_angle_deg      : float — φ (degrees)
        unit_weight_knm3        : float — γ (kN/m³)
        water_table_depth_m     : float — depth to WT below surface (m, default deep)
        factor_of_safety        : float — FoS (default 3.0)
        load_inclination_deg    : float — α inclination of resultant load (default 0)
        Hk                      : float — horizontal load (kN, default 0)
        Vk                      : float — vertical load (kN)
        ex                      : float — eccentricity in B direction (m, default 0)
        ey                      : float — eccentricity in L direction (m, default 0)
        layer_2_cohesion_kpa    : float — c for lower layer (optional)
        layer_2_friction_deg    : float — φ for lower layer (optional)

    Returns
    -------
    dict
        status, summary, all_methods, steps, pressure_profile, warnings,
        errors, timestamp
    """
    errors: list[str] = []
    warnings: list[str] = []
    steps: list[dict] = []

    # ----------------------------------------------------------------- inputs
    method        = str(inputs.get("method", "all")).lower()
    footing_type  = str(inputs.get("footing_type", "rectangular")).lower()
    B             = float(inputs.get("B_m", 1.5))
    L             = float(inputs.get("L_m", B))
    Df            = float(inputs.get("Df_m", 1.0))
    c             = float(inputs.get("cohesion_kpa", 0.0))
    phi_deg       = float(inputs.get("friction_angle_deg", 30.0))
    gamma         = float(inputs.get("unit_weight_knm3", 18.0))
    dw            = float(inputs.get("water_table_depth_m", Df + B + 1.0))
    FoS           = float(inputs.get("factor_of_safety", 3.0))
    alpha_deg     = float(inputs.get("load_inclination_deg", 0.0))
    H             = float(inputs.get("Hk", 0.0))
    V             = float(inputs.get("Vk", 0.0))
    ex            = float(inputs.get("ex", 0.0))
    ey            = float(inputs.get("ey", 0.0))
    c2            = inputs.get("layer_2_cohesion_kpa")
    phi2          = inputs.get("layer_2_friction_deg")

    # ---------------------------------------------------------------- validate
    if B <= 0:
        errors.append("Footing width B_m must be > 0.")
        return _error_response(errors)
    if L <= 0:
        errors.append("Footing length L_m must be > 0.")
        return _error_response(errors)
    if Df < 0:
        errors.append("Foundation depth Df_m cannot be negative.")
        return _error_response(errors)
    if phi_deg < 0 or phi_deg > 60:
        errors.append("Friction angle must be in range [0, 60] degrees.")
        return _error_response(errors)
    if c < 0:
        errors.append("Cohesion cannot be negative.")
        return _error_response(errors)
    if c == 0 and phi_deg < 0.5:
        warnings.append("Both c and φ are near zero — soil has negligible strength.")
    if 2 * ex >= B:
        errors.append("Eccentricity ex ≥ B/2: footing lifts off — increase B or reduce eccentricity.")
        return _error_response(errors)
    if 2 * ey >= L:
        errors.append("Eccentricity ey ≥ L/2: footing lifts off — increase L or reduce eccentricity.")
        return _error_response(errors)

    # -------------------------------------------------- effective dimensions
    Beff, Leff = _effective_dimensions(B, L, ex, ey)
    if ex > 0 or ey > 0:
        warnings.append(
            f"Eccentric loading detected (ex={ex}m, ey={ey}m). "
            f"Effective dimensions B'={round(Beff,3)}m, L'={round(Leff,3)}m used."
        )
        steps.append(
            _step(
                "Effective area for eccentric loading (Meyerhof)",
                "B' = B − 2ex;  L' = L − 2ey",
                f"B' = {B} − 2×{ex} = {round(Beff,3)} m; "
                f"L' = {L} − 2×{ey} = {round(Leff,3)} m",
                Beff, "Meyerhof effective area", "m",
            )
        )

    # -------------------------------------------------- water table
    q, gamma_eff, wt_corrected = _water_table_correction(gamma, Df, Beff, dw)
    steps.append(
        _step(
            "Overburden pressure q and effective unit weight γ'",
            "q = γ·Df (corrected for WT); γ_eff per WT position",
            f"dw={dw}m, Df={Df}m, B={Beff}m → q={round(q,3)} kPa, γ_eff={round(gamma_eff,3)} kN/m³",
            q, "Bowles 1996 §3-4", "kPa",
        )
    )
    if wt_corrected:
        warnings.append(
            f"Water table at {dw}m depth — effective unit weight and/or overburden corrected."
        )

    # -------------------------------------------------- applied pressure
    A_footing = Beff * Leff
    applied_kpa = V / A_footing if A_footing > 0 and V > 0 else 0.0
    if V > 0:
        steps.append(
            _step(
                "Applied foundation pressure",
                "p = Vk / (B'×L')",
                f"{V} / ({round(Beff,3)}×{round(Leff,3)}) = {round(applied_kpa,3)} kPa",
                applied_kpa, "Input", "kPa",
            )
        )

    # -------------------------------------------------- run methods
    results: dict[str, float] = {}
    method_steps: dict[str, list] = {}

    run_terzaghi = method in ("terzaghi", "all")
    run_meyerhof = method in ("meyerhof", "all")
    run_hansen   = method in ("hansen",   "all")
    run_vesic    = method in ("vesic",    "all")

    if run_terzaghi:
        s: list[dict] = []
        qu_t = _terzaghi(footing_type, Beff, c, phi_deg, q, gamma_eff, s)
        results["terzaghi_kpa"] = qu_t
        method_steps["terzaghi"] = s
        steps.extend(s)

    if run_meyerhof:
        s = []
        qu_m = _meyerhof(
            footing_type, Beff, Leff, c, phi_deg, q, gamma_eff, Df, alpha_deg, s
        )
        results["meyerhof_kpa"] = qu_m
        method_steps["meyerhof"] = s
        steps.extend(s)

    if run_hansen:
        s = []
        qu_h = _hansen(
            footing_type, Beff, Leff, c, phi_deg, q, gamma_eff, Df, H, V, s
        )
        results["hansen_kpa"] = qu_h
        method_steps["hansen"] = s
        steps.extend(s)

    if run_vesic:
        s = []
        qu_v = _vesic(
            footing_type, Beff, Leff, c, phi_deg, q, gamma_eff, Df, alpha_deg, s
        )
        results["vesic_kpa"] = qu_v
        method_steps["vesic"] = s
        steps.extend(s)

    if not results:
        errors.append(f"Unknown method '{method}'. Use terzaghi, meyerhof, hansen, vesic, or all.")
        return _error_response(errors)

    # -------------------------------------------------- governing method
    qu_govern = min(results.values())  # conservative: minimum of requested methods
    method_govern = min(results, key=results.get).replace("_kpa", "")

    # Slightly less conservative: for "all", use Hansen as primary (industry standard)
    if method == "all" and "hansen_kpa" in results:
        qu_govern = results["hansen_kpa"]
        method_govern = "hansen"

    qa = qu_govern / FoS
    net_qu = qu_govern - q
    net_qa = net_qu / FoS
    FoS_achieved = qu_govern / applied_kpa if applied_kpa > 0 else math.inf

    steps.append(
        _step(
            "Allowable bearing capacity (gross)",
            "qa = qu / FoS",
            f"{round(qu_govern,3)} / {FoS} = {round(qa,3)} kPa",
            qa, "Bowles 1996", "kPa",
        )
    )
    steps.append(
        _step(
            "Net ultimate bearing capacity",
            "qu_net = qu − q",
            f"{round(qu_govern,3)} − {round(q,3)} = {round(net_qu,3)} kPa",
            net_qu, "Bowles 1996", "kPa",
        )
    )

    # -------------------------------------------------- BC factors for summary
    if method_govern == "terzaghi":
        Nq_s, Nc_s, Ng_s = _bc_factors_terzaghi(phi_deg)
    elif method_govern == "meyerhof":
        Nq_s, Nc_s, Ng_s = _bc_factors_meyerhof(phi_deg)
    elif method_govern == "vesic":
        Nq_s, Nc_s, Ng_s = _bc_factors_vesic(phi_deg)
    else:
        Nq_s, Nc_s, Ng_s = _bc_factors_hansen(phi_deg)

    # -------------------------------------------------- status
    if applied_kpa > 0:
        if FoS_achieved >= FoS:
            status = "pass"
        elif FoS_achieved >= FoS * 0.9:
            status = "warning"
            warnings.append(
                f"Achieved FoS ({round(FoS_achieved,2)}) is within 10% of required ({FoS})."
            )
        else:
            status = "fail"
            warnings.append(
                f"Applied pressure ({round(applied_kpa,1)} kPa) exceeds allowable "
                f"({round(qa,1)} kPa). Increase footing dimensions or depth."
            )
    else:
        status = "pass"

    # -------------------------------------------------- layered soil
    if c2 is not None and phi2 is not None:
        layer_warns = _layered_soil_warning(
            qu_govern, float(c2), float(phi2), q, gamma_eff, Beff, Leff, Df
        )
        warnings.extend(layer_warns)
        if layer_warns:
            status = "warning"

    # -------------------------------------------------- pressure profile
    pressure_profile = _pressure_profile(B, max(V, applied_kpa * A_footing), ex)

    return {
        "status": status,
        "summary": {
            "method": method_govern,
            "ultimate_bearing_capacity_kpa": round_value(qu_govern, 2),
            "allowable_bearing_capacity_kpa": round_value(qa, 2),
            "applied_pressure_kpa": round_value(applied_kpa, 2),
            "factor_of_safety_achieved": round_value(FoS_achieved, 2) if math.isfinite(FoS_achieved) else None,
            "net_bearing_capacity_kpa": round_value(net_qu, 2),
            "net_allowable_kpa": round_value(net_qa, 2),
            "Nc": round_value(Nc_s, 3),
            "Nq": round_value(Nq_s, 3),
            "Ngamma": round_value(Ng_s, 3),
            "water_table_correction_applied": wt_corrected,
            "effective_B_m": round_value(Beff, 3),
            "effective_L_m": round_value(Leff, 3),
            "overburden_q_kpa": round_value(q, 3),
            "gamma_eff_knm3": round_value(gamma_eff, 3),
        },
        "all_methods": {
            k: round_value(v, 2) for k, v in results.items()
        },
        "steps": steps,
        "pressure_profile": pressure_profile,
        "warnings": warnings,
        "errors": errors,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _error_response(errors: list[str]) -> dict:
    """Return a minimal error dict."""
    return {
        "status": "fail",
        "summary": {},
        "all_methods": {},
        "steps": [],
        "pressure_profile": {"x_m": [], "pressure_kpa": []},
        "warnings": [],
        "errors": errors,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
