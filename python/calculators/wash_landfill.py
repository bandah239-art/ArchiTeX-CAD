from pydantic import BaseModel

class LandfillRequest(BaseModel):
    population: int = 50000
    waste_generation_kg_capita_day: float = 1.2
    design_life_years: int = 20
    compacted_waste_density_kg_m3: float = 800.0

def calculate_landfill(req: LandfillRequest) -> dict:
    """
    Calculates the volume, area, and geomembrane requirements for an engineered sanitary landfill.
    """
    # 1. Total Waste Generation
    annual_waste_kg = req.population * req.waste_generation_kg_capita_day * 365.25
    total_waste_kg = annual_waste_kg * req.design_life_years
    
    # 2. Volume Required
    waste_volume_m3 = total_waste_kg / req.compacted_waste_density_kg_m3
    
    # Add 20% volume for daily soil cover
    total_landfill_volume_m3 = waste_volume_m3 * 1.20
    
    # 3. Area Required
    # Assume an average landfill depth of 15 meters
    average_depth_m = 15.0
    landfill_area_m2 = total_landfill_volume_m3 / average_depth_m
    landfill_area_ha = landfill_area_m2 / 10000.0
    
    # 4. Geomembrane Liner
    # Liner area = footprint area + 15% for side slopes and anchor trenches
    liner_area_m2 = landfill_area_m2 * 1.15
    
    return {
        "status": "success",
        "total_waste_tonnes": round(total_waste_kg / 1000.0, 1),
        "total_volume_m3": round(total_landfill_volume_m3, 1),
        "landfill_area_ha": round(landfill_area_ha, 2),
        "liner_area_m2": round(liner_area_m2, 1),
        "recommendation": f"For {req.design_life_years} years, the landfill requires {round(landfill_area_ha, 2)} Hectares. You will need {round(liner_area_m2, 1)}m² of HDPE Geomembrane liner to protect groundwater."
    }
