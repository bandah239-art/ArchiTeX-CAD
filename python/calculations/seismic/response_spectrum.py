"""
EC8 Elastic Response Spectrum — EN 1998-1:2004 Section 3.2.2 (Type 1).

Computes:
  - Se(T) horizontal elastic spectrum for ground types A–E
  - Sve(T) vertical elastic spectrum
  - Design spectrum Sd(T) for q-factor reduced forces
  - SRSS/CQC modal combination with effective modal masses
  - Modal base shears and combined design base shear
"""

from __future__ import annotations

import math
from typing import Any

# EC8 Type 1 ground type parameters  {ground_type: (S, TB, TC, TD)}
_EC8_TYPE1: dict[str, tuple[float, float, float, float]] = {
    "A": (1.00, 0.15, 0.40, 2.00),
    "B": (1.20, 0.15, 0.50, 2.00),
    "C": (1.15, 0.20, 0.60, 2.00),
    "D": (1.35, 0.20, 0.80, 2.00),
    "E": (1.40, 0.15, 0.50, 2.00),
}

# EC8 Type 2 (lower-seismicity regions)
_EC8_TYPE2: dict[str, tuple[float, float, float, float]] = {
    "A": (1.00, 0.05, 0.25, 1.20),
    "B": (1.35, 0.05, 0.25, 1.20),
    "C": (1.50, 0.10, 0.25, 1.20),
    "D": (1.80, 0.10, 0.30, 1.20),
    "E": (1.60, 0.05, 0.25, 1.20),
}

# Importance factors γI per importance class (EC8 Table 4.3)
IMPORTANCE_FACTORS = {"I": 0.8, "II": 1.0, "III": 1.2, "IV": 1.4}


def _eta(xi_pct: float) -> float:
    """Damping correction factor η (EC8 Eq. 3.6)."""
    return max(math.sqrt(10.0 / (5.0 + xi_pct)), 0.55)


def elastic_spectrum(
    T: float,
    ag: float,
    ground_type: str = "B",
    xi_pct: float = 5.0,
    spectrum_type: int = 1,
) -> float:
    """
    Horizontal elastic response spectrum Se(T) in m/s².

    T         : period (s)
    ag        : peak ground acceleration (m/s²) after applying γI
    ground_type: A, B, C, D, or E
    xi_pct    : viscous damping ratio (%)
    spectrum_type: 1 (high seismicity) or 2 (low seismicity)
    """
    params = (_EC8_TYPE1 if spectrum_type == 1 else _EC8_TYPE2).get(
        ground_type.upper(), _EC8_TYPE1["B"]
    )
    S, TB, TC, TD = params
    eta = _eta(xi_pct)

    if T <= 0.0:
        return ag * S
    elif T <= TB:
        return ag * S * (1.0 + (T / TB) * (eta * 2.5 - 1.0))
    elif T <= TC:
        return ag * S * eta * 2.5
    elif T <= TD:
        return ag * S * eta * 2.5 * (TC / T)
    else:
        return ag * S * eta * 2.5 * (TC * TD / T**2)


def vertical_spectrum(T: float, ag: float, xi_pct: float = 5.0) -> float:
    """Vertical elastic spectrum Sve(T) — EC8 Table 3.4 (Type 1)."""
    avg = 0.9 * ag
    TB, TC, TD = 0.05, 0.15, 1.0
    eta = _eta(xi_pct)
    if T <= 0.0:
        return avg
    elif T <= TB:
        return avg * (1.0 + (T / TB) * (eta * 3.0 - 1.0))
    elif T <= TC:
        return avg * eta * 3.0
    elif T <= TD:
        return avg * eta * 3.0 * (TC / T)
    else:
        return avg * eta * 3.0 * (TC * TD / T**2)


