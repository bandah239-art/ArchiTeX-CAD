"""PDF BoQ export generator."""

import html
import os
import tempfile
from datetime import datetime
from typing import Any


def _html_boq(boq: dict[str, Any], draft: bool = True) -> str:
    summary = boq.get("summary", {})
    project = html.escape(boq.get("project_name", "Project"))
    client = html.escape(boq.get("client", "Ministry of Infrastructure"))
    country = boq.get("country_code", "ZM")
    tender_no = html.escape(boq.get("tender_no", "TENDER-___/202_"))
    date_str = datetime.now().strftime("%d %B %Y")
    watermark = "PRELIMINARY ESTIMATE" if draft else ""

    rows = []
    for key, title in boq.get("section_titles", {}).items():
        lines = boq.get("sections", {}).get(key, [])
        if not lines:
            continue
        rows.append(f"<tr><td colspan='7' class='section'>Bill No. {key}: {html.escape(title)}</td></tr>")
        for line in lines:
            rate_ref = html.escape(line.get("rate_ref", f"JCC/InFra_TeCh {date_str}"))
            rows.append(
                "<tr>"
                f"<td>{html.escape(str(line.get('element_ref', '')))}</td>"
                f"<td>{html.escape(line.get('description', ''))}</td>"
                f"<td>{html.escape(line.get('unit', ''))}</td>"
                f"<td class='num'>{line.get('quantity', 0):,.2f}</td>"
                f"<td class='num'>{line.get('rate_min', 0):,.0f}–{line.get('rate_max', 0):,.0f}</td>"
                f"<td class='num'>{line.get('amount_mid', 0):,.2f}</td>"
                f"<td class='ref'>{rate_ref}</td>"
                "</tr>"
            )
        sec_total = boq.get("section_totals", {}).get(key, {}).get("mid", 0)
        rows.append(
            f"<tr class='total'><td colspan='5'>Total Carried to Summary</td>"
            f"<td class='num'>{sec_total:,.2f}</td><td></td></tr>"
        )

    body_rows = "\n".join(rows)
    return f"""<!DOCTYPE html>
<html><head><meta charset='utf-8'>
<style>
  body {{ font-family: Arial, sans-serif; font-size: 10pt; color: #111; margin: 24px; }}
  h1 {{ color: #1a2744; font-size: 16pt; margin-bottom: 4px; }}
  h2 {{ color: #1a2744; font-size: 12pt; margin-top: 0px; }}
  .meta {{ margin-bottom: 16px; border: 1px solid #1a2744; padding: 10px; background: #f8fafc; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 9pt; }}
  th {{ background: #1a2744; color: white; padding: 6px; text-align: left; }}
  td {{ border-bottom: 1px solid #ddd; padding: 5px; }}
  tr:nth-child(even) td {{ background: #f5f5f5; }}
  .section td {{ background: #d6eaf8; font-weight: bold; font-size: 10pt; }}
  .total td {{ font-weight: bold; background: #ebf5fb; }}
  .num {{ text-align: right; }}
  .ref {{ text-align: center; font-size: 8pt; color: #64748b; }}
  .summary {{ margin-top: 24px; width: 60%; float: right; border: 1px solid #1a2744; }}
  .summary table {{ margin-top: 0; }}
  .summary th {{ font-size: 10pt; }}
  .footer {{ position: fixed; bottom: 0; width: 100%; font-size: 8pt; color: #666; border-top: 1px solid #ddd; padding-top: 4px; }}
  .watermark {{ color: #ccc; font-size: 48pt; position: fixed; top: 40%; left: 10%; transform: rotate(-30deg); opacity: 0.25; }}
</style></head><body>
  <div class='watermark'>{watermark}</div>
  <h1>REPUBLIC OF ZAMBIA</h1>
  <h2>ZAMBIA PUBLIC PROCUREMENT AUTHORITY (ZPPA) STANDARD BOQ</h2>
  <div class='meta'>
    <div><strong>Tender No:</strong> {tender_no}</div>
    <div><strong>Project Name:</strong> {project}</div>
    <div><strong>Procuring Entity:</strong> {client}</div>
    <div><strong>Date of Preparation:</strong> {date_str}</div>
  </div>
  <table>
    <thead><tr><th>Item No.</th><th>Description</th><th>Unit</th><th>Qty</th><th>Rate Range ({summary.get('local_currency', 'ZMW')})</th><th>Amount</th><th>Rate Source</th></tr></thead>
    <tbody>{body_rows}</tbody>
  </table>
  <div class='summary'>
    <table>
      <thead><tr><th colspan="2">GRAND SUMMARY</th></tr></thead>
      <tr><td>Sub-Total 1</td><td class='num'>{summary.get('construction_cost_usd', 0):,.2f}</td></tr>
      <tr><td>Add: Preliminaries & General (Overhead 15%)</td><td class='num'>{summary.get('overhead_usd', 0):,.2f}</td></tr>
      <tr><td>Add: Profit (10%)</td><td class='num'>{summary.get('profit_usd', 0):,.2f}</td></tr>
      <tr><td>Sub-Total 2 (Construction Cost)</td><td class='num'>{(summary.get('construction_cost_usd', 0) + summary.get('overhead_usd', 0) + summary.get('profit_usd', 0)):,.2f}</td></tr>
      <tr><td>Add: Contingency Sum (10%)</td><td class='num'>{summary.get('contingency_usd', 0):,.2f}</td></tr>
      <tr class='total'><td>TOTAL TENDER SUM (Exclusive of VAT)</td><td class='num'>{summary.get('total_project_estimate_usd', 0):,.2f}</td></tr>
    </table>
  </div>
  <div style="clear: both;"></div>
  <div class='footer'>Prepared via ARCHITEX-CAD. Standard ZPPA Format. Rates are indicative derived from {date_str} DB.</div>
</body></html>"""


def generate_boq_pdf(boq: dict[str, Any], output_path: str | None = None, draft: bool = True) -> str:
    html_content = _html_boq(boq, draft=draft)
    if not output_path:
        fd, output_path = tempfile.mkstemp(suffix=".pdf", prefix="architex-cad_boq_")
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
