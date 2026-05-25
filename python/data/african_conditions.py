"""African Conditions Database (Zambia parameters)."""

AFRICAN_CONDITIONS = {
    "Zambia": {
        "materials": {
            "cement_grades": ["CEM I 42.5N", "CEM I 52.5N", "CEM II 32.5N"],
            "steel_availability": ["High yield (fyk 500 MPa)", "Mild steel (fyk 250 MPa)"],
            "timber": ["Zambezi teak", "Pine"]
        },
        "climate": {
            "mean_max_temp": 27,
            "curing_days_min": 10,
            "thermal_movement_dT": 35,
            "rainfall": {
                "Lusaka": {"mean_annual_mm": 800, "i_10yr_mm_hr": 90},
                "Copperbelt": {"mean_annual_mm": 1200, "i_10yr_mm_hr": 110},
                "Southern": {"mean_annual_mm": 600, "i_10yr_mm_hr": 60}
            }
        },
        "soil": {
            "Lusaka": {
                "description": "Predominantly weathered granite (gneiss and schist)",
                "bearing_capacity_kpa": [100, 250],
                "expansive": "Pockets"
            },
            "Copperbelt": {
                "description": "Alluvial deposits, mining subsidence risk",
                "bearing_capacity_kpa": [50, 150],
                "expansive": "Low"
            },
            "Western": {
                "description": "Sandy Kalahari soils",
                "bearing_capacity_kpa": [50, 100],
                "expansive": "Low"
            },
            "Southern": {
                "description": "Black cotton soil prevalent",
                "bearing_capacity_kpa": [50, 150],
                "expansive": "Highly Expansive - 200kPa swell"
            }
        },
        "construction_factors": {
            "concrete_strength_reduction": 0.85, # manual batching
            "cover_increase_mm": 5, # variable steel fixing
            "formwork_deflection_limit_span_ratio": 400
        }
    }
}

def apply_local_adjustments(country: str, params: dict) -> dict:
    """Apply local construction factors to standard parameters before passing to verified calculators."""
    if country not in AFRICAN_CONDITIONS:
        return params
        
    local_data = AFRICAN_CONDITIONS[country]
    factors = local_data["construction_factors"]
    
    adjusted = params.copy()
    
    # Do not break verified calculators; instead, modify their inputs directly
    # and attach a note so the user knows it happened.
    if "fck" in adjusted:
        adjusted["fck"] = adjusted["fck"] * factors["concrete_strength_reduction"]
        adjusted["local_fck_note"] = "fck reduced by 15% due to prevalent manual batching in Zambia."
        
    if "cover_mm" in adjusted:
        adjusted["cover_mm"] += factors["cover_increase_mm"]
        adjusted["local_cover_note"] = "Cover increased by 5mm above EC2 minimum due to variable steel fixing."
        
    return adjusted