def design_spectrum(
    T: float,
    ag: float,
    q: float = 1.5,
    ground_type: str = "B",
    xi_pct: float = 5.0,
    spectrum_type: int = 1,
) -> float:
    """
    Design spectrum Sd(T) (EC8 §3.2.2.5) — behaviour-factor reduced.

    q : behaviour factor (1.5 = low ductility, 3.9 = DCM RC frame, etc.)
    """
    params = (_EC8_TYPE1 if spectrum_type == 1 else _EC8_TYPE2).get(
        ground_type.upper(), _EC8_TYPE1["B"]
    )
    S, TB, TC, TD = params
    beta = 0.2  # lower bound factor (EC8 §3.2.2.5)

    if T <= 0.0:
        return ag * S
    elif T <= TB:
        return ag * S * (2.0 / 3.0 + (T / TB) * (2.5 / q - 2.0 / 3.0))
    elif T <= TC:
        return max(ag * S * 2.5 / q, beta * ag)
    elif T <= TD:
        return max(ag * S * 2.5 / q * (TC / T), beta * ag)
    else:
        return max(ag * S * 2.5 / q * (TC * TD / T**2), beta * ag)


def _cqc_correlation(omega_i: float, omega_j: float, xi: float = 0.05) -> float:
    """CQC cross-correlation coefficient ρij (Complete Quadratic Combination)."""
    r = omega_j / omega_i  # r = ω_j / ω_i ≥ 1 assumed
    numerator = 8.0 * (xi**2) * (1.0 + r) * (r**1.5)
    denominator = (1.0 - r**2)**2 + 4.0 * (xi**2) * r * (1.0 + r)**2
    return numerator / max(denominator, 1e-20)


def compute_spectrum_curve(
    ag: float,
    ground_type: str = "B",
    xi_pct: float = 5.0,
    q: float = 1.5,
    spectrum_type: int = 1,
    n_pts: int = 200,
) -> dict[str, list[float]]:
    """Return Se and Sd arrays for plotting."""
    T_max = 4.0
    periods = [i * T_max / (n_pts - 1) for i in range(n_pts)]
    Se = [elastic_spectrum(t, ag, ground_type, xi_pct, spectrum_type) for t in periods]
    Sd = [design_spectrum(t, ag, q, ground_type, xi_pct, spectrum_type) for t in periods]
    Sve = [vertical_spectrum(t, ag, xi_pct) for t in periods]
    return {"periods": periods, "Se": Se, "Sd": Sd, "Sve": Sve}


def modal_seismic_response(
    modes: list[dict],
    ag: float,
    ground_type: str = "B",
    xi_pct: float = 5.0,
    q: float = 1.5,
    importance_class: str = "II",
    spectrum_type: int = 1,
    combination: str = "SRSS",
    total_mass_kg: float | None = None,
) -> dict[str, Any]:
    """
    Compute EC8 design seismic forces using modal response spectrum method.

    modes : list of mode dicts from run_modal_analysis:
            {mode, freq_hz, period_s, effective_mass_x_kg, participation_x, ...}
    ag    : reference peak ground acceleration (m/s², before importance factor)
    combination: 'SRSS' or 'CQC'

    Returns per-mode spectral values + combined base shear.
    """
    gamma_I = IMPORTANCE_FACTORS.get(importance_class.upper(), 1.0)
    ag_design = ag * gamma_I

    modal_results = []
    omega_list: list[float] = []

    for m in modes:
        T = float(m.get("period_s", 0.0))
        if T == float("inf") or T > 10.0:
            T_eff = 10.0
        else:
            T_eff = T

        Se_val = elastic_spectrum(T_eff, ag_design, ground_type, xi_pct, spectrum_type)
        Sd_val = design_spectrum(T_eff, ag_design, q, ground_type, xi_pct, spectrum_type)
        M_eff_x = float(m.get("effective_mass_x_kg", 0.0))
        M_eff_y = float(m.get("effective_mass_y_kg", 0.0))

        # Modal base shear (horizontal x-direction)
        V_x = Sd_val * M_eff_x          # N
        V_y = Sd_val * M_eff_y          # N

        omega = 2.0 * math.pi / max(T_eff, 1e-6)
        omega_list.append(omega)

        modal_results.append({
            "mode": int(m.get("mode", 0)),
            "period_s": round(T, 4),
            "freq_hz": round(float(m.get("freq_hz", 0.0)), 4),
            "Se_ms2": round(Se_val, 4),
            "Sd_ms2": round(Sd_val, 4),
            "effective_mass_x_kg": round(M_eff_x, 1),
            "effective_mass_y_kg": round(M_eff_y, 1),
            "modal_base_shear_x_kn": round(V_x / 1000.0, 3),
            "modal_base_shear_y_kn": round(V_y / 1000.0, 3),
            "mass_participation_x_pct": round(float(m.get("mass_participation_x_pct", 0.0)), 2),
        })

    # Modal combination
    V_x_vals = [r["modal_base_shear_x_kn"] for r in modal_results]
    V_y_vals = [r["modal_base_shear_y_kn"] for r in modal_results]

    if combination.upper() == "CQC" and len(modal_results) > 1:
        xi = xi_pct / 100.0
        V_x_cqc = 0.0
        V_y_cqc = 0.0
        n = len(modal_results)
        for i in range(n):
            for j in range(n):
                rho = _cqc_correlation(omega_list[i], omega_list[j], xi) if i != j else 1.0
                V_x_cqc += rho * V_x_vals[i] * V_x_vals[j]
                V_y_cqc += rho * V_y_vals[i] * V_y_vals[j]
        V_total_x = math.sqrt(max(V_x_cqc, 0.0))
        V_total_y = math.sqrt(max(V_y_cqc, 0.0))
    else:
        V_total_x = math.sqrt(sum(v**2 for v in V_x_vals))
        V_total_y = math.sqrt(sum(v**2 for v in V_y_vals))

    # Spectral curve for plotting
    curve = compute_spectrum_curve(ag_design, ground_type, xi_pct, q, spectrum_type)

    cum_mass = sum(r["mass_participation_x_pct"] for r in modal_results)

    return {
        "status": "ok",
        "ag_design_ms2": round(ag_design, 4),
        "gamma_I": gamma_I,
        "ground_type": ground_type,
        "combination": combination,
        "modal_results": modal_results,
        "combined_base_shear_x_kn": round(V_total_x, 3),
        "combined_base_shear_y_kn": round(V_total_y, 3),
        "cumulative_mass_participation_pct": round(cum_mass, 2),
        "spectrum_curve": curve,
    }


