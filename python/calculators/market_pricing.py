import random
import datetime
from pydantic import BaseModel
from typing import List, Dict

class PricingRequest(BaseModel):
    materials: List[str]
    currency: str = "USD"

def get_live_pricing(req: PricingRequest) -> dict:
    """
    Simulates fetching live market spot prices for infrastructure commodities.
    In a production system, this would connect to LME (London Metal Exchange) 
    or regional supplier APIs.
    """
    
    # Base market rates in USD per unit
    base_prices = {
        "steel_rebar_ton": 620.50,
        "concrete_m3": 115.00,
        "cement_bag_50kg": 4.50,
        "copper_cable_m": 12.30,
        "aluminum_sheet_sqm": 24.80,
        "pvc_pipe_m": 3.20,
        "glass_sqm": 45.00,
        "timber_cbm": 350.00,
        "asphalt_ton": 75.00,
        "transformer_160mva": 1250000.00,
        "solar_panel_watt": 0.22,
        "labor_unskilled_day": 15.00,
        "labor_skilled_day": 45.00
    }
    
    # Apply daily market fluctuation (pseudo-random based on date)
    today_seed = datetime.datetime.now().timetuple().tm_yday
    random.seed(today_seed)
    
    results = {}
    for mat in req.materials:
        mat_key = mat.lower()
        if mat_key in base_prices:
            # Fluctuate between -3% and +3% daily
            fluctuation = random.uniform(0.97, 1.03)
            current_price = base_prices[mat_key] * fluctuation
            results[mat_key] = round(current_price, 2)
        else:
            # Generic estimate for unknown materials
            results[mat_key] = round(random.uniform(50, 500), 2)
            
    exchange_rates = {
        "USD": 1.0,
        "EUR": 0.92,
        "GBP": 0.79,
        "ZMW": 25.5,
        "KES": 132.4,
        "ZAR": 18.9
    }
    
    fx = exchange_rates.get(req.currency.upper(), 1.0)
    
    final_prices = {k: round(v * fx, 2) for k, v in results.items()}
    
    return {
        "status": "success",
        "currency": req.currency.upper(),
        "date": datetime.datetime.now().isoformat(),
        "prices": final_prices,
        "source": "LME/Regional Supplier Aggregate (Simulated)"
    }
