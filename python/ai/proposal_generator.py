"""Client proposal generator combining design + geo + BoQ."""

import html
from datetime import datetime
from typing import Any


def generate_proposal_html(payload: dict[str, Any]) -> str:
    brief = payload.get("design_brief", {})
    geo = payload.get("geo_data") or {}
    boq = payload.get("boq_summary") or {}
    project = html.escape(payload.get("project_name", "Project"))
    client = html.escape(payload.get("client_name", "Client"))

    spaces = brief.get("spatial_programme", [])
    space_rows = "".join(
        f"<tr><td>{html.escape(s.get('space',''))}</td><td>{s.get('area_m2',0)} m²</td>"
        f"<td>{html.escape(s.get('notes',''))}</td></tr>"
        for s in spaces
    )

    cost = brief.get("preliminary_cost_estimate", {})
    exec_geo = geo.get("executive_summary", geo)

    return f"""<!DOCTYPE html><html><head><meta charset='utf-8'>
<style>
body {{ font-family: Georgia, serif; margin: 40px; color: #111; }}
h1 {{ color: #1a2744; border-bottom: 3px solid #1a2744; }}
h2 {{ color: #0f3460; margin-top: 24px; }}
table {{ border-collapse: collapse; width: 100%; margin: 12px 0; }}
td, th {{ border: 1px solid #ccc; padding: 8px; }}
th {{ background: #1a2744; color: white; }}
.sig {{ margin-top: 60px; border-top: 1px solid #333; width: 300px; padding-top: 8px; }}
</style></head><body>
<h1>PROFESSIONAL ENGINEERING PROPOSAL</h1>
<p><strong>Project:</strong> {project}<br>
<strong>Client:</strong> {client}<br>
<strong>Date:</strong> {datetime.now():%d %B %Y}<br>
<strong>Prepared using:</strong> ARCHITEX-CAD Platform v1.0</p>

<h2>Section 1 — Project Understanding</h2>
<p>{html.escape(brief.get('description', ''))}</p>
<p>Gross floor area: {brief.get('gross_floor_area', 0)} m² | Storeys: {brief.get('storeys', 1)}</p>

<h2>Section 2 — Site Assessment</h2>
<p>Buildability: {exec_geo.get('buildability_score', 'N/A')}/10 |
Soil: {html.escape(str(exec_geo.get('soil_conditions', geo.get('uscs_classification', 'N/A'))))} |
Rainfall: {exec_geo.get('annual_rainfall_mm', 'N/A')} mm/yr |
Seismic: {html.escape(str(exec_geo.get('seismic_risk', 'Low')))}</p>

<h2>Section 3 — Proposed Design</h2>
<table><tr><th>Space</th><th>Area</th><th>Notes</th></tr>{space_rows}</table>
<p><strong>Structure:</strong> {html.escape(str(brief.get('structural_scheme', {})))}</p>

<h2>Section 4 — Preliminary Cost</h2>
<p>Construction: USD {cost.get('construction_cost_usd', boq.get('construction_cost_usd', 'TBC')):,}<br>
Total project: USD {cost.get('total_project_cost_usd', boq.get('total_project_estimate_usd', 'TBC')):,}<br>
Assessment: {cost.get('budget_assessment', 'Preliminary')}</p>

<h2>Section 5 — Professional Recommendation</h2>
<p>Proceed to detailed structural calculations and ground investigation before construction commencement.
All designs to comply with {html.escape(payload.get('design_code', 'Eurocode 2'))}.</p>

<div class='sig'>Signed: ____________________<br>Professional Engineer</div>
<p style='font-size:9pt;color:#666'>Rates indicative. Obtain competitive tenders before committing.</p>
</body></html>"""


def generate_proposal(payload: dict[str, Any]) -> dict[str, Any]:
    html_content = generate_proposal_html(payload)
    return {
        "status": "complete",
        "format": "html",
        "content": html_content,
        "project_name": payload.get("project_name", ""),
    }
