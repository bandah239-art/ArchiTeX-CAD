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
