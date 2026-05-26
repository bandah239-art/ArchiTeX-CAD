"""Excel BoQ export generator."""

import io
import os
import tempfile
from datetime import datetime
from typing import Any


def generate_boq_excel(boq: dict[str, Any], output_path: str | None = None) -> str:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill

    wb = Workbook()
    navy = PatternFill(start_color="1A2744", end_color="1A2744", fill_type="solid")
    grey = PatternFill(start_color="F5F5F5", end_color="F5F5F5", fill_type="solid")
    blue = PatternFill(start_color="D6EAF8", end_color="D6EAF8", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF")

    summary = boq.get("summary", {})
    project = boq.get("project_name", "Project")
    country = boq.get("country_code", "ZM")

    # Cover
    ws = wb.active
    ws.title = "Cover"
    ws["A1"] = "ARCHITEX-CAD — BILL OF QUANTITIES"
    ws["A1"].font = Font(bold=True, size=16, color="FFFFFF")
    ws["A1"].fill = navy
    ws.merge_cells("A1:F1")
    ws["A3"] = "Project"
    ws["B3"] = project
    ws["A4"] = "Client"
    ws["B4"] = boq.get("client", "")
    ws["A5"] = "Date"
    ws["B5"] = datetime.now().strftime("%d %B %Y")
    ws["A6"] = "Country"
    ws["B6"] = f"{country}"
    ws["A8"] = "Total Estimate (USD)"
    ws["B8"] = summary.get("total_project_estimate_usd", 0)
    ws["A9"] = f"Total ({summary.get('local_currency', 'ZMW')})"
    ws["B9"] = summary.get("total_local_currency", 0)

    # Summary sheet
    ws_sum = wb.create_sheet("Summary")
    ws_sum.append(["Section", "Amount USD"])
    for key, title in boq.get("section_titles", {}).items():
        total = boq.get("section_totals", {}).get(key, {}).get("mid", 0)
        if total:
            ws_sum.append([title, total])
    ws_sum.append(["Overhead", summary.get("overhead_usd", 0)])
    ws_sum.append(["Profit", summary.get("profit_usd", 0)])
    ws_sum.append(["Contingency", summary.get("contingency_usd", 0)])
    ws_sum.append(["GRAND TOTAL USD", summary.get("total_project_estimate_usd", 0)])

    # Section sheets
    for key, title in boq.get("section_titles", {}).items():
        lines = boq.get("sections", {}).get(key, [])
        if not lines:
            continue
        sheet_name = f"Section {key}"[:31]
        ws_sec = wb.create_sheet(sheet_name)
        headers = ["Item", "Description", "Unit", "Qty", "Rate", "Amount"]
        ws_sec.append(headers)
        for cell in ws_sec[1]:
            cell.font = header_font
            cell.fill = navy
        for i, line in enumerate(lines, start=2):
            ws_sec.append([
                line.get("element_ref", ""),
                line.get("description", ""),
                line.get("unit", ""),
                line.get("quantity", 0),
                line.get("rate_mid", 0),
                line.get("amount_mid", 0),
            ])
            if i % 2 == 0:
                for cell in ws_sec[i]:
                    cell.fill = grey
        total = boq.get("section_totals", {}).get(key, {}).get("mid", 0)
        row = ws_sec.max_row + 1
        ws_sec.cell(row=row, column=5, value="Section Total").font = Font(bold=True)
        c = ws_sec.cell(row=row, column=6, value=total)
        c.font = Font(bold=True)
        c.fill = blue

    # Rates sheet
    ws_rates = wb.create_sheet("Rates Database")
    ws_rates.append(["Material", "Description", "Unit", "Rate Min", "Rate Max", "Country"])
    from boq.materials_database import MATERIALS_DATABASE

    for mid, mat in MATERIALS_DATABASE.items():
        if mid == "exchange_rates":
            continue
        rates = mat.get("rates", {}).get(country, mat.get("rates", {}).get("ZM", {}))
        ws_rates.append([
            mid,
            mat.get("description", ""),
            mat.get("unit", ""),
            rates.get("min", 0),
            rates.get("max", 0),
            country,
        ])

    for sheet in wb.worksheets:
        for col in sheet.columns:
            max_len = 0
            letter = col[0].column_letter
            for cell in col:
                if cell.value is not None:
                    max_len = max(max_len, len(str(cell.value)))
            sheet.column_dimensions[letter].width = min(max_len + 2, 45)

    if not output_path:
        fd, output_path = tempfile.mkstemp(suffix=".xlsx", prefix="architex-cad_boq_")
        os.close(fd)
    wb.save(output_path)
    return output_path


def generate_boq_excel_bytes(boq: dict[str, Any]) -> bytes:
    from openpyxl import Workbook

    path = generate_boq_excel(boq)
    with open(path, "rb") as f:
        data = f.read()
    try:
        os.remove(path)
    except OSError:
        pass
    return data
