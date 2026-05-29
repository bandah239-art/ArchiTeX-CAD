"""Zambian unit rates (ZMW) for Bill of Quantities (BoQ) compilation."""

RATE_METADATA = {
    "last_updated": "2025-Q4",
    "source": "Zambia BoQ market benchmarks",
    "currency": "ZMW",
    "note": "Rates are indicative. Verify against current supplier quotes before tendering.",
}

ZAMBIA_UNIT_RATES_ZMW = {
    # Earthworks (per m³)
    "excavation_hand":     {"rate": 180.0,  "unit": "m³", "description": "Hand excavation in firm ground"},
    "excavation_machine":  {"rate": 95.0,   "unit": "m³", "description": "Machine excavation (TLB/excavator)"},
    "compaction_roller":   {"rate": 55.0,   "unit": "m³", "description": "Compaction with roller, watered"},
    "fill_selected":       {"rate": 120.0,  "unit": "m³", "description": "Selected fill, import and compact"},

    # Concrete (per m³)
    "concrete_c20_sitemix":  {"rate": 2800.0, "unit": "m³", "description": "C20 site-mixed concrete"},
    "concrete_c25_readymix": {"rate": 4200.0, "unit": "m³", "description": "C25 ready-mix (Lusaka/Ndola only)"},
    "concrete_c30_readymix": {"rate": 4900.0, "unit": "m³", "description": "C30 ready-mix concrete"},

    # Reinforcement (per tonne)
    "rebar_y10_y12": {"rate": 8500.0,  "unit": "tonne", "description": "Y10–Y12 deformed bars, supply & fix"},
    "rebar_y16_y20": {"rate": 8000.0,  "unit": "tonne", "description": "Y16–Y20 deformed bars, supply & fix"},
    "rebar_y25_y32": {"rate": 7800.0,  "unit": "tonne", "description": "Y25–Y32 deformed bars, supply & fix"},
    "brc_a193":      {"rate": 12000.0, "unit": "tonne", "description": "BRC A193 mesh, supply & fix"},

    # Masonry (per m²)
    "brickwork_class3_half_brick": {"rate": 680.0,  "unit": "m²", "description": "Class 3 clay brick half-brick wall"},
    "brickwork_class3_full_brick": {"rate": 1100.0, "unit": "m²", "description": "Class 3 clay brick full-brick wall"},
    "blockwork_140mm": {"rate": 820.0,  "unit": "m²", "description": "140mm hollow concrete block wall"},
    "blockwork_190mm": {"rate": 980.0,  "unit": "m²", "description": "190mm hollow concrete block wall"},

    # Roofing (per m²)
    "ibr_0.47mm_zincalume": {"rate": 850.0,  "unit": "m²", "description": "IBR 0.47mm Zincalume sheeting"},
    "ibr_0.47mm_colorcoat": {"rate": 1100.0, "unit": "m²", "description": "IBR 0.47mm colour-coated sheeting"},
    "timber_roof_structure": {"rate": 1400.0, "unit": "m²", "description": "Timber roof structure, supply & erect"},

    # Finishes (per m²)
    "plaster_internal":  {"rate": 220.0, "unit": "m²", "description": "Internal 15mm cement plaster"},
    "plaster_external":  {"rate": 260.0, "unit": "m²", "description": "External 20mm cement plaster"},
    "screed_floor":      {"rate": 180.0, "unit": "m²", "description": "50mm cement screed to floor"},
    "tiles_ceramic":     {"rate": 450.0, "unit": "m²", "description": "300×300 ceramic floor tiles, supply & lay"},

    # Gravel Roads (per m per km)
    "gravel_wearing_course": {"rate": 48000.0, "unit": "km", "description": "150mm gravel wearing course, 6m wide"},
    "culvert_900mm_conc":    {"rate": 12000.0, "unit": "each", "description": "900mm dia concrete pipe culvert"},
}
