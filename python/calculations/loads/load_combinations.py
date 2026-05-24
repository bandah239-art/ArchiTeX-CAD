"""Load combinations per Eurocode 0 and ACI 318."""

from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value


def _step(n, title, formula, sub, result, unit="", ref="", status="info"):
    return {
        "step_number": n, "title": title, "formula": formula,
        "substitution": sub, "result": result, "unit": unit,
        "reference": ref, "status": status,
    }


def calculate_loads(inputs: dict[str, Any]) -> dict[str, Any]:
    gk = inputs.get("dead_load_g", inputs.get("dead_load", 0))
    qk = inputs.get("imposed_load_q", inputs.get("imposed_load", 0))
    wk = inputs.get("wind_load_w", inputs.get("wind_load", 0))
    sk = inputs.get("snow_load_s", 0)
    code = inputs.get("design_code", "eurocode")
    psi0, psi1, psi2 = 0.7, 0.5, 0.3
    xi = 0.85

    steps: list[dict] = []
    unit = "kN/m" if inputs.get("load_type", "udl") == "udl" else "kN/m²"

    steps.append(_step(1, "Characteristic Loads",
        "Gk, Qk, Wk, Sk",
        f"Gk={gk}, Qk={qk}, Wk={wk}, Sk={sk}",
        f"Gk={gk} {unit}; Qk={qk} {unit}; Wk={wk} {unit}", unit, "Eurocode 0 / ACI 318", "info"))

    if code == "aci318":
        combos = {
            "Combo 1 (1.4D)": 1.4 * gk,
            "Combo 2 (1.2D+1.6L)": 1.2 * gk + 1.6 * qk,
            "Combo 3 (1.2D+1.6S+max(L,0.5W)": 1.2 * gk + 1.6 * sk + max(qk, 0.5 * wk),
            "Combo 4 (1.2D+1.0W+L+0.5S)": 1.2 * gk + 1.0 * wk + qk + 0.5 * sk,
            "Combo 5 (0.9D+1.0W)": 0.9 * gk + 1.0 * wk,
        }
        ref = "ACI 318-19"
    else:
        c1 = 1.35 * gk + 1.50 * qk
        c2 = 1.35 * gk + 1.50 * wk + 1.05 * qk
        c3 = 1.00 * gk + 1.50 * wk
        c4 = 1.35 * gk + 1.50 * qk + 0.90 * wk
        c_610a = 1.35 * gk + 1.50 * psi0 * qk
        c_610b = xi * 1.35 * gk + 1.50 * qk
        combos = {
            "Combo 1 (Gravity dominant)": c1,
            "Combo 2 (Wind unfavourable)": c2,
            "Combo 3 (Wind favourable)": c3,
            "Combo 4 (Imposed + wind)": c4,
            "Combo 5 (Eq 6.10a)": c_610a,
            "Combo 6 (Eq 6.10b)": c_610b,
        }
        ref = "Eurocode 0: Eq. 6.10"

    steps.append(_step(2, "ULS Fundamental Combinations",
        "EN 1990 Eq. 6.10 combinations" if code != "aci318" else "ACI 318 strength combinations",
        "; ".join(f"{k.split('(')[0].strip()}: {round_value(v,2)}" for k, v in list(combos.items())[:4]),
        "See summary table below", unit, ref, "info"))

    alt_governing = min(combos.get("Combo 5 (Eq 6.10a)", 999), combos.get("Combo 6 (Eq 6.10b)", 999)) if code != "aci318" else None
    if alt_governing is not None:
        steps.append(_step(3, "Alternative ULS Combinations",
            "Eq 6.10a: 1.35Gk + 1.50ψ0Qk; Eq 6.10b: ξ·1.35Gk + 1.50Qk",
            f"ψ0={psi0}, ξ={xi}",
            f"Governing alternative = {round_value(alt_governing, 2)} {unit}", unit, "Eurocode 0: Eq. 6.10a/b", "info"))

    sls_char = gk + qk
    sls_freq = gk + psi1 * qk
    sls_qp = gk + psi2 * qk

    steps.append(_step(4, "SLS Characteristic Combination",
        "NSls = Gk + Qk", f"Gk + Qk = {gk} + {qk}",
        f"NSls = {round_value(sls_char, 2)} {unit}", unit, "Eurocode 0: Eq. 6.14b", "info"))

    steps.append(_step(5, "SLS Frequent Combination",
        "NSls,freq = Gk + ψ1·Qk", f"ψ1={psi1}",
        f"NSls,freq = {round_value(sls_freq, 2)} {unit}", unit, "Eurocode 0: Eq. 6.16b", "info"))

    steps.append(_step(6, "SLS Quasi-Permanent Combination",
        "NSls,qp = Gk + ψ2·Qk", f"ψ2={psi2}",
        f"NSls,qp = {round_value(sls_qp, 2)} {unit}", unit, "Eurocode 0: Eq. 6.16c", "info"))

    governing_name = max(combos, key=combos.get)
    governing_val = combos[governing_name]

    steps.append(_step(7, "Governing ULS Design Load",
        "wEd = max(all ULS combinations)",
        f"Governing: {governing_name}",
        f"wEd = {round_value(governing_val, 2)} {unit} ← {governing_name} governs ✓", unit, ref, "pass"))

    combo_lines = [f"{name}: {round_value(val, 2)} {unit}" for name, val in combos.items()]
    steps.append(_step(8, "Summary Table",
        "All combinations tabulated",
        "; ".join(combo_lines[:4]),
        f"Governing ULS = {round_value(governing_val, 2)} {unit}", unit, ref, "info"))

    return {
        "status": "pass",
        "summary": {
            "dead_load": gk,
            "imposed_load": qk,
            "wind_load": wk,
            "snow_load": sk,
            "governing_uls_kn": round_value(governing_val, 2),
            "governing_combination": governing_name,
            "sls_characteristic": round_value(sls_char, 2),
            "sls_frequent": round_value(sls_freq, 2),
            "sls_quasi_permanent": round_value(sls_qp, 2),
            "combo_1_gravity": round_value(combos.get("Combo 1 (Gravity dominant)", combos.get("Combo 1 (1.4D)", 0)), 2),
            "combo_2_wind_unfav": round_value(combos.get("Combo 2 (Wind unfavourable)", combos.get("Combo 2 (1.2D+1.6L)", 0)), 2),
            "combo_3_wind_fav": round_value(combos.get("Combo 3 (Wind favourable)", combos.get("Combo 3 (1.2D+1.6S+max(L,0.5W)", 0)), 2),
            "load_analysis": "COMPLETE ✓",
        },
        "steps": steps,
        "warnings": [],
        "errors": [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
