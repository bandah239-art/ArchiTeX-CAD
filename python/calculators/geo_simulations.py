"""GEO modality simulation functions for visualisation in the frontend."""

import math
from pydantic import BaseModel


# ─── Consolidation Settlement Time-Curve ────────────────────────────────────

class ConsolidationSimRequest(BaseModel):
    clay_thickness_m: float = 5.0
    drainage: str = "double"        # "single" | "double"
    cv_m2_yr: float = 1.5           # coefficient of consolidation (m²/yr)
    cc: float = 0.25                # compression index
    e0: float = 0.8                 # initial void ratio
    sigma0_kpa: float = 100.0       # initial effective stress (kPa)
    delta_sigma_kpa: float = 50.0   # stress increase (kPa)


def simulate_consolidation_settlement(req: ConsolidationSimRequest) -> dict:
    H = req.clay_thickness_m
    Hdr = H / 2.0 if req.drainage == "double" else H
    cv = req.cv_m2_yr

    # Total primary consolidation settlement (Terzaghi / Cc method)
    if req.sigma0_kpa <= 0 or req.delta_sigma_kpa <= 0:
        return {"status": "error", "message": "stresses must be positive"}

    S_total_mm = (
        (req.cc * H / (1.0 + req.e0))
        * math.log10((req.sigma0_kpa + req.delta_sigma_kpa) / req.sigma0_kpa)
        * 1000.0
    )

    # Time-factor landmarks
    t50_yr = 0.197 * Hdr**2 / cv
    t90_yr = 0.848 * Hdr**2 / cv
    t99_yr = 1.781 * Hdr**2 / cv

    # 50 evenly-spaced points from 0 to t99
    curve = []
    for i in range(51):
        t = t99_yr * i / 50.0
        if t == 0.0:
            U = 0.0
        else:
            Tv = cv * t / Hdr**2
            # Series solution – first 10 terms (converges well for all Tv)
            U = 1.0 - sum(
                (8.0 / ((2 * m + 1) ** 2 * math.pi**2))
                * math.exp(-((2 * m + 1) ** 2) * math.pi**2 * Tv / 4.0)
                for m in range(10)
            )
            U = min(max(U, 0.0), 1.0)

        curve.append({
            "time_years": round(t, 3),
            "U_pct": round(U * 100.0, 1),
            "settlement_mm": round(U * S_total_mm, 2),
        })

    return {
        "status": "ok",
        "curve": curve,
        "summary": {
            "total_settlement_mm": round(S_total_mm, 1),
            "t50_years": round(t50_yr, 3),
            "t90_years": round(t90_yr, 3),
            "t99_years": round(t99_yr, 3),
            "drainage_path_m": round(Hdr, 2),
            "cv_m2_yr": cv,
        },
    }


# ─── Slope Slip Circle (Fellenius / Ordinary Method) ────────────────────────

class SlopeSlipRequest(BaseModel):
    slope_height_m: float = 10.0
    slope_angle_degrees: float = 30.0
    cohesion_kpa: float = 20.0
    friction_angle_degrees: float = 25.0
    unit_weight_knm3: float = 18.0


