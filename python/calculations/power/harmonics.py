"""
Harmonic distortion analysis up to the 25th harmonic.

Models a radial supply with series impedance feeding a non-linear load that
injects harmonic currents as a current-source model (IEC 61000-3-6 Class 3).

Computes voltage harmonic spectrum at the load bus and THD.
"""

from __future__ import annotations

import math
from typing import Any


# IEC 61000-3-6 Class 3 reference harmonic current spectra (% of fundamental)
# Key: harmonic order, value: % of fundamental current
_CLASS3_SPECTRUM: dict[int, float] = {
    1: 100.0,
    2: 1.8, 3: 21.6, 4: 1.0, 5: 10.7, 6: 0.3, 7: 7.2,
    8: 0.1, 9: 3.8, 10: 0.1, 11: 3.1, 12: 0.1, 13: 2.0,
    14: 0.1, 15: 0.7, 16: 0.1, 17: 1.2, 18: 0.1, 19: 0.9,
    20: 0.1, 21: 0.5, 22: 0.1, 23: 0.7, 24: 0.1, 25: 0.5,
}


def harmonic_spectrum(
    system_voltage_v: float,
    load_kva: float,
    system_impedance_ohm: float,
    cable_r_ohm: float,
    cable_x_ohm: float,
    fund_freq_hz: float = 50.0,
    harmonic_profile: str = "class3_iec",
    max_harmonic: int = 25,
) -> dict[str, Any]:
    """
    Calculate voltage harmonic spectrum at load bus.

    Returns harmonic orders, magnitudes (V), % of fundamental, and THD.
    """
    orders = list(range(1, max_harmonic + 1))
    v_fund = system_voltage_v / math.sqrt(3)  # phase voltage

    # Select harmonic current profile (% of fundamental load current)
    if harmonic_profile == "class3_iec":
        spectrum = _CLASS3_SPECTRUM
    else:
        # Flat spectrum (for comparison)
        spectrum = {h: max(0, 40 - h * 1.5) for h in orders}

    # Fundamental load current
    i_fund_a = (load_kva * 1000) / (math.sqrt(3) * system_voltage_v)

    # Source + cable impedance components
    r_total = system_impedance_ohm + cable_r_ohm
    x_fund = cable_x_ohm  # at 50 Hz

    harmonic_v: list[float] = []
    harmonic_pct: list[float] = []
    harmonic_i: list[float] = []

    for h in orders:
        i_h_pct = spectrum.get(h, 0.0)
        i_h_a = i_fund_a * i_h_pct / 100.0
        harmonic_i.append(round(i_h_a, 4))

        # Harmonic impedance: R stays same, X scales with h
        x_h = x_fund * h
        z_h = math.sqrt(r_total ** 2 + x_h ** 2)

        v_h = i_h_a * z_h  # voltage drop at harmonic h = harmonic voltage at bus
        harmonic_v.append(round(v_h, 4))
        harmonic_pct.append(round(v_h / max(v_fund, 1) * 100, 4))

    # THD_V = sqrt(sum(V_h^2) for h>1) / V1 * 100
    v1 = harmonic_v[0] if harmonic_v else v_fund
    thd_v = math.sqrt(sum(v ** 2 for v in harmonic_v[1:])) / max(v1, 1) * 100

    # THD_I
    i1 = harmonic_i[0] if harmonic_i else i_fund_a
    thd_i = math.sqrt(sum(i ** 2 for i in harmonic_i[1:])) / max(i1, 1) * 100

    # IEC 61000-2-2 voltage limits (% of fundamental)
    limits = {
        h: 3.0 if h <= 7 else (2.0 if h <= 13 else (1.5 if h <= 19 else 1.0))
        for h in orders
    }
    violations = [h for h in orders if harmonic_pct[h - 1] > limits.get(h, 1.0)]

    return {
        "harmonic_orders": orders,
        "harmonic_voltages_v": harmonic_v,
        "harmonic_voltages_pct": harmonic_pct,
        "harmonic_currents_a": harmonic_i,
        "iec_limits_pct": [limits[h] for h in orders],
        "thd_v_pct": round(thd_v, 3),
        "thd_i_pct": round(thd_i, 3),
        "violations": violations,
        "fundamental_voltage_v": round(v_fund, 2),
        "fundamental_current_a": round(i_fund_a, 3),
        "status": "ok",
    }
