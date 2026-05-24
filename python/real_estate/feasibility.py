"""Development feasibility appraisal engine."""

from typing import Any

BUILD_RATES: dict[str, dict[str, tuple[float, float]]] = {
    "ZM": {"economy": (220, 280), "standard": (320, 420), "premium": (520, 720)},
    "KE": {"economy": (280, 350), "standard": (400, 520), "premium": (650, 900)},
    "NG": {"economy": (180, 240), "standard": (280, 380), "premium": (480, 680)},
    "GH": {"economy": (200, 260), "standard": (300, 400), "premium": (500, 750)},
}

YIELDS = {
    "residential_single": {"Lusaka": (7, 9), "Nairobi": (5, 7), "default": (6, 8)},
    "commercial_offices": {"Lusaka": (9, 11), "Nairobi": (7, 9), "default": (8, 10)},
}


def _scenario(tdc: float, revenue: float, cost_adj: float, rev_adj: float) -> dict[str, float]:
    adj_tdc = tdc * cost_adj
    adj_rev = revenue * rev_adj
    profit = adj_rev - adj_tdc
    poc = profit / adj_tdc * 100 if adj_tdc else 0
    return {"tdc": round(adj_tdc, 0), "revenue": round(adj_rev, 0), "profit": round(profit, 0), "profit_on_cost_pct": round(poc, 1)}


def run_feasibility(payload: dict[str, Any]) -> dict[str, Any]:
    plot = payload.get("plot_data", {})
    land_cost = float(plot.get("asking_price_usd", payload.get("land_cost_usd", 45000)))
    country = payload.get("country_code", "ZM")
    city = payload.get("city", "Lusaka")
    gfa = float(payload.get("gross_floor_area_m2", 250))
    standard = payload.get("construction_standard", "standard")
    units = int(payload.get("units_planned", 1))
    sale_price = float(payload.get("target_sale_price_per_m2", 750))
    monthly_rent = float(payload.get("target_rental_per_month", 0))
    finance = payload.get("finance_type", "cash")
    loan_pct = float(payload.get("loan_percentage", 0)) / 100
    annual_rate = float(payload.get("interest_rate_annual", 0)) / 100
    term_months = int(payload.get("loan_term_months", 0))

    transfer_tax = land_cost * 0.05
    legal = land_cost * 0.015
    survey = 800
    total_land = land_cost + transfer_tax + legal + survey

    rates = BUILD_RATES.get(country, BUILD_RATES["ZM"]).get(standard, (320, 420))
    build_rate = (rates[0] + rates[1]) / 2
    construction = gfa * build_rate

    prof_rate = 0.10 if gfa <= 300 else 0.135
    prof_fees = construction * prof_rate

    dev_type = payload.get("development_type", "residential_single")
    if dev_type == "residential_single" and gfa <= 350:
        external = 12000 + gfa * 20
    else:
        external = 28000
    contingency = construction * 0.10

    finance_cost = 0.0
    loan_amount = 0.0
    if finance != "cash" and loan_pct > 0:
        loan_amount = (total_land + construction) * loan_pct
        monthly_rate = annual_rate / 12
        finance_cost = loan_amount * monthly_rate * (term_months / 2)

    tdc = total_land + construction + prof_fees + external + contingency + finance_cost

    gdv = units * gfa / max(units, 1) * sale_price * units if sale_price else gfa * sale_price
    if units > 1:
        gdv = gfa * sale_price
    selling_costs = gdv * 0.04
    net_sales = gdv - selling_costs

    yield_band = YIELDS.get(dev_type, YIELDS["residential_single"]).get(city, (6, 8))
    yield_mid = (yield_band[0] + yield_band[1]) / 2 / 100

    annual_rent = units * monthly_rent * 12 if monthly_rent else 0
    net_rent = annual_rent * 0.90 * 0.92
    capital_value = net_rent / yield_mid if net_rent and yield_mid else 0

    revenue = net_sales if sale_price > 0 else capital_value
    profit = revenue - tdc
    poc = profit / tdc * 100 if tdc else 0

    if poc > 25:
        viability = "EXCELLENT"
    elif poc > 20:
        viability = "GOOD — proceed with confidence"
    elif poc > 15:
        viability = "ACCEPTABLE"
    elif poc > 10:
        viability = "MINIMUM VIABLE"
    else:
        viability = "MARGINAL — high risk"

    equity = tdc - loan_amount
    roe = profit / equity * 100 if equity > 0 else poc
    dev_yield = net_rent / tdc * 100 if tdc and net_rent else 0
    payback = tdc / net_rent if net_rent else None

    return {
        "status": "complete",
        "land_cost_usd": round(total_land, 0),
        "construction_cost_usd": round(construction, 0),
        "construction_rate_per_m2": build_rate,
        "professional_fees_usd": round(prof_fees, 0),
        "external_works_usd": external,
        "finance_cost_usd": round(finance_cost, 0),
        "contingency_usd": round(contingency, 0),
        "total_development_cost_usd": round(tdc, 0),
        "gross_development_value_usd": round(gdv, 0),
        "net_revenue_usd": round(revenue, 0),
        "profit_usd": round(profit, 0),
        "profit_on_cost_pct": round(poc, 1),
        "return_on_equity_pct": round(roe, 1),
        "development_yield_pct": round(dev_yield, 1),
        "payback_years": round(payback, 1) if payback else None,
        "viability_assessment": viability,
        "sensitivity": {
            "bear_case": _scenario(tdc, revenue, 1.15, 0.90),
            "base_case": _scenario(tdc, revenue, 1.0, 1.0),
            "bull_case": _scenario(tdc, revenue, 0.95, 1.10),
        },
        "break_even_sale_price_per_m2": round(tdc / gfa, 0) if gfa else 0,
    }
