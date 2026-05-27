"""Input validation utilities for calculation modules."""

from typing import Any


def validate_positive(value: float, name: str) -> None:
    if value <= 0:
        raise ValueError(f"{name} must be positive, got {value}")


def validate_non_negative(value: float, name: str) -> None:
    if value < 0:
        raise ValueError(f"{name} must be non-negative, got {value}")


def variable_line_load(data: dict[str, Any]) -> float:
    """Return imposed/live line load (kN/m); API uses live_load, legacy UI uses imposed_load."""
    if "imposed_load" in data:
        return float(data["imposed_load"])
    if "live_load" in data:
        return float(data["live_load"])
    raise ValueError("imposed_load or live_load is required")


def validate_beam_inputs(data: dict[str, Any]) -> None:
    validate_positive(data["span"], "span")
    validate_non_negative(data["dead_load"], "dead_load")
    validate_non_negative(variable_line_load(data), "imposed_load")
    validate_positive(data["width"], "width")
    validate_positive(data["depth"], "depth")
    validate_positive(data["fck"], "fck")
    validate_positive(data["fyk"], "fyk")
