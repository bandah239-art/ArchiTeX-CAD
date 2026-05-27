"""
2D Potential-Flow Panel Method for wind pressure coefficients around buildings.

Reference: Katz & Plotkin "Low-Speed Aerodynamics", Hess & Smith (1967).

Panel method (constant-strength source panels):
  - Building cross-section defined as a closed polygon of N panels
  - Freestream velocity U∞ at angle of attack α
  - Solve for source strength σᵢ at each panel such that normal velocity = 0 on body
  - Compute surface velocity and Cp = 1 - (V/U∞)²
  - Generate a grid of streamlines in the external flow field

Output:
  - Panel midpoints with Cp
  - Streamline grid (x, y, Vx, Vy) for visualization
  - Peak positive and negative Cp
  - Net drag and lift coefficients
"""

from __future__ import annotations

import math
from typing import Any


def _panel_influence(xi: float, yi: float, xj1: float, yj1: float, xj2: float, yj2: float) -> tuple[float, float]:
    """
    Influence coefficients (un, ut) of constant-strength source panel j on
    control point i using the Hess-Smith formulation.
    Returns (normal velocity influence, tangential velocity influence) per unit σ.
    """
    dx = xj2 - xj1
    dy = yj2 - yj1
    Lj = math.sqrt(dx * dx + dy * dy)
    if Lj < 1e-12:
        return 0.0, 0.0

    # Panel tangent and normal
    tx, ty = dx / Lj, dy / Lj
    nx, ny = ty, -tx  # outward normal

    # Transform control point to panel-local coords
    dxi = xi - xj1
    dyi = yi - yj1
    xp = dxi * tx + dyi * ty   # along panel
    yp = -dxi * ty + dyi * tx  # perpendicular (+ = external)

    r1_sq = xp * xp + yp * yp
    r2_sq = (xp - Lj) ** 2 + yp * yp
    r1 = math.sqrt(r1_sq) if r1_sq > 1e-20 else 1e-10
    r2 = math.sqrt(r2_sq) if r2_sq > 1e-20 else 1e-10

    theta1 = math.atan2(yp, xp)
    theta2 = math.atan2(yp, xp - Lj)
    dtheta = theta2 - theta1

    log_ratio = 0.5 * math.log(r2_sq / r1_sq) if r1_sq > 1e-20 else 0.0

    # Velocity in panel-local system (per unit σ / 2π)
    up = -yp * dtheta + log_ratio  # was originally (log_r2/r1) term (tangential)
    vp = xp * dtheta - (xp - Lj) * dtheta  # this needs fix below

    # Standard Hess-Smith:
    # u_local = (1/2π) * [ yp*(θ2-θ1) + ... ] — re-derive correctly
    inv2pi = 1.0 / (2.0 * math.pi)
    # u_local (tangential to panel normal, i.e., perpendicular to panel normal)
    u_loc = inv2pi * (log_ratio)          # +ve away from source
    v_loc = inv2pi * dtheta               # +ve in panel-normal direction (into body if yp<0)

    # Transform back to global
    # vx = u_loc * tx - v_loc * ty
    # vy = u_loc * ty + v_loc * tx
    vx = u_loc * tx - v_loc * ty
    vy = u_loc * ty + v_loc * tx

    # Normal and tangential components at control point normal direction
    vn = vx * nx + vy * ny
    vt = vx * tx + vy * ty
    return vn, vt