def simulate_slope_slip_circle(req: SlopeSlipRequest) -> dict:
    H = req.slope_height_m
    beta = math.radians(max(req.slope_angle_degrees, 5.0))
    c = req.cohesion_kpa
    phi = math.radians(req.friction_angle_degrees)
    gamma = req.unit_weight_knm3

    # Slope geometry: toe at (0,0), crest at (0, H),
    # slope face from (0, H) down-right to (x_toe, 0)
    x_toe = H / math.tan(beta)
    W_ext = 0.4 * H

    slope_polygon = [
        [-W_ext, H],
        [0.0, H],
        [x_toe, 0.0],
        [x_toe + W_ext, 0.0],
    ]

    def surface_y(x: float) -> float:
        if x <= 0.0:
            return H
        if x >= x_toe:
            return 0.0
        return H * (1.0 - x / x_toe)

    # Grid search for critical circle
    best_fos = 1e9
    best_circle: dict | None = None

    n_grid = 14
    xc_values = [(-W_ext) + (x_toe + W_ext) * i / (n_grid - 1) for i in range(n_grid)]
    yc_values = [H * 0.5 + H * 2.0 * j / (n_grid - 1) for j in range(n_grid)]

    for xc in xc_values:
        for yc in yc_values:
            # Try radii: distance-to-toe ± 20%
            R_toe = math.sqrt(xc**2 + yc**2)
            for r_factor in (0.85, 1.0, 1.15, 1.3):
                R = R_toe * r_factor
                if R < 0.5 * H:
                    continue

                # Arc x-range: where circle bottom is below the surface
                # Left entry: where circle crosses y = H (crest level)
                disc_top = R**2 - (H - yc) ** 2
                x_entry_left = xc - math.sqrt(disc_top) if disc_top >= 0 else None

                # Right exit: where circle crosses y = 0 (toe level)
                disc_bot = R**2 - yc**2
                x_entry_right = xc + math.sqrt(disc_bot) if disc_bot >= 0 else None

                if x_entry_left is None or x_entry_right is None:
                    continue

                x_start = max(x_entry_left, -W_ext)
                x_end = min(x_entry_right, x_toe + W_ext * 0.5)

                if x_end - x_start < 0.15 * H:
                    continue

                # Fellenius FOS
                n_slices = 16
                num = 0.0
                den = 0.0

                for k in range(n_slices):
                    x_mid = x_start + (x_end - x_start) * (k + 0.5) / n_slices
                    b = (x_end - x_start) / n_slices
                    dx = x_mid - xc
                    if abs(dx) >= R:
                        continue
                    y_bot = yc - math.sqrt(R**2 - dx**2)
                    y_top = surface_y(x_mid)
                    h_slice = y_top - y_bot
                    if h_slice <= 0:
                        continue
                    W_slice = gamma * b * h_slice
                    sin_a = max(-1.0, min(1.0, dx / R))
                    alpha = math.asin(sin_a)
                    cos_a = math.cos(alpha)
                    arc_len = b / max(cos_a, 0.01)
                    num += c * arc_len + W_slice * cos_a * math.tan(phi)
                    den += W_slice * math.sin(alpha)

                if den <= 0:
                    continue
                fos = num / den

                if 0.5 < fos < best_fos:
                    best_fos = fos
                    best_circle = {"cx": round(xc, 3), "cy": round(yc, 3), "radius": round(R, 3)}

    # Build slices for the winner circle
    slices = []
    if best_circle:
        cx, cy, R = best_circle["cx"], best_circle["cy"], best_circle["radius"]
        disc_top = R**2 - (H - cy) ** 2
        disc_bot = R**2 - cy**2
        x_start = max(cx - math.sqrt(disc_top) if disc_top >= 0 else -W_ext, -W_ext)
        x_end = min(cx + math.sqrt(disc_bot) if disc_bot >= 0 else x_toe, x_toe + W_ext * 0.5)
        n_slices = 12
        for k in range(n_slices):
            x_mid = x_start + (x_end - x_start) * (k + 0.5) / n_slices
            b = (x_end - x_start) / n_slices
            dx = x_mid - cx
            if abs(dx) >= R:
                continue
            y_bot = cy - math.sqrt(R**2 - dx**2)
            y_top = surface_y(x_mid)
            if y_top - y_bot > 0:
                slices.append({
                    "x_left": round(x_mid - b / 2, 3),
                    "x_right": round(x_mid + b / 2, 3),
                    "y_top": round(y_top, 3),
                    "y_bottom": round(y_bot, 3),
                })

    fos_color = "green" if best_fos >= 1.5 else ("yellow" if best_fos >= 1.2 else "red")
    safe = best_fos >= 1.3

    return {
        "status": "ok",
        "slope_polygon": [[round(p[0], 3), round(p[1], 3)] for p in slope_polygon],
        "slip_circle": best_circle,
        "slices": slices,
        "x_toe": round(x_toe, 3),
        "H": H,
        "W_ext": round(W_ext, 3),
        "summary": {
            "fos": round(best_fos, 3),
            "fos_color": fos_color,
            "safe": safe,
            "height_m": H,
            "slope_angle_deg": req.slope_angle_degrees,
            "cohesion_kpa": c,
            "friction_angle_deg": req.friction_angle_degrees,
            "unit_weight_knm3": gamma,
        },
    }


# ─── Pile Load Transfer ──────────────────────────────────────────────────────

class PileLoadTransferRequest(BaseModel):
    pile_diameter_m: float = 0.6
    pile_length_m: float = 20.0
    soil_cohesion_kpa: float = 50.0
    adhesion_factor: float = 0.5
    nc: float = 9.0
    applied_load_kn: float = 800.0


def simulate_pile_load_transfer(req: PileLoadTransferRequest) -> dict:
    D = req.pile_diameter_m
    L = req.pile_length_m
    c = req.soil_cohesion_kpa
    alpha = req.adhesion_factor
    nc = req.nc
    Q_app = req.applied_load_kn

    perimeter = math.pi * D
    area_tip = math.pi * D**2 / 4.0

    qs = alpha * c          # unit skin friction (kPa)
    Q_skin = qs * perimeter * L
    Q_tip = nc * c * area_tip
    Q_ult = Q_skin + Q_tip

    # Load in pile shaft decreasing with depth as skin friction is mobilised
    n = 25
    nodes = []
    for i in range(n + 1):
        depth = L * i / n
        skin_shed = min(qs * perimeter * depth, Q_app)
        load_in_pile = max(Q_app - skin_shed, 0.0)
        nodes.append({
            "depth_m": round(depth, 2),
            "load_kn": round(load_in_pile, 1),
            "cumulative_skin_kn": round(skin_shed, 1),
        })

    return {
        "status": "ok",
        "nodes": nodes,
        "summary": {
            "Q_skin_kn": round(Q_skin, 1),
            "Q_tip_kn": round(Q_tip, 1),
            "Q_ult_kn": round(Q_ult, 1),
            "unit_skin_friction_kpa": round(qs, 1),
            "perimeter_m": round(perimeter, 3),
            "area_tip_m2": round(area_tip, 4),
            "diameter_m": D,
            "length_m": L,
            "applied_load_kn": Q_app,
        },
    }
