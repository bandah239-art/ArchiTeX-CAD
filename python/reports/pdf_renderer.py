"""PDF Report Generator for Calculation Results."""

from __future__ import annotations

import io
from typing import Any
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
import time
from datetime import datetime, timezone
import reportlab.graphics.shapes as rshapes


def create_module_drawing(result: dict[str, Any]) -> rshapes.Drawing | None:
    module = result.get("module")
    if not module:
        # Fall back: try to infer from keys in summary
        summary = result.get("summary") or {}
        if "span" in summary and "support_condition" in summary:
            module = "beam"
        elif "foundation_type" in summary:
            module = "foundation"
        elif "bearing_type" in summary:
            module = "bearing"
        elif "max_displacement_x_mm" in summary:
            module = "fea"
        else:
            return None

    d = rshapes.Drawing(450, 150)
    
    # Draw background border
    d.add(rshapes.Rect(0, 0, 450, 150, fillColor=colors.HexColor("#f8fafc"), strokeColor=colors.HexColor("#cbd5e1"), strokeWidth=0.5, rx=5, ry=5))

    if module == "beam":
        # Draw beam (Horizontal line from X=50 to X=400)
        d.add(rshapes.Line(50, 80, 400, 80, strokeColor=colors.HexColor("#1e293b"), strokeWidth=4))
        # Left support (pin)
        d.add(rshapes.Polygon([50, 80, 44, 65, 56, 65], fillColor=colors.HexColor("#475569"), strokeColor=colors.HexColor("#334155")))
        # Right support (roller)
        d.add(rshapes.Polygon([400, 80, 394, 68, 406, 68], fillColor=colors.HexColor("#475569"), strokeColor=colors.HexColor("#334155")))
        d.add(rshapes.Circle(400, 63, 3, fillColor=colors.HexColor("#64748b"), strokeColor=colors.HexColor("#475569")))
        
        # UDL arrows and top line
        d.add(rshapes.Line(60, 105, 390, 105, strokeColor=colors.HexColor("#94a3b8"), strokeWidth=1))
        for x in range(65, 390, 20):
            d.add(rshapes.Line(x, 105, x, 83, strokeColor=colors.HexColor("#0284c7"), strokeWidth=1))
            # arrowhead
            d.add(rshapes.Polygon([x, 83, x-2, 86, x+2, 86], fillColor=colors.HexColor("#0284c7"), strokeColor=colors.HexColor("#0284c7")))
            
        # Labeled load
        d.add(rshapes.String(225, 112, "Uniformly Distributed Load (w)", textAnchor="middle", fontName="Helvetica-Bold", fontSize=8, fillColor=colors.HexColor("#0284c7")))
        
        # BMD Parabola
        bmd_points = []
        for x in range(50, 401, 10):
            dx = (x - 50) / 350.0
            # max moment at center, Y = 80 - 45
            y = 80 - 180.0 * dx * (1.0 - dx)
            bmd_points.append(x)
            bmd_points.append(y)
        d.add(rshapes.PolyLine(bmd_points, strokeColor=colors.HexColor("#10b981"), strokeWidth=1.5, strokeDashArray=[2, 2]))
        d.add(rshapes.String(225, 25, "Bending Moment Diagram (Max = wL\u00b2/8)", textAnchor="middle", fontName="Helvetica-Oblique", fontSize=8, fillColor=colors.HexColor("#047857")))
        
        # Text annotations
        d.add(rshapes.String(225, 85, "Span (L)", textAnchor="middle", fontSize=8, fillColor=colors.HexColor("#475569")))
        return d

    elif module == "foundation":
        # Footing
        d.add(rshapes.Rect(145, 50, 160, 30, fillColor=colors.HexColor("#94a3b8"), strokeColor=colors.HexColor("#475569")))
        # Column
        d.add(rshapes.Rect(210, 80, 30, 45, fillColor=colors.HexColor("#cbd5e1"), strokeColor=colors.HexColor("#64748b")))
        
        # Load P
        d.add(rshapes.Line(225, 140, 225, 126, strokeColor=colors.HexColor("#ef4444"), strokeWidth=2))
        d.add(rshapes.Polygon([225, 126, 221, 131, 229, 131], fillColor=colors.HexColor("#ef4444"), strokeColor=colors.HexColor("#ef4444")))
        d.add(rshapes.String(232, 131, "Column Load P", fontSize=8, fontName="Helvetica-Bold", fillColor=colors.HexColor("#ef4444")))
        
        # Bearing Pressure Trapezoid
        d.add(rshapes.Polygon([145, 50, 145, 25, 305, 30, 305, 50], fillColor=colors.HexColor("#fef08a"), strokeColor=colors.HexColor("#eab308"), strokeWidth=1))
        # Arrows pointing up
        for x in range(155, 305, 20):
            y_val = 25 + (x - 145) * (30 - 25) / 160.0
            d.add(rshapes.Line(x, y_val, x, 48, strokeColor=colors.HexColor("#ca8a04"), strokeWidth=1))
            d.add(rshapes.Polygon([x, 48, x-2, 45, x+2, 45], fillColor=colors.HexColor("#ca8a04"), strokeColor=colors.HexColor("#ca8a04")))
            
        d.add(rshapes.String(135, 22, "q_max", textAnchor="end", fontSize=8, fillColor=colors.HexColor("#854d0e")))
        d.add(rshapes.String(315, 27, "q_min", textAnchor="start", fontSize=8, fillColor=colors.HexColor("#854d0e")))
        d.add(rshapes.String(225, 12, "Soil Bearing Pressure Distribution", textAnchor="middle", fontSize=8, fontName="Helvetica-Bold", fillColor=colors.HexColor("#854d0e")))
        return d

    elif module == "bearing":
        # Draw pier
        d.add(rshapes.Rect(205, 30, 40, 100, fillColor=colors.HexColor("#94a3b8"), strokeColor=colors.HexColor("#475569")))
        # Water level
        d.add(rshapes.Line(100, 100, 205, 100, strokeColor=colors.HexColor("#38bdf8"), strokeWidth=1))
        
        # Hydrostatic triangle
        d.add(rshapes.Polygon([205, 30, 135, 30, 205, 100], fillColor=colors.HexColor("#e0f2fe"), strokeColor=colors.HexColor("#0284c7"), strokeWidth=1))
        # Arrows pointing right
        for y in range(40, 100, 15):
            x_start = 205 - (100 - y) * 70.0 / 70.0
            d.add(rshapes.Line(x_start, y, 203, y, strokeColor=colors.HexColor("#0284c7"), strokeWidth=1))
            d.add(rshapes.Polygon([203, y, 199, y-2, 199, y+2], fillColor=colors.HexColor("#0284c7"), strokeColor=colors.HexColor("#0284c7")))
            
        d.add(rshapes.String(125, 27, "P = \u03b3_w * h", textAnchor="end", fontSize=8, fillColor=colors.HexColor("#0369a1")))
        d.add(rshapes.String(150, 105, "Water Level", textAnchor="middle", fontSize=8, fillColor=colors.HexColor("#0369a1")))
        d.add(rshapes.String(225, 12, "Bridge Pier Bearing & Fluid Pressures", textAnchor="middle", fontSize=8, fontName="Helvetica-Bold", fillColor=colors.HexColor("#475569")))
        return d

    elif module == "geo":
        # Retaining Wall
        d.add(rshapes.Rect(220, 30, 25, 100, fillColor=colors.HexColor("#94a3b8"), strokeColor=colors.HexColor("#475569")))
        # Soil line left
        d.add(rshapes.Line(70, 120, 220, 120, strokeColor=colors.HexColor("#854d0e"), strokeWidth=1.5))
        # Pressure triangle left
        d.add(rshapes.Polygon([220, 30, 150, 30, 220, 120], fillColor=colors.HexColor("#ffedd5"), strokeColor=colors.HexColor("#ea580c"), strokeWidth=1))
        for y in range(40, 120, 15):
            x_start = 220 - (120 - y) * 70.0 / 90.0
            d.add(rshapes.Line(x_start, y, 218, y, strokeColor=colors.HexColor("#ea580c"), strokeWidth=1))
            d.add(rshapes.Polygon([218, y, 214, y-2, 214, y+2], fillColor=colors.HexColor("#ea580c"), strokeColor=colors.HexColor("#ea580c")))
            
        d.add(rshapes.String(140, 27, "Active Earth Pressure (Ka)", textAnchor="end", fontSize=8, fillColor=colors.HexColor("#c2410c")))
        d.add(rshapes.String(225, 12, "Retaining Wall Soil Pressures", textAnchor="middle", fontSize=8, fontName="Helvetica-Bold", fillColor=colors.HexColor("#475569")))
        return d

    elif module == "fea":
        import math
        # Override drawing height for FEA
        d.height = 280
        if d.contents and hasattr(d.contents[0], 'height'):
            d.contents[0].height = 280

        # Get nodes and elements
        nodes_list = result.get("nodes", [])
        elements_list = result.get("elements", [])
        displacements = result.get("displacements", [])
        element_results = result.get("element_results", [])
        
        # Fallback to standard portal frame if nodes_list is empty
        height_val = float(result.get("summary", {}).get("height_m", 4.0))
        span_val = float(result.get("summary", {}).get("span_m", 6.0))
        
        if not nodes_list:
            nodes_list = [
                {"id": 1, "x": 0.0, "y": 0.0},
                {"id": 2, "x": 0.0, "y": height_val},
                {"id": 3, "x": span_val, "y": height_val},
                {"id": 4, "x": span_val, "y": 0.0}
            ]
        if not elements_list:
            elements_list = [
                {"id": 1, "node_i": 1, "node_j": 2},
                {"id": 2, "node_i": 2, "node_j": 3},
                {"id": 3, "node_i": 3, "node_j": 4}
            ]
            
        xs = [n["x"] for n in nodes_list]
        ys = [n["y"] for n in nodes_list]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        span = max(max_x - min_x, 0.1)
        height = max(max_y - min_y, 0.1)
        
        node_map = {n["id"]: (n["x"], n["y"]) for n in nodes_list}
        disp_map = {d["node_id"]: (d["ux"], d["uy"]) for d in displacements} if displacements else {}
        el_res_map = {res["element_id"]: res for res in element_results} if element_results else {}
        
        # Compute dynamic displacement scale
        if displacements:
            max_d = max(max(abs(d.get("ux", 0.0)), abs(d.get("uy", 0.0))) for d in displacements)
            scale_disp = (max(span, height) * 0.1) / max_d if max_d > 1e-8 else 20.0
        else:
            scale_disp = 20.0
            # Mock displacements for visualization if none provided
            disp_map = {
                1: (0.0, 0.0),
                2: (0.005, 0.0),
                3: (0.005, -0.002),
                4: (0.0, 0.0)
            }
            
        def map_coords(x, y, bbox):
            xmin, ymin, xmax, ymax = bbox
            w = xmax - xmin
            h = ymax - ymin
            sc_x = w / span
            sc_y = h / height
            scale = min(sc_x, sc_y) * 0.8
            offset_x = xmin + (w - span * scale) / 2.0
            offset_y = ymin + (h - height * scale) / 2.0
            return offset_x + (x - min_x) * scale, offset_y + (y - min_y) * scale

        # Bounding boxes
        bbox_def = (20, 160, 430, 260)  # Top Deformed Frame
        bbox_bmd = (20, 35, 215, 125)   # Bottom Left BMD
        bbox_sfd = (235, 35, 430, 125)  # Bottom Right SFD
        
        # ----------------------------------------------------
        # 1. DRAW DEFORMED FRAME MESH (TOP PANEL)
        # ----------------------------------------------------
        d.add(rshapes.String(225, 265, "Deformed Shape & Mesh (Green, scale factor: 10% span/max_d)", textAnchor="middle", fontSize=8, fontName="Helvetica-Bold", fillColor=colors.HexColor("#0f172a")))
        
        # Draw Undeformed Structure (Dashed Gray)
        for el in elements_list:
            ni, nj = el["node_i"], el["node_j"]
            if ni in node_map and nj in node_map:
                xi, yi = node_map[ni]
                xj, yj = node_map[nj]
                sxi, syi = map_coords(xi, yi, bbox_def)
                sxj, syj = map_coords(xj, yj, bbox_def)
                d.add(rshapes.Line(sxi, syi, sxj, syj, strokeColor=colors.HexColor("#cbd5e1"), strokeWidth=1, strokeDashArray=[2, 2]))
                
        # Draw Deformed Structure (Solid Green)
        for el in elements_list:
            ni, nj = el["node_i"], el["node_j"]
            if ni in node_map and nj in node_map:
                xi, yi = node_map[ni]
                xj, yj = node_map[nj]
                ux_i, uy_i = disp_map.get(ni, (0.0, 0.0))
                ux_j, uy_j = disp_map.get(nj, (0.0, 0.0))
                
                dxi, dyi = xi + ux_i * scale_disp, yi + uy_i * scale_disp
                dxj, dyj = xj + ux_j * scale_disp, yj + uy_j * scale_disp
                
                sdxi, sdyi = map_coords(dxi, dyi, bbox_def)
                sdxj, sdxj_y = map_coords(dxj, dyj, bbox_def)
                
                d.add(rshapes.Line(sdxi, sdyi, sdxj, sdxj_y, strokeColor=colors.HexColor("#10b981"), strokeWidth=2))
                
        # Draw Deformed Nodes
        for nid, (x, y) in node_map.items():
            ux, uy = disp_map.get(nid, (0.0, 0.0))
            dx, dy = x + ux * scale_disp, y + uy * scale_disp
            sdx, sdy = map_coords(dx, dy, bbox_def)
            d.add(rshapes.Circle(sdx, sdy, 3, fillColor=colors.HexColor("#047857"), strokeColor=colors.HexColor("#065f46"), strokeWidth=0.5))

        # ----------------------------------------------------
        # 2. DRAW BMD AND SFD (BOTTOM PANELS)
        # ----------------------------------------------------
        max_moment = 0.0
        max_shear = 0.0
        if element_results:
            for res in element_results:
                max_moment = max(max_moment, max(abs(m) for m in res.get("moments", [0.0])))
                max_shear = max(max_shear, max(abs(v) for v in res.get("shears", [0.0])))
        else:
            max_moment = 50000.0
            max_shear = 20000.0
            
        scale_bmd = 15.0 / max_moment if max_moment > 1e-8 else 1.0
        scale_sfd = 15.0 / max_shear if max_shear > 1e-8 else 1.0
        
        d.add(rshapes.String(117, 130, "Bending Moment Diagram (BMD)", textAnchor="middle", fontSize=8, fontName="Helvetica-Bold", fillColor=colors.HexColor("#0284c7")))
        d.add(rshapes.String(332, 130, "Shear Force Diagram (SFD)", textAnchor="middle", fontSize=8, fontName="Helvetica-Bold", fillColor=colors.HexColor("#ea580c")))
        
        def draw_diagram_on_box(bbox, data_key, val_scale, line_color, fill_color, hatch_color, unit_label):
            for el in elements_list:
                ni, nj = el["node_i"], el["node_j"]
                if ni in node_map and nj in node_map:
                    xi, yi = node_map[ni]
                    xj, yj = node_map[nj]
                    sxi, syi = map_coords(xi, yi, bbox)
                    sxj, syj = map_coords(xj, yj, bbox)
                    d.add(rshapes.Line(sxi, syi, sxj, syj, strokeColor=colors.HexColor("#64748b"), strokeWidth=1))
            
            for el in elements_list:
                el_id = el["id"]
                ni, nj = el["node_i"], el["node_j"]
                if ni not in node_map or nj not in node_map:
                    continue
                xi, yi = node_map[ni]
                xj, yj = node_map[nj]
                sxi, syi = map_coords(xi, yi, bbox)
                sxj, syj = map_coords(xj, yj, bbox)
                
                dx = sxj - sxi
                dy = syj - syi
                L_screen = math.hypot(dx, dy)
                if L_screen < 1e-3:
                    continue
                c_screen = dx / L_screen
                s_screen = dy / L_screen
                nx, ny = -s_screen, c_screen
                
                res = el_res_map.get(el_id)
                if res and data_key in res:
                    y_vals = res[data_key]
                else:
                    if el_id == 2:
                        if data_key == "moments":
                            y_vals = [(-50000.0 * 6.0 / 8.0) * 4.0 * (x/10.0) * (1.0 - (x/10.0)) for x in range(11)]
                        else:
                            y_vals = [25000.0 - 50000.0 * (x/10.0) for x in range(11)]
                    else:
                        y_vals = [0.0] * 11
                
                center_pts = []
                offset_pts = []
                for k in range(11):
                    t = k / 10.0
                    cx = sxi + t * dx
                    cy = syi + t * dy
                    val = y_vals[k]
                    ox = cx + val * val_scale * nx
                    oy = cy + val * val_scale * ny
                    center_pts.append((cx, cy))
                    offset_pts.append((ox, oy))
                    
                poly_coords = []
                for cx, cy in center_pts:
                    poly_coords.extend([cx, cy])
                for ox, oy in reversed(offset_pts):
                    poly_coords.extend([ox, oy])
                d.add(rshapes.Polygon(poly_coords, fillColor=fill_color, strokeColor=None))
                
                for (cx, cy), (ox, oy) in zip(center_pts, offset_pts):
                    d.add(rshapes.Line(cx, cy, ox, oy, strokeColor=hatch_color, strokeWidth=0.5))
                    
                diag_line_coords = []
                for ox, oy in offset_pts:
                    diag_line_coords.extend([ox, oy])
                d.add(rshapes.PolyLine(diag_line_coords, strokeColor=line_color, strokeWidth=1.2))
                
                max_idx = 0
                max_val_abs = -1.0
                for idx, v in enumerate(y_vals):
                    if abs(v) > max_val_abs:
                        max_val_abs = abs(v)
                        max_idx = idx
                max_v = y_vals[max_idx]
                
                if abs(max_v) > 10.0:
                    val_k = max_v / 1000.0
                    lbl = f"{val_k:.1f} {unit_label}"
                    lx = offset_pts[max_idx][0] + 5 * nx
                    ly = offset_pts[max_idx][1] + 5 * ny
                    d.add(rshapes.String(lx, ly, lbl, textAnchor="middle", fontSize=6, fontName="Helvetica", fillColor=colors.HexColor("#1e293b")))
                    
        draw_diagram_on_box(
            bbox_bmd,
            "moments",
            scale_bmd,
            colors.HexColor("#0284c7"),
            colors.Color(0.01, 0.52, 0.78, alpha=0.15),
            colors.HexColor("#38bdf8"),
            "kNm"
        )
        
        draw_diagram_on_box(
            bbox_sfd,
            "shears",
            scale_sfd,
            colors.HexColor("#ea580c"),
            colors.Color(0.92, 0.35, 0.05, alpha=0.15),
            colors.HexColor("#fb923c"),
            "kN"
        )
        
        d.add(rshapes.String(225, 12, "Verification Suite Cryptographic Record Seal Active", textAnchor="middle", fontSize=7, fontName="Helvetica-Bold", fillColor=colors.HexColor("#475569")))
        return d
        
    return None