def run_seismic_spectrum(
    ag: float = 0.15,
    ground_type: str = "B",
    xi_pct: float = 5.0,
    q: float = 1.5,
    importance_class: str = "II",
    spectrum_type: int = 1,
    # Optional modal data for combination
    modal_periods: list[float] | None = None,
    modal_eff_masses_x: list[float] | None = None,
    modal_eff_masses_y: list[float] | None = None,
    modal_mass_part_x: list[float] | None = None,
    combination: str = "SRSS",
) -> dict[str, Any]:
    """
    Main entry point — computes spectrum curve and optionally combines modal forces.

    ag is in g (e.g. 0.15 g), converted to m/s² internally.
    """
    ag_ms2 = ag * 9.81
    curve = compute_spectrum_curve(ag_ms2, ground_type, xi_pct, q, spectrum_type)

    result: dict[str, Any] = {
        "status": "ok",
        "ag_g": ag,
        "ag_ms2": round(ag_ms2, 4),
        "ground_type": ground_type,
        "xi_pct": xi_pct,
        "q_factor": q,
        "importance_class": importance_class,
        "spectrum_curve": curve,
    }

    if modal_periods:
        n = len(modal_periods)
        eff_x = modal_eff_masses_x or [0.0] * n
        eff_y = modal_eff_masses_y or [0.0] * n
        mp_x = modal_mass_part_x or [0.0] * n

        gamma_I = IMPORTANCE_FACTORS.get(importance_class.upper(), 1.0)
        ag_des = ag_ms2 * gamma_I

        modes_synthetic = []
        for k, T in enumerate(modal_periods):
            f = 1.0 / T if T > 0 else 0.0
            modes_synthetic.append({
                "mode": k + 1,
                "period_s": T,
                "freq_hz": f,
                "effective_mass_x_kg": eff_x[k] if k < len(eff_x) else 0.0,
                "effective_mass_y_kg": eff_y[k] if k < len(eff_y) else 0.0,
                "mass_participation_x_pct": mp_x[k] if k < len(mp_x) else 0.0,
            })

        seismic = modal_seismic_response(
            modes_synthetic, ag_ms2, ground_type, xi_pct, q,
            importance_class, spectrum_type, combination,
        )
        result["modal_combination"] = seismic

    return result
