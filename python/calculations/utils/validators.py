"""Input validation utilities for calculation modules."""

from typing import Any

# ── Material grade plausibility bounds ──────────────────────────────────────
# fcu / fck: BS 8110 range C15–C50; EC2 allows C12–C90; we gate at 10–80 MPa
FCU_MIN, FCU_MAX = 10.0, 80.0
# fy / fyk: 250 (mild), 460 (high-yield), 500 (EC2); allow 200–550
FY_MIN, FY_MAX = 200.0, 550.0

# Minimum usable effective depth (mm) — below this d is meaningless
D_MIN_MM = 20.0


def validate_positive(value: float, name: str) -> None:
    if value <= 0:
        raise ValueError(f"{name} must be positive, got {value}")


def validate_non_negative(value: float, name: str) -> None:
    if value < 0:
        raise ValueError(f"{name} must be non-negative, got {value}")


def validate_material_grades(fcu_or_fck: float, fy_or_fyk: float) -> None:
    """Reject clearly implausible concrete and steel grades."""
    if not (FCU_MIN <= fcu_or_fck <= FCU_MAX):
        raise ValueError(
            f"Concrete grade {fcu_or_fck} MPa is outside the plausible range "
            f"{FCU_MIN}–{FCU_MAX} MPa. Check units (entered as MPa?)."
        )
    if not (FY_MIN <= fy_or_fyk <= FY_MAX):
        raise ValueError(
            f"Steel grade {fy_or_fyk} MPa is outside the plausible range "
            f"{FY_MIN}–{FY_MAX} MPa. BS 8110 uses 250 or 460; EC2 uses 500."
        )


def validate_cover_feasibility(
    cover_mm: float,
    h_mm: float,
    bar_dia_mm: float,
    link_dia_mm: float = 0.0,
) -> float:
    """Return effective depth d, or raise if cover + reinforcement exceeds section depth."""
    d = h_mm - cover_mm - link_dia_mm - bar_dia_mm / 2.0
    if d <= D_MIN_MM:
        raise ValueError(
            f"Effective depth d = {d:.1f} mm ≤ {D_MIN_MM} mm. "
            f"Cover ({cover_mm} mm) + link ({link_dia_mm} mm) + bar/2 ({bar_dia_mm/2} mm) "
            f"= {cover_mm + link_dia_mm + bar_dia_mm/2:.1f} mm leaves ≤ {D_MIN_MM} mm to "
            f"section depth {h_mm} mm. Increase h or reduce cover/bar size."
        )
    return d


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
    validate_material_grades(data["fck"], data["fyk"])
