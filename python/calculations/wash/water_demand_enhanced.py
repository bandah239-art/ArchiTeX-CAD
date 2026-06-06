"""
WASH Water Demand — Enhanced calculator for African rural/urban contexts.

Supports three population-projection methods (geometric, arithmetic, logistic),
full institutional demand breakdowns, NRW accounting, peak-factor analysis,
fire-flow storage, and a demand schedule by year.

References:
  - WHO (2017) Guidelines for Drinking-water Quality, 4th ed.
  - Zambia NRWSSP (2006) National Rural Water Supply & Sanitation Programme guidelines
  - UN-Water (2021) GLAAS — per-capita demand benchmarks
  - ISO 24510:2007 — water supply service activities
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value

# ---------------------------------------------------------------------------
# Embedded constants
# ---------------------------------------------------------------------------

PER_CAPITA_LPCD: dict[str, float] = {
    "rural": 25.0,
    "peri_urban": 80.0,
    "urban": 120.0,
}

INSTITUTIONAL_LPCD: dict[str, float] = {
    "school": 15.0,
    "clinic": 50.0,
    "market": 10.0,
    "office": 45.0,
}

# Default peak-hour factors by community type (NRWSSP field experience)
DEFAULT_PHF: dict[str, float] = {
    "rural": 2.5,
    "peri_urban": 2.8,
    "urban": 3.0,
}

# Default peak-day factor (WHO / AWWA practice)
DEFAULT_PDF: float = 1.8

# Default NRW for Zambia rural schemes (NRWSSP 2006 Section 4.3)
DEFAULT_NRW_PCT: float = 25.0

# WHO fire-flow benchmark for small communities
DEFAULT_FIRE_FLOW_LPS: float = 10.0
DEFAULT_FIRE_DURATION_HOURS: float = 4.0

# Storage factor: 25% of peak day demand for emergency + balancing (6-hour reserve)
STORAGE_BALANCING_FACTOR: float = 0.25

# Years at which to tabulate the demand schedule
SCHEDULE_YEARS: list[int] = [0, 5, 10, 15, 20]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _step(
    n: int,
    title: str,
    formula: str,
    substitution: str,
    result: str,
    unit: str = "",
    reference: str = "",
    status: str = "info",
) -> dict[str, Any]:
    return {
        "step_number": n,
        "title": title,
        "formula": formula,
        "substitution": substitution,
        "result": result,
        "unit": unit,
        "reference": reference,
        "status": status,
    }


def _project_geometric(p0: float, r: float, n: float) -> float:
    """Geometric growth: P_n = P_0 × (1 + r/100)^n  [WHO 2017 §A2.3]"""
    return p0 * (1.0 + r / 100.0) ** n


def _project_arithmetic(p0: float, r: float, n: float) -> float:
    """Arithmetic growth: P_n = P_0 + n × (r/100 × P_0)  [NRWSSP 2006 §3.2.1]"""
    return p0 + n * (r / 100.0) * p0


def _project_logistic(p0: float, r: float, n: float, k: float) -> float:
    """Logistic growth: P_n = K × P_0 × e^(r×n) / (K − P_0 + P_0 × e^(r×n))  [Verhulst 1845]"""
    exp_rn = math.exp(r * n)
    denominator = k - p0 + p0 * exp_rn
    if denominator == 0.0:
        raise ValueError("Logistic model denominator is zero — check carrying capacity K.")
    return (k * p0 * exp_rn) / denominator


def _duration_factor_interpolate(tc_minutes: float) -> float:
    """
    Interpolate IDF duration factor for time of concentration.
    Anchored at standard durations used in Zambia Met Dept data.
    """
    anchors = [(5, 2.8), (10, 2.2), (15, 1.8), (30, 1.35), (60, 1.0), (120, 0.72), (360, 0.45)]
    tc = max(5.0, min(tc_minutes, 360.0))
    for i in range(len(anchors) - 1):
        t0, f0 = anchors[i]
        t1, f1 = anchors[i + 1]
        if t0 <= tc <= t1:
            ratio = (tc - t0) / (t1 - t0)
            return f0 + ratio * (f1 - f0)
    return anchors[-1][1]


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def calculate_water_demand_enhanced(inputs: dict[str, Any]) -> dict[str, Any]:
    """
    Full water demand analysis for a WASH scheme.

    Parameters
    ----------
    inputs : dict
        See module docstring for full schema.

    Returns
    -------
    dict
        Structured result with summary, demand_schedule, steps, warnings, errors, timestamp.
    """
    errors: list[str] = []
    warnings: list[str] = []
    steps: list[dict] = []

    # ── Parse & validate inputs ───────────────────────────────────────────
    try:
        p0 = float(inputs["population_current"])
        if p0 <= 0:
            errors.append("population_current must be > 0.")
    except (KeyError, TypeError, ValueError):
        errors.append("population_current is required and must be a positive number.")
        p0 = 0.0

    growth_rate = float(inputs.get("growth_rate_pct", 2.5))
    design_years = int(inputs.get("design_years", 20))
    growth_method = inputs.get("growth_method", "geometric").lower()
    carrying_capacity = float(inputs.get("carrying_capacity", p0 * 3.0))
    community_type = inputs.get("community_type", "rural").lower()
    include_institutions = bool(inputs.get("include_institutions", False))
    institution_data: list[dict] = inputs.get("institution_data", [])
    nrw_pct = float(inputs.get("nrw_pct", DEFAULT_NRW_PCT))
    peak_hour_factor = float(inputs.get("peak_hour_factor", DEFAULT_PHF.get(community_type, 2.5)))
    peak_day_factor = float(inputs.get("peak_day_factor", DEFAULT_PDF))
    fire_flow_lps = float(inputs.get("fire_flow_lps", DEFAULT_FIRE_FLOW_LPS))
    fire_duration_hours = float(inputs.get("fire_duration_hours", DEFAULT_FIRE_DURATION_HOURS))

    # Validation
    if community_type not in PER_CAPITA_LPCD:
        warnings.append(
            f"Unknown community_type '{community_type}'. Defaulting to 'rural'."
        )
        community_type = "rural"

    if growth_method not in ("geometric", "arithmetic", "logistic"):
        warnings.append(
            f"Unknown growth_method '{growth_method}'. Defaulting to 'geometric'."
        )
        growth_method = "geometric"

    if growth_method == "logistic" and carrying_capacity <= p0:
        errors.append(
            "Logistic model requires carrying_capacity > population_current."
        )

    if nrw_pct < 0 or nrw_pct > 60:
        warnings.append(
            f"NRW of {nrw_pct}% is outside typical range (0–60%). Proceeding."
        )

    if errors:
        return {
            "status": "error",
            "summary": {},
            "demand_schedule": [],
            "steps": steps,
            "warnings": warnings,
            "errors": errors,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    # ── STEP 1: Population projection ────────────────────────────────────
    def _project(method: str, n: float) -> float:
        if method == "geometric":
            return _project_geometric(p0, growth_rate, n)
        if method == "arithmetic":
            return _project_arithmetic(p0, growth_rate, n)
        return _project_logistic(p0, growth_rate, n, carrying_capacity)

    p_design = _project(growth_method, design_years)
    p_design_int = int(round(p_design))

    # Comparison projections (always shown for geometric as baseline)
    p_geom = _project_geometric(p0, growth_rate, design_years)
    p_arith = _project_arithmetic(p0, growth_rate, design_years)

    step1_sub = (
        f"P₀={int(p0)}, r={growth_rate}%, n={design_years} yr  →  "
        f"Geometric={int(round(p_geom))}, Arithmetic={int(round(p_arith))}"
    )
    if growth_method == "logistic":
        p_logistic = _project_logistic(p0, growth_rate, design_years, carrying_capacity)
        step1_sub += f", Logistic (K={int(carrying_capacity)})={int(round(p_logistic))}"

    steps.append(
        _step(
            1,
            "Population Projection",
            {
                "geometric": "P_n = P₀ × (1 + r/100)^n",
                "arithmetic": "P_n = P₀ + n × (r/100 × P₀)",
                "logistic": "P_n = K × P₀ × e^(r·n) / (K − P₀ + P₀ × e^(r·n))",
            }[growth_method],
            step1_sub,
            f"{p_design_int:,} persons (using {growth_method} method)",
            "persons",
            "WHO (2017) §A2.3; Zambia NRWSSP (2006) §3.2.1",
            "info",
        )
    )

    if p_design < p0:
        warnings.append(
            "Design population is less than current population — check growth rate sign."
        )

    # ── STEP 2: Per-capita domestic demand ───────────────────────────────
    lpcd = PER_CAPITA_LPCD[community_type]
    q_dom_m3d = p_design * lpcd / 1000.0

    steps.append(
        _step(
            2,
            "Average Domestic Daily Demand",
            "Q_dom = P_design × LPCD / 1000",
            f"Q_dom = {p_design_int:,} × {lpcd} / 1000",
            f"{round_value(q_dom_m3d, 2)} m³/d",
            "m³/d",
            f"WHO (2017) Table A1; LPCD for {community_type}: {lpcd} L/capita/day",
            "info",
        )
    )

    # ── STEP 3: Institutional demand ─────────────────────────────────────
    q_inst_m3d = 0.0
    inst_breakdown: list[dict] = []

    if include_institutions and institution_data:
        for item in institution_data:
            inst_type = str(item.get("type", "")).lower()
            count = int(item.get("count", 0))
            pop_per_unit = int(item.get("population_per_unit", 0))
            inst_lpcd = INSTITUTIONAL_LPCD.get(inst_type, 20.0)
            q_item = count * pop_per_unit * inst_lpcd / 1000.0
            q_inst_m3d += q_item
            inst_breakdown.append(
                {
                    "type": inst_type,
                    "count": count,
                    "population_per_unit": pop_per_unit,
                    "lpcd": inst_lpcd,
                    "demand_m3d": round_value(q_item, 2),
                }
            )
        if not inst_breakdown:
            warnings.append("include_institutions=True but institution_data is empty.")

    steps.append(
        _step(
            3,
            "Institutional Daily Demand",
            "Q_inst = Σ(count × population_per_unit × LPCD_inst) / 1000",
            f"Institutions: {inst_breakdown}" if inst_breakdown else "No institutional data provided",
            f"{round_value(q_inst_m3d, 2)} m³/d",
            "m³/d",
            "NRWSSP (2006) §4.1; WHO (2017) Annex A",
            "info",
        )
    )

    # ── STEP 4: Average daily demand with NRW ────────────────────────────
    q_avg_m3d = (q_dom_m3d + q_inst_m3d) * (1.0 + nrw_pct / 100.0)

    steps.append(
        _step(
            4,
            "Total Average Daily Demand (with NRW)",
            "Q_avg = (Q_dom + Q_inst) × (1 + NRW/100)",
            f"Q_avg = ({round_value(q_dom_m3d,2)} + {round_value(q_inst_m3d,2)}) × (1 + {nrw_pct}/100)",
            f"{round_value(q_avg_m3d, 2)} m³/d",
            "m³/d",
            f"NRWSSP (2006) §5.1 — NRW allowance {nrw_pct}% for Zambia rural systems",
            "info",
        )
    )

    if nrw_pct > 40:
        warnings.append(
            f"NRW of {nrw_pct}% is high. NRWSSP target is ≤ 25% for rural schemes."
        )

    # ── STEP 5: Peak demands ─────────────────────────────────────────────
    q_peak_day_m3d = q_avg_m3d * peak_day_factor
    q_peak_hour_m3h = q_avg_m3d * peak_hour_factor / 24.0

    # Fire flow volume (m³)
    q_fire_m3 = fire_flow_lps * fire_duration_hours * 3600.0 / 1000.0

    steps.append(
        _step(
            5,
            "Peak Day & Peak Hour Demand",
            "Q_peak_day = Q_avg × PDF;  Q_peak_hour = Q_avg × PHF / 24",
            (
                f"Q_peak_day = {round_value(q_avg_m3d,2)} × {peak_day_factor} = "
                f"{round_value(q_peak_day_m3d,2)} m³/d;  "
                f"Q_peak_hour = {round_value(q_avg_m3d,2)} × {peak_hour_factor} / 24 = "
                f"{round_value(q_peak_hour_m3h,2)} m³/h"
            ),
            f"Peak day = {round_value(q_peak_day_m3d,2)} m³/d; Peak hour = {round_value(q_peak_hour_m3h,2)} m³/h",
            "m³/d | m³/h",
            "WHO (2017) §4.2; AWWA M32 — peak factors for small systems",
            "info",
        )
    )

    steps.append(
        _step(
            6,
            "Fire Flow Demand",
            "Q_fire = fire_flow_lps × duration_hours × 3600 / 1000",
            f"Q_fire = {fire_flow_lps} × {fire_duration_hours} × 3600 / 1000",
            f"{round_value(q_fire_m3, 1)} m³  ({fire_flow_lps} L/s for {fire_duration_hours} h)",
            "m³",
            "WHO (2017) Annex B; ISO 14090:2019 — fire flow defaults for small communities",
            "info",
        )
    )

    # ── STEP 6: Storage ──────────────────────────────────────────────────
    storage_balancing_m3 = q_peak_day_m3d * STORAGE_BALANCING_FACTOR
    storage_total_m3 = storage_balancing_m3 + q_fire_m3

    steps.append(
        _step(
            7,
            "Storage Requirement",
            "V_storage = Q_peak_day × 0.25 (6-hr balancing) + V_fire",
            (
                f"V = {round_value(q_peak_day_m3d,2)} × {STORAGE_BALANCING_FACTOR} + "
                f"{round_value(q_fire_m3,1)}"
            ),
            f"Total storage = {round_value(storage_total_m3, 1)} m³",
            "m³",
            "NRWSSP (2006) §6.2 — minimum 25% daily balancing + fire reserve",
            "pass",
        )
    )

    # ── STEP 7: Flow rates in L/s ────────────────────────────────────────
    add_lps = q_avg_m3d * 1000.0 / 86400.0
    peak_hour_lps = q_peak_hour_m3h * 1000.0 / 3600.0

    steps.append(
        _step(
            8,
            "Flow Rates",
            "ADD (L/s) = Q_avg × 1000 / 86400;  Peak hour (L/s) = Q_peak_hour × 1000 / 3600",
            (
                f"ADD = {round_value(q_avg_m3d,2)} × 1000 / 86400 = {round_value(add_lps,3)} L/s;  "
                f"Peak hour = {round_value(q_peak_hour_m3h,2)} × 1000 / 3600 = {round_value(peak_hour_lps,3)} L/s"
            ),
            f"ADD = {round_value(add_lps,3)} L/s; Peak hour = {round_value(peak_hour_lps,3)} L/s",
            "L/s",
            "Conversion factors for pump and pipe selection",
            "info",
        )
    )

    # ── STEP 8: Demand schedule ───────────────────────────────────────────
    demand_schedule: list[dict] = []
    for yr in SCHEDULE_YEARS:
        p_yr = _project(growth_method, yr)
        p_yr_int = int(round(p_yr))
        q_dom_yr = p_yr * lpcd / 1000.0
        q_inst_yr = (q_inst_m3d / p_design * p_yr) if p_design > 0 else 0.0
        q_avg_yr = (q_dom_yr + q_inst_yr) * (1.0 + nrw_pct / 100.0)
        q_pd_yr = q_avg_yr * peak_day_factor
        q_ph_yr = q_avg_yr * peak_hour_factor / 24.0
        demand_schedule.append(
            {
                "year": yr,
                "population": p_yr_int,
                "add_m3d": round_value(q_avg_yr, 2),
                "peak_day_m3d": round_value(q_pd_yr, 2),
                "peak_hour_m3h": round_value(q_ph_yr, 2),
            }
        )

    # ── Compliance checks ────────────────────────────────────────────────
    if lpcd < 20:
        warnings.append(
            f"Per-capita demand {lpcd} L/d is below WHO minimum of 20 L/capita/d for basic access."
        )

    if add_lps > 50:
        warnings.append(
            "ADD exceeds 50 L/s — consider whether a single borehole can meet this demand."
        )

    status = "info" if warnings else "pass"

    return {
        "status": status,
        "summary": {
            "design_population": p_design_int,
            "growth_method_used": growth_method,
            "lpcd_applied": lpcd,
            "community_type": community_type,
            "average_daily_demand_m3d": round_value(q_avg_m3d, 2),
            "peak_day_demand_m3d": round_value(q_peak_day_m3d, 2),
            "peak_hour_demand_m3h": round_value(q_peak_hour_m3h, 2),
            "peak_hour_flow_lps": round_value(peak_hour_lps, 3),
            "add_lps": round_value(add_lps, 3),
            "storage_required_m3": round_value(storage_total_m3, 1),
            "fire_storage_m3": round_value(q_fire_m3, 1),
            "nrw_pct_applied": nrw_pct,
            "peak_hour_factor": peak_hour_factor,
            "peak_day_factor": peak_day_factor,
        },
        "demand_schedule": demand_schedule,
        "institutional_breakdown": inst_breakdown,
        "steps": steps,
        "warnings": warnings,
        "errors": errors,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
