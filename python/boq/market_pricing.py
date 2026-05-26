"""Dynamic Market Pricing API Integrations (Mocked for Blueprint 10)."""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Mocked external live market DB (e.g. bridging to a real supplier API in the future)
MOCK_LIVE_PRICES = {
    "ZM": {
        "concrete_30mpa": {"min": 145.0, "max": 160.0},
        "rebar_h": {"min": 980.0, "max": 1050.0},
        "cement_portland": {"min": 7.5, "max": 8.5},
    },
    "NG": {
        "concrete_30mpa": {"min": 130.0, "max": 150.0},
        "rebar_h": {"min": 900.0, "max": 1000.0},
        "cement_portland": {"min": 6.5, "max": 8.0},
    },
    "KE": {
        "concrete_30mpa": {"min": 155.0, "max": 170.0},
        "rebar_h": {"min": 1100.0, "max": 1200.0},
        "cement_portland": {"min": 8.0, "max": 9.5},
    }
}

def fetch_live_market_price(material_id: str, country_code: str) -> Optional[dict[str, float]]:
    """
    Fetches the live market price for a material in a specific country.
    Returns a dict with 'min' and 'max' USD prices, or None if the API fails/doesn't have it.
    """
    try:
        cc = country_code.upper()
        if cc in MOCK_LIVE_PRICES:
            if material_id in MOCK_LIVE_PRICES[cc]:
                logger.info(f"Successfully fetched live market price for {material_id} in {cc}")
                return MOCK_LIVE_PRICES[cc][material_id]
        return None
    except Exception as e:
        logger.warning(f"Failed to fetch live market price for {material_id}: {e}")
        return None
