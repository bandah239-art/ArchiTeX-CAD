"""Wind pressure distribution per EN 1991-1-4 simplified."""

from __future__ import annotations

import math
from typing import Any

from calculations.utils.formatters import round_value
from calculations.pressure._common import finish, step


def calculate_wind_distribution(payload: dict[str, Any]) -> dict[str, Any]:
    vb = float(payload.get("vb", payload.get("basic_wind_speed", 30)))
    z = float(payload.get("height", payload.get("z", 10)))
    terrain = int(payload.get("terrain_category", 2))
    rho = 1.25
    z0_map = {0: 0.003, 1: 0.01, 2: 0.05, 3: 0.3, 4: 1.0}
    z0 = z0_map.get(terrain, 0.05)
    kr = 0.19 * (z0 / 0.05) ** 0.07
    cr = kr * math.log(max(z, z0) / z0)
    qp = 0.5 * rho * vb * vb * cr * cr * 1e-3
    cpe_zones = {
        "windward": 0.8,
        "leeward": -0.5,
        "side": -0.7,
        "roof_flat": -1.2,
    }
    cpi = float(payload.get("cpi", 0.2))
    zones = {name: round_value(qp * (cpe - cpi), 2) for name, cpe in cpe_zones.items()}

    steps = [
        step(1, "Peak velocity pressure", "qp = ½·ρ·vb²·Ce(z)²", f"vb={vb} m/s; z={z}m", f"qp ≈ {round_value(qp, 2)} kN/m²", "kN/m²", "EN 1991-1-4"),
        step(2, "Net pressures", "we = qp·(Cpe − Cpi)", f"Cpi={cpi}", str(zones), "kN/m²", "EC1 pressure coefficients"),
    ]

    diagram = {
        "type": "arrows",
        "points": [{"zone": k, "pressure_kpa": v} for k, v in zones.items()],
        "labels": [f"qp = {round_value(qp,2)} kN/m²"],
        "resultant": {"value": max(zones.values(), key=abs), "location": "facade", "unit": "kN/m²"},
        "terrain_category": terrain,
    }

    return finish({"qp_kN_m2": round_value(qp, 2), "zone_pressures": zones}, steps, diagram)
