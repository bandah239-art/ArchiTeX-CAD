"""Shared helpers for pressure distribution modules."""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value


def step(
    n: int,
    title: str,
    formula: str,
    sub: str,
    result: str,
    unit: str = "",
    ref: str = "",
    status: str = "info",
) -> dict[str, Any]:
    return {
        "step_number": n,
        "title": title,
        "formula": formula,
        "substitution": sub,
        "result": result,
        "unit": unit,
        "reference": ref,
        "status": status,
    }


def finish(
    summary: dict[str, Any],
    steps: list[dict[str, Any]],
    diagram: dict[str, Any],
    warnings: list[str] | None = None,
    errors: list[str] | None = None,
    status: str = "pass",
) -> dict[str, Any]:
    return {
        "status": status,
        "summary": summary,
        "steps": steps,
        "warnings": warnings or [],
        "errors": errors or [],
        "pressure_diagram_data": diagram,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def depth_table(rows: list[tuple[float, float, str]]) -> list[dict[str, Any]]:
    return [{"depth_m": d, "pressure_kpa": p, "status": st} for d, p, st in rows]