def run_panel_cfd(
    polygon_x: list[float],
    polygon_y: list[float],
    wind_speed_ms: float = 10.0,
    wind_angle_deg: float = 0.0,
    grid_nx: int = 30,
    grid_ny: int = 25,
    grid_margin: float = 2.5,
) -> dict[str, Any]:
    """
    Run 2D panel method for arbitrary building polygon cross-section.

    polygon_x, polygon_y: vertex coordinates (closed, CCW positive)
    wind_speed_ms: free-stream speed (m/s)
    wind_angle_deg: wind direction (0 = left-to-right)
    Returns: panel Cp, streamline grid, net force coefficients
    """
    N = len(polygon_x)
    if N < 3:
        return {"status": "error", "detail": "polygon must have at least 3 vertices"}

    # Close polygon if not already closed
    if polygon_x[-1] != polygon_x[0] or polygon_y[-1] != polygon_y[0]:
        polygon_x = list(polygon_x) + [polygon_x[0]]
        polygon_y = list(polygon_y) + [polygon_y[0]]

    # Build panels from polygon edges
    panels_x1 = polygon_x[:-1]
    panels_y1 = polygon_y[:-1]
    panels_x2 = polygon_x[1:]
    panels_y2 = polygon_y[1:]

    # Panel midpoints and normals
    mids_x = [(a + b) / 2 for a, b in zip(panels_x1, panels_x2)]
    mids_y = [(a + b) / 2 for a, b in zip(panels_y1, panels_y2)]
    lengths = [math.sqrt((b - a) ** 2 + (d - c) ** 2)
               for a, b, c, d in zip(panels_x1, panels_x2, panels_y1, panels_y2)]
    nx_p = [(panels_y2[i] - panels_y1[i]) / max(lengths[i], 1e-12) for i in range(N)]
    ny_p = [-(panels_x2[i] - panels_x1[i]) / max(lengths[i], 1e-12) for i in range(N)]

    # Freestream
    alpha = math.radians(wind_angle_deg)
    U = wind_speed_ms
    Ux = U * math.cos(alpha)
    Uy = U * math.sin(alpha)

    # Build influence matrix A (N×N) and RHS
    # A[i,j] = normal velocity at panel i due to unit source on panel j
    A = [[0.0] * N for _ in range(N)]
    rhs = [0.0] * N

    for i in range(N):
        xi, yi = mids_x[i], mids_y[i]
        for j in range(N):
            vn, _ = _panel_influence(xi, yi, panels_x1[j], panels_y1[j], panels_x2[j], panels_y2[j])
            A[i][j] = vn
        # RHS: normal component of freestream must be cancelled
        rhs[i] = -(Ux * nx_p[i] + Uy * ny_p[i])

    # Solve A·σ = rhs using Gaussian elimination
    sigma = _gauss_solve(A, rhs)
    if sigma is None:
        return {"status": "error", "detail": "panel matrix singular"}

    # Surface velocity and Cp at each panel
    panel_cp: list[float] = []
    panel_vt: list[float] = []

    for i in range(N):
        xi, yi = mids_x[i], mids_y[i]
        # Tangential velocity = freestream tangential + induced tangential
        tx_p = (panels_x2[i] - panels_x1[i]) / max(lengths[i], 1e-12)
        ty_p = (panels_y2[i] - panels_y1[i]) / max(lengths[i], 1e-12)
        vt_total = Ux * tx_p + Uy * ty_p
        for j in range(N):
            _, vt_ind = _panel_influence(xi, yi, panels_x1[j], panels_y1[j], panels_x2[j], panels_y2[j])
            vt_total += sigma[j] * vt_ind
        panel_vt.append(vt_total)
        cp = 1.0 - (vt_total / U) ** 2 if U > 0 else 0.0
        panel_cp.append(round(cp, 4))

    # Net force coefficients (integrate Cp × normal over surface)
    cd = 0.0
    cl = 0.0
    total_length = sum(lengths)
    for i in range(N):
        dl = lengths[i] / total_length
        cd += -panel_cp[i] * nx_p[i] * dl
        cl += -panel_cp[i] * ny_p[i] * dl

    # Streamline / velocity grid
    x_min = min(polygon_x) - grid_margin
    x_max = max(polygon_x) + grid_margin
    y_min = min(polygon_y) - grid_margin
    y_max = max(polygon_y) + grid_margin

    grid_vx: list[list[float]] = []
    grid_vy: list[list[float]] = []
    grid_xs: list[float] = []
    grid_ys: list[float] = []
    cp_grid: list[list[float]] = []

    for iy in range(grid_ny):
        row_vx: list[float] = []
        row_vy: list[float] = []
        row_cp: list[float] = []
        gy = y_min + (iy / (grid_ny - 1)) * (y_max - y_min)
        if iy == 0:
            for ix in range(grid_nx):
                gx = x_min + (ix / (grid_nx - 1)) * (x_max - x_min)
                grid_xs.append(round(gx, 3))
        grid_ys.append(round(gy, 3))

        for ix in range(grid_nx):
            gx = x_min + (ix / (grid_nx - 1)) * (x_max - x_min)

            # Check if inside polygon (skip)
            if _point_in_polygon(gx, gy, polygon_x[:-1], polygon_y[:-1]):
                row_vx.append(0.0); row_vy.append(0.0); row_cp.append(float("nan"))
                continue

            vx_g = Ux
            vy_g = Uy
            for j in range(N):
                dx = gx - panels_x1[j]
                dy = gy - panels_y1[j]
                pj_x = panels_x2[j] - panels_x1[j]
                pj_y = panels_y2[j] - panels_y1[j]
                Lj = max(math.sqrt(pj_x ** 2 + pj_y ** 2), 1e-12)
                tx_j, ty_j = pj_x / Lj, pj_y / Lj
                xp = dx * tx_j + dy * ty_j
                yp = -dx * ty_j + dy * tx_j
                r1_sq = xp ** 2 + yp ** 2
                r2_sq = (xp - Lj) ** 2 + yp ** 2
                r1 = math.sqrt(r1_sq) if r1_sq > 1e-20 else 1e-10
                r2 = math.sqrt(r2_sq) if r2_sq > 1e-20 else 1e-10
                log_r = math.log(r2 / r1) if r1 > 1e-10 else 0.0
                dtheta = math.atan2(yp, xp - Lj) - math.atan2(yp, xp)
                inv2pi = 1.0 / (2.0 * math.pi)
                u_loc = sigma[j] * inv2pi * log_r
                v_loc = sigma[j] * inv2pi * dtheta
                vx_g += u_loc * tx_j - v_loc * ty_j
                vy_g += u_loc * ty_j + v_loc * tx_j

            Vmag = math.sqrt(vx_g ** 2 + vy_g ** 2)
            cp_g = round(1.0 - (Vmag / U) ** 2 if U > 0 else 0.0, 3)
            row_vx.append(round(vx_g, 3))
            row_vy.append(round(vy_g, 3))
            row_cp.append(cp_g)

        grid_vx.append(row_vx)
        grid_vy.append(row_vy)
        cp_grid.append(row_cp)

    return {
        "status": "ok",
        "panel_midpoints_x": [round(x, 3) for x in mids_x],
        "panel_midpoints_y": [round(y, 3) for y in mids_y],
        "panel_cp": panel_cp,
        "panel_normals_x": [round(n, 3) for n in nx_p],
        "panel_normals_y": [round(n, 3) for n in ny_p],
        "cp_max": round(max(panel_cp), 3),
        "cp_min": round(min(panel_cp), 3),
        "cd": round(cd, 4),
        "cl": round(cl, 4),
        "grid_x": grid_xs,
        "grid_y": grid_ys,
        "grid_vx": grid_vx,
        "grid_vy": grid_vy,
        "grid_cp": cp_grid,
        "wind_speed_ms": wind_speed_ms,
        "wind_angle_deg": wind_angle_deg,
        "polygon_x": [round(x, 3) for x in polygon_x],
        "polygon_y": [round(y, 3) for y in polygon_y],
    }


