"""Geotechnical parameters for common African soil types."""

AFRICAN_SOILS = {
    "laterite": {
        "phi": 30.0,
        "cohesion_kpa": 20.0,
        "gamma_knm3": 19.0,
        "description": "Tropical lateritic soil"
    },
    "black_cotton": {
        "phi": 15.0,
        "cohesion_kpa": 50.0,
        "gamma_knm3": 17.5,
        "description": "Expansive black cotton clay"
    },
    "sandy": {
        "phi": 32.0,
        "cohesion_kpa": 0.0,
        "gamma_knm3": 18.0,
        "description": "Granular sandy soil"
    },
    "weathered_rock": {
        "phi": 40.0,
        "cohesion_kpa": 50.0,
        "gamma_knm3": 21.0,
        "description": "Highly weathered basement rock"
    },
    "soft_clay": {
        "phi": 5.0,
        "cohesion_kpa": 15.0,
        "gamma_knm3": 16.0,
        "description": "Soft alluvial clay"
    }
}

def get_soil_properties(soil_type: str) -> dict:
    """Retrieve default geotechnical parameters for a given soil type."""
    return AFRICAN_SOILS.get(soil_type.lower(), AFRICAN_SOILS["sandy"])
