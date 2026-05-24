"""AI Design variant generator — Economy, Standard, Premium."""

from typing import Any

from ai.design_generator import _fallback_brief, generate_design


def generate_variants(payload: dict[str, Any]) -> dict[str, Any]:
    budget = float(payload.get("budget_usd", 45000))
    base = payload.get("base_brief")

    if not base:
        base_result = generate_design(payload)
        base = base_result.get("design_brief", {})

    economy_payload = {**payload, "budget_usd": budget * 0.70, "natural_language_prompt": (
        payload.get("natural_language_prompt", "") + " ECONOMY variant — smaller rooms, basic finishes."
    )}
    premium_payload = {**payload, "budget_usd": budget * 1.40, "natural_language_prompt": (
        payload.get("natural_language_prompt", "") + " PREMIUM variant — larger rooms, carport, solar, security wall."
    )}

    economy = _fallback_brief(economy_payload)["design_brief"]
    economy["variant_label"] = "Economy"
    economy["gross_floor_area"] = round(base.get("gross_floor_area", 142) * 0.75, 1)

    standard = {**base, "variant_label": "Standard"}

    premium = _fallback_brief(premium_payload)["design_brief"]
    premium["variant_label"] = "Premium"
    premium["gross_floor_area"] = round(base.get("gross_floor_area", 142) * 1.25, 1)

    return {
        "status": "complete",
        "variant_a": {"label": "Economy", "budget_usd": budget * 0.70, "brief": economy},
        "variant_b": {"label": "Standard", "budget_usd": budget, "brief": standard},
        "variant_c": {"label": "Premium", "budget_usd": budget * 1.40, "brief": premium},
    }
