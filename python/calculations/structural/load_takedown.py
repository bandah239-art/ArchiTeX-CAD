"""Load Takedown and Foundation Sizing Engine."""

import math
from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value


def run_load_takedown(building: dict[str, Any]) -> dict[str, Any]:
    """Execute top-down load takedown, column schedules, and footing sizing."""
    floors = building.get("floors", [])
    walls = building.get("walls", [])
    columns = building.get("columns", [])
    foundation = building.get("foundation", {})
    
    q_allowable = float(foundation.get("soil_bearing_capacity_kpa", 150.0))
    
    load_summary = []
    column_schedule = []
    foundation_schedule = []
    
    total_concrete_vol = 0.0
    total_rebar_weight = 0.0  # tonnes

    # Sort floors by level descending (top floor first)
    sorted_floors = sorted(floors, key=lambda f: float(f.get("level_m", 0.0)), reverse=True)
    
    cumulative_axial_load_kn = 0.0
    
    for i, floor in enumerate(sorted_floors):
        level = float(floor.get("level_m", 0.0))
        t_slab = float(floor.get("slab_thickness_mm", 150.0))
        imposed = float(floor.get("imposed_kPa", 1.5))
        finishes = float(floor.get("finishes_kPa", 1.0))
        partitions = float(floor.get("partitions_kPa", 1.0))
        grid_x = float(floor.get("grid_x_m", 4.0))
        grid_y = float(floor.get("grid_y_m", 4.0))
        
        # Concrete density = 24 kN/m3
        slab_dl = (t_slab / 1000.0) * 24.0
        dl = slab_dl + finishes + partitions
        il = imposed
        
        # ULS load combination: 1.4DL + 1.6IL (BS 8110)
        floor_uls = 1.4 * dl + 1.6 * il
        
        # Tributary area per column = grid_x * grid_y / 4
        trib_area = (grid_x * grid_y) / 4.0
        
        # Load from this floor per column
        floor_axial_uls = floor_uls * trib_area
        cumulative_axial_load_kn += floor_axial_uls
        
        # Estimate wall loads on this level
        # Wall density ~ 18 kN/m3, assume 200mm wall, 3m height
        wall_load_kn = 0.0
        for wall in walls:
            if wall.get("floor") == floor.get("level_m"):
                w_h = float(wall.get("height_m", 3.0))
                w_t = float(wall.get("thickness_mm", 200.0))
                # 1.4 dead load factor for walls
                wall_load_kn += 1.4 * (w_t / 1000.0) * w_h * 18.0 * max(grid_x, grid_y)
                
        cumulative_axial_load_kn += wall_load_kn
        
        load_summary.append({
            "level_m": level,
            "slab_dl_kpa": round_value(slab_dl, 2),
            "total_dl_kpa": round_value(dl, 2),
            "il_kpa": round_value(il, 2),
            "uls_floor_load_kpa": round_value(floor_uls, 2),
            "tributary_area_m2": round_value(trib_area, 2),
            "floor_axial_load_kn": round_value(floor_axial_uls, 1),
            "wall_load_kn": round_value(wall_load_kn, 1),
            "cumulative_axial_load_kn": round_value(cumulative_axial_load_kn, 1),
        })
        
        # Concrete volume for slab
        total_concrete_vol += grid_x * grid_y * (t_slab / 1000.0)

    # 2. Columns Schedule & concrete volume
    for col in columns:
        ref = col.get("grid_ref", "C1")
        b = float(col.get("section_b", 300.0))
        h = float(col.get("section_h", 300.0))
        
        # Estimate height based on floors (e.g. 3m per floor)
        col_height = 3.0 * len(floors)
        col_vol = (b / 1000.0) * (h / 1000.0) * col_height
        total_concrete_vol += col_vol
        
        # Rebar estimate: ~2% steel area by volume for columns
        col_rebar = col_vol * 0.02 * 7850 / 1000  # tonnes
        total_rebar_weight += col_rebar
        
        column_schedule.append({
            "grid_ref": ref,
            "section": f"{int(b)}x{int(h)}",
            "axial_load_uls_kn": round_value(cumulative_axial_load_kn, 1),
            "concrete_volume_m3": round_value(col_vol, 2),
            "rebar_weight_tonnes": round_value(col_rebar, 3),
        })

    # 3. Foundation Schedule Sizing
    # Required area A_req = N_total / q_allowable
    # For pad footing, design load is SLS (approx ULS / 1.45)
    n_sls = cumulative_axial_load_kn / 1.45
    area_req = n_sls / q_allowable
    
    # Pad size B = sqrt(A_req), round up to nearest 50mm (0.05m)
    b_size = math.sqrt(area_req)
    b_rounded = math.ceil(b_size / 0.05) * 0.05
    b_rounded = max(0.8, b_rounded)  # min size 800mm
    
    pad_thickness = 400.0  # mm
    pad_vol = b_rounded * b_rounded * (pad_thickness / 1000.0)
    total_concrete_vol += pad_vol
    
    # Pad rebar estimate: ~100kg/m3
    pad_rebar = pad_vol * 100 / 1000  # tonnes
    total_rebar_weight += pad_rebar

    foundation_schedule.append({
        "footing_type": "Pad Footing",
        "axial_load_sls_kn": round_value(n_sls, 1),
        "required_area_m2": round_value(area_req, 3),
        "pad_dimensions": f"{round_value(b_rounded, 2)}x{round_value(b_rounded, 2)}x0.4m",
        "concrete_volume_m3": round_value(pad_vol, 2),
        "rebar_weight_tonnes": round_value(pad_rebar, 3),
    })

    # 4. BoQ Quantities Compile
    boq_quantities = {
        "concrete_c25_m3": round_value(total_concrete_vol, 1),
        "rebar_tonnes": round_value(total_rebar_weight, 2),
        "formwork_m2": round_value(total_concrete_vol * 4.5, 1),  # empirical ratio
        "excavation_m3": round_value(b_rounded * b_rounded * 1.5, 1),  # depth 1.5m
    }

    return {
        "status": "pass",
        "load_summary": load_summary,
        "column_schedule": column_schedule,
        "foundation_schedule": foundation_schedule,
        "total_concrete_m3": round_value(total_concrete_vol, 1),
        "total_rebar_tonnes": round_value(total_rebar_weight, 2),
        "boq_ready_quantities": boq_quantities,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
