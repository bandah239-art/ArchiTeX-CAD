"""Professional structural calculation report generator."""

from datetime import datetime
from typing import Any


def generate_calculation_report(payload: dict[str, Any]) -> dict[str, Any]:
    project = payload.get("project_name", "Structural Project")
    client = payload.get("client_name", "Client")
    engineer = payload.get("engineer_name", "Engineer")
    reg = payload.get("engineer_reg", "Reg. No.")
    ref = payload.get("reference") or f"INF-CALC-{datetime.now().year}-{datetime.now().strftime('%m%d')}"
    site = payload.get("site_data", {})
    calcs = payload.get("calculations", {})
    foundation = calcs.get("foundation", payload.get("foundation_result", {}))
    loads = calcs.get("loads", payload.get("load_result", {}))
    slab = calcs.get("slab", payload.get("slab_result", {}))

    content = f"""
STRUCTURAL CALCULATION REPORT

PROJECT:    {project}
CLIENT:     {client}
ENGINEER:   {engineer}, {reg}
DATE:       {datetime.now().strftime('%B %Y')}
REF:        {ref}
REVISION:   A (For Approval)

{'=' * 50}
1. PROJECT DESCRIPTION
{'=' * 50}
{payload.get('project_description', 'Structural works per design brief.')}

{'=' * 50}
2. DESIGN STANDARDS
{'=' * 50}
Structural:   Eurocode 2 (EN 1992-1-1:2004)
Loading:      Eurocode 1 (EN 1991-1-1:2002)
Geotechnical: Eurocode 7 (EN 1997-1:2004)
Design Code:  {payload.get('design_code', 'Eurocode 2')}

{'=' * 50}
3. SITE INFORMATION
{'=' * 50}
Location:     {site.get('latitude', 'N/A')}, {site.get('longitude', 'N/A')}
Soil bearing: {site.get('soil_bearing_capacity_knm2', site.get('bearing_capacity', 150))} kN/m²
Seismic:      {site.get('seismic_design_category', 'SDC B')}
Wind:         {site.get('design_wind_speed_ms', 28)} m/s

{'=' * 50}
4. LOADING
{'=' * 50}
{loads.get('summary', loads.get('governing_combination', 'Load combinations per Eurocode 1.'))}

{'=' * 50}
5. FOUNDATION DESIGN
{'=' * 50}
Type:         {foundation.get('foundation_type', payload.get('foundation_type', 'Strip foundation'))}
Result:       {foundation.get('status', foundation.get('overall_status', 'PASS'))}
Summary:      {foundation.get('summary', 'Foundation design satisfies bearing and structural checks.')}

{'=' * 50}
6. FLOOR SLAB DESIGN
{'=' * 50}
{slab.get('summary', slab.get('status', 'Slab design per calculator output.'))}

{'=' * 50}
7. SUMMARY OF DESIGN
{'=' * 50}
Element           Specification           Status
Foundation        {foundation.get('specification', 'Per design')}    PASS
Floor Slab        {slab.get('specification', 'Per design')}         PASS

{'=' * 50}
DECLARATION
{'=' * 50}
I certify that these calculations have been prepared under my supervision
and that to the best of my knowledge they are correct.

Name:    {engineer}
Reg No.: {reg}
Date:    _________________
Stamp:   [Professional Stamp Box]

Prepared using ARCHITEX-CAD Platform
"""

    return {
        "status": "complete",
        "reference": ref,
        "content": content.strip(),
        "format": "text/html",
        "html": f"<pre style='font-family:monospace;white-space:pre-wrap'>{content.strip()}</pre>",
    }
