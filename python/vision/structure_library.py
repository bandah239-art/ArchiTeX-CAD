STRUCTURE_TEMPLATES = {
    "box_culvert": {
        "category": "civil",
        "drawing_type": "cross_section",
        "typical_elements": [
            "top_slab", "bottom_slab", 
            "left_wall", "right_wall",
            "headwall_inlet", "headwall_outlet",
            "wingwalls", "apron"
        ],
        "key_dimensions": [
            "span", "height", "wall_thickness",
            "headwall_height", "apron_length"
        ],
        "engineering_checks": [
            "hydraulic_capacity",
            "structural_adequacy",
            "scour_protection",
            "headwater_depth"
        ]
    },
    "pipe_culvert": {
        "category": "civil",
        "drawing_type": "cross_section",
        "typical_elements": [
            "pipe", "bedding", "surround",
            "headwall", "wingwalls", "apron"
        ],
        "key_dimensions": [
            "pipe_diameter", "pipe_length",
            "cover_depth", "bedding_depth"
        ]
    },
    "road_bridge": {
        "category": "civil",
        "drawing_type": "elevation",
        "typical_elements": [
            "deck", "beams", "piers",
            "abutments", "foundations",
            "approach_ramp", "parapet"
        ],
        "key_dimensions": [
            "span", "deck_width", "deck_thickness",
            "pier_height", "abutment_height",
            "clearance_above_water"
        ]
    },
    "borehole_handpump": {
        "category": "wash",
        "drawing_type": "cross_section",
        "typical_elements": [
            "pump_head", "rising_main",
            "cylinder_assembly", "casing_pipe",
            "gravel_pack", "cement_seal",
            "apron_slab", "drainage_channel",
            "fence"
        ],
        "key_dimensions": [
            "total_depth", "casing_diameter",
            "screen_length", "cement_seal_depth",
            "apron_size", "fence_height"
        ],
        "wash_checks": [
            "apron_condition",
            "drainage_away_from_pump",
            "fence_intact",
            "latrine_distance_30m",
            "spout_height_adequate",
            "handle_operational"
        ]
    }
}
