"""Input validation utilities for calculation modules."""

from typing import Any


def validate_positive(value: float, name: str) -> None:
    if value <= 0:
        raise ValueError(f"{name} must be positive, got {value}")


def validate_non_negative(value: float, name: str) -> None:
    if value < 0:
        raise ValueError(f"{name} must be non-negative, got {value}")


def validate_beam_inputs(data: dict[str, Any]) -> None:
    validate_positive(data["span"], "span")
    validate_non_negative(data["dead_load"], "dead_load")
    validate_non_negative(data["imposed_load"], "imposed_load")
    validate_positive(data["width"], "width")
    validate_positive(data["depth"], "depth")
    validate_positive(data["fck"], "fck")
    validate_positive(data["fyk"], "fyk")
