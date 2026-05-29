"""South African National Standards (SANS) steel section database and lookup utilities."""

SANS_UNIVERSAL_BEAMS = {
    "203x133x25": {"mass_kg_m": 25.1, "A_cm2": 32.0, "Ixx_cm4": 2340.0, "Iyy_cm4": 308.0, "Zxx_cm3": 231.0, "Zyy_cm3": 46.3, "Sxx_cm3": 258.0, "rx_cm": 8.55, "tf_mm": 7.8, "tw_mm": 5.7},
    "254x146x31": {"mass_kg_m": 31.1, "A_cm2": 39.7, "Ixx_cm4": 4410.0, "Iyy_cm4": 512.0, "Zxx_cm3": 348.0, "Zyy_cm3": 70.1, "Sxx_cm3": 393.0, "rx_cm": 10.5, "tf_mm": 8.6, "tw_mm": 6.0},
    "305x165x40": {"mass_kg_m": 40.3, "A_cm2": 51.3, "Ixx_cm4": 8500.0, "Iyy_cm4": 945.0, "Zxx_cm3": 561.0, "Zyy_cm3": 115.0, "Sxx_cm3": 623.0, "rx_cm": 12.9, "tf_mm": 10.2, "tw_mm": 6.0},
    "356x171x45": {"mass_kg_m": 45.3, "A_cm2": 57.7, "Ixx_cm4": 12100.0, "Iyy_cm4": 1120.0, "Zxx_cm3": 681.0, "Zyy_cm3": 131.0, "Sxx_cm3": 765.0, "rx_cm": 14.5, "tf_mm": 9.7, "tw_mm": 7.0},
}

SANS_UNIVERSAL_COLUMNS = {
    "152x152x23": {"mass_kg_m": 23.0, "A_cm2": 29.3, "Ixx_cm4": 1250.0, "Iyy_cm4": 400.0, "Zxx_cm3": 164.0, "Zyy_cm3": 52.6, "Sxx_cm3": 182.0, "rx_cm": 6.53, "tf_mm": 6.8, "tw_mm": 5.8},
    "203x203x46": {"mass_kg_m": 46.1, "A_cm2": 58.7, "Ixx_cm4": 4570.0, "Iyy_cm4": 1540.0, "Zxx_cm3": 450.0, "Zyy_cm3": 152.0, "Sxx_cm3": 497.0, "rx_cm": 8.82, "tf_mm": 11.0, "tw_mm": 7.2},
    "254x254x73": {"mass_kg_m": 73.1, "A_cm2": 93.1, "Ixx_cm4": 11400.0, "Iyy_cm4": 3890.0, "Zxx_cm3": 896.0, "Zyy_cm3": 307.0, "Sxx_cm3": 992.0, "rx_cm": 11.1, "tf_mm": 14.2, "tw_mm": 8.6},
}

SANS_RHS = {
    "100x50x4": {"mass_kg_m": 8.6, "A_cm2": 11.0, "Ixx_cm4": 142.0, "Iyy_cm4": 47.0, "Zxx_cm3": 28.4, "Zyy_cm3": 18.8, "Sxx_cm3": 35.0, "rx_cm": 3.6, "tf_mm": 4.0, "tw_mm": 4.0},
    "150x75x5": {"mass_kg_m": 16.5, "A_cm2": 21.0, "Ixx_cm4": 620.0, "Iyy_cm4": 205.0, "Zxx_cm3": 82.7, "Zyy_cm3": 54.7, "Sxx_cm3": 98.0, "rx_cm": 5.4, "tf_mm": 5.0, "tw_mm": 5.0},
    "200x100x6": {"mass_kg_m": 26.2, "A_cm2": 33.4, "Ixx_cm4": 1850.0, "Iyy_cm4": 620.0, "Zxx_cm3": 185.0, "Zyy_cm3": 124.0, "Sxx_cm3": 220.0, "rx_cm": 7.4, "tf_mm": 6.0, "tw_mm": 6.0},
}

SANS_CHS = {
    "114x4": {"mass_kg_m": 10.9, "A_cm2": 13.9, "Ixx_cm4": 211.0, "Iyy_cm4": 211.0, "Zxx_cm3": 36.9, "Zyy_cm3": 36.9, "Sxx_cm3": 48.0, "rx_cm": 3.9, "tf_mm": 4.0, "tw_mm": 4.0},
    "165x5": {"mass_kg_m": 19.8, "A_cm2": 25.2, "Ixx_cm4": 820.0, "Iyy_cm4": 820.0, "Zxx_cm3": 99.4, "Zyy_cm3": 99.4, "Sxx_cm3": 130.0, "rx_cm": 5.7, "tf_mm": 5.0, "tw_mm": 5.0},
    "219x6": {"mass_kg_m": 31.5, "A_cm2": 40.1, "Ixx_cm4": 2340.0, "Iyy_cm4": 2340.0, "Zxx_cm3": 214.0, "Zyy_cm3": 214.0, "Sxx_cm3": 280.0, "rx_cm": 7.5, "tf_mm": 6.0, "tw_mm": 6.0},
}


def get_section(section_id: str) -> dict:
    """Find and return properties of a SANS steel section by ID."""
    all_sections = {}
    all_sections.update(SANS_UNIVERSAL_BEAMS)
    all_sections.update(SANS_UNIVERSAL_COLUMNS)
    all_sections.update(SANS_RHS)
    all_sections.update(SANS_CHS)
    
    return all_sections.get(section_id, {})


def list_sections(section_type: str) -> list[str]:
    """List section IDs of a specific type ('ub', 'uc', 'rhs', 'chs')."""
    mapping = {
        "ub": SANS_UNIVERSAL_BEAMS,
        "uc": SANS_UNIVERSAL_COLUMNS,
        "rhs": SANS_RHS,
        "chs": SANS_CHS,
    }
    db = mapping.get(section_type.lower())
    if db is None:
        return []
    return list(db.keys())


def find_minimum_section(section_type: str, Ixx_min: float = 0.0, Zyy_min: float = 0.0, mass_max: float = 999.0) -> str:
    """Find the lightest section (minimum mass) satisfying inertia and modulus constraints."""
    sections_list = list_sections(section_type)
    best_section = ""
    min_mass = mass_max

    for sec_id in sections_list:
        props = get_section(sec_id)
        if not props:
            continue
        
        # SANS database values are in cm4 and cm3. Convert check limits accordingly
        # Let's assume input parameters are in standard SI (cm4/cm3) to match SANS
        if props["Ixx_cm4"] >= Ixx_min and props["Zyy_cm3"] >= Zyy_min and props["mass_kg_m"] < min_mass:
            min_mass = props["mass_kg_m"]
            best_section = sec_id
            
    return best_section
