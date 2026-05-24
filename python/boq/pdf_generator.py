"""PDF BoQ export generator."""

import html
import os
import tempfile
from datetime import datetime
from typing import Any


def _html_boq(boq: dict[str, Any], draft: bool = True) -> str:
    summary = boq.get("summary", {})
    project = html.escape(boq.get("project_name", "Project"))
    client = html.escape(boq.get("client", ""))
    country = boq.get("country_code", "ZM")
    watermark = "PRELIMINARY ESTIMATE" if draft else ""

    rows = []
    for key, title in boq.get("section_titles", {}).items():
        lines = boq.get("sections", {}).get(key, [])
        if not lines:
            continue
        rows.append(f"<tr><td colspan='6' class='section'>{html.escape(title)}</td></tr>")
        for line in lines:
            rows.append(
                "<tr>"
                f"<td>{html.escape(str(line.get('element_ref', '')))}</td>"
                f"<td>{html.escape(line.get('description', ''))}</td>"
                f"<td>{html.escape(line.get('unit', ''))}</td>"
                f"<td class='num'>{line.get('quantity', 0):,.2f}</td>"
                f"<td class='num'>{line.get('rate_min', 0):,.0f}–{line.get('rate_max', 0):,.0f}</td>"
                f"<td class='num'>{line.get('amount_mid', 0):,.2f}</td>"
                "</tr>"
            )
        sec_total = boq.get("section_totals", {}).get(key, {}).get("mid", 0)
        rows.append(
            f"<tr class='total'><td colspan='5'>Section Total</td>"
            f"<td class='num'>{sec_total:,.2f}</td></tr>"
        )

    body_rows = "\n".join(rows)
    return f"""<!DOCTYPE html>
<html><head><meta charset='utf-8'>
<style>
  body {{ font-family: Arial, sans-serif; font-size: 11pt; color: #111; margin: 24px; }}
  h1 {{ color: #1a2744; font-size: 18pt; }}
  .meta {{ margin-bottom: 16px; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 12px; }}
  th {{ background: #1a2744; color: white; padding: 8px; text-align: left; }}
  td {{ border-bottom: 1px solid #ddd; padding: 6px; }}
  tr:nth-child(even) td {{ background: #f5f5f5; }}
  .section td {{ background: #d6eaf8; font-weight: bold; }}
  .total td {{ font-weight: bold; background: #ebf5fb; }}
  .num {{ text-align: right; }}
  .summary {{ margin-top: 24px; width: 50%; float: right; }}
  .footer {{ position: fixed; bottom: 0; width: 100%; font-size: 9pt; color: #666; }}
  .watermark {{ color: #ccc; font-size: 48pt; position: fixed; top: 40%; left: 10%; transform: rotate(-30deg); opacity: 0.25; }}
</style></head><body>
  <div class='watermark'>{watermark}</div>
  <h1>BILL OF QUANTITIES</h1>
  <div class='meta'>
    <div><strong>Project:</strong> {project}</div>
    <div><strong>Client:</strong> {client}</div>
    <div><strong>Date:</strong> {datetime.now():%d %B %Y}</div>
    <div><strong>Country:</strong> {country}</div>
  </div>
  <table>
    <thead><tr><th>Ref</th><th>Description</th><th>Unit</th><th>Qty</th><th>Rate Range</th><th>Amount USD</th></tr></thead>
    <tbody>{body_rows}</tbody>
  </table>
  <div class='summary'>
    <table>
      <tr><td>Construction Cost</td><td class='num'>{summary.get('construction_cost_usd', 0):,.2f}</td></tr>
      <tr><td>Overhead (15%)</td><td class='num'>{summary.get('overhead_usd', 0):,.2f}</td></tr>
      <tr><td>Profit (10%)</td><td class='num'>{summary.get('profit_usd', 0):,.2f}</td></tr>
      <tr><td>Contingency (10%)</td><td class='num'>{summary.get('contingency_usd', 0):,.2f}</td></tr>
      <tr class='total'><td>TOTAL PROJECT ESTIMATE</td><td class='num'>{summary.get('total_project_estimate_usd', 0):,.2f}</td></tr>
      <tr><td>Equivalent {summary.get('local_currency', 'ZMW')}</td><td class='num'>{summary.get('total_local_currency', 0):,.2f}</td></tr>
    </table>
  </div>
  <div class='footer'>Rates are indicative. Obtain competitive tenders before committing to contract.</div>
</body></html>"""


def generate_boq_pdf(boq: dict[str, Any], output_path: str | None = None, draft: bool = True) -> str:
    html_content = _html_boq(boq, draft=draft)
    if not output_path:
        fd, output_path = tempfile.mkstemp(suffix=".pdf", prefix="infraafrica_boq_")
        os.close(fd)

    try:
        from weasyprint import HTML

        HTML(string=html_content).write_pdf(output_path)
        return output_path
    except Exception:
        html_path = output_path.replace(".pdf", ".html")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        return html_path


def generate_boq_pdf_bytes(boq: dict[str, Any], draft: bool = True) -> tuple[bytes, str]:
    path = generate_boq_pdf(boq, draft=draft)
    with open(path, "rb") as f:
        data = f.read()
    media_type = "application/pdf" if path.endswith(".pdf") else "text/html"
    try:
        os.remove(path)
    except OSError:
        pass
    return data, media_type
