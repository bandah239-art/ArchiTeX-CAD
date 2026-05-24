"""Output formatting utilities."""

import math


def round_value(value: float, decimals: int = 2) -> float:
    return round(value, decimals)


def format_bars(area_mm2: float, bar_diameter: int = 16) -> str:
    """Suggest bar arrangement for required steel area."""
    bar_area = math.pi * (bar_diameter / 2) ** 2
    num_bars = max(2, math.ceil(area_mm2 / bar_area))
    provided = num_bars * bar_area
    return f"{num_bars} H{bar_diameter} bars ({round(provided)} mm²)"


def select_bar_diameter(area_mm2: float) -> tuple[int, str]:
    """Select appropriate bar size and return diameter + provision string."""
    for diameter in [32, 25, 20, 16, 12]:
        bar_area = math.pi * (diameter / 2) ** 2
        num_bars = max(2, math.ceil(area_mm2 / bar_area))
        if num_bars <= 6:
            provided = num_bars * bar_area
            return diameter, f"{num_bars} H{diameter} ({round(provided)} mm²)"
    diameter = 32
    bar_area = math.pi * (diameter / 2) ** 2
    num_bars = math.ceil(area_mm2 / bar_area)
    provided = num_bars * bar_area
    return diameter, f"{num_bars} H{diameter} ({round(provided)} mm²)"


def slab_bar_spacing(area_mm2_per_m: float, bar_diameter: int = 10) -> tuple[int, int, str]:
    """Return spacing (mm), provided area (mm²/m), and provision string."""
    bar_area = math.pi * (bar_diameter / 2) ** 2
    spacing = int(1000 * bar_area / max(area_mm2_per_m, 1))
    spacing = max(75, min(spacing, 400))
    spacing = int(round(spacing / 25) * 25)
    if spacing <= 0:
        spacing = 75
    provided = round(1000 / spacing * bar_area)
    provision = f"H{bar_diameter} @ {spacing} c/c ({provided} mm²/m)"
    return spacing, provided, provision
