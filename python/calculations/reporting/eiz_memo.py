"""EIZ Calculation Memo PDF Generator using ReportLab."""

import io
import time
from datetime import datetime, timezone
from typing import Any

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm


def draw_eiz_decorations(canvas, doc, project_name, project_location, engineer_name, eiz_number, calc_reference, revision, date):
    """Draw the standard EIZ border, header block, and footer on every page."""
    canvas.saveState()
    
    # Page size dimensions (A4: 595.27 x 841.89)
    width, height = A4
    margin = 36.0  # 0.5 inch margins
    
    # --- HEADER BLOCK (Top of Page) ---
    # Draw header bounding box
    h_top = height - margin
    h_bottom = h_top - 90
    h_left = margin
    h_right = width - margin
    
    canvas.setStrokeColor(colors.HexColor("#1e293b"))
    canvas.setLineWidth(1.0)
    canvas.rect(h_left, h_bottom, h_right - h_left, h_top - h_bottom)
    
    # Internal division lines
    # vertical line for stamp field on the right
    stamp_width = 90
    stamp_x = h_right - stamp_width
    canvas.line(stamp_x, h_bottom, stamp_x, h_top)
    
    # stamp box label
    canvas.setFont("Helvetica-Bold", 7)
    canvas.setFillColor(colors.HexColor("#64748b"))
    canvas.drawString(stamp_x + 5, h_top - 12, "EIZ STAMP FIELD")
    canvas.rect(stamp_x + 8, h_bottom + 8, stamp_width - 16, h_top - h_bottom - 26, strokeColor=colors.HexColor("#cbd5e1"), strokeWidth=0.5)
    
    # Logo text / Brand
    canvas.setFont("Helvetica-Bold", 12)
    canvas.setFillColor(colors.HexColor("#0f172a"))
    canvas.drawString(h_left + 10, h_top - 20, "InFra_TeCh Platform")
    
    # Project Info
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#334155"))
    canvas.drawString(h_left + 10, h_top - 38, f"PROJECT: {project_name}")
    canvas.drawString(h_left + 10, h_top - 50, f"LOCATION: {project_location}")
    canvas.drawString(h_left + 10, h_top - 62, f"CALC REF: {calc_reference}")
    
    # Revision / Date / Page Info
    canvas.drawString(h_left + 240, h_top - 38, f"REV: {revision}")
    canvas.drawString(h_left + 240, h_top - 50, f"DATE: {date}")
    canvas.drawString(h_left + 240, h_top - 62, f"ENGINEER: {engineer_name}")
    canvas.drawString(h_left + 240, h_top - 74, f"EIZ REG No: {eiz_number}")
    
    # Page numbers
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawRightString(stamp_x - 10, h_top - 20, f"Page {doc.page}")
    
    # --- FOOTER BLOCK (Bottom of Page) ---
    f_bottom = margin
    f_left = margin
    f_right = width - margin
    
    canvas.setStrokeColor(colors.HexColor("#94a3b8"))
    canvas.setLineWidth(0.5)
    canvas.line(f_left, f_bottom + 15, f_right, f_bottom + 15)
    
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#475569"))
    canvas.drawString(f_left, f_bottom + 5, "These calculations are issued for:  [ ] Design Check  [ ] Construction  [ ] Council Submission  [ ] Tender")
    canvas.drawRightString(f_right, f_bottom + 5, "Verified per ZABS / EIZ Standards")
    
    canvas.restoreState()


def generate_eiz_memo(
    project_name: str,
    project_location: str,
    engineer_name: str,
    eiz_number: str,
    calc_title: str,
    calc_reference: str,
    revision: str,
    date: str,
    client_name: str,
    local_authority: str,
    calculation_sections: list[dict[str, Any]],
    logo_path=None,
) -> bytes:
    """Generate regulatory calculation memo PDF matching Lusaka council submission guidelines."""
    buffer = io.BytesIO()
    
    # Set top margin large enough to clear the 90-point header block
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=4.2 * cm,
        bottomMargin=2.0 * cm,
    )
    
    styles = getSampleStyleSheet()
    
    h1_style = ParagraphStyle(
        "MemoTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        spaceAfter=15,
        textColor=colors.HexColor("#0f172a"),
    )
    
    h2_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        spaceBefore=10,
        spaceAfter=8,
        textColor=colors.HexColor("#1e3a8a"),
    )
    
    normal_style = ParagraphStyle(
        "MemoNormal",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#334155"),
    )
    
    formula_style = ParagraphStyle(
        "MemoFormula",
        parent=styles["Normal"],
        fontName="Courier-Bold",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#1e3a8a"),
    )

    elements = []
    
    # Memo header details (Client, Authority)
    elements.append(Paragraph(calc_title, h1_style))
    
    metadata_data = [
        [Paragraph("<b>Client Name:</b>", normal_style), Paragraph(client_name, normal_style)],
        [Paragraph("<b>Local Authority:</b>", normal_style), Paragraph(local_authority, normal_style)],
    ]
    t_meta = Table(metadata_data, colWidths=[4*cm, 13*cm])
    t_meta.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
    ]))
    elements.append(t_meta)
    elements.append(Spacer(1, 0.5 * cm))
    
    # Calculation sections
    for sec in calculation_sections:
        title = sec.get("title", "")
        content_type = sec.get("content_type", "text")
        data = sec.get("data")
        
        if title:
            elements.append(Paragraph(title, h2_style))
            
        if content_type == "text" and isinstance(data, str):
            elements.append(Paragraph(data, normal_style))
            elements.append(Spacer(1, 0.3 * cm))
            
        elif content_type == "formula" and isinstance(data, str):
            # Formula block
            t_f = Table([[Paragraph(data, formula_style)]], colWidths=[17*cm])
            t_f.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
                ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
                ('TOPPADDING', (0,0), (-1,-1), 6),
                ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                ('LEFTPADDING', (0,0), (-1,-1), 10),
            ]))
            elements.append(t_f)
            elements.append(Spacer(1, 0.3 * cm))
            
        elif content_type == "table" and isinstance(data, list):
            # Formatted key-value table
            table_data = []
            for row in data:
                if isinstance(row, list) and len(row) >= 2:
                    table_data.append([Paragraph(str(row[0]), normal_style), Paragraph(str(row[1]), normal_style)])
            if table_data:
                t = Table(table_data, colWidths=[6*cm, 11*cm])
                t.setStyle(TableStyle([
                    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
                    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                    ('LEFTPADDING', (0,0), (-1,-1), 8),
                    ('RIGHTPADDING', (0,0), (-1,-1), 8),
                    ('TOPPADDING', (0,0), (-1,-1), 4),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                ]))
                elements.append(t)
                elements.append(Spacer(1, 0.4 * cm))

    # Build document repeating EIZ header block on every page
    doc.build(
        elements,
        onFirstPage=lambda c, d: draw_eiz_decorations(
            c, d, project_name, project_location, engineer_name, eiz_number, calc_reference, revision, date
        ),
        onLaterPages=lambda c, d: draw_eiz_decorations(
            c, d, project_name, project_location, engineer_name, eiz_number, calc_reference, revision, date
        ),
    )
    
    return buffer.getvalue()
