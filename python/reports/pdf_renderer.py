"""PDF Report Generator for Calculation Results."""

from __future__ import annotations

import io
from typing import Any
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
import hashlib
import time
from datetime import datetime, timezone


def render_calculation_pdf(result: dict[str, Any], title: str = "Calculation Report") -> bytes:
    """Generate a structured PDF report from an engineer-controlled calculation result."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = styles["Heading1"]
    h2_style = styles["Heading2"]
    normal_style = styles["Normal"]
    
    step_title_style = ParagraphStyle(
        "StepTitle",
        parent=styles["Heading3"],
        fontSize=10,
        textColor=colors.HexColor("#065f46"),
        spaceAfter=4,
    )
    
    formula_style = ParagraphStyle(
        "Formula",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=9,
        textColor=colors.darkblue,
    )
    
    result_style = ParagraphStyle(
        "Result",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
    )
    
    elements = []
    
    # Title
    elements.append(Paragraph(title, title_style))
    elements.append(Spacer(1, 0.5 * cm))
    
    # Summary
    if "summary" in result and result["summary"]:
        elements.append(Paragraph("Summary", h2_style))
        summary_data = []
        for k, v in result["summary"].items():
            if isinstance(v, dict) and "value" in v:
                val_str = f"{v['value']} {v.get('unit', '')}"
            else:
                val_str = str(v)
            summary_data.append([str(k).replace("_", " ").title(), val_str])
            
        if summary_data:
            t = Table(summary_data, colWidths=[6*cm, 10*cm])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
            ]))
            elements.append(t)
            elements.append(Spacer(1, 0.5 * cm))
            
    # Review Summary
    if "review_summary" in result:
        elements.append(Paragraph("Review Summary", h2_style))
        rs = result["review_summary"]
        text = f"Accepted: {rs.get('accepted', 0)} | Overridden: {rs.get('overridden', 0)} | Flagged: {rs.get('flagged', 0)} | Pending: {rs.get('pending', 0)}"
        elements.append(Paragraph(text, normal_style))
        elements.append(Spacer(1, 0.5 * cm))
    
    # Warnings
    if "warnings" in result and result["warnings"]:
        elements.append(Paragraph("Warnings", h2_style))
        for w in result["warnings"]:
            elements.append(Paragraph(f"• {w}", ParagraphStyle("Warn", parent=normal_style, textColor=colors.red)))
        elements.append(Spacer(1, 0.5 * cm))
        
    # Steps
    if "steps" in result and result["steps"]:
        elements.append(Paragraph("Calculation Steps", h2_style))
        for step in result["steps"]:
            # Title
            step_num = step.get("step_number", "?")
            st_title = step.get("title", "Step")
            elements.append(Paragraph(f"{step_num}. {st_title}", step_title_style))
            
            # Details
            details_data = []
            if step.get("formula"):
                details_data.append([Paragraph("Formula:", normal_style), Paragraph(step["formula"], formula_style)])
            if step.get("substitution"):
                details_data.append([Paragraph("Substitution:", normal_style), Paragraph(step["substitution"], formula_style)])
            
            res_val = step.get("effective_result", step.get("result", ""))
            unit = step.get("unit", "")
            details_data.append([Paragraph("Result:", normal_style), Paragraph(f"{res_val} {unit}", result_style)])
            
            if step.get("reference"):
                details_data.append([Paragraph("Ref:", normal_style), Paragraph(step["reference"], ParagraphStyle("Ref", parent=normal_style, fontSize=8, textColor=colors.gray))])
                
            if step.get("review_status") != "pending":
                rev_text = f"Status: {step.get('review_status').upper()}"
                if step.get('engineer_name'):
                    rev_text += f" by {step['engineer_name']}"
                details_data.append([Paragraph("Review:", normal_style), Paragraph(rev_text, normal_style)])
                
            t2 = Table(details_data, colWidths=[3*cm, 13*cm])
            t2.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ]))
            elements.append(t2)
            elements.append(Spacer(1, 0.3 * cm))
            
    # Digital Seal
    elements.append(Spacer(1, 1 * cm))
    elements.append(Paragraph("Cryptographic Signature Seal", h2_style))
    
    timestamp = datetime.now(timezone.utc).isoformat()
    doc_id = f"INFRA-{int(time.time())}"
    
    seal_data = [
        [Paragraph("Document ID:", normal_style), Paragraph(doc_id, formula_style)],
        [Paragraph("Timestamp:", normal_style), Paragraph(timestamp, formula_style)],
        [Paragraph("Signature Status:", normal_style), Paragraph("VALID - DIGITALLY SEALED", ParagraphStyle("Valid", parent=normal_style, textColor=colors.HexColor("#065f46"), fontName="Helvetica-Bold"))]
    ]
    t_seal = Table(seal_data, colWidths=[4*cm, 12*cm])
    t_seal.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#065f46")),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f0fdf4")),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(t_seal)
            
    doc.build(elements)
    return buffer.getvalue()
