"""Interim Payment Certificate generator."""

from typing import Any

from government.portfolio_database import add_certificate, get_certificates, get_project_raw, get_variations


def generate_certificate(project_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    project = get_project_raw(project_id)
    if not project:
        return {"error": "Project not found"}

    contract = float(payload.get("contract_value_usd") or project.get("contract_value_usd") or 0)
    prev_gross = float(payload.get("previous_cumulative_gross_usd", 0))
    works = float(payload.get("works_value_usd", payload.get("works_value", 0)))
    materials = float(payload.get("materials_on_site_usd", payload.get("materials_on_site", 0)))
    retention_pct = float(payload.get("retention_pct", 10))

    cumulative_gross = prev_gross + works + materials
    retention = cumulative_gross * retention_pct / 100
    cumulative_net = cumulative_gross - retention

    prev_certs = get_certificates(project_id)
    prev_net = float(prev_certs[-1]["cumulative_certified"]) if prev_certs else prev_gross * (1 - retention_pct / 100)
    if payload.get("previous_net_certified_usd"):
        prev_net = float(payload["previous_net_certified_usd"])

    cert_amount = cumulative_net - prev_net
    pct_complete = cumulative_gross / contract * 100 if contract else 0
    balance = contract - cumulative_gross

    variations = get_variations(project_id)
    approved_vars = [v for v in variations if v.get("status") == "approved"]
    var_total = sum(float(v.get("value_usd") or 0) for v in approved_vars)

    cert_no = len(prev_certs) + 1
    record = add_certificate(project_id, {
        "certificate_no": cert_no,
        "period_from": payload.get("period_from", ""),
        "period_to": payload.get("period_to", ""),
        "works_value": works,
        "materials_on_site": materials,
        "gross_amount": cumulative_gross,
        "retention_pct": retention_pct,
        "retention_amount": retention,
        "net_certificate": cert_amount,
        "cumulative_certified": cumulative_net,
        "balance_to_complete": balance,
        "status": "draft",
    })

    exchange = float(payload.get("exchange_rate", 26.5))
    currency = payload.get("currency", "ZMW")

    document = f"""
MINISTRY OF INFRASTRUCTURE, HOUSING AND URBAN DEVELOPMENT
REPUBLIC OF ZAMBIA

INTERIM PAYMENT CERTIFICATE No. {cert_no}
{'=' * 55}
PROJECT:    {project.get('project_name', '')}
CONTRACT:   {project.get('project_code', '')}
CONTRACTOR: {project.get('contractor_name', '')}
CONSULTANT: {project.get('consultant_name', '')}
EMPLOYER:   Ministry of Infrastructure
{'=' * 55}

PERIOD:     {payload.get('period_from', '')} to {payload.get('period_to', '')}

SECTION A — VALUE OF WORK EXECUTED
Cumulative value to previous certificate:  USD {prev_gross:,.0f}
Value of work this period:               USD {works:,.0f}
Materials on site (this period):         USD {materials:,.0f}
CUMULATIVE GROSS VALUE:                  USD {cumulative_gross:,.0f}

SECTION B — RETENTION
Retention @ {retention_pct}%:              USD ({retention:,.0f})
CUMULATIVE NET VALUE:                    USD {cumulative_net:,.0f}

SECTION C — PREVIOUS CERTIFICATES
Total previously certified (net):        USD {prev_net:,.0f}
AMOUNT DUE THIS CERTIFICATE:             USD {cert_amount:,.0f}

SECTION D — VARIATIONS
Approved variations to date:             USD {var_total:,.0f}

SECTION E — CONTRACT SUMMARY
Original contract sum:                   USD {contract:,.0f}
Current contract sum:                    USD {contract + var_total:,.0f}
Cumulative certified (gross):            USD {cumulative_gross:,.0f}
% Complete:                              {pct_complete:.1f}%
Balance to complete:                     USD {balance:,.0f}

Local currency ({currency} @ {exchange}):
Amount due this certificate:             {currency} {cert_amount * exchange:,.0f}

Prepared using InfraAfrica Government Platform
"""

    return {
        "status": "complete",
        "certificate": record,
        "calculations": {
            "cumulative_gross_usd": round(cumulative_gross, 0),
            "retention_usd": round(retention, 0),
            "cumulative_net_usd": round(cumulative_net, 0),
            "previous_net_usd": round(prev_net, 0),
            "certificate_amount_usd": round(cert_amount, 0),
            "pct_complete": round(pct_complete, 1),
            "balance_to_complete_usd": round(balance, 0),
        },
        "document_text": document.strip(),
        "format": "text",
    }
