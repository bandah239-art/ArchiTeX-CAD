"""Load combinations generator — EC0, ACI 318, BS 8110 (production response)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value

UNIT_DEFAULT = "kN/m"


def _norm_code(code: str) -> str:
    c = (code or "EC0").upper().replace(" ", "").replace("-", "")
    if c in ("EC0", "EC", "EUROCODE", "EN1990"):
        return "EC0"
    if c in ("ACI318", "ACI"):
        return "ACI318"
    if c in ("BS8110", "BS"):
        return "BS8110"
    raise ValueError(f"Unsupported design code: {code}. Use EC0, ACI318, or BS8110.")


def _substitution(expr: str, gk: float, qk: float, wk: float, ek: float) -> str:
    return (
        expr.replace("Gk", f"({gk})")
        .replace("Qk", f"({qk})")
        .replace("Wk", f"({wk})")
        .replace("Ek", f"({ek})")
        .replace("D", f"({gk})")
        .replace("L", f"({qk})")
        .replace("W", f"({wk})")
        .replace("E", f"({ek})")
    )


def _combo(
    combo_number: int | str,
    expression: str,
    result: float,
    unit: str,
    reference: str,
    gk: float,
    qk: float,
    wk: float,
    ek: float,
    governing: bool = False,
) -> dict[str, Any]:
    return {
        "combo_number": combo_number,
        "expression": expression,
        "substitution": _substitution(expression, gk, qk, wk, ek),
        "result": round_value(result, 4),
        "unit": unit,
        "reference": reference,
        "governing": governing,
    }


def _mark_governing(combos: list[dict[str, Any]]) -> dict[str, Any]:
    if not combos:
        raise ValueError("No combinations generated")
    best = max(combos, key=lambda c: c["result"])
    for c in combos:
        c["governing"] = c is best
    return best


def _ec0_combinations(gk: float, qk: float, wk: float, ek: float, unit: str) -> tuple[list, list]:
    uls_defs = [
        (1, "1.35·Gk + 1.50·Qk", 1.35 * gk + 1.50 * qk, "EC0 Table A1.2(B) — Combo 1"),
        (2, "1.35·Gk + 1.50·Qk + 0.90·Wk", 1.35 * gk + 1.50 * qk + 0.90 * wk, "EC0 Table A1.2(B) — Combo 2"),
        (3, "1.35·Gk + 1.05·Qk + 1.50·Wk", 1.35 * gk + 1.05 * qk + 1.50 * wk, "EC0 Table A1.2(B) — Combo 3"),
        (4, "1.00·Gk + 1.50·Wk", 1.00 * gk + 1.50 * wk, "EC0 Table A1.2(B) — Combo 4"),
        (5, "1.00·Gk + 1.00·Ek + 0.30·Qk", 1.00 * gk + 1.00 * ek + 0.30 * qk, "EC0 Table A1.2(B) — Combo 5"),
    ]
    uls = [_combo(n, e, r, unit, ref, gk, qk, wk, ek) for n, e, r, ref in uls_defs]
    _mark_governing(uls)

    sls_defs = [
        ("characteristic", "1.0·Gk + 1.0·Qk + 0.6·Wk", 1.0 * gk + 1.0 * qk + 0.6 * wk, "EC0 — Characteristic"),
        ("frequent", "1.0·Gk + 0.5·Qk + 0.2·Wk", 1.0 * gk + 0.5 * qk + 0.2 * wk, "EC0 — Frequent"),
        ("quasi-permanent", "1.0·Gk + 0.3·Qk", 1.0 * gk + 0.3 * qk, "EC0 — Quasi-permanent"),
    ]
    sls = [_combo(n, e, r, unit, ref, gk, qk, wk, ek) for n, e, r, ref in sls_defs]
    _mark_governing(sls)
    return uls, sls


def _aci_combinations(gk: float, qk: float, wk: float, ek: float, unit: str) -> tuple[list, list]:
    uls_defs = [
        (1, "1.4·D", 1.4 * gk, "ACI 318-19 §5.3 — Combo 1"),
        (2, "1.2·D + 1.6·L", 1.2 * gk + 1.6 * qk, "ACI 318-19 §5.3 — Combo 2"),
        (3, "1.2·D + 1.6·W + 1.0·L", 1.2 * gk + 1.6 * wk + 1.0 * qk, "ACI 318-19 §5.3 — Combo 3"),
        (4, "0.9·D + 1.6·W", 0.9 * gk + 1.6 * wk, "ACI 318-19 §5.3 — Combo 4"),
        (5, "1.2·D + 1.0·E + 1.0·L", 1.2 * gk + 1.0 * ek + 1.0 * qk, "ACI 318-19 §5.3 — Combo 5"),
    ]
    uls = [_combo(n, e, r, unit, ref, gk, qk, wk, ek) for n, e, r, ref in uls_defs]
    _mark_governing(uls)
    return uls, []


def _bs_combinations(gk: float, qk: float, wk: float, ek: float, unit: str) -> tuple[list, list]:
    _ = ek
    uls_defs = [
        (1, "1.4·Gk + 1.6·Qk", 1.4 * gk + 1.6 * qk, "BS 8110 Table 2.1 — Combo 1"),
        (2, "1.2·Gk + 1.2·Qk + 1.2·Wk", 1.2 * gk + 1.2 * qk + 1.2 * wk, "BS 8110 Table 2.1 — Combo 2"),
        (3, "1.0·Gk + 1.4·Wk", 1.0 * gk + 1.4 * wk, "BS 8110 Table 2.1 — Combo 3"),
    ]
    uls = [_combo(n, e, r, unit, ref, gk, qk, wk, ek) for n, e, r, ref in uls_defs]
    _mark_governing(uls)
    return uls, []


def generate_load_combinations(payload: dict[str, Any]) -> dict[str, Any]:
    gk = float(payload.get("gk", payload.get("dead_load_g", 0)))
    qk = float(payload.get("qk", payload.get("imposed_load_q", 0)))
    wk = float(payload.get("wk", payload.get("wind_load_w", 0)))
    ek = float(payload.get("ek", payload.get("seismic_load", 0)))
    code = _norm_code(str(payload.get("code", payload.get("design_code", "EC0"))))
    unit = str(payload.get("unit", UNIT_DEFAULT))

    if code == "EC0":
        uls, sls = _ec0_combinations(gk, qk, wk, ek, unit)
    elif code == "ACI318":
        uls, sls = _aci_combinations(gk, qk, wk, ek, unit)
    else:
        uls, sls = _bs_combinations(gk, qk, wk, ek, unit)

    gov_uls = next(c for c in uls if c["governing"])
    gov_sls = next((c for c in sls if c["governing"]), None)

    governing_uls = {
        "value": gov_uls["result"],
        "expression": gov_uls["expression"],
        "combo": gov_uls["combo_number"],
    }
    governing_sls = (
        {
            "value": gov_sls["result"],
            "expression": gov_sls["expression"],
            "combo": gov_sls["combo_number"],
        }
        if gov_sls
        else None
    )

    design = round_value(gov_uls["result"], 4)

    return {
        "code": code,
        "inputs": {"gk": gk, "qk": qk, "wk": wk, "ek": ek},
        "unit": unit,
        "uls_combinations": uls,
        "sls_combinations": sls,
        "governing_uls": governing_uls,
        "governing_sls": governing_sls,
        "feed_to_calculators": {
            "beam_design_load": design,
            "slab_design_load": design,
            "column_design_load": design,
            "foundation_design_load": design,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def calculate_loads(inputs: dict[str, Any]) -> dict[str, Any]:
    """Legacy /calculate/loads response (steps format) — uses production generator."""
    payload = {
        "gk": inputs.get("dead_load_g", inputs.get("dead_load", 0)),
        "qk": inputs.get("imposed_load_q", inputs.get("imposed_load", 0)),
        "wk": inputs.get("wind_load_w", inputs.get("wind_load", 0)),
        "ek": 0.0,
        "code": "ACI318" if inputs.get("design_code") == "aci318" else "EC0",
        "unit": "kN/m" if inputs.get("load_type", "udl") == "udl" else "kN/m²",
    }
    gen = generate_load_combinations(payload)
    gov = gen["governing_uls"]
    sls_rows = gen.get("sls_combinations") or []
    sls_char = next((s for s in sls_rows if s["combo_number"] == "characteristic"), None)
    sls_freq = next((s for s in sls_rows if s["combo_number"] == "frequent"), None)
    sls_qp = next((s for s in sls_rows if s["combo_number"] == "quasi-permanent"), None)

    steps = [
        {
            "step_number": 1,
            "title": "Load combination generator",
            "formula": gov["expression"],
            "substitution": next(
                (c["substitution"] for c in gen["uls_combinations"] if c["governing"]),
                "",
            ),
            "result": f"{gov['value']} {gen['unit']}",
            "unit": gen["unit"],
            "reference": gen["code"],
            "status": "pass",
        }
    ]

    uls_rows = gen["uls_combinations"]
    combo_1 = uls_rows[0]["result"] if len(uls_rows) > 0 else 0
    combo_2 = uls_rows[1]["result"] if len(uls_rows) > 1 else 0
    combo_3 = uls_rows[2]["result"] if len(uls_rows) > 2 else 0

    return {
        "status": "pass",
        "summary": {
            "governing_uls_kn": gov["value"],
            "governing_combination": f"Combo {gov['combo']}",
            "combo_1_gravity": combo_1,
            "combo_2_wind_unfav": combo_2,
            "combo_3_wind_fav": combo_3,
            "sls_characteristic": sls_char["result"] if sls_char else 0,
            "sls_frequent": sls_freq["result"] if sls_freq else 0,
            "sls_quasi_permanent": sls_qp["result"] if sls_qp else 0,
            "load_analysis": "COMPLETE ✓",
        },
        "steps": steps,
        "warnings": [],
        "errors": [],
        "timestamp": gen["timestamp"],
        "load_combinations": gen,
    }
