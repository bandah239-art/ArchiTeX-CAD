"""Site intelligence report generator."""

import html
import os
import tempfile
from datetime import datetime
from typing import Any

from geo.geo_intelligence import run_site_analysis


def _html_report(analysis: dict[str, Any]) -> str:
    terrain = analysis.get("terrain", {})
    soil = analysis.get("soil", {})
    climate = analysis.get("climate", {})
    seismic = analysis.get("seismic", {})
    exec_sum = analysis.get("executive_summary", {})
    params = analysis.get("design_parameters", {})
    project = html.escape(analysis.get("project_name", "Site Report"))

    recs = "".join(f"<li>{html.escape(r)}</li>" for r in analysis.get("recommendations", []))
    monthly = climate.get("monthly_rainfall_mm", {})
    rain_rows = "".join(f"<tr><td>{k}</td><td>{v}mm</td></tr>" for k, v in monthly.items())

    return f"""<!DOCTYPE html><html><head><meta charset='utf-8'>
<style>
body {{ font-family: Arial, sans-serif; margin: 24px; color: #111; }}
h1 {{ color: #1a2744; }} h2 {{ color: #0f3460; border-bottom: 2px solid #1a2744; }}
table {{ border-collapse: collapse; width: 100%; margin: 12px 0; }}
td, th {{ border: 1px solid #ddd; padding: 8px; }}
th {{ background: #1a2744; color: white; }}
.footer {{ margin-top: 40px; font-size: 9pt; color: #666; }}
</style></head><body>
<h1>SITE INTELLIGENCE REPORT</h1>
<p><strong>Project:</strong> {project}<br>
<strong>Location:</strong> {analysis.get('latitude')}, {analysis.get('longitude')} — {analysis.get('country_code')}<br>
<strong>Prepared:</strong> {datetime.now():%d %B %Y}<br>
<strong>Platform:</strong> InfraAfrica Geo Intelligence</p>

<h2>EXECUTIVE SUMMARY</h2>
<table>
<tr><td>Buildability Score</td><td>{exec_sum.get('buildability_score')}/10 — {exec_sum.get('buildability_label')}</td></tr>
<tr><td>Soil</td><td>{soil.get('uscs_classification')}</td></tr>
<tr><td>Seismic</td><td>{exec_sum.get('seismic_risk')}</td></tr>
<tr><td>Flood Risk</td><td>{exec_sum.get('flood_risk')}</td></tr>
<tr><td>Annual Rainfall</td><td>{climate.get('annual_rainfall_mm')}mm ({climate.get('climate_zone')})</td></tr>
<tr><td>Design Wind</td><td>{climate.get('design_wind_speed_ms')} m/s</td></tr>
</table>

<h2>1. LOCATION AND TERRAIN</h2>
<p>Elevation: {terrain.get('elevation_m')}m | Slope: {terrain.get('slope_deg')}° | Aspect: {terrain.get('aspect')}<br>
Earthworks estimate: {terrain.get('earthworks_m3')} m³</p>

<h2>2. SOIL INTELLIGENCE</h2>
<p>Classification: {soil.get('uscs_classification')}<br>
Clay {soil.get('clay_pct')}% | Sand {soil.get('sand_pct')}% | Silt {soil.get('silt_pct')}%<br>
CBR: {soil.get('cbr_range_pct')[0]}–{soil.get('cbr_range_pct')[1]}% | Bearing: {soil.get('bearing_capacity_range_knm2')[0]}–{soil.get('bearing_capacity_range_knm2')[1]} kN/m²<br>
Recommendation: {soil.get('founding_recommendation')}</p>

<h2>3. CLIMATE DATA</h2>
<p>Wet season months: {climate.get('wet_season_months')} | Dry season: {climate.get('dry_season_months')}<br>
Design rainfall (10yr): {climate.get('design_rainfall_10yr_mmhr')} mm/hr</p>
<table><tr><th>Month</th><th>Rainfall</th></tr>{rain_rows}</table>

<h2>4. WIND DATA</h2>
<p>Mean wind: {climate.get('mean_wind_kmh')} km/h | Design Vb: {climate.get('design_wind_speed_ms')} m/s</p>

<h2>5. SEISMIC ASSESSMENT</h2>
<p>SDC {seismic.get('seismic_design_category')} ({seismic.get('sdc_description')}) | PGA {seismic.get('peak_ground_acceleration_g')}g<br>
{seismic.get('design_implications')}</p>

<h2>6. SOLAR RESOURCE</h2>
<p>GHI: {climate.get('ghi_kwh_m2_day')} kWh/m²/day | Peak sun hours: {climate.get('peak_sun_hours')}<br>
Optimal tilt: {climate.get('optimal_panel_tilt_deg')}° | Assessment: {climate.get('solar_assessment')}</p>

<h2>7. DESIGN PARAMETERS SUMMARY</h2>
<table>
<tr><td>Soil bearing capacity</td><td>{params.get('soil_bearing_range_knm2')[0]}–{params.get('soil_bearing_range_knm2')[1]} kN/m²</td></tr>
<tr><td>Foundation depth min</td><td>{params.get('min_foundation_depth_m')}m</td></tr>
<tr><td>CBR subgrade</td><td>{params.get('cbr_range_pct')[0]}–{params.get('cbr_range_pct')[1]}%</td></tr>
<tr><td>Design wind Vb</td><td>{params.get('design_wind_speed_ms')} m/s</td></tr>
<tr><td>Design rainfall (10yr)</td><td>{params.get('design_rainfall_10yr_mmhr')} mm/hr</td></tr>
<tr><td>Seismic zone</td><td>SDC {params.get('seismic_design_category')}</td></tr>
</table>

<h2>8. RECOMMENDATIONS</h2>
<ul>{recs}</ul>
<div class='footer'>
Data Sources: {', '.join(analysis.get('data_sources', []))}<br>
Disclaimer: Geo intelligence is indicative only. Professional site investigation required before design.
</div></body></html>"""


def generate_site_report(payload: dict[str, Any], output_path: str | None = None) -> dict[str, Any]:
    analysis = run_site_analysis(payload)
    html_content = _html_report(analysis)

    if not output_path:
        fd, output_path = tempfile.mkstemp(suffix=".pdf", prefix="infraafrica_site_")
        os.close(fd)

    file_type = "pdf"
    try:
        from weasyprint import HTML

        HTML(string=html_content).write_pdf(output_path)
    except Exception:
        output_path = output_path.replace(".pdf", ".html")
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        file_type = "html"

    return {
        "status": "complete",
        "analysis": analysis,
        "report_path": output_path,
        "report_type": file_type,
    }
