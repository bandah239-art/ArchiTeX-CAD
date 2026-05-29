"""Engineer review layer on calculation steps — no change to calculation logic."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class CalculationStep:
    step_number: int
    title: str
    formula: str
    substitution: str
    platform_result: str
    unit: str
    reference: str
    engineer_override: str | None = None
    override_reason: str | None = None
    engineer_flag: bool = False
    flag_note: str | None = None
    reviewed_by: str | None = None
    reviewed_at: str | None = None
    status: str = "pending"
    review_status: str = "pending"

    def to_api_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["result"] = self.effective_result
        d["status"] = self.calc_status
        return d

    @property
    def effective_result(self) -> str:
        if self.engineer_override is not None and str(self.engineer_override).strip():
            return str(self.engineer_override)
        return self.platform_result

    @property
    def calc_status(self) -> str:
        if self.review_status == "flagged":
            return "fail"
        if self.review_status == "overridden":
            return "warning"
        if self.review_status == "accepted":
            return "pass"
        return "info"


def step_from_legacy(raw: dict[str, Any]) -> CalculationStep:
    result = str(raw.get("result", ""))
    return CalculationStep(
        step_number=int(raw.get("step_number", 0)),
        title=str(raw.get("title", "")),
        formula=str(raw.get("formula", "")),
        substitution=str(raw.get("substitution", "")),
        platform_result=result,
        unit=str(raw.get("unit", "")),
        reference=str(raw.get("reference", "")),
        review_status="pending",
    )


def wrap_calculation_result(result: dict[str, Any]) -> dict[str, Any]:
    """Attach engineer-control fields to each step without altering numeric logic."""
    steps = result.get("steps") or []
    wrapped = [step_from_legacy(s).to_api_dict() for s in steps]
    out = {**result, "steps": wrapped}
    counts = review_summary(wrapped)
    out["review_summary"] = counts
    if counts.get("pending", 0) > 0:
        out.setdefault("warnings", [])
        w = f"{counts['pending']} steps not yet reviewed — do not use for construction"
        if w not in out["warnings"]:
            out["warnings"] = list(out["warnings"]) + [w]
    # Attach assumptions sheet — defaults used that the engineer should verify
    out["assumptions"] = _build_assumptions(result)
    return out


_KNOWN_DEFAULTS: list[tuple[str, str, str]] = [
    # (field_key_in_inputs_or_summary, default_description, note)
    ("design_code",       "Eurocode 2 / BS 8110",       "Confirm applicable code for jurisdiction"),
    ("exposure_class",    "XC1 (dry interior)",          "Verify exposure class from site conditions"),
    ("fire_period_hours", "1.0 h fire rating",           "Confirm required fire rating from building use"),
    ("le_factor",         "1.0 (pinned-pinned column)",  "Verify effective length factor from structural arrangement"),
    ("country",           "Zambia",                      "Confirm ZMW rates and local code apply"),
    ("climate_zone",      "Semi-arid",                   "Confirm from Zambia Met rainfall map"),
    ("soil_bearing",      "150 kPa assumed",             "Replace with site investigation data"),
    ("storage_coeff",     "0.001 (confined aquifer)",    "Use borehole test pumping results"),
    ("gamma_c",           "1.5 (EC2 concrete)",          "Standard partial factor — confirmed"),
    ("gamma_s",           "1.15 (EC2 steel)",            "Standard partial factor — confirmed"),
]


def _build_assumptions(result: dict[str, Any]) -> list[dict[str, str]]:
    """List every significant default used so the engineer can verify."""
    out = []
    src = {**result.get("inputs", {}), **result.get("summary", {})}
    for key, description, note in _KNOWN_DEFAULTS:
        if key in src:
            out.append({"parameter": key, "value_used": str(src[key]), "default_description": description, "note": note})
    # Always include timestamp / code reference
    out.append({
        "parameter": "calculation_timestamp",
        "value_used": result.get("timestamp", ""),
        "default_description": "Run time (UTC)",
        "note": "Results valid for inputs as entered — re-run if inputs change",
    })
    return out


def review_summary(steps: list[dict[str, Any]]) -> dict[str, int]:
    counts = {"accepted": 0, "overridden": 0, "flagged": 0, "pending": 0}
    for s in steps:
        rs = s.get("review_status", "pending")
        if rs in counts:
            counts[rs] += 1
        else:
            counts["pending"] += 1
    return counts