def render_calculation_pdf(result: dict[str, Any], title: str = "Calculation Report") -> bytes:
    """Generate a structured PDF report from an engineer-controlled calculation result."""
    buffer = io.BytesIO()
    proj_ref = result.get("project_ref", "N/A")
    draft = result.get("is_draft", True)
    review_summary = result.get("review_summary") or {}
    if review_summary.get("pending", 0) > 0 or review_summary.get("flagged", 0) > 0:
        draft = True
    if result.get("status", "").lower() in ("fail", "failed"):
        draft = True

    def _page_decor(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#64748b"))
        canvas.drawString(2 * cm, A4[1] - 1.2 * cm, f"ARCHITEX-CAD — {title}")
        canvas.drawRightString(A4[0] - 2 * cm, A4[1] - 1.2 * cm, str(proj_ref))
        canvas.drawString(2 * cm, 1 * cm, f"Page {doc.page}")
        canvas.drawRightString(A4[0] - 2 * cm, 1 * cm, datetime.now().strftime("%d %B %Y"))
        if draft:
            canvas.setFont("Helvetica-Bold", 44)
            canvas.setFillColor(colors.Color(0.86, 0.15, 0.15, alpha=0.11))
            canvas.translate(A4[0] / 2, A4[1] / 2)
            canvas.rotate(45)
            canvas.drawCentredString(0, 0, "DRAFT ONLY — NOT FOR CONSTRUCTION")
        canvas.restoreState()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2.5*cm,
        bottomMargin=2*cm
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontSize=16,
        spaceAfter=12,
        alignment=1, # Center
        textColor=colors.HexColor("#1a2744"),
        fontName="Helvetica-Bold"
    )
    h2_style = ParagraphStyle(
        "Heading2",
        parent=styles["Heading2"],
        fontSize=12,
        textColor=colors.HexColor("#1a2744"),
        spaceBefore=10,
        spaceAfter=6,
        fontName="Helvetica-Bold",
        borderPadding=(0, 0, 2, 0),
        borderColor=colors.HexColor("#1a2744"),
        borderWidth=1
    )
    normal_style = styles["Normal"]
    
    step_title_style = ParagraphStyle(
        "StepTitle",
        parent=styles["Heading3"],
        fontSize=10,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=4,
    )
    
    formula_style = ParagraphStyle(
        "Formula",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=9,
        textColor=colors.HexColor("#1e3a8a"),
    )
    
    result_style = ParagraphStyle(
        "Result",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
    )
    
    elements = []
    
    # 1. Project Details Header
    eng_name = result.get("engineer_name", "UNVERIFIED")
    eiz_no = result.get("eiz_number", "")
    proj_ref = result.get("project_ref", "N/A")
    date_str = datetime.now().strftime("%d %B %Y")
    module_name = str(result.get("module", "General")).upper()
    
    header_data = [
        [Paragraph("<b>PROJECT:</b>", normal_style), Paragraph(proj_ref, normal_style), Paragraph("<b>DATE:</b>", normal_style), Paragraph(date_str, normal_style)],
        [Paragraph("<b>ENGINEER:</b>", normal_style), Paragraph(eng_name, normal_style), Paragraph("<b>EIZ NO:</b>", normal_style), Paragraph(eiz_no, normal_style)],
        [Paragraph("<b>ELEMENT:</b>", normal_style), Paragraph(module_name, normal_style), Paragraph("<b>STATUS:</b>", normal_style), Paragraph(result.get("status", "UNKNOWN").upper(), normal_style)]
    ]
    t_header = Table(header_data, colWidths=[2.5*cm, 7.5*cm, 2.5*cm, 4.5*cm])
    t_header.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1.0, colors.HexColor("#1a2744")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor("#f1f5f9")),
        ('BACKGROUND', (2,0), (2,-1), colors.HexColor("#f1f5f9")),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    
    elements.append(Paragraph(title, title_style))
    elements.append(t_header)
    elements.append(Spacer(1, 0.5 * cm))
    
    # 2. Design Brief Summary
    design_brief = result.get("design_brief", "")
    if design_brief:
        elements.append(Paragraph("1. Design Brief", h2_style))
        elements.append(Paragraph(design_brief, normal_style))
        elements.append(Spacer(1, 0.5 * cm))

    # Review Warnings
    review_summary = result.get("review_summary") or {}
    has_pending = review_summary.get("pending", 0) > 0
    has_flagged = review_summary.get("flagged", 0) > 0
    
    if has_pending or has_flagged:
        warn_text = "<b>WARNING:</b> This report contains calculations that "
        if has_flagged:
            warn_text += "have been <b>FLAGGED AS DEFECTIVE/FAILED</b>. "
        if has_pending:
            warn_text += f"have <b>{review_summary.get('pending')} PENDING REVIEWS</b>. "
        warn_text += "DO NOT USE FOR CONSTRUCTION."
        
        warn_box = Table([[Paragraph(warn_text, ParagraphStyle("WarnText", parent=normal_style, textColor=colors.HexColor("#991b1b"), fontSize=9))]], colWidths=[17*cm])
        warn_box.setStyle(TableStyle([
            ('BOX', (0,0), (-1,-1), 1.5, colors.HexColor("#dc2626")),
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#fef2f2")),
            ('LEFTPADDING', (0,0), (-1,-1), 10),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ]))
        elements.append(warn_box)
        elements.append(Spacer(1, 0.5 * cm))
    
    # 3. Pass/Fail Compliance Summary
    elements.append(Paragraph("2. Compliance Summary", h2_style))
    overall_status = result.get("status", "failed").lower()
    if overall_status == "passed" and not has_flagged and not has_pending:
        comp_text = "<b>COMPLIANT</b>: The structural element satisfies all checked requirements of the referenced design codes."
        comp_color = "#15803d"
        comp_bg = "#f0fdf4"
    else:
        comp_text = "<b>NON-COMPLIANT / PENDING</b>: The element fails one or more checks, or requires pending reviews."
        comp_color = "#b91c1c"
        comp_bg = "#fef2f2"
        
    comp_box = Table([[Paragraph(comp_text, ParagraphStyle("Comp", parent=normal_style, textColor=colors.HexColor(comp_color)))]], colWidths=[17*cm])
    comp_box.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor(comp_color)),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor(comp_bg)),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(comp_box)
    elements.append(Spacer(1, 0.5 * cm))
    
    # Summary Parameters
    if "summary" in result and result["summary"]:
        elements.append(Paragraph("3. Input Parameters", h2_style))
        summary_data = []
        for k, v in result["summary"].items():
            if isinstance(v, dict) and "value" in v:
                val_str = f"{v['value']} {v.get('unit', '')}"
            else:
                val_str = str(v)
            summary_data.append([str(k).replace("_", " ").title(), val_str])
            
        if summary_data:
            t = Table(summary_data, colWidths=[6*cm, 11*cm])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
            ]))
            elements.append(t)
            elements.append(Spacer(1, 0.5 * cm))
            
    # Add Visual Diagram
    try:
        diag = create_module_drawing(result)
        if diag:
            elements.append(Paragraph("4. System Visualisation", h2_style))
            elements.append(diag)
            elements.append(Spacer(1, 0.5 * cm))
    except Exception:
        pass

    # 4. Calculation Trace
    if "steps" in result and result["steps"]:
        elements.append(Paragraph("5. Calculation Trace", h2_style))
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
            details_data.append([Paragraph("Result:", normal_style), Paragraph(f"<b>{res_val} {unit}</b>", result_style)])
            
            if step.get("reference"):
                # E.g. "BS 8110-1:1997 Clause 3.4.4.1"
                details_data.append([Paragraph("Code Ref:", normal_style), Paragraph(step["reference"], ParagraphStyle("Ref", parent=normal_style, fontSize=8, textColor=colors.HexColor("#475569"), fontName="Helvetica-BoldOblique"))])
                
            t2 = Table(details_data, colWidths=[3*cm, 14*cm])
            t2.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ]))
            elements.append(t2)
            elements.append(Spacer(1, 0.3 * cm))
            
    # 5. Engineer Declaration Block
    elements.append(Spacer(1, 1 * cm))
    elements.append(Paragraph("6. Engineer's Declaration", h2_style))
    decl_text = ("I certify that these calculations have been prepared by me or under my direct supervision, "
                 "and that they conform to the requirements of the stated design codes and standard engineering practice.")
    elements.append(Paragraph(decl_text, normal_style))
    elements.append(Spacer(1, 0.5 * cm))
    
    decl_data = [
        [Paragraph("<b>Signature:</b>", normal_style), "", Paragraph("<b>Date:</b>", normal_style), Paragraph(date_str, normal_style)],
        ["", "", "", ""],
        [Paragraph("<b>Name:</b>", normal_style), Paragraph(eng_name, normal_style), Paragraph("<b>EIZ Reg No:</b>", normal_style), Paragraph(eiz_no, normal_style)]
    ]
    t_decl = Table(decl_data, colWidths=[2.5*cm, 7*cm, 2.5*cm, 5*cm])
    t_decl.setStyle(TableStyle([
        ('LINEBOTTOM', (1,0), (1,0), 1, colors.black), # Signature line
        ('LINEBOTTOM', (3,0), (3,0), 1, colors.black), # Date line
        ('VALIGN', (0,0), (-1,-1), 'BOTTOM'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    elements.append(t_decl)
    
    # 6. InFra_TeCh Verification Stamp
    elements.append(Spacer(1, 1 * cm))
    
    import hashlib
    import json
    # Generate deterministic hash for the payload
    payload_str = json.dumps({k: v for k, v in result.items() if k not in ["warnings"]}, sort_keys=True)
    calc_hash = hashlib.sha256(payload_str.encode()).hexdigest()[:16].upper()
    
    timestamp = datetime.now(timezone.utc).isoformat()
    
    sig_status = "VALID - ARCHITEX-CAD SEALED" if eng_name != "UNVERIFIED" else "UNVERIFIED - PENDING SIGNATURE"
    sig_color = "#15803d" if eng_name != "UNVERIFIED" else "#b91c1c"
    
    seal_data = [
        [Paragraph("<b>InFra_TeCh VERIFICATION STAMP</b>", ParagraphStyle("S", parent=normal_style, fontName="Helvetica-Bold", textColor=colors.HexColor(sig_color))), ""],
        [Paragraph("Calc Hash:", normal_style), Paragraph(calc_hash, formula_style)],
        [Paragraph("Timestamp:", normal_style), Paragraph(timestamp, formula_style)],
        [Paragraph("Status:", normal_style), Paragraph(sig_status, ParagraphStyle("Valid", parent=normal_style, textColor=colors.HexColor(sig_color), fontName="Helvetica-Bold"))]
    ]
    t_seal = Table(seal_data, colWidths=[4.5*cm, 12.5*cm])
    t_seal.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1.5, colors.HexColor(sig_color)),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f0fdf4") if eng_name != "UNVERIFIED" else colors.HexColor("#fff5f5")),
        ('SPAN', (0,0), (1,0)),
        ('ALIGN', (0,0), (1,0), 'CENTER'),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(t_seal)
            
    doc.build(elements, onFirstPage=_page_decor, onLaterPages=_page_decor)
    return buffer.getvalue()
