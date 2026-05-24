"""Bridge AI design brief to calculator inputs."""

from typing import Any


def push_to_calculators(payload: dict[str, Any]) -> dict[str, Any]:
    brief = payload.get("design_brief", payload.get("design_brief", {}))
    geo = payload.get("geo_data") or {}
    scheme = brief.get("structural_scheme", {})
    country = payload.get("country_code", "ZM")
    gfa = brief.get("gross_floor_area", 142)

    foundation_type = "strip" if "strip" in str(scheme.get("foundation_type", "")).lower() else "pad"
    wall_load = 45  # kN/m typical single storey wall

    calculators = {
        "foundation": {
            "foundation_type": foundation_type,
            "column_load": 800 if foundation_type == "pad" else wall_load,
            "moment_x": 30,
            "moment_y": 0,
            "soil_bearing": geo.get("bearing_capacity_mid", 150),
            "soil_unit_weight": 18,
            "foundation_depth": scheme.get("foundation_depth", 1.2),
            "foundation_depth_concrete": 400,
            "fck": 25,
            "fyk": 500,
            "column_width": 300,
            "column_depth": 300,
        },
        "loads": {
            "dead_load_g": 12.0,
            "imposed_load_q": 1.5,
            "wind_load_w": geo.get("design_wind_pressure_knm2", 0.5),
            "snow_load_s": 0,
            "load_type": "udl",
            "design_code": payload.get("design_code", "eurocode"),
        },
        "slab": {
            "slab_type": "two_way",
            "span_lx": max(4, (gfa ** 0.5) * 0.7),
            "span_ly": max(5, (gfa ** 0.5) * 0.9),
            "dead_load": 5,
            "live_load": 1.5,
            "depth": scheme.get("floor_thickness", 100),
            "fck": 25,
            "fyk": 500,
            "support_condition": "simply_supported",
        },
        "boq": {
            "country_code": country,
            "spatial_programme": brief.get("spatial_programme", []),
            "materials_specification": brief.get("materials_specification", {}),
            "gross_floor_area": gfa,
        },
    }

    return {
        "status": "complete",
        "calculators": calculators,
        "notes": "Review pre-filled inputs before running calculations.",
    }
