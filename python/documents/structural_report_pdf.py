"""Structural calculation report PDF — Phase 3 production quality."""

from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def _is_draft(payload: dict[str, Any]) -> bool:
    if payload.get("is_draft", True):
        return True
    review = payload.get("review_summary") or {}
    return review.get("pending", 0) > 0 or review.get("flagged", 0) > 0


def render_structural_report_pdf(payload: dict[str, Any]) -> bytes:
    """Generate a multi-section structural report PDF with headers, footers, and optional draft watermark."""
    buffer = io.BytesIO()
    project = payload.get("project_name", "Structural Project")
    ref = payload.get("reference") or f"INF-STR-{datetime.now().year}"
    draft = _is_draft(payload)

    def _header_footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#475569"))
        canvas.drawString(2 * cm, A4[1] - 1.2 * cm, f"{project} — Structural Calculation Report")
        canvas.drawRightString(A4[0] - 2 * cm, A4[1] - 1.2 * cm, ref)
        canvas.drawString(2 * cm, 1 * cm, f"Page {doc.page}")
        canvas.drawRightString(A4[0] - 2 * cm, 1 * cm, datetime.now().strftime("%d %B %Y"))
        if draft:
            canvas.saveState()
            canvas.setFont("Helvetica-Bold", 48)
            canvas.setFillColor(colors.Color(0.9, 0.2, 0.2, alpha=0.12))
            canvas.translate(A4[0] / 2, A4[1] / 2)
            canvas.rotate(45)
            canvas.drawCentredString(0, 0, "DRAFT ONLY — NOT FOR CONSTRUCTION")
            canvas.restoreState()
        canvas.restoreState()

    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2 * cm, leftMargin=2 * cm, topMargin=2.5 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    title = ParagraphStyle("T", parent=styles["Heading1"], fontSize=16, alignment=1, textColor=colors.HexColor("#1a2744"))
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=12, textColor=colors.HexColor("#1a2744"), spaceBefore=12)
    body = styles["Normal"]

    story: list = []
    story.append(Paragraph("STRUCTURAL CALCULATION REPORT", title))
    story.append(Spacer(1, 0.5 * cm))

    meta = [
        ["Project", payload.get("project_name", "—"), "Client", payload.get("client_name", "—")],
        ["Engineer", payload.get("engineer_name", "—"), "EIZ Reg", payload.get("engineer_reg", "—")],
        ["Reference", ref, "Design Code", payload.get("design_code", "Eurocode 2")],
    ]
    t = Table(meta, colWidths=[3 * cm, 6 * cm, 3 * cm, 5 * cm])
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f1f5f9")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#f1f5f9")),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.5 * cm))

    if draft:
        story.append(Paragraph(
            "<b>DRAFT STATUS:</b> This report contains unreviewed calculations. "
            "Not for construction until all engineer review steps are accepted.",
            ParagraphStyle("Warn", parent=body, textColor=colors.HexColor("#991b1b"), fontSize=9),
        ))
        story.append(Spacer(1, 0.3 * cm))

    sections = [
        ("1. Executive Summary", payload.get("executive_summary", payload.get("project_description", "Structural design per attached calculations."))),
        ("2. Design Basis", payload.get("design_basis", "Eurocode 2 (EN 1992-1-1), Eurocode 1 (EN 1991), Eurocode 7 (EN 1997-1).")),
        ("3. Loading", str(payload.get("calculations", {}).get("loads", payload.get("load_summary", "Load combinations per EC0.")))),
        ("4. Foundation Design", str(payload.get("calculations", {}).get("foundation", payload.get("foundation_summary", "Per foundation calculator output.")))),
        ("5. Superstructure", str(payload.get("calculations", {}).get("superstructure", payload.get("superstructure_summary", "Beam, slab, and column designs per EC2.")))),
        ("6. Conclusion", payload.get("conclusion", "Design satisfies checked limit states subject to site verification.")),
    ]
    for heading, text in sections:
        story.append(Paragraph(heading, h2))
        story.append(Paragraph(str(text)[:4000], body))
        story.append(Spacer(1, 0.3 * cm))

    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph("Engineer's Declaration", h2))
    story.append(Paragraph(
        "I certify that these calculations have been prepared under my supervision "
        "and conform to the stated design codes.",
        body,
    ))

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buffer.getvalue()
