"""Tender document package generator."""

from datetime import datetime, timedelta
from typing import Any


COUNTRY_ELIGIBILITY = {
    "ZM": [
        "NCC Class appropriate to contract value or equivalent",
        "Tax clearance certificate (ZRA)",
        "PACRA company registration",
        "Three similar works in last 5 years",
    ],
    "KE": ["NCA registration", "KRA tax compliance", "Similar works experience"],
    "NG": ["COREN registration", "FIRS tax clearance", "BPP registration"],
    "GH": ["Ministry of Works registration", "GRA tax clearance"],
}


def generate_tender(payload: dict[str, Any]) -> dict[str, Any]:
    name = payload.get("project_name", "Infrastructure Project")
    employer = payload.get("employer", "Ministry of Infrastructure")
    country = payload.get("country_code", "ZM")
    value = float(payload.get("estimated_value_usd", 0))
    duration = int(payload.get("contract_duration_months", 18))
    closing = payload.get("tender_closing_date", (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"))
    contract_no = payload.get("contract_no") or f"MIH/{datetime.now().year}/{value/1000:.0f}".replace(".", "")
    location = payload.get("location", f"{payload.get('province', 'Lusaka')}, {country}")
    desc = payload.get("project_description", f"Construction and completion of {name}")
    eligibility = COUNTRY_ELIGIBILITY.get(country, COUNTRY_ELIGIBILITY["ZM"])
    financial_capacity = value * 0.25

    invitation = f"""
INVITATION TO TENDER

{employer} hereby invites sealed tenders from eligible contractors for:

{name}
Contract No.: {contract_no}
Location: {location}

SCOPE OF WORK:
{desc}

CONTRACT VALUE (Estimated): USD {value:,.0f}
CONTRACT DURATION: {duration} months
TENDER VALIDITY: 90 days from closing date

ELIGIBILITY REQUIREMENTS:
{chr(10).join(f'- {e}' for e in eligibility)}
- Financial capacity: USD {financial_capacity:,.0f} minimum turnover

TENDER SUBMISSION:
Deadline: {closing} at 14:00 local time
Late tenders: Will not be accepted

TENDER OPENING:
Public opening — tenderers may attend

For enquiries contact the Employer.
"""

    volumes = {
        "volume_1": {
            "title": "Instructions to Tenderers",
            "sections": [
                "Section 1: Invitation to Tender",
                "Section 2: Instructions to Tenderers (ITT)",
                "Section 3: Tender Data Sheet",
                "Section 4: General Conditions of Contract",
                "Section 5: Special Conditions of Contract",
                "Section 6: Contract Data",
            ],
        },
        "volume_2": {
            "title": "Employer's Requirements",
            "sections": [
                "Section 7: Scope of Works",
                "Section 8: Technical Specifications",
                "Section 9: Drawings List",
                "Section 10: Site Information",
            ],
        },
        "volume_3": {
            "title": "Pricing Document",
            "sections": [
                "Section 11: Bill of Quantities",
                "Section 12: Daywork Schedule",
                "Section 13: Schedule of Rates",
            ],
            "boq_summary": payload.get("boq_data", {}),
        },
        "volume_4": {
            "title": "Forms",
            "forms": [
                "Form of Tender",
                "Form of Agreement",
                "Performance Bond Form",
                "Advance Payment Bond Form",
                "Bank Guarantee Form",
                "Tenderer's Declaration",
            ],
        },
    }

    return {
        "status": "complete",
        "contract_no": contract_no,
        "project_name": name,
        "employer": employer,
        "country_code": country,
        "estimated_value_usd": value,
        "tender_closing_date": closing,
        "volumes": volumes,
        "invitation_to_tender": invitation.strip(),
        "content": invitation.strip(),
        "format": "text",
    }
