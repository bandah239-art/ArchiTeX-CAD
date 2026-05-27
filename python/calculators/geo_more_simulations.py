from __future__ import annotations

import math
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class RMRSimRequest(BaseModel):
    rqd_percent: float = Field(default=60.0, ge=0, le=100)
    intact_rock_strength_mpa: float = Field(default=50.0, ge=0)
    joint_spacing_rating: float = Field(default=10.0, ge=0)
    joint_condition_rating: float = Field(default=12.0, ge=0)
    groundwater_rating: float = Field(default=10.0, ge=0)


class GroundImprovSimRequest(BaseModel):
    column_diameter_m: float = Field(default=0.8, gt=0)
    column_spacing_m: float = Field(default=2.0, gt=0)
    depth_m: float = Field(default=8.0, gt=0)
    pattern: str = Field(default="triangular")
    area_to_improve_m2: float = Field(default=1000.0, gt=0)


# ---------------------------------------------------------------------------
# 1. RMR rock support simulation
# ---------------------------------------------------------------------------

def _rqd_rating(rqd: float) -> int:
    if rqd < 25:
        return 3
    elif rqd < 50:
        return 8
    elif rqd < 75:
        return 13
    elif rqd < 90:
        return 17
    else:
        return 20


def _ucs_rating(ucs: float) -> int:
    if ucs < 1:
        return 0
    elif ucs < 5:
        return 1
    elif ucs < 25:
        return 2
    elif ucs < 50:
        return 4
    elif ucs < 100:
        return 7
    elif ucs <= 250:
        return 12
    else:
        return 15


def simulate_rmr_support(req: RMRSimRequest) -> dict:
    rqd_rating = _rqd_rating(req.rqd_percent)
    ucs_rating = _ucs_rating(req.intact_rock_strength_mpa)

    rmr_total = (
        rqd_rating
        + ucs_rating
        + req.joint_spacing_rating
        + req.joint_condition_rating
        + req.groundwater_rating
    )

    # Rock class determination
    if rmr_total >= 81:
        rock_class = "I"
        rock_class_num = 1
        rock_desc = "Very Good Rock"
        bolt_length = 1.5
        bolt_spacing = 4.0
        shotcrete_mm = 0
        stand_up_time = "20 years"
    elif rmr_total >= 61:
        rock_class = "II"
        rock_class_num = 2
        rock_desc = "Good Rock"
        bolt_length = 2.0
        bolt_spacing = 2.5
        shotcrete_mm = 50
        stand_up_time = "1 year"
    elif rmr_total >= 41:
        rock_class = "III"
        rock_class_num = 3
        rock_desc = "Fair Rock"
        bolt_length = 2.5
        bolt_spacing = 1.5
        shotcrete_mm = 100
        stand_up_time = "1 week"
    elif rmr_total >= 21:
        rock_class = "IV"
        rock_class_num = 4
        rock_desc = "Poor Rock"
        bolt_length = 3.0
        bolt_spacing = 1.0
        shotcrete_mm = 150
        stand_up_time = "10 hours"
    else:
        rock_class = "V"
        rock_class_num = 5
        rock_desc = "Very Poor Rock"
        bolt_length = 3.5
        bolt_spacing = 0.8
        shotcrete_mm = 200
        stand_up_time = "30 minutes"

    ratings_labels = [
        {"label": "RQD Rating", "value": rqd_rating, "max": 20},
        {"label": "UCS Rating", "value": ucs_rating, "max": 15},
        {"label": "Joint Spacing Rating", "value": req.joint_spacing_rating, "max": 20},
        {"label": "Joint Condition Rating", "value": req.joint_condition_rating, "max": 30},
        {"label": "Groundwater Rating", "value": req.groundwater_rating, "max": 15},
    ]

    return {
        "rmr_total": round(rmr_total, 2),
        "rock_class": rock_class,
        "rock_class_num": rock_class_num,
        "rock_description": rock_desc,
        "bolt_length_m": bolt_length,
        "bolt_spacing_m": bolt_spacing,
        "shotcrete_mm": shotcrete_mm,
        "stand_up_time": stand_up_time,
        "rqd_rating": rqd_rating,
        "ucs_rating": ucs_rating,
        "joint_spacing_rating": req.joint_spacing_rating,
        "joint_condition_rating": req.joint_condition_rating,
        "groundwater_rating": req.groundwater_rating,
        "ratings_labels": ratings_labels,
    }


# ---------------------------------------------------------------------------
# 2. Ground improvement layout simulation
# ---------------------------------------------------------------------------

def simulate_ground_improvement_layout(req: GroundImprovSimRequest) -> dict:
    D = req.column_diameter_m
    S = req.column_spacing_m
    A_col = math.pi * D ** 2 / 4.0  # m²

    pattern = req.pattern.lower()

    if pattern == "triangular":
        unit_cell_area = (math.sqrt(3) / 2.0) * S ** 2
    else:
        # square (default)
        unit_cell_area = S ** 2

    area_ratio = A_col / unit_cell_area

    # Number of columns required
    n_columns_total = math.ceil(req.area_to_improve_m2 / unit_cell_area)

    # Stress concentration ratio and improvement factor
    m_stress = 3.0
    improvement_factor = 1.0 / (1.0 - area_ratio * (1.0 - 1.0 / m_stress))

    # Column positions for visualization (max 6x6 = 36 columns)
    max_display = 36
    grid_n = 6  # rows and columns in display grid
    column_positions: list[list[float]] = []

    if pattern == "triangular":
        for row in range(grid_n):
            for col in range(grid_n):
                x = col * S + (S / 2.0 if row % 2 == 1 else 0.0)
                y = row * S * math.sqrt(3) / 2.0
                column_positions.append([round(x, 4), round(y, 4)])
                if len(column_positions) >= max_display:
                    break
            if len(column_positions) >= max_display:
                break
    else:
        # Square grid
        for row in range(grid_n):
            for col in range(grid_n):
                x = col * S
                y = row * S
                column_positions.append([round(x, 4), round(y, 4)])
                if len(column_positions) >= max_display:
                    break
            if len(column_positions) >= max_display:
                break

    # Grid display size (bounding box of display columns)
    if column_positions:
        xs = [p[0] for p in column_positions]
        ys = [p[1] for p in column_positions]
        grid_size_m = round(max(max(xs) - min(xs), max(ys) - min(ys)) + D, 4)
    else:
        grid_size_m = D

    return {
        "area_ratio": round(area_ratio, 6),
        "n_columns_total": n_columns_total,
        "improvement_factor": round(improvement_factor, 4),
        "column_positions": column_positions,
        "column_diameter_m": D,
        "column_spacing_m": S,
        "pattern": pattern,
        "depth_m": req.depth_m,
        "grid_size_m": grid_size_m,
    }