def _gauss_solve(A: list[list[float]], b: list[float]) -> list[float] | None:
    """Gaussian elimination with partial pivoting."""
    n = len(b)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]

    for col in range(n):
        # Pivot
        max_row = max(range(col, n), key=lambda r: abs(M[r][col]))
        M[col], M[max_row] = M[max_row], M[col]
        if abs(M[col][col]) < 1e-15:
            return None
        pivot = M[col][col]
        for row in range(col + 1, n):
            factor = M[row][col] / pivot
            for c in range(col, n + 1):
                M[row][c] -= factor * M[col][c]

    x = [0.0] * n
    for i in range(n - 1, -1, -1):
        x[i] = M[i][n]
        for j in range(i + 1, n):
            x[i] -= M[i][j] * x[j]
        x[i] /= M[i][i]
    return x


def _point_in_polygon(px: float, py: float, vx: list[float], vy: list[float]) -> bool:
    """Ray-casting point-in-polygon test."""
    n = len(vx)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = vx[i], vy[i]
        xj, yj = vx[j], vy[j]
        if ((yi > py) != (yj > py)) and px < xi + (py - yi) / (yj - yi + 1e-15) * (xj - xi):
            inside = not inside
        j = i
    return inside


# ---------------------------------------------------------------------------
# Preset building shapes
# ---------------------------------------------------------------------------

def _rect_polygon(w: float, h: float) -> tuple[list[float], list[float]]:
    """Axis-aligned rectangle CCW, centered at origin."""
    hw, hh = w / 2, h / 2
    return [-hw, hw, hw, -hw], [-hh, -hh, hh, hh]


def _ellipse_polygon(a: float, b: float, n: int = 32) -> tuple[list[float], list[float]]:
    import math
    angles = [2 * math.pi * i / n for i in range(n)]
    return [a * math.cos(t) for t in angles], [b * math.sin(t) for t in angles]


def building_shapes() -> dict[str, tuple[list[float], list[float]]]:
    return {
        "rectangular": _rect_polygon(20.0, 30.0),
        "square": _rect_polygon(20.0, 20.0),
        "wide": _rect_polygon(40.0, 15.0),
        "elliptical": _ellipse_polygon(10.0, 15.0),
        "L_shape": (
            [-10, 10, 10, 0, 0, -10],
            [-15, -15, 0, 0, 15, 15],
        ),
        "octagonal": (
            [5, 10, 10, 5, -5, -10, -10, -5],
            [-10, -5, 5, 10, 10, 5, -5, -10],
        ),
    }
