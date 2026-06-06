"""
Enhanced Solar PV + BESS Design Engine — Zambia Calibrated
============================================================
Implements full off-grid / hybrid system sizing for Zambia:
- Province-level Peak Sun Hours (PSH) from ZMD data
- Array sizing: panel count, tilt optimisation, strings/parallel
- Inverter selection (kVA rating)
- Battery bank sizing: Ah capacity, days autonomy, DoD, temperature derating
- Charge controller (MPPT) sizing
- DC and AC cable sizing (voltage drop ≤3%)
- System losses budget
- ZMW Bill of Quantities with ZRA-compliant pricing

Usage
-----
    from calculations.energy.solar_pv_enhanced import calculate_solar_pv_enhanced

    result = calculate_solar_pv_enhanced({
        "province": "lusaka",
        "daily_load_kwh": 25.0,
        "peak_load_kw": 5.0,
        "days_autonomy": 3,
        "dod_pct": 80,
        "panel_wp": 400,
        "panel_voc": 49.5,
        "panel_vmp": 41.2,
        "panel_isc": 10.5,
        "panel_imp": 9.7,
        "battery_type": "lithium",   # "lead_acid" or "lithium"
        "battery_ah": 200,
        "battery_voltage": 48,
        "inverter_voltage": 48,
        "dc_cable_length_m": 10,
        "ac_cable_length_m": 30,
    })
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

# ---------------------------------------------------------------------------
# ZAMBIA PEAK SUN HOURS (PSH) by province — ZMD / PVGIS calibrated
# ---------------------------------------------------------------------------
ZAMBIA_PSH: dict[str, dict[str, float]] = {
    "lusaka":       {"annual_avg": 5.5, "worst_month": 4.5, "best_month": 6.8},
    "copperbelt":   {"annual_avg": 5.2, "worst_month": 4.2, "best_month": 6.5},
    "eastern":      {"annual_avg": 5.8, "worst_month": 4.8, "best_month": 7.0},
    "southern":     {"annual_avg": 6.0, "worst_month": 5.0, "best_month": 7.2},
    "western":      {"annual_avg": 5.6, "worst_month": 4.6, "best_month": 6.9},
    "central":      {"annual_avg": 5.4, "worst_month": 4.4, "best_month": 6.6},
    "northern":     {"annual_avg": 5.0, "worst_month": 4.0, "best_month": 6.2},
    "luapula":      {"annual_avg": 5.1, "worst_month": 4.1, "best_month": 6.3},
    "muchinga":     {"annual_avg": 5.3, "worst_month": 4.3, "best_month": 6.5},
    "north_western": {"annual_avg": 5.4, "worst_month": 4.4, "best_month": 6.6},
    "default":      {"annual_avg": 5.5, "worst_month": 4.5, "best_month": 6.5},
}

# ZMW unit rates (2025 estimate — ZRA import duty incl.)
ZMW_RATES: dict[str, float] = {
    "panel_400wp_zmw":       3_500.0,     # ZMW per panel
    "battery_200ah_48v_la":  8_000.0,     # lead acid per unit
    "battery_200ah_48v_li":  22_000.0,    # lithium per unit
    "mppt_60a_zmw":          4_500.0,
    "mppt_100a_zmw":         7_200.0,
    "inverter_3kva_zmw":     9_000.0,
    "inverter_5kva_zmw":    14_000.0,
    "inverter_8kva_zmw":    21_000.0,
    "inverter_10kva_zmw":   27_000.0,
    "dc_cable_6mm_zmw_m":      45.0,
    "dc_cable_10mm_zmw_m":     75.0,
    "dc_cable_16mm_zmw_m":    115.0,
    "ac_cable_4mm_zmw_m":      35.0,
    "ac_cable_6mm_zmw_m":      50.0,
    "mounting_per_panel_zmw":  800.0,
    "installation_pct":          0.12,    # 12% of equipment
    "contingency_pct":           0.05,
}

# Standard MPPT charge controller ampere ratings
MPPT_RATINGS_A = [20, 30, 40, 60, 80, 100, 150]

# Standard inverter sizes kVA
INVERTER_SIZES_KVA = [1.5, 2.0, 3.0, 5.0, 8.0, 10.0, 15.0, 20.0, 30.0]

# Cable resistivity (mΩ·m) aluminium/copper
COPPER_RESISTIVITY = 0.01724  # Ω·mm²/m at 20°C


def _step(ref: str, formula: str, subs: str, result: float, unit: str,
          status: str = "info", note: str = "") -> dict[str, Any]:
    return {
        "reference": ref, "formula": formula, "substitution": subs,
        "result": round(result, 4), "unit": unit, "status": status, "note": note,
    }


def _select_cable_size(I_a: float, length_m: float, voltage_v: float,
                       vdrop_pct: float = 3.0) -> tuple[float, float, float]:
    """Return (cable_mm2, vdrop_pct_actual, resistance_mohm).
    Standard sizes: 2.5, 4, 6, 10, 16, 25, 35, 50 mm²."""
    standard_sizes = [2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0]
    max_vdrop_v = voltage_v * vdrop_pct / 100.0
    for sz in standard_sizes:
        R = COPPER_RESISTIVITY * 2.0 * length_m / sz   # Ω (both ways)
        vd = I_a * R
        if vd <= max_vdrop_v:
            return sz, vd / voltage_v * 100.0, R * 1000.0
    return 50.0, I_a * COPPER_RESISTIVITY * 2.0 * length_m / 50.0 / voltage_v * 100.0, 0.0


def calculate_solar_pv_enhanced(inputs: dict[str, Any]) -> dict[str, Any]:
    steps: list[dict] = []
    warnings: list[str] = []
    errors: list[str] = []

    try:
        province = inputs.get("province", "lusaka").lower().replace(" ", "_").replace("-", "_")
        psh_data = ZAMBIA_PSH.get(province, ZAMBIA_PSH["default"])
        psh = psh_data["worst_month"]   # design on worst month for reliability

        steps.append(_step(
            "ZMD/PVGIS", "PSH (design on worst month)",
            f"province={province}, PSH_worst={psh}h/day, PSH_annual_avg={psh_data['annual_avg']}h/day",
            psh, "h/day",
        ))

        daily_kwh = float(inputs["daily_load_kwh"])
        peak_kw = float(inputs["peak_load_kw"])
        days_autonomy = int(inputs.get("days_autonomy", 3))
        dod_pct = float(inputs.get("dod_pct", 80))
        battery_type = inputs.get("battery_type", "lithium")
        batt_temp_derating = 1.0 if battery_type == "lithium" else 0.8  # 80% for lead acid in heat

        # System losses (IEC 62548)
        loss_dc = 0.97     # wiring
        loss_mppt = 0.98   # charge controller
        loss_inv = 0.95    # inverter
        loss_batt = 0.95   # battery roundtrip (Li=0.95, LA=0.85 approx)
        if battery_type == "lead_acid":
            loss_batt = 0.85
        loss_total = loss_dc * loss_mppt * loss_inv * loss_batt
        steps.append(_step(
            "IEC 62548 cl.5", "System derating = η_wire × η_mppt × η_inv × η_batt",
            f"{loss_dc}×{loss_mppt}×{loss_inv}×{loss_batt} = {loss_total:.3f}",
            loss_total * 100, "%",
        ))

        # Array sizing
        E_required = daily_kwh / loss_total   # kWh from panels to cover losses
        panel_wp = float(inputs.get("panel_wp", 400.0))
        panel_kwp = panel_wp / 1000.0
        n_panels = math.ceil(E_required / (panel_kwp * psh))
        array_kwp = n_panels * panel_kwp
        steps.append(_step(
            "Solar sizing", "N_panels = E_req / (Wp × PSH)",
            f"E_req={E_required:.2f} kWh, panel={panel_wp}Wp, PSH={psh}h → N={n_panels}",
            n_panels, "panels",
        ))

        # String configuration (series/parallel)
        inv_voltage = float(inputs.get("inverter_voltage", 48.0))
        panel_vmp = float(inputs.get("panel_vmp", 41.2))
        panel_voc = float(inputs.get("panel_voc", 49.5))
        panel_imp = float(inputs.get("panel_imp", 9.7))
        panel_isc = float(inputs.get("panel_isc", 10.5))

        n_series = max(1, round(inv_voltage / panel_vmp))   # panels per string
        n_strings = math.ceil(n_panels / n_series)
        n_panels_actual = n_series * n_strings
        array_kwp_actual = n_panels_actual * panel_kwp

        Varray = n_series * panel_vmp
        Iarray = n_strings * panel_imp
        Parray_kw = Varray * Iarray / 1000.0

        steps.append(_step(
            "String design", "Series: V_array ≈ V_inv_nom; Parallel: I_total",
            f"{n_series}S × {n_strings}P = {n_panels_actual} panels, Vmp={Varray:.1f}V, Iarray={Iarray:.1f}A",
            n_panels_actual, "panels",
        ))

        # MPPT charge controller sizing (I_mppt ≥ 1.25 × Isc × n_strings)
        I_mppt_req = 1.25 * panel_isc * n_strings
        mppt_rating = next((r for r in MPPT_RATINGS_A if r >= I_mppt_req), MPPT_RATINGS_A[-1])
        n_mppts = 1
        if mppt_rating == MPPT_RATINGS_A[-1] and I_mppt_req > MPPT_RATINGS_A[-1]:
            n_mppts = math.ceil(I_mppt_req / MPPT_RATINGS_A[-1])
            mppt_rating = MPPT_RATINGS_A[-1]
        steps.append(_step(
            "NEC 690.8 / IEC 62548", "I_mppt ≥ 1.25 × Isc × N_strings",
            f"1.25 × {panel_isc}A × {n_strings} = {I_mppt_req:.1f}A → select {mppt_rating}A × {n_mppts}",
            mppt_rating, "A",
        ))

        # Inverter sizing (125% of peak load)
        inv_kva_req = peak_kw * 1.25
        inv_kva = next((s for s in INVERTER_SIZES_KVA if s >= inv_kva_req), INVERTER_SIZES_KVA[-1])
        steps.append(_step(
            "IEC 62548", "Inverter kVA ≥ 1.25 × peak_load",
            f"1.25 × {peak_kw}kW = {inv_kva_req:.2f}kVA → select {inv_kva}kVA",
            inv_kva, "kVA",
        ))

        # Battery bank sizing
        batt_voltage = float(inputs.get("battery_voltage", 48.0))
        batt_ah = float(inputs.get("battery_ah", 200.0))

        batt_energy_req = (daily_kwh * days_autonomy) / (dod_pct / 100.0) / batt_temp_derating  # kWh
        n_batteries = math.ceil(batt_energy_req * 1000.0 / (batt_voltage * batt_ah))  # each unit
        batt_bank_kwh = n_batteries * batt_voltage * batt_ah / 1000.0
        steps.append(_step(
            "SANS 10142", "N_batt = E_req / (V × Ah × DoD × derating)",
            f"E_req={batt_energy_req:.2f}kWh, batt={batt_voltage}V/{batt_ah}Ah → N={n_batteries}",
            n_batteries, "batteries",
        ))

        # Cable sizing
        dc_len = float(inputs.get("dc_cable_length_m", 10.0))
        ac_len = float(inputs.get("ac_cable_length_m", 30.0))

        # DC array cable: current = Iarray, voltage = Varray
        dc_sz, dc_vdrop, _ = _select_cable_size(Iarray, dc_len, Varray, 3.0)
        # AC output cable: current = Parray/Vac (assume 230V AC single-phase)
        I_ac = inv_kva * 1000.0 / 230.0
        ac_sz, ac_vdrop, _ = _select_cable_size(I_ac, ac_len, 230.0, 3.0)

        steps.append(_step(
            "SANS 10142 / IEC 60364", "DC cable: select smallest size for VD ≤ 3%",
            f"I_dc={Iarray:.1f}A, L={dc_len}m → {dc_sz}mm² copper ({dc_vdrop:.2f}% VD)",
            dc_sz, "mm²",
        ))
        steps.append(_step(
            "SANS 10142 / IEC 60364", "AC cable: select smallest size for VD ≤ 3%",
            f"I_ac={I_ac:.1f}A, L={ac_len}m → {ac_sz}mm² copper ({ac_vdrop:.2f}% VD)",
            ac_sz, "mm²",
        ))

        # ZMW Bill of Quantities
        rates = ZMW_RATES
        batt_rate = rates["battery_200ah_48v_li"] if battery_type == "lithium" else rates["battery_200ah_48v_la"]
        # Scale battery cost if different Ah
        batt_rate_adj = batt_rate * (batt_ah / 200.0)

        # Inverter rate
        inv_rate_key = "inverter_3kva_zmw"
        if inv_kva <= 3: inv_rate_key = "inverter_3kva_zmw"
        elif inv_kva <= 5: inv_rate_key = "inverter_5kva_zmw"
        elif inv_kva <= 8: inv_rate_key = "inverter_8kva_zmw"
        else: inv_rate_key = "inverter_10kva_zmw"

        mppt_key = "mppt_60a_zmw" if mppt_rating <= 60 else "mppt_100a_zmw"
        dc_cable_key = "dc_cable_6mm_zmw_m" if dc_sz <= 6 else ("dc_cable_10mm_zmw_m" if dc_sz <= 10 else "dc_cable_16mm_zmw_m")
        ac_cable_key = "ac_cable_4mm_zmw_m" if ac_sz <= 4 else "ac_cable_6mm_zmw_m"

        boq_items = [
            {"item": f"Solar panel {panel_wp}Wp", "qty": n_panels_actual, "unit": "No.", "rate_zmw": rates["panel_400wp_zmw"], "total_zmw": n_panels_actual * rates["panel_400wp_zmw"]},
            {"item": f"Battery {batt_ah}Ah / {batt_voltage}V ({battery_type})", "qty": n_batteries, "unit": "No.", "rate_zmw": batt_rate_adj, "total_zmw": n_batteries * batt_rate_adj},
            {"item": f"MPPT charge controller {mppt_rating}A", "qty": n_mppts, "unit": "No.", "rate_zmw": rates[mppt_key], "total_zmw": n_mppts * rates[mppt_key]},
            {"item": f"Hybrid inverter {inv_kva}kVA / {batt_voltage}V", "qty": 1, "unit": "No.", "rate_zmw": rates[inv_rate_key], "total_zmw": rates[inv_rate_key]},
            {"item": f"DC cable {dc_sz}mm² copper", "qty": dc_len * 2.0, "unit": "m", "rate_zmw": rates[dc_cable_key], "total_zmw": dc_len * 2.0 * rates[dc_cable_key]},
            {"item": f"AC cable {ac_sz}mm² copper", "qty": ac_len * 2.0, "unit": "m", "rate_zmw": rates[ac_cable_key], "total_zmw": ac_len * 2.0 * rates[ac_cable_key]},
            {"item": "Panel mounting structure (galv. steel)", "qty": n_panels_actual, "unit": "No.", "rate_zmw": rates["mounting_per_panel_zmw"], "total_zmw": n_panels_actual * rates["mounting_per_panel_zmw"]},
        ]
        equipment_total = sum(i["total_zmw"] for i in boq_items)
        installation = equipment_total * rates["installation_pct"]
        contingency = (equipment_total + installation) * rates["contingency_pct"]
        grand_total = equipment_total + installation + contingency

        for item in boq_items:
            item["total_zmw"] = round(item["total_zmw"], 2)

        # Warnings
        if dc_vdrop > 3.0:
            warnings.append(f"DC cable voltage drop {dc_vdrop:.1f}% exceeds 3% limit — increase cable size")
        if ac_vdrop > 3.0:
            warnings.append(f"AC cable voltage drop {ac_vdrop:.1f}% exceeds 3% limit — increase cable size")
        if dod_pct > 80 and battery_type == "lead_acid":
            warnings.append("Lead acid batteries: DoD >80% reduces lifespan significantly — use max 50-60%")
        if days_autonomy < 2:
            warnings.append("Days autonomy <2 is insufficient for most off-grid Zambian sites")

        return {
            "status": "pass",
            "summary": {
                "province": province,
                "psh_design_hday": psh,
                "daily_load_kwh": daily_kwh,
                "n_panels": n_panels_actual,
                "panel_wp": panel_wp,
                "array_kwp": round(array_kwp_actual, 2),
                "string_config": f"{n_series}S × {n_strings}P",
                "array_voltage_v": round(Varray, 1),
                "array_current_a": round(Iarray, 1),
                "n_mppts": n_mppts,
                "mppt_rating_a": mppt_rating,
                "inverter_kva": inv_kva,
                "n_batteries": n_batteries,
                "battery_bank_kwh": round(batt_bank_kwh, 2),
                "days_autonomy": days_autonomy,
                "dc_cable_mm2": dc_sz,
                "ac_cable_mm2": ac_sz,
                "system_efficiency_pct": round(loss_total * 100, 1),
                "total_cost_zmw": round(grand_total, 0),
            },
            "boq": {
                "items": boq_items,
                "equipment_total_zmw": round(equipment_total, 2),
                "installation_zmw": round(installation, 2),
                "contingency_zmw": round(contingency, 2),
                "grand_total_zmw": round(grand_total, 2),
            },
            "steps": steps,
            "warnings": warnings,
            "errors": errors,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as exc:
        return {
            "status": "error", "summary": {}, "boq": {},
            "steps": steps, "warnings": warnings, "errors": [str(exc)],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
