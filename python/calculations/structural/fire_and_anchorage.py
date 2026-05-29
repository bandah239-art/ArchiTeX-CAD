"""BS 8110 fire resistance tables and anchorage / lap length helpers."""

import math

# ── Fire resistance tables (BS 8110-1:1997 Tables 3.4 & 3.5) ─────────────────
# Format: fire_period_hours -> (min_cover_mm, min_width_or_thickness_mm)

# Beams – simply supported (Table 3.5 row a)
BEAM_FIRE_SS: dict[float, tuple[int, int]] = {
    0.5: (20, 200),
    1.0: (20, 200),
    1.5: (35, 200),
    2.0: (40, 200),
    3.0: (60, 200),
    4.0: (70, 280),
}
# Beams – continuous (Table 3.5 row b)
BEAM_FIRE_CONT: dict[float, tuple[int, int]] = {
    0.5: (20, 200),
    1.0: (20, 200),
    1.5: (20, 200),
    2.0: (35, 200),
    3.0: (35, 200),
    4.0: (35, 280),
}

# Slabs – simply supported (Table 3.4 row a)
SLAB_FIRE_SS: dict[float, tuple[int, int]] = {
    0.5: (20,  75),
    1.0: (20,  95),
    1.5: (25, 110),
    2.0: (35, 125),
    3.0: (45, 150),
    4.0: (55, 170),
}
# Slabs – continuous (Table 3.4 row b)
SLAB_FIRE_CONT: dict[float, tuple[int, int]] = {
    0.5: (20,  75),
    1.0: (20,  95),
    1.5: (25, 110),
    2.0: (35, 115),
    3.0: (45, 135),
    4.0: (55, 155),
}

# Columns – exposed on more than one face (Table 3.5)
COLUMN_FIRE: dict[float, tuple[int, int]] = {
    0.5: (20, 125),
    1.0: (20, 150),
    1.5: (20, 175),
    2.0: (25, 200),
    3.0: (25, 300),
    4.0: (25, 450),
}

_VALID_PERIODS = [0.5, 1.0, 1.5, 2.0, 3.0, 4.0]


def _nearest_period(fp: float) -> float:
    """Snap requested fire period to nearest standard value."""
    return min(_VALID_PERIODS, key=lambda p: abs(p - fp))


def check_beam_fire(
    cover_mm: float,
    b_mm: float,
    fire_period_hours: float,
    support_condition: str,
) -> tuple[str, str, int, int]:
    """Return (status, message, req_cover, req_width)."""
    fp = _nearest_period(fire_period_hours)
    table = BEAM_FIRE_CONT if support_condition not in ("simply_supported",) else BEAM_FIRE_SS
    req_cover, req_width = table[fp]

    issues = []
    if cover_mm < req_cover:
        issues.append(f"cover {cover_mm:.0f} mm < required {req_cover} mm")
    if b_mm < req_width:
        issues.append(f"beam width {b_mm:.0f} mm < required {req_width} mm")

    if issues:
        return "fail", "; ".join(issues), req_cover, req_width
    return "pass", f"Cover and width satisfy {fp}h fire rating", req_cover, req_width


def check_slab_fire(
    cover_mm: float,
    h_mm: float,
    fire_period_hours: float,
    support_condition: str,
) -> tuple[str, str, int, int]:
    """Return (status, message, req_cover, req_thickness)."""
    fp = _nearest_period(fire_period_hours)
    table = SLAB_FIRE_CONT if support_condition not in ("simply_supported",) else SLAB_FIRE_SS
    req_cover, req_thick = table[fp]

    issues = []
    if cover_mm < req_cover:
        issues.append(f"cover {cover_mm:.0f} mm < required {req_cover} mm")
    if h_mm < req_thick:
        issues.append(f"thickness {h_mm:.0f} mm < required {req_thick} mm")

    if issues:
        return "fail", "; ".join(issues), req_cover, req_thick
    return "pass", f"Cover and thickness satisfy {fp}h fire rating", req_cover, req_thick


def check_column_fire(
    cover_mm: float,
    b_mm: float,
    h_mm: float,
    fire_period_hours: float,
) -> tuple[str, str, int, int]:
    """Return (status, message, req_cover, req_dimension)."""
    fp = _nearest_period(fire_period_hours)
    req_cover, req_dim = COLUMN_FIRE[fp]
    min_dim = min(b_mm, h_mm)

    issues = []
    if cover_mm < req_cover:
        issues.append(f"cover {cover_mm:.0f} mm < required {req_cover} mm")
    if min_dim < req_dim:
        issues.append(f"min dimension {min_dim:.0f} mm < required {req_dim} mm")

    if issues:
        return "fail", "; ".join(issues), req_cover, req_dim
    return "pass", f"Cover and dimensions satisfy {fp}h fire rating", req_cover, req_dim


# ── Anchorage & lap length (BS 8110-1:1997 §3.12.8) ──────────────────────────

def anchorage_length(
    bar_dia_mm: float,
    fy_mpa: float,
    fcu_mpa: float,
    zone: str = "tension",
) -> float:
    """Calculate anchorage length per BS 8110 §3.12.8.3.

    zone: 'tension' or 'compression'
    Returns length in mm.
    """
    # fbu = β × √fcu  (bond stress)
    # Deformed bars: β = 0.50 (tension), 0.63 (compression)
    beta = 0.50 if zone == "tension" else 0.63
    fbu = beta * math.sqrt(fcu_mpa)
    # Anchorage length L_a = (φ/4) × (fy / fbu)
    la = (bar_dia_mm / 4.0) * (fy_mpa / fbu)
    # Minimum: max(25φ, 300 mm)
    return max(la, 25.0 * bar_dia_mm, 300.0)


def lap_length(
    bar_dia_mm: float,
    fy_mpa: float,
    fcu_mpa: float,
    zone: str = "tension",
) -> float:
    """Calculate lap length per BS 8110 §3.12.8.10.

    Tension lap ≥ 1.4 × anchorage length.
    Compression lap = anchorage length.
    """
    la = anchorage_length(bar_dia_mm, fy_mpa, fcu_mpa, zone)
    if zone == "tension":
        return max(1.4 * la, 25.0 * bar_dia_mm, 300.0)
    return la
