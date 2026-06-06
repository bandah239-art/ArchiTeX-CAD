"""
Eurocode 1 (EN 1991-1-4) Wind Pressure Calculation Engine — Zambia Calibrated.

Implements the full EC1 wind loading chain from basic wind velocity to total
horizontal force and overturning moment, calibrated for Zambia using a
province-level wind map.

Primary function: calculate_wind_loads_ec1(inputs: dict) -> dict

All clause and equation references are to EN 1991-1-4:2005.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

# ---------------------------------------------------------------------------
# ZAMBIA WIND MAP — fundamental basic wind velocity vb0 (m/s)
# Source: calibrated from Zambia Meteorological Department data
# ---------------------------------------------------------------------------
ZAMBIA_WIND_MAP: dict[str, float] = {
    "copperbelt":   28.0,
    "central":      30.0,
    "eastern":      32.0,
    "luapula":      28.0,
    "lusaka":       30.0,
    "muchinga":     26.0,
    "northern":     26.0,
    "north_western": 27.0,
    "southern":     33.0,
    "western":      28.0,
}

# ---------------------------------------------------------------------------
# TERRAIN ROUGHNESS PARAMETERS — EC1 Table 4.1
# ---------------------------------------------------------------------------
TERRAIN_PARAMS: dict[str, dict[str, float]] = {
    "0":   {"z0": 0.003, "zmin": 1.0,  "description": "Sea, coastal area exposed to open sea"},
    "I":   {"z0": 0.01,  "zmin": 1.0,  "description": "Lakes or flat terrain with negligible vegetation"},
    "II":  {"z0": 0.05,  "zmin": 2.0,  "description": "Low vegetation, isolated obstacles (default)"},
    "III": {"z0": 0.3,   "zmin": 5.0,  "description": "Suburbs, forests, areas with regular cover"},
    "IV":  {"z0": 1.0,   "zmin": 10.0, "description": "Urban: at least 15% of area covered by buildings >15 m"},
}

# ---------------------------------------------------------------------------
# EXTERNAL PRESSURE COEFFICIENTS — EC1 Table 7.1 (Vertical walls)
# Tabulated at h/d = 0.25, 1.0, ≥5.0; interpolate linearly
# ---------------------------------------------------------------------------
CPE_WALL_TABLE: list[tuple[float, float, float]] = [
    # (h/d, Cpe_D, Cpe_E)
    (0.25, +0.7, -0.3),
    (1.00, +0.8, -0.5),
    (5.00, +1.0, -0.7),
]
CPE_SIDE_A = -1.2
CPE_SIDE_B = -0.8
CPE_SIDE_C = -0.5

# ---------------------------------------------------------------------------
# FLAT ROOF COEFFICIENTS — EC1 Table 7.2 (pitch ≤ 5°)
# ---------------------------------------------------------------------------
CPE_FLAT_ROOF: dict[str, float] = {
    "F": -1.8,
    "G": -1.2,
    "H": -0.7,
    "I_neg": -0.2,
    "I_pos": +0.2,
}

# ---------------------------------------------------------------------------
# PITCHED ROOF COEFFICIENTS — EC1 Table 7.4a
# Format: angle_deg -> {zone: (min_cpe, max_cpe)}
# Single value stored as (value, value); use negative (suction) as governing
# ---------------------------------------------------------------------------
PITCHED_ROOF_TABLE: dict[int, dict[str, tuple[float, float]]] = {
    5:  {"F": (-1.7, +0.0), "G": (-1.2, +0.0), "H": (-0.6, +0.2), "I": (-0.6, -0.6), "J": (+0.2, +0.2)},
    15: {"F": (-0.9, +0.2), "G": (-0.8, +0.2), "H": (-0.3, +0.2), "I": (-0.4, -0.4), "J": (-1.0, +0.0)},
    30: {"F": (-0.5, +0.7), "G": (-0.5, +0.7), "H": (-0.2, +0.4), "I": (-0.4, -0.4), "J": (-0.5, +0.0)},
    45: {"F": (-0.0, +0.7), "G": (-0.0, +0.7), "H": (-0.0, +0.6), "I": (-0.2, -0.2), "J": (-0.3, +0.0)},
}
PITCHED_ROOF_ANGLES = sorted(PITCHED_ROOF_TABLE.keys())


# ---------------------------------------------------------------------------
# HELPER FUNCTIONS
# ---------------------------------------------------------------------------

def _linear_interp(x: float, x0: float, x1: float, y0: float, y1: float) -> float:
    """Linear interpolation clamped to [x0, x1]."""
    if x1 == x0:
        return y0
    t = (x - x0) / (x1 - x0)
    t = max(0.0, min(1.0, t))
    return y0 + t * (y1 - y0)


def _cpe_wall(h_over_d: float) -> tuple[float, float]:
    """
    Interpolate Cpe,D and Cpe,E for vertical walls.

    Returns (Cpe_D, Cpe_E) for given h/d ratio.
    EC1 Table 7.1.
    """
    tbl = CPE_WALL_TABLE
    hd = max(tbl[0][0], min(tbl[-1][0], h_over_d))
    for i in range(len(tbl) - 1):
        x0, d0, e0 = tbl[i]
        x1, d1, e1 = tbl[i + 1]
        if x0 <= hd <= x1:
            cpe_d = _linear_interp(hd, x0, x1, d0, d1)
            cpe_e = _linear_interp(hd, x0, x1, e0, e1)
            return cpe_d, cpe_e
    return tbl[-1][1], tbl[-1][2]


def _cpe_pitched_roof(pitch_deg: float) -> dict[str, float]:
    """
    Return governing (most negative / suction) Cpe for each pitched-roof zone
    at the given pitch angle, interpolating between tabulated angles.

    EC1 Table 7.4a.
    """
    angles = PITCHED_ROOF_ANGLES
    pitch = max(float(angles[0]), min(float(angles[-1]), pitch_deg))

    # Find bounding angles
    lower = angles[0]
    upper = angles[-1]
    for i in range(len(angles) - 1):
        if angles[i] <= pitch <= angles[i + 1]:
            lower, upper = angles[i], angles[i + 1]
            break

    if lower == upper:
        raw = PITCHED_ROOF_TABLE[lower]
        return {zone: raw[zone][0] for zone in raw}  # use min (suction)

    lo_data = PITCHED_ROOF_TABLE[lower]
    hi_data = PITCHED_ROOF_TABLE[upper]
    result: dict[str, float] = {}
    for zone in lo_data:
        lo_min, lo_max = lo_data[zone]
        hi_min, hi_max = hi_data[zone]
        # Interpolate the negative (suction-governing) values
        interp_min = _linear_interp(pitch, float(lower), float(upper), lo_min, hi_min)
        result[zone] = interp_min
    return result


def _cpi(building_type: str) -> float:
    """
    Internal pressure coefficient Cpi. EC1 cl.7.2.9.

    Returns the value that maximises net suction on the roof / leeward wall
    (i.e. the sign that adds to external suction).
    """
    bt = building_type.lower().replace("-", "_").replace(" ", "_")
    if bt in ("closed",):
        return +0.2   # worst case for suction combination
    if bt in ("partially_open", "partially open"):
        return -0.5   # dominant windward opening → pressure inside
    if bt in ("open",):
        return 0.0
    return +0.2  # default to closed


def _air_density(altitude_m: float) -> float:
    """
    Air density adjusted for altitude.

    ρ = 1.25 × exp(−0.0001 × alt)  [kg/m³]
    Ref: EN 1991-1-4 Annex A, simplified barometric formula.
    """
    return 1.25 * math.exp(-0.0001 * altitude_m)


def _step_record(
    number: int,
    title: str,
    reference: str,
    formula: str,
    values: dict[str, Any],
    result: Any,
    unit: str,
) -> dict[str, Any]:
    """Return a consistently structured step dictionary for the output."""
    return {
        "step": number,
        "title": title,
        "reference": reference,
        "formula": formula,
        "values": values,
        "result": result,
        "unit": unit,
    }


# ---------------------------------------------------------------------------
# MAIN FUNCTION
# ---------------------------------------------------------------------------

def calculate_wind_loads_ec1(inputs: dict[str, Any]) -> dict[str, Any]:
    """
    Calculate wind loads on a building to EN 1991-1-4 (Eurocode 1), calibrated
    for Zambia.

    Parameters
    ----------
    inputs : dict
        Required keys:
          building_height_m    : float   — reference height z_e (m)
          building_width_m     : float   — cross-wind dimension (m)
          building_length_m    : float   — along-wind depth d (m)
          terrain_category     : str     — "0"|"I"|"II"|"III"|"IV"

        At least one of:
          vb0_ms               : float   — fundamental basic wind velocity (m/s)
          province             : str     — Zambia province for wind map lookup

        Optional keys:
          roof_type            : str     — "flat"|"pitched"|"mono_pitched"
          roof_pitch_deg       : float   — roof pitch (°), used if pitched
          building_type        : str     — "closed"|"open"|"partially_open"
          cdir                 : float   — directional factor (default 1.0)
          cseason              : float   — seasonal factor (default 1.0)
          altitude_m           : float   — site altitude a.s.l. (m, default 0)
          orography_factor_co  : float   — co(z), default 1.0
          turbulence_factor_kI : float   — kI, default 1.0
          structural_factor_cscd : float — cscd override (default computed)

    Returns
    -------
    dict
        Full output with 'summary', 'steps', 'pressure_zones', 'warnings',
        'errors', 'timestamp'.
    """
    warnings: list[str] = []
    errors: list[str] = []
    steps: list[dict[str, Any]] = []

    # ------------------------------------------------------------------
    # PARSE INPUTS
    # ------------------------------------------------------------------
    try:
        height    = float(inputs["building_height_m"])
        width     = float(inputs["building_width_m"])
        length    = float(inputs["building_length_m"])
        terrain   = str(inputs.get("terrain_category", "II")).strip()

        province_raw  = str(inputs.get("province", "")).strip().lower().replace(" ", "_")
        vb0_input     = inputs.get("vb0_ms")
        roof_type     = str(inputs.get("roof_type", "flat")).lower()
        pitch_deg     = float(inputs.get("roof_pitch_deg", 0.0))
        building_type = str(inputs.get("building_type", "closed"))
        cdir          = float(inputs.get("cdir", 1.0))
        cseason       = float(inputs.get("cseason", 1.0))
        altitude_m    = float(inputs.get("altitude_m", 0.0))
        co            = float(inputs.get("orography_factor_co", 1.0))
        kI            = float(inputs.get("turbulence_factor_kI", 1.0))
        cscd_override = inputs.get("structural_factor_cscd")

    except KeyError as exc:
        return {
            "status": "error",
            "summary": {},
            "steps": [],
            "pressure_zones": {},
            "warnings": [],
            "errors": [f"Missing required input: {exc}"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except (ValueError, TypeError) as exc:
        return {
            "status": "error",
            "summary": {},
            "steps": [],
            "pressure_zones": {},
            "warnings": [],
            "errors": [f"Invalid input value: {exc}"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    # ------------------------------------------------------------------
    # VALIDATION
    # ------------------------------------------------------------------
    if terrain not in TERRAIN_PARAMS:
        warnings.append(f"Unknown terrain category '{terrain}'; defaulting to 'II'.")
        terrain = "II"

    if height <= 0:
        errors.append("building_height_m must be positive.")
    if width <= 0:
        errors.append("building_width_m must be positive.")
    if length <= 0:
        errors.append("building_length_m must be positive.")

    if errors:
        return {
            "status": "error",
            "summary": {},
            "steps": [],
            "pressure_zones": {},
            "warnings": warnings,
            "errors": errors,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    # ------------------------------------------------------------------
    # STEP 1: BASIC WIND VELOCITY — EC1 cl.4.2 Eq.(4.1)
    # ------------------------------------------------------------------
    province_label: str = ""
    if province_raw and province_raw in ZAMBIA_WIND_MAP:
        vb0 = ZAMBIA_WIND_MAP[province_raw]
        province_label = province_raw
    elif province_raw and province_raw not in ZAMBIA_WIND_MAP:
        warnings.append(
            f"Province '{province_raw}' not found in ZAMBIA_WIND_MAP; "
            "falling back to vb0_ms input."
        )
        if vb0_input is None:
            errors.append("vb0_ms required when province is not recognised.")
            return {
                "status": "error",
                "summary": {},
                "steps": [],
                "pressure_zones": {},
                "warnings": warnings,
                "errors": errors,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        vb0 = float(vb0_input)
    else:
        if vb0_input is None:
            warnings.append(
                "No province or vb0_ms supplied; defaulting vb0 = 30 m/s "
                "(Central province value)."
            )
            vb0 = 30.0
        else:
            vb0 = float(vb0_input)

    vb = cdir * cseason * vb0

    steps.append(_step_record(
        number=1,
        title="Basic Wind Velocity",
        reference="EN 1991-1-4 Clause 4.2 Eq.(4.1)",
        formula="vb = cdir × cseason × vb0",
        values={"vb0_ms": round(vb0, 3), "cdir": cdir, "cseason": cseason},
        result=round(vb, 4),
        unit="m/s",
    ))

    # ------------------------------------------------------------------
    # STEP 2: TERRAIN ROUGHNESS CATEGORY PARAMETERS — EC1 Table 4.1
    # ------------------------------------------------------------------
    terrain_data = TERRAIN_PARAMS[terrain]
    z0   = terrain_data["z0"]
    zmin = terrain_data["zmin"]
    terrain_desc = terrain_data["description"]

    steps.append(_step_record(
        number=2,
        title="Terrain Roughness Category Parameters",
        reference="EN 1991-1-4 Table 4.1",
        formula="Look-up z0, zmin for terrain category",
        values={"terrain_category": terrain, "description": terrain_desc},
        result={"z0_m": z0, "zmin_m": zmin},
        unit="m",
    ))

    # ------------------------------------------------------------------
    # STEP 3: ROUGHNESS FACTOR cr(z) — EC1 cl.4.3.2 Eq.(4.4)
    # ------------------------------------------------------------------
    kr    = 0.19 * (z0 / 0.05) ** 0.07
    z_eff = max(height, zmin)
    cr_z  = kr * math.log(z_eff / z0)
    cr_at_zmin = kr * math.log(zmin / z0) if zmin > z0 else kr * math.log(max(zmin, z0 * 1.001) / z0)

    if height < zmin:
        cr_used = cr_at_zmin
        warnings.append(
            f"Building height {height} m < zmin {zmin} m for terrain category {terrain}; "
            f"cr(z) set to cr(zmin) = {cr_at_zmin:.4f}."
        )
    else:
        cr_used = cr_z

    steps.append(_step_record(
        number=3,
        title="Roughness Factor cr(z)",
        reference="EN 1991-1-4 Clause 4.3.2 Eq.(4.4)",
        formula="kr = 0.19×(z0/0.05)^0.07 ; cr(z) = kr×ln(max(z,zmin)/z0)",
        values={"z0_m": z0, "zmin_m": zmin, "kr": round(kr, 5), "z_eff_m": z_eff},
        result=round(cr_used, 5),
        unit="-",
    ))

    # ------------------------------------------------------------------
    # STEP 4: MEAN WIND VELOCITY vm(z) — EC1 cl.4.3.1 Eq.(4.3)
    # ------------------------------------------------------------------
    vm = cr_used * co * vb

    steps.append(_step_record(
        number=4,
        title="Mean Wind Velocity vm(z)",
        reference="EN 1991-1-4 Clause 4.3.1 Eq.(4.3)",
        formula="vm(z) = cr(z) × co(z) × vb",
        values={"cr_z": round(cr_used, 5), "co": co, "vb_ms": round(vb, 3)},
        result=round(vm, 4),
        unit="m/s",
    ))

    # ------------------------------------------------------------------
    # STEP 5: TURBULENCE INTENSITY Iv(z) — EC1 cl.4.4 Eq.(4.7)
    # ------------------------------------------------------------------
    iv_denom = co * math.log(z_eff / z0)
    iv_z = kI / iv_denom if iv_denom > 0 else 0.0

    iv_at_zmin_denom = co * math.log(max(zmin, z0 * 1.001) / z0)
    iv_at_zmin = kI / iv_at_zmin_denom if iv_at_zmin_denom > 0 else 0.0

    iv = iv_at_zmin if height < zmin else iv_z

    steps.append(_step_record(
        number=5,
        title="Turbulence Intensity Iv(z)",
        reference="EN 1991-1-4 Clause 4.4 Eq.(4.7)",
        formula="Iv(z) = kI / (co(z) × ln(max(z,zmin)/z0))",
        values={"kI": kI, "co": co, "z_eff_m": z_eff, "z0_m": z0},
        result=round(iv, 5),
        unit="-",
    ))

    # ------------------------------------------------------------------
    # STEP 6: PEAK VELOCITY PRESSURE qp(z) — EC1 cl.4.5 Eq.(4.8)
    # ------------------------------------------------------------------
    rho = _air_density(altitude_m)
    qp_Nm2 = (1.0 + 7.0 * iv) * 0.5 * rho * vm ** 2
    qp_kNm2 = qp_Nm2 / 1000.0

    steps.append(_step_record(
        number=6,
        title="Peak Velocity Pressure qp(z)",
        reference="EN 1991-1-4 Clause 4.5 Eq.(4.8)",
        formula="qp(z) = [1 + 7×Iv(z)] × 0.5 × ρ × vm(z)²",
        values={
            "iv": round(iv, 5),
            "rho_kgm3": round(rho, 4),
            "vm_ms": round(vm, 4),
            "altitude_m": altitude_m,
        },
        result=round(qp_kNm2, 5),
        unit="kN/m²",
    ))

    # ------------------------------------------------------------------
    # STEP 7: EXTERNAL PRESSURE COEFFICIENTS Cpe — EC1 cl.7.2
    # ------------------------------------------------------------------
    h_over_d = height / length  # d = along-wind depth
    cpe_D, cpe_E = _cpe_wall(h_over_d)

    # Roof coefficients
    if roof_type in ("flat",) or pitch_deg <= 5.0:
        cpe_roof = CPE_FLAT_ROOF["H"]   # governing main area
        cpe_roof_edge = CPE_FLAT_ROOF["F"]
        roof_desc = "Flat roof (Table 7.2): zone H (main) / zone F (edge)"
    elif roof_type in ("pitched", "mono_pitched"):
        pitched_cpe = _cpe_pitched_roof(pitch_deg)
        cpe_roof = pitched_cpe.get("H", -0.4)
        cpe_roof_edge = pitched_cpe.get("F", -1.0)
        roof_desc = f"Pitched roof {pitch_deg}° (Table 7.4a): zone H / zone F (interpolated)"
    else:
        cpe_roof = CPE_FLAT_ROOF["H"]
        cpe_roof_edge = CPE_FLAT_ROOF["F"]
        roof_desc = "Roof type unrecognised; defaulting to flat roof coefficients."
        warnings.append(f"Unrecognised roof_type '{roof_type}'; flat roof coefficients applied.")

    steps.append(_step_record(
        number=7,
        title="External Pressure Coefficients Cpe",
        reference="EN 1991-1-4 Clause 7.2, Tables 7.1 / 7.2 / 7.4a",
        formula="Cpe from h/d interpolation (walls) and pitch interpolation (roof)",
        values={
            "h_over_d": round(h_over_d, 3),
            "roof_type": roof_type,
            "pitch_deg": pitch_deg,
            "description": roof_desc,
        },
        result={
            "Cpe_D_windward": round(cpe_D, 3),
            "Cpe_E_leeward": round(cpe_E, 3),
            "Cpe_A_side": CPE_SIDE_A,
            "Cpe_B_side": CPE_SIDE_B,
            "Cpe_C_side": CPE_SIDE_C,
            "Cpe_roof_main": round(cpe_roof, 3),
            "Cpe_roof_edge": round(cpe_roof_edge, 3),
        },
        unit="-",
    ))

    # ------------------------------------------------------------------
    # STEP 8: INTERNAL PRESSURE COEFFICIENT Cpi — EC1 cl.7.2.9
    # ------------------------------------------------------------------
    cpi = _cpi(building_type)

    steps.append(_step_record(
        number=8,
        title="Internal Pressure Coefficient Cpi",
        reference="EN 1991-1-4 Clause 7.2.9",
        formula="Cpi from building type (closed=±0.2, partially_open, open=0)",
        values={"building_type": building_type},
        result=round(cpi, 3),
        unit="-",
    ))

    # ------------------------------------------------------------------
    # STEP 9: NET DESIGN WIND PRESSURES — EC1 cl.5.2
    # ------------------------------------------------------------------
    # External pressures (positive = pressure towards surface)
    we_windward = qp_kNm2 * cpe_D
    we_leeward  = qp_kNm2 * cpe_E
    we_roof     = qp_kNm2 * cpe_roof

    # Internal pressure (same sign convention)
    wi = qp_kNm2 * cpi

    # Net pressures: w = we − wi
    w_net_windward = we_windward - wi
    w_net_leeward  = we_leeward  - wi
    w_net_roof     = we_roof     - wi

    # Side walls (zone A governing)
    we_side = qp_kNm2 * CPE_SIDE_A
    w_net_side = we_side - wi

    # Roof edge (zone F/G)
    we_roof_edge = qp_kNm2 * cpe_roof_edge
    w_net_roof_edge = we_roof_edge - wi

    steps.append(_step_record(
        number=9,
        title="Net Design Wind Pressures",
        reference="EN 1991-1-4 Clause 5.2",
        formula="w = we − wi = qp×(Cpe − Cpi)",
        values={
            "qp_kNm2": round(qp_kNm2, 5),
            "cpe_D": round(cpe_D, 3),
            "cpe_E": round(cpe_E, 3),
            "cpe_roof": round(cpe_roof, 3),
            "cpi": round(cpi, 3),
        },
        result={
            "we_windward_kNm2": round(we_windward, 4),
            "we_leeward_kNm2":  round(we_leeward, 4),
            "we_roof_kNm2":     round(we_roof, 4),
            "wi_kNm2":          round(wi, 4),
            "w_net_windward_kNm2": round(w_net_windward, 4),
            "w_net_leeward_kNm2":  round(w_net_leeward, 4),
            "w_net_roof_kNm2":     round(w_net_roof, 4),
        },
        unit="kN/m²",
    ))

    # ------------------------------------------------------------------
    # STEP 10: STRUCTURAL FACTOR cscd — EC1 cl.6
    # ------------------------------------------------------------------
    if cscd_override is not None:
        cscd = float(cscd_override)
        cscd_note = "User-supplied override value."
    elif height <= 15.0:
        cscd = 1.0
        cscd_note = "h ≤ 15 m: cscd = 1.0 (EC1 cl.6.2, simplified)."
    else:
        # Simplified background factor B² = 1 / (1 + 0.9×(b+h)/(L(h)))
        # with L(h) = 300×(h/200)^0.67 for terrain II; resonance R²≈0 for static
        L_h = 300.0 * (height / 200.0) ** 0.67
        B2 = 1.0 / (1.0 + 0.9 * (width + height) / L_h)
        kp = math.sqrt(2.0 * math.log(600.0)) if iv > 0 else 3.5  # peak factor
        cscd = (1.0 + 2.0 * kp * iv * math.sqrt(B2)) / (1.0 + 7.0 * iv)
        cscd_note = (
            f"Computed from simplified background factor B²={B2:.4f}, "
            f"kp={kp:.3f}, R²=0 (static assumption). EC1 cl.6."
        )

    steps.append(_step_record(
        number=10,
        title="Structural Factor cscd",
        reference="EN 1991-1-4 Clause 6",
        formula="cscd = (1 + 2kp×Iv×√B²) / (1 + 7×Iv)  [or 1.0 for h ≤ 15 m]",
        values={"building_height_m": height, "iv": round(iv, 5)},
        result={"cscd": round(cscd, 4), "note": cscd_note},
        unit="-",
    ))

    # ------------------------------------------------------------------
    # STEP 11: TOTAL HORIZONTAL WIND FORCE — EC1 cl.5.3
    # ------------------------------------------------------------------
    # Reference area Aref = h × d  (d = along-wind building depth)
    Aref = height * length
    # Force coefficient for rectangular buildings
    Cf = cpe_D - cpe_E  # net windward + leeward contribution
    Fw_kN = cscd * qp_kNm2 * Cf * Aref  # qp already in kN/m²

    steps.append(_step_record(
        number=11,
        title="Total Horizontal Wind Force Fw",
        reference="EN 1991-1-4 Clause 5.3",
        formula="Fw = cscd × qp × Cf × Aref   [Cf = Cpe,D − Cpe,E]",
        values={
            "cscd": round(cscd, 4),
            "qp_kNm2": round(qp_kNm2, 5),
            "Cf": round(Cf, 3),
            "Aref_m2": round(Aref, 2),
        },
        result=round(Fw_kN, 3),
        unit="kN",
    ))

    # ------------------------------------------------------------------
    # STEP 12: OVERTURNING MOMENT
    # ------------------------------------------------------------------
    # Resultant acts at 0.6×h above base (triangular/parabolic pressure profile)
    Mw_kNm = Fw_kN * 0.6 * height

    steps.append(_step_record(
        number=12,
        title="Overturning Moment Mw",
        reference="EC1 cl.5.3, resultant at 0.6×h",
        formula="Mw = Fw × 0.6 × h",
        values={"Fw_kN": round(Fw_kN, 3), "h_m": height},
        result=round(Mw_kNm, 3),
        unit="kN.m",
    ))

    # ------------------------------------------------------------------
    # ADDITIONAL WARNINGS
    # ------------------------------------------------------------------
    if height > 200.0:
        warnings.append(
            "Building height > 200 m: EC1 simplified methods may not be "
            "applicable; specialist dynamic analysis recommended."
        )
    if pitch_deg > 45.0:
        warnings.append(
            f"Roof pitch {pitch_deg}° exceeds Table 7.4a range (45°); "
            "Cpe extrapolated — verify with project-specific wind tunnel data."
        )
    if altitude_m > 2000.0:
        warnings.append(
            f"Site altitude {altitude_m} m: air density reduced to "
            f"{rho:.4f} kg/m³. Verify with local meteorological data."
        )
    if cdir != 1.0:
        warnings.append(
            f"Directional factor cdir = {cdir} (≠ 1.0). Ensure this value "
            "is supported by site-specific wind directional analysis."
        )

    # ------------------------------------------------------------------
    # ASSEMBLE OUTPUT
    # ------------------------------------------------------------------
    status = "info" if warnings else "pass"

    summary: dict[str, Any] = {
        "vb0_ms":                round(vb0, 3),
        "vb_ms":                 round(vb, 4),
        "vm_ms":                 round(vm, 4),
        "iv":                    round(iv, 5),
        "qp_kNm2":               round(qp_kNm2, 5),
        "cpe_windward":          round(cpe_D, 3),
        "cpe_leeward":           round(cpe_E, 3),
        "cpe_roof":              round(cpe_roof, 3),
        "cpi":                   round(cpi, 3),
        "we_windward_kNm2":      round(we_windward, 4),
        "we_leeward_kNm2":       round(we_leeward, 4),
        "we_roof_kNm2":          round(we_roof, 4),
        "wind_force_kn":         round(Fw_kN, 3),
        "overturning_moment_knm": round(Mw_kNm, 3),
        "cscd":                  round(cscd, 4),
        "province":              province_label if province_label else None,
        "terrain_category":      terrain,
        "design_code":           "EC1 EN 1991-1-4",
    }

    pressure_zones: dict[str, float] = {
        "windward_wall_kNm2": round(w_net_windward, 4),
        "leeward_wall_kNm2":  round(w_net_leeward, 4),
        "side_wall_kNm2":     round(w_net_side, 4),
        "roof_main_kNm2":     round(w_net_roof, 4),
        "roof_edge_kNm2":     round(w_net_roof_edge, 4),
    }

    return {
        "status": status,
        "summary": summary,
        "steps": steps,
        "pressure_zones": pressure_zones,
        "warnings": warnings,
        "errors": errors,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
