from pydantic import BaseModel
import math

class GroundImprovementRequest(BaseModel):
    area_to_improve_m2: float = 1000.0
    column_diameter_m: float = 0.8
    column_spacing_m: float = 2.0
    pattern: str = "triangular" # or "square"
    depth_m: float = 8.0

def calculate_ground_improvement(req: GroundImprovementRequest) -> dict:
    """
    Calculates stone column / vibro-replacement design for ground improvement.
    """
    # 1. Area Replacement Ratio (As / A)
    # Area of one column
    As = (math.pi * req.column_diameter_m**2) / 4.0
    
    # Tributary Area per column (A)
    if req.pattern.lower() == "triangular":
        A = 0.866 * (req.column_spacing_m**2)
    else:
        # Square pattern
        A = req.column_spacing_m**2
        
    replacement_ratio = As / A
    
    # 2. Number of columns required
    num_columns = int(math.ceil(req.area_to_improve_m2 / A))
    
    # 3. Total volume of stone required
    volume_per_column_m3 = As * req.depth_m
    total_stone_volume_m3 = volume_per_column_m3 * num_columns
    
    # Add 15% wastage/compaction factor
    total_stone_volume_m3 *= 1.15
    
    return {
        "status": "success",
        "replacement_ratio_percent": round(replacement_ratio * 100.0, 1),
        "number_of_columns": num_columns,
        "total_stone_volume_m3": round(total_stone_volume_m3, 1),
        "recommendation": f"Install {num_columns} stone columns ({req.depth_m}m deep) in a {req.pattern} grid. Area replacement ratio is {round(replacement_ratio * 100.0, 1)}%. Requires {round(total_stone_volume_m3, 1)}m³ of crushed stone."
    }
