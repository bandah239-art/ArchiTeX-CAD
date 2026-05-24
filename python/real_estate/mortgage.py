"""African mortgage calculator."""

from typing import Any

MORTGAGE_MARKETS = {
    "ZM": {"rate_range": (23, 28), "term_years": (10, 20), "ltv_max": 0.80, "currency": "ZMW", "rate_usd_equiv": 0.25},
    "KE": {"rate_range": (13, 16), "term_years": (15, 25), "ltv_max": 0.90, "currency": "KES", "rate_usd_equiv": 0.14},
    "NG": {"rate_range": (18, 25), "term_years": (5, 20), "ltv_max": 0.70, "currency": "NGN", "rate_usd_equiv": 0.20},
    "GH": {"rate_range": (22, 28), "term_years": (10, 20), "ltv_max": 0.80, "currency": "GHS", "rate_usd_equiv": 0.24},
}


def calculate_mortgage(payload: dict[str, Any]) -> dict[str, Any]:
    country = payload.get("country_code", "ZM")
    property_value = float(payload.get("property_value_usd", 100000))
    deposit_pct = float(payload.get("deposit_pct", 20)) / 100
    term_years = int(payload.get("term_years", 15))
    annual_rate = float(payload.get("interest_rate_annual", 0))

    market = MORTGAGE_MARKETS.get(country, MORTGAGE_MARKETS["ZM"])
    if annual_rate <= 0:
        annual_rate = (market["rate_range"][0] + market["rate_range"][1]) / 2 / 100

    principal = property_value * (1 - deposit_pct)
    n = term_years * 12
    r = annual_rate / 12

    if r > 0:
        payment = principal * (r * (1 + r) ** n) / ((1 + r) ** n - 1)
    else:
        payment = principal / n

    total_paid = payment * n
    total_interest = total_paid - principal
    required_income = payment / 0.35

    schedule = []
    balance = principal
    for month in range(1, min(13, n + 1)):
        interest = balance * r
        principal_paid = payment - interest
        balance -= principal_paid
        schedule.append({
            "month": month,
            "payment_usd": round(payment, 2),
            "interest_usd": round(interest, 2),
            "principal_usd": round(principal_paid, 2),
            "balance_usd": round(max(balance, 0), 2),
        })

    from boq.materials_database import EXCHANGE_RATES
    fx = EXCHANGE_RATES.get(country, EXCHANGE_RATES["ZM"])

    affordable = required_income < float(payload.get("monthly_income_usd", required_income * 1.2))

    return {
        "status": "complete",
        "country_code": country,
        "property_value_usd": property_value,
        "loan_principal_usd": round(principal, 0),
        "annual_interest_rate_pct": round(annual_rate * 100, 2),
        "term_years": term_years,
        "monthly_payment_usd": round(payment, 2),
        "monthly_payment_local": round(payment * float(fx["rate"]), 2),
        "local_currency": fx["currency"],
        "total_interest_usd": round(total_interest, 0),
        "total_repaid_usd": round(total_paid, 0),
        "required_monthly_income_usd": round(required_income, 0),
        "affordability": "AFFORDABLE" if affordable else "STRETCH — income may be insufficient",
        "amortisation_schedule": schedule,
        "market_notes": f"{country} typical rates {market['rate_range'][0]}–{market['rate_range'][1]}% p.a.",
    }
