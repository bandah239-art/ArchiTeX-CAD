"""
Load Combinations Generator — EN 1990 (EC0), ACI 318-19, BS 8110.

Implements:
  - EC0 ULS Fundamental (Eq. 6.10, 6.10a, 6.10b)
  - EC0 SLS Characteristic, Frequent, Quasi-permanent
  - EC0 Accidental and Seismic combinations
  - ACI 318-19 strength combinations
  - BS 8110 ultimate load combinations
  - Simplified pattern loading for continuous beams/slabs
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
XI = 0.925  # reduction factor ξ used in Eq. 6.10b (EN 1990 Annex A1)
GAMMA_W = 9.81  # kN/m³


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _norm_standard(raw: str) -> str:
    """Normalise design standard string to one of 'EC0', 'ACI318', 'BS8110'."""
    s = (raw or "EC0").upper().replace(" ", "").replace("-", "")
    if s in ("EC0", "EC", "EUROCODE", "EN1990", "EN1990:2002"):
        return "EC0"
    if s in ("ACI318", "ACI"):
        return "ACI318"
    if s in ("BS8110", "BS"):
        return "BS8110"
    raise ValueError(
        f"Unsupported design standard '{raw}'. Use EC0, ACI318, or BS8110."
    )


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
        "result": round_value(result, 3),
        "unit": unit,
        "reference": reference,
    }


def _combo_entry(
    name: str,
    value: float,
    equation: str,
    combo_type: str,
    governing: bool = False,
) -> dict[str, Any]:
    return {
        "name": name,
        "value": round_value(value, 3),
        "equation": equation,
        "type": combo_type,
        "governing": governing,
    }


# ---------------------------------------------------------------------------
# EC0 Bearing Capacity Factor helpers (not needed here, but kept for analogy)
# ---------------------------------------------------------------------------

def _psi0_wind() -> float:
    """ψ0 for wind action per EN 1990 NA (UK/general): 0.5."""
    return 0.5


# ---------------------------------------------------------------------------
# EC0 combinations (EN 1990)
# ---------------------------------------------------------------------------

def _ec0_combinations(
    Gk: float,
    Qk1: float,
    Qk_others: list[dict],
    Wk: float,
    Ek: float,
    Ak: float,
    psi0_Q: float,
    psi1_Q: float,
    psi2_Q: float,
    gamma_G_sup: float,
    gamma_G_inf: float,
    gamma_Q: float,
    use_6_10ab: bool,
) -> tuple[list[dict], list[dict], list[str]]:
    """
    Build all EC0 combination dictionaries.

    Returns (combinations, steps, warnings).
    """
    combos: list[dict] = []
    steps: list[dict] = []
    warnings: list[str] = []

    # Surcharge from other variable actions (companion actions)
    sum_psi0_Qki = sum(act["value"] * act.get("psi0", psi0_Q) for act in Qk_others)
    sum_psi2_Qki = sum(act["value"] * act.get("psi2", psi2_Q) for act in Qk_others)

    # ------------------------------------------------------------------
    # ULS FUNDAMENTAL — Eq. 6.10
    # ------------------------------------------------------------------
    val_610 = (
        gamma_G_sup * Gk
        + gamma_Q * Qk1
        + gamma_Q * sum_psi0_Qki
    )
    subs_610 = (
        f"{gamma_G_sup}×{Gk} + {gamma_Q}×{Qk1}"
        + (f" + {gamma_Q}×{round(sum_psi0_Qki, 3)}" if Qk_others else "")
    )
    steps.append(
        _step(
            "ULS Fundamental (Eq. 6.10) — unfavourable permanent",
            "γG,sup×Gk + γQ×Qk1 + Σ(γQ×ψ0,i×Qki)",
            subs_610,
            val_610,
            "EN 1990 Eq. 6.10",
            "kN",
        )
    )
    combos.append(
        _combo_entry("ULS Eq.6.10", val_610, "γG,sup×Gk + γQ×Qk1 + Σ(γQ×ψ0,i×Qki)", "ULS")
    )

    # ------------------------------------------------------------------
    # ULS FUNDAMENTAL — Eq. 6.10a (when use_6_10ab requested)
    # ------------------------------------------------------------------
    val_610a = gamma_G_sup * Gk + gamma_Q * psi0_Q * Qk1
    subs_610a = f"{gamma_G_sup}×{Gk} + {gamma_Q}×{psi0_Q}×{Qk1}"
    steps.append(
        _step(
            "ULS Eq. 6.10a — reduced variable (check alongside 6.10b)",
            "γG,sup×Gk + γQ×ψ0,1×Qk1",
            subs_610a,
            val_610a,
            "EN 1990 Eq. 6.10a",
            "kN",
        )
    )
    combos.append(
        _combo_entry("ULS Eq.6.10a", val_610a, "γG,sup×Gk + γQ×ψ0,1×Qk1", "ULS")
    )

    # ------------------------------------------------------------------
    # ULS FUNDAMENTAL — Eq. 6.10b
    # ------------------------------------------------------------------
    val_610b = (
        XI * gamma_G_sup * Gk
        + gamma_Q * Qk1
        + gamma_Q * sum_psi0_Qki
    )
    subs_610b = (
        f"{XI}×{gamma_G_sup}×{Gk} + {gamma_Q}×{Qk1}"
        + (f" + {gamma_Q}×{round(sum_psi0_Qki, 3)}" if Qk_others else "")
    )
    steps.append(
        _step(
            "ULS Eq. 6.10b — reduced permanent load (ξ=0.925)",
            "ξ×γG,sup×Gk + γQ×Qk1 + Σ(γQ×ψ0,i×Qki)",
            subs_610b,
            val_610b,
            "EN 1990 Eq. 6.10b",
            "kN",
        )
    )
    combos.append(
        _combo_entry(
            "ULS Eq.6.10b",
            val_610b,
            "ξ×γG,sup×Gk + γQ×Qk1 + Σ(γQ×ψ0,i×Qki)",
            "ULS",
        )
    )

    # Governing ULS fundamental = max(6.10, 6.10a, 6.10b)
    uls_govern_val = max(val_610, val_610a, val_610b)
    uls_govern_name = {val_610: "ULS Eq.6.10", val_610a: "ULS Eq.6.10a", val_610b: "ULS Eq.6.10b"}[
        uls_govern_val
    ]
    steps.append(
        _step(
            "Governing ULS fundamental = max(Eq.6.10, 6.10a, 6.10b)",
            "max(6.10, 6.10a, 6.10b)",
            f"max({round(val_610,3)}, {round(val_610a,3)}, {round(val_610b,3)})",
            uls_govern_val,
            "EN 1990 §6.4.3.2",
            "kN",
        )
    )

    # ------------------------------------------------------------------
    # ULS with favourable permanent (upward / stabilising)
    # ------------------------------------------------------------------
    val_uls_fav = gamma_G_inf * Gk + gamma_Q * Qk1
    steps.append(
        _step(
            "ULS with favourable permanent (stabilising check)",
            "γG,inf×Gk + γQ×Qk1",
            f"{gamma_G_inf}×{Gk} + {gamma_Q}×{Qk1}",
            val_uls_fav,
            "EN 1990 Eq. 6.10 (favourable)",
            "kN",
        )
    )
    combos.append(
        _combo_entry(
            "ULS Favourable Gk",
            val_uls_fav,
            "γG,inf×Gk + γQ×Qk1",
            "ULS",
        )
    )

    # ------------------------------------------------------------------
    # ULS with Wind — live dominant
    # ------------------------------------------------------------------
    if Wk > 0:
        psi0_w = _psi0_wind()
        val_uls_wl = gamma_G_sup * Gk + gamma_Q * Qk1 + gamma_Q * psi0_w * Wk
        subs_uls_wl = f"{gamma_G_sup}×{Gk} + {gamma_Q}×{Qk1} + {gamma_Q}×{psi0_w}×{Wk}"
        steps.append(
            _step(
                "ULS with wind companion (live dominant)",
                "γG×Gk + γQ×Qk + γQ×ψ0,w×Wk",
                subs_uls_wl,
                val_uls_wl,
                "EN 1990 §6.4.3.2",
                "kN",
            )
        )
        combos.append(
            _combo_entry(
                "ULS Wind (live dominant)",
                val_uls_wl,
                "γG×Gk + γQ×Qk + γQ×ψ0,w×Wk",
                "ULS",
            )
        )

        val_uls_wd = gamma_G_sup * Gk + gamma_Q * Wk + gamma_Q * psi0_Q * Qk1
        subs_uls_wd = f"{gamma_G_sup}×{Gk} + {gamma_Q}×{Wk} + {gamma_Q}×{psi0_Q}×{Qk1}"
        steps.append(
            _step(
                "ULS with wind dominant (wind governing)",
                "γG×Gk + γQ×Wk + γQ×ψ0×Qk",
                subs_uls_wd,
                val_uls_wd,
                "EN 1990 §6.4.3.2",
                "kN",
            )
        )
        combos.append(
            _combo_entry(
                "ULS Wind (wind dominant)",
                val_uls_wd,
                "γG×Gk + γQ×Wk + γQ×ψ0×Qk",
                "ULS",
            )
        )

    # ------------------------------------------------------------------
    # SLS CHARACTERISTIC — Eq. 6.14b
    # ------------------------------------------------------------------
    val_sls_char = Gk + Qk1 + sum_psi0_Qki
    subs_sls_char = (
        f"{Gk} + {Qk1}"
        + (f" + {round(sum_psi0_Qki, 3)}" if Qk_others else "")
    )
    steps.append(
        _step(
            "SLS Characteristic combination (Eq. 6.14b)",
            "Gk + Qk1 + Σ(ψ0,i×Qki)",
            subs_sls_char,
            val_sls_char,
            "EN 1990 Eq. 6.14b",
            "kN",
        )
    )
    combos.append(
        _combo_entry("SLS Characteristic", val_sls_char, "Gk + Qk1 + Σ(ψ0,i×Qki)", "SLS")
    )

    # ------------------------------------------------------------------
    # SLS FREQUENT — Eq. 6.15b
    # ------------------------------------------------------------------
    val_sls_freq = Gk + psi1_Q * Qk1 + sum_psi2_Qki
    subs_sls_freq = (
        f"{Gk} + {psi1_Q}×{Qk1}"
        + (f" + {round(sum_psi2_Qki, 3)}" if Qk_others else "")
    )
    steps.append(
        _step(
            "SLS Frequent combination (Eq. 6.15b)",
            "Gk + ψ1,1×Qk1 + Σ(ψ2,i×Qki)",
            subs_sls_freq,
            val_sls_freq,
            "EN 1990 Eq. 6.15b",
            "kN",
        )
    )
    combos.append(
        _combo_entry(
            "SLS Frequent", val_sls_freq, "Gk + ψ1,1×Qk1 + Σ(ψ2,i×Qki)", "SLS"
        )
    )

    # ------------------------------------------------------------------
    # SLS QUASI-PERMANENT — Eq. 6.16b
    # ------------------------------------------------------------------
    val_sls_qp = Gk + psi2_Q * Qk1 + sum_psi2_Qki
    subs_sls_qp = (
        f"{Gk} + {psi2_Q}×{Qk1}"
        + (f" + {round(sum_psi2_Qki, 3)}" if Qk_others else "")
    )
    steps.append(
        _step(
            "SLS Quasi-permanent combination (Eq. 6.16b)",
            "Gk + Σ(ψ2,i×Qki)",
            subs_sls_qp,
            val_sls_qp,
            "EN 1990 Eq. 6.16b",
            "kN",
        )
    )
    combos.append(
        _combo_entry(
            "SLS Quasi-permanent",
            val_sls_qp,
            "Gk + Σ(ψ2,i×Qki)",
            "SLS",
        )
    )

    # ------------------------------------------------------------------
    # ACCIDENTAL — Eq. 6.11b
    # ------------------------------------------------------------------
    if Ak > 0:
        val_acc = Gk + Ak + psi1_Q * Qk1 + sum_psi2_Qki
        subs_acc = (
            f"{Gk} + {Ak} + {psi1_Q}×{Qk1}"
            + (f" + {round(sum_psi2_Qki, 3)}" if Qk_others else "")
        )
        steps.append(
            _step(
                "Accidental combination (Eq. 6.11b)",
                "Gk + Ad + ψ1,1×Qk1 + Σ(ψ2,i×Qki)",
                subs_acc,
                val_acc,
                "EN 1990 Eq. 6.11b",
                "kN",
            )
        )
        combos.append(
            _combo_entry(
                "Accidental (Ad)",
                val_acc,
                "Gk + Ad + ψ1,1×Qk1 + Σ(ψ2,i×Qki)",
                "accidental",
            )
        )
    else:
        warnings.append(
            "Accidental action Ak not provided — accidental combination (Eq. 6.11b) skipped."
        )

    # ------------------------------------------------------------------
    # SEISMIC — Eq. 6.12b
    # ------------------------------------------------------------------
    if Ek > 0:
        val_sei = Gk + Ek + sum_psi2_Qki
        subs_sei = (
            f"{Gk} + {Ek}"
            + (f" + {round(sum_psi2_Qki, 3)}" if Qk_others else "")
        )
        steps.append(
            _step(
                "Seismic combination (Eq. 6.12b)",
                "Gk + AEd + Σ(ψ2,i×Qki)",
                subs_sei,
                val_sei,
                "EN 1990 Eq. 6.12b",
                "kN",
            )
        )
        combos.append(
            _combo_entry(
                "Seismic (AEd)",
                val_sei,
                "Gk + AEd + Σ(ψ2,i×Qki)",
                "seismic",
            )
        )
    else:
        warnings.append(
            "Seismic action Ek not provided — seismic combination (Eq. 6.12b) skipped."
        )

    # Mark governing combination across all ULS entries
    uls_vals = [(c["value"], i) for i, c in enumerate(combos) if c["type"] == "ULS"]
    if uls_vals:
        _, gov_idx = max(uls_vals)
        combos[gov_idx]["governing"] = True

    return combos, steps, warnings


# ---------------------------------------------------------------------------
# ACI 318-19 combinations
# ---------------------------------------------------------------------------

def _aci318_combinations(
    Gk: float,
    Qk1: float,
    Wk: float,
    Ek: float,
) -> tuple[list[dict], list[dict], list[str]]:
    """Return ACI 318-19 strength load combinations."""
    D, L, W, E = Gk, Qk1, Wk, Ek
    combos: list[dict] = []
    steps: list[dict] = []
    warnings: list[str] = []

    defs = [
        ("ACI 1.4D",          1.4 * D,                       "1.4D",                          "§5.3.1a"),
        ("ACI 1.2D+1.6L",     1.2 * D + 1.6 * L,             "1.2D + 1.6L",                   "§5.3.1b"),
        ("ACI 1.2D+1.6L+W",   1.2 * D + 1.6 * L + 0.5 * W,  "1.2D + 1.6L + 0.5W",            "§5.3.1c"),
        ("ACI 1.2D+1.0W+L",   1.2 * D + 1.0 * W + L,         "1.2D + 1.0W + L",               "§5.3.1d"),
        ("ACI 0.9D+1.0W",     0.9 * D + 1.0 * W,             "0.9D + 1.0W",                   "§5.3.1e"),
        ("ACI 0.9D+1.0E",     0.9 * D + 1.0 * E,             "0.9D + 1.0E",                   "§5.3.1f"),
        ("ACI 1.2D+1.0E+L",   1.2 * D + 1.0 * E + L,         "1.2D + 1.0E + L",               "§5.3.1g"),
    ]

    for name, val, formula, ref in defs:
        subs = (
            formula.replace("D", f"({D})")
            .replace("L", f"({L})")
            .replace("W", f"({W})")
            .replace("E", f"({E})")
        )
        steps.append(_step(name, formula, subs, val, f"ACI 318-19 {ref}", "kN"))
        combos.append(_combo_entry(name, val, formula, "ULS"))

    if W == 0:
        warnings.append("Wind load Wk = 0; wind ACI combinations not meaningful.")
    if E == 0:
        warnings.append("Seismic load Ek = 0; seismic ACI combinations are zero.")

    uls_vals = [(c["value"], i) for i, c in enumerate(combos)]
    if uls_vals:
        _, gov_idx = max(uls_vals)
        combos[gov_idx]["governing"] = True

    return combos, steps, warnings


# ---------------------------------------------------------------------------
# BS 8110 combinations
# ---------------------------------------------------------------------------

def _bs8110_combinations(
    Gk: float,
    Qk1: float,
    Wk: float,
) -> tuple[list[dict], list[dict], list[str]]:
    """Return BS 8110 ultimate load combinations (Table 2.1)."""
    combos: list[dict] = []
    steps: list[dict] = []
    warnings: list[str] = []

    defs = [
        ("BS 1.4Gk+1.6Qk",        1.4 * Gk + 1.6 * Qk1,  "1.4Gk + 1.6Qk",        "BS 8110-1 Table 2.1"),
        ("BS 1.4Gk+1.4Wk",        1.4 * Gk + 1.4 * Wk,   "1.4Gk + 1.4Wk",        "BS 8110-1 Table 2.1"),
        ("BS 1.2Gk+1.2Qk+1.2Wk",  1.2 * (Gk + Qk1 + Wk), "1.2Gk + 1.2Qk + 1.2Wk","BS 8110-1 Table 2.1"),
        ("BS 1.0Gk+1.4Wk (roof)",  1.0 * Gk + 1.4 * Wk,  "1.0Gk + 1.4Wk",        "BS 8110-1 Table 2.1 (upward wind)"),
    ]

    for name, val, formula, ref in defs:
        subs = (
            formula.replace("Gk", f"({Gk})")
            .replace("Qk", f"({Qk1})")
            .replace("Wk", f"({Wk})")
        )
        steps.append(_step(name, formula, subs, val, ref, "kN"))
        combos.append(_combo_entry(name, val, formula, "ULS"))

    if Wk == 0:
        warnings.append("Wind load Wk = 0; wind BS 8110 combinations are equal to gravity-only case.")

    uls_vals = [(c["value"], i) for i, c in enumerate(combos)]
    if uls_vals:
        _, gov_idx = max(uls_vals)
        combos[gov_idx]["governing"] = True

    return combos, steps, warnings


# ---------------------------------------------------------------------------
# Pattern loading
# ---------------------------------------------------------------------------

def _pattern_loading(
    Gk: float,
    Qk1: float,
    gamma_G_sup: float,
    gamma_Q: float,
) -> list[dict]:
    """
    Simplified pattern loading for continuous beams/slabs (EC0 / EC1 pattern).

    Returns pattern dicts with factored UDL intensities and moment factors.
    Pattern moment factors are approximate and based on standard continuous-beam
    analysis:
      - max span moment ≈ wL²/8 (reference factor = 0.125)
      - max support moment ≈ wL²/10 (factor = 0.10)
    """
    wu_perm = gamma_G_sup * Gk
    wu_var = gamma_Q * Qk1
    wu_all = wu_perm + wu_var

    patterns = [
        {
            "pattern": "Pattern 1 — All spans loaded (maximum span/support moments)",
            "wu_all_spans_kn_m": round_value(wu_all, 3),
            "max_span_moment_factor": 0.125,
            "support_moment_factor": 0.100,
            "description": (
                f"wu = {gamma_G_sup}×Gk + {gamma_Q}×Qk = "
                f"{gamma_G_sup}×{Gk} + {gamma_Q}×{Qk1} = {round(wu_all, 3)} kN/m"
            ),
        },
        {
            "pattern": "Pattern 2 — Alternate spans loaded (maximum span moment in loaded spans)",
            "wu_loaded_spans_kn_m": round_value(wu_all, 3),
            "wu_unloaded_spans_kn_m": round_value(wu_perm, 3),
            "max_span_moment_factor": 0.100,
            "support_moment_factor": 0.080,
            "description": (
                f"Loaded: {round(wu_all, 3)} kN/m on odd spans; "
                f"Unloaded: {round(wu_perm, 3)} kN/m on even spans"
            ),
        },
        {
            "pattern": "Pattern 3 — Adjacent spans loaded (maximum support/reaction at first interior support)",
            "wu_first_two_spans_kn_m": round_value(wu_all, 3),
            "wu_remaining_spans_kn_m": round_value(wu_perm, 3),
            "max_span_moment_factor": 0.080,
            "support_moment_factor": 0.100,
            "description": (
                f"Loaded: {round(wu_all, 3)} kN/m on spans 1–2; "
                f"Unloaded: {round(wu_perm, 3)} kN/m elsewhere"
            ),
        },
    ]
    return patterns


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_load_combinations_ec0(inputs: dict) -> dict:
    """
    Generate design load combinations per EN 1990 (EC0), ACI 318-19, or BS 8110.

    Parameters
    ----------
    inputs : dict
        Gk              : float  — Characteristic permanent load
        Qk1             : float  — Leading variable action
        Qk_others       : list   — Other variable actions [{name, value, psi0, psi1, psi2}]
        Wk              : float  — Wind action (optional, default 0)
        Ek              : float  — Seismic action AEd (optional, default 0)
        Ak              : float  — Accidental action (optional, default 0)
        standard        : str    — "EC0" | "ACI318" | "BS8110"
        psi0_Q          : float  — ψ0 for leading variable action (default 0.7)
        psi1_Q          : float  — ψ1 frequent factor (default 0.5)
        psi2_Q          : float  — ψ2 quasi-permanent factor (default 0.3)
        gamma_G_sup     : float  — γG,sup partial factor (default 1.35)
        gamma_G_inf     : float  — γG,inf partial factor (default 1.0)
        gamma_Q         : float  — γQ partial factor (default 1.5)
        use_6_10ab      : bool   — Apply Eqs 6.10a and 6.10b (default True)

    Returns
    -------
    dict
        status, governing_combination, combinations, steps, pattern_loading,
        warnings, timestamp
    """
    # ------------------------------------------------------------------ inputs
    Gk          = float(inputs.get("Gk", 0.0))
    Qk1         = float(inputs.get("Qk1", 0.0))
    Qk_others   = list(inputs.get("Qk_others", []))
    Wk          = float(inputs.get("Wk", 0.0))
    Ek          = float(inputs.get("Ek", 0.0))
    Ak          = float(inputs.get("Ak", 0.0))
    standard    = _norm_standard(str(inputs.get("standard", "EC0")))
    psi0_Q      = float(inputs.get("psi0_Q", inputs.get("ψ0_Q", 0.7)))
    psi1_Q      = float(inputs.get("psi1_Q", inputs.get("ψ1_Q", 0.5)))
    psi2_Q      = float(inputs.get("psi2_Q", inputs.get("ψ2_Q", 0.3)))
    gamma_G_sup = float(inputs.get("gamma_G_sup", 1.35))
    gamma_G_inf = float(inputs.get("gamma_G_inf", 1.0))
    gamma_Q     = float(inputs.get("gamma_Q", 1.5))
    use_6_10ab  = bool(inputs.get("use_6_10ab", True))

    warnings: list[str] = []

    # ----------------------------------------------------------------- validate
    if Gk < 0:
        warnings.append("Gk is negative — treating as upward force (check sign convention).")
    if Qk1 < 0:
        warnings.append("Qk1 is negative — variable actions should be ≥ 0.")

    # -------------------------------------------------------- dispatch by code
    if standard == "EC0":
        combos, steps, code_warns = _ec0_combinations(
            Gk, Qk1, Qk_others, Wk, Ek, Ak,
            psi0_Q, psi1_Q, psi2_Q,
            gamma_G_sup, gamma_G_inf, gamma_Q,
            use_6_10ab,
        )
    elif standard == "ACI318":
        combos, steps, code_warns = _aci318_combinations(Gk, Qk1, Wk, Ek)
        warnings.append(
            "ACI 318-19 does not use ψ factors or SLS quasi-permanent concepts; "
            "EC0 SLS combinations skipped."
        )
    elif standard == "BS8110":
        combos, steps, code_warns = _bs8110_combinations(Gk, Qk1, Wk)
        warnings.append(
            "BS 8110 ULS partial factors applied. SLS check uses unfactored loads."
        )
    else:
        raise ValueError(f"Unknown standard: {standard}")

    warnings.extend(code_warns)

    # --------------------------------------------------------- governing combo
    governing: dict[str, Any] = {}
    if combos:
        gov_entries = [c for c in combos if c.get("governing")]
        if gov_entries:
            gc = gov_entries[0]
        else:
            gc = max(combos, key=lambda c: c["value"])
        governing = {
            "name": gc["name"],
            "value": gc["value"],
            "equation": gc["equation"],
            "type": gc["type"],
        }

    # ------------------------------------------------------- pattern loading
    pattern_loading = _pattern_loading(Gk, Qk1, gamma_G_sup, gamma_Q)

    # ------------------------------------------------------------------ status
    status = "info"
    if not combos:
        status = "warning"
        warnings.append("No combinations generated — check inputs.")

    return {
        "status": status,
        "standard": standard,
        "governing_combination": governing,
        "combinations": combos,
        "steps": steps,
        "pattern_loading": pattern_loading,
        "warnings": warnings,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
