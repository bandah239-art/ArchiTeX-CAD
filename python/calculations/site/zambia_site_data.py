"""Zambian Site Intelligence data lookup and calculations."""

import math
from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value

# Rainfall IDF curves parameters for major Zambian cities: i = a / (t + b)^c
# Fitted from historical Zambia meteorological data for various return periods
ZAMBIA_IDF = {
    "Lusaka": {
        2: {"a": 650.0, "b": 12.0, "c": 0.85},
        5: {"a": 820.0, "b": 14.0, "c": 0.86},
        10: {"a": 980.0, "b": 15.0, "c": 0.87},
        25: {"a": 1180.0, "b": 16.0, "c": 0.88},
        50: {"a": 1350.0, "b": 18.0, "c": 0.90},
        100: {"a": 1550.0, "b": 20.0, "c": 0.92},
    },
    "Ndola": {
        2: {"a": 700.0, "b": 13.0, "c": 0.84},
        10: {"a": 1050.0, "b": 16.0, "c": 0.86},
        50: {"a": 1420.0, "b": 19.0, "c": 0.89},
        100: {"a": 1620.0, "b": 21.0, "c": 0.91},
    },
    "Livingstone": {
        2: {"a": 550.0, "b": 11.0, "c": 0.86},
        10: {"a": 840.0, "b": 14.0, "c": 0.88},
        50: {"a": 1150.0, "b": 17.0, "c": 0.91},
        100: {"a": 1320.0, "b": 19.0, "c": 0.93},
    },
    "Chipata": {
        2: {"a": 620.0, "b": 12.0, "c": 0.85},
        10: {"a": 940.0, "b": 15.0, "c": 0.87},
        50: {"a": 1290.0, "b": 18.0, "c": 0.90},
        100: {"a": 1480.0, "b": 20.0, "c": 0.92},
    },
}


def get_zambia_site_data(lat: float, lon: float) -> dict[str, Any]:
    """Retrieve localized wind, seismic, rainfall, and soil classification parameters for Zambia."""
    # Determine nearest city / province
    # Lusaka center is approx lat -15.4, lon 28.3
    # Copperbelt (Ndola) is approx lat -13.0, lon 28.6
    # Livingstone is approx lat -17.85, lon 25.85
    # Chipata is approx lat -13.6, lon 32.6
    
    # Distance utility
    def dist(la1, lo1, la2, lo2):
        return math.sqrt((la1 - la2) ** 2 + (lo1 - lo2) ** 2)

    cities = [
        ("Lusaka", -15.4167, 28.2833),
        ("Ndola", -12.9667, 28.6333),
        ("Livingstone", -17.8500, 25.8500),
        ("Chipata", -13.6333, 32.6500),
    ]
    
    closest_city = min(cities, key=lambda c: dist(lat, lon, c[1], c[2]))[0]
    
    # 1. Wind speed from ZABS / BS 6399
    # Lusaka 24 m/s, Copperbelt 26 m/s, Kafue 25 m/s, Livingstone 22 m/s, Chipata 23 m/s
    if closest_city == "Lusaka":
        wind_speed = 24.0
        province = "Lusaka"
        altitude_est = 1280.0
    elif closest_city == "Ndola":
        wind_speed = 26.0
        province = "Copperbelt"
        altitude_est = 1300.0
    elif closest_city == "Livingstone":
        wind_speed = 22.0
        province = "Southern"
        altitude_est = 900.0
    else:
        wind_speed = 23.0
        province = "Eastern"
        altitude_est = 1030.0

    # Basic wind pressure: q = 0.5 * rho * Vz^2 / 1000 (kPa)
    # Assume rho = 1.2 kg/m3, Vz = V_basic
    basic_pressure = 0.5 * 1.2 * (wind_speed ** 2) / 1000.0

    # 2. Seismic PGA (seismically benign region)
    # Central 0.04g, Copperbelt 0.03g, Eastern 0.05g, Lusaka 0.04g, Southern 0.04g
    pga = 0.04
    if province == "Copperbelt":
        pga = 0.03
    elif province == "Eastern":
        pga = 0.05

    seismic_note = "Zambia is seismically benign. Seismic hazard is low; standard structural robustness is sufficient."

    # 3. Rainfall IDF Lookup
    city_idf = ZAMBIA_IDF.get(closest_city, ZAMBIA_IDF["Lusaka"])
    idf_points = {}
    
    # Calculate intensity for 15-minute duration (t=15 min) for 10-year return
    t_min = 15.0
    param_10yr = city_idf.get(10, city_idf[10])
    intensity_10yr = param_10yr["a"] / ((t_min + param_10yr["b"]) ** param_10yr["c"])

    # 4. Soil Probability
    # Black Cotton Soil: high risk in Lusaka basin and Kafue flats
    in_lusaka_basin = (-15.6 <= lat <= -15.2) and (28.1 <= lon <= 28.5)
    in_kafue_flats = (-16.0 <= lat <= -15.5) and (27.0 <= lon <= 28.2)
    
    if in_lusaka_basin or in_kafue_flats:
        soil_risk = "HIGH"
        soil_type = "CH Expansive Clay (Black Cotton Soil)"
        soil_color = "red"
    elif province == "Copperbelt":
        soil_risk = "MODERATE"
        soil_type = "Lateritic Gravelly Soils"
        soil_color = "yellow"
    elif closest_city == "Livingstone":
        soil_risk = "LOW"
        soil_type = "Kalahari Sandy Soils"
        soil_color = "green"
    else:
        soil_risk = "LOW"
        soil_type = "Quartzite / Weathered Rock"
        soil_color = "green"

    # Altitude check
    alt_warning = "Altitude affects concrete mix design. No correction required below 2000m in Zambia."

    return {
        "status": "ok",
        "coordinates": {"latitude": lat, "longitude": lon},
        "region": {
            "closest_city": closest_city,
            "province": province,
            "altitude_m": altitude_est,
            "altitude_note": alt_warning
        },
        "wind": {
            "zone_speed_ms": wind_speed,
            "basic_pressure_kpa": round_value(basic_pressure, 3),
            "design_code": "ZABS/BS 6399"
        },
        "seismic": {
            "pga_g": pga,
            "design_ground_type": "B",
            "narrative": seismic_note
        },
        "hydrology": {
            "fitted_city": closest_city,
            "idf_intensity_15min_10yr_mm_hr": round_value(intensity_10yr, 1),
            "coefficients": city_idf
        },
        "soil_prior": {
            "soil_type": soil_type,
            "expansion_risk": soil_risk,
            "risk_color": soil_color
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
