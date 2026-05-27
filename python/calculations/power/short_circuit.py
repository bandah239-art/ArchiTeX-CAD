"""
IEC 60909 short-circuit calculations using pandapower.

Builds a simple radial network and runs:
  - Three-phase symmetrical fault (Ik3'')
  - Single-phase-to-earth fault (Ik1'')
  - Peak short-circuit current (ip)
  - Thermal short-circuit current (Ith)
"""

from __future__ import annotations

import math
from typing import Any

try:
    import pandapower as pp
    import pandapower.shortcircuit as sc
    HAS_PP = True
except ImportError:
    HAS_PP = False


def run_short_circuit(
    system_voltage_kv: float,
    source_impedance_ohm: float,
    cable_length_km: float,
    cable_r_ohm_km: float,
    cable_x_ohm_km: float,
    fault_bus: int = 1,
) -> dict[str, Any]:
    """
    Run IEC 60909 short-circuit on a simple two-bus radial network.

    Bus 0 = HV source (infinite busbar)
    Bus 1 = LV / load end (fault location)
    Cable between bus 0 and bus 1.
    """
    if not HAS_PP:
        return _analytical_sc(
            system_voltage_kv, source_impedance_ohm,
            cable_length_km, cable_r_ohm_km, cable_x_ohm_km,
        )

    try:
        net = pp.create_empty_network(sn_mva=100)
        b0 = pp.create_bus(net, vn_kv=system_voltage_kv, name="Source Bus")
        b1 = pp.create_bus(net, vn_kv=system_voltage_kv, name="Fault Bus")
        pp.create_ext_grid(net, bus=b0, vm_pu=1.0, s_sc_max_mva=10000, rx_max=0.1, r0x0_max=0.1, x0x_max=1.0)
        r_ohm = cable_r_ohm_km * cable_length_km
        x_ohm = cable_x_ohm_km * cable_length_km
        z_base = (system_voltage_kv ** 2) / 100
        r_pu = r_ohm / z_base
        x_pu = x_ohm / z_base
        pp.create_line_from_parameters(
            net, from_bus=b0, to_bus=b1, length_km=cable_length_km,
            r_ohm_per_km=cable_r_ohm_km, x_ohm_per_km=cable_x_ohm_km,
            c_nf_per_km=0, max_i_ka=1.0, r0_ohm_per_km=cable_r_ohm_km * 4,
            x0_ohm_per_km=cable_x_ohm_km * 4, c0_nf_per_km=0,
        )
        sc.calc_sc(net, bus=b1, fault="3ph", case="max")
        ik3 = float(net.res_bus_sc.at[b1, "ikss_ka"])
        ip3 = float(net.res_bus_sc.at[b1, "ip_ka"])
        ith3 = float(net.res_bus_sc.at[b1, "ith_ka"]) if "ith_ka" in net.res_bus_sc.columns else ik3 * 1.02

        sc.calc_sc(net, bus=b1, fault="1ph", case="max")
        ik1 = float(net.res_bus_sc.at[b1, "ikss_ka"])

        return _format_result(system_voltage_kv, ik3, ik1, ip3, ith3, cable_length_km, cable_r_ohm_km, cable_x_ohm_km)

    except Exception:
        return _analytical_sc(
            system_voltage_kv, source_impedance_ohm,
            cable_length_km, cable_r_ohm_km, cable_x_ohm_km,
        )


def _analytical_sc(
    vkv: float, zs_ohm: float, length_km: float, r_ohm_km: float, x_ohm_km: float
) -> dict[str, Any]:
    """Fallback analytical IEC 60909 method."""
    vn = vkv * 1000  # V
    r_cable = r_ohm_km * length_km
    x_cable = x_ohm_km * length_km
    z_total = math.sqrt((zs_ohm + r_cable) ** 2 + x_cable ** 2)

    ik3_ka = (1.05 * vn / math.sqrt(3)) / z_total / 1000  # kA
    ip3_ka = ik3_ka * math.sqrt(2) * 1.02
    ith3_ka = ik3_ka * 1.05

    # 1-ph approx: use 3× zero-sequence impedance
    z1_total = math.sqrt((zs_ohm + r_cable) ** 2 + x_cable ** 2)
    z0_total = math.sqrt((zs_ohm + r_cable * 4) ** 2 + (x_cable * 4) ** 2)
    ik1_ka = (math.sqrt(3) * 1.05 * vn / math.sqrt(3)) / (2 * z1_total + z0_total) / 1000

    return _format_result(vkv, ik3_ka, ik1_ka, ip3_ka, ith3_ka, length_km, r_ohm_km, x_ohm_km)


def _format_result(
    vkv: float, ik3: float, ik1: float, ip3: float, ith3: float,
    length_km: float, r_ohm_km: float, x_ohm_km: float,
) -> dict[str, Any]:
    r_cable = r_ohm_km * length_km
    x_cable = x_ohm_km * length_km
    z_cable = math.sqrt(r_cable ** 2 + x_cable ** 2)

    return {
        "ik3_ka": round(ik3, 4),
        "ik1_ka": round(ik1, 4),
        "ip3_ka": round(ip3, 4),
        "ith3_ka": round(ith3, 4),
        "z_cable_ohm": round(z_cable, 4),
        "r_cable_ohm": round(r_cable, 4),
        "x_cable_ohm": round(x_cable, 4),
        "system_voltage_kv": vkv,
        "cable_length_km": length_km,
        "status": "ok",
    }
