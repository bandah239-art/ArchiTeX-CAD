from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any

from fastapi.responses import Response

from documents.tender_generator import generate_tender
from documents.calculation_report import generate_calculation_report
from documents.structural_report_pdf import render_structural_report_pdf
from documents.eia_screening import screen_eia
from documents.esg_report import generate_esg_report
from mobile.quick_calculators import concrete_mix, quick_beam_check, rebar_weight

router = APIRouter(tags=["documents"])


class TenderInput(BaseModel):
    project_name: str
    employer: str = "Ministry of Infrastructure"
    country_code: str = "ZM"
    project_description: str = ""
    contract_type: str = "lump_sum"
    estimated_value_usd: float = 0
    contract_duration_months: int = 18
    tender_closing_date: str = ""
    boq_data: dict[str, Any] = Field(default_factory=dict)
    province: str = "Lusaka"


class CalcReportInput(BaseModel):
    project_name: str = "Project"
    client_name: str = "Client"
    engineer_name: str = "Engineer"
    engineer_reg: str = ""
    site_data: dict[str, Any] = Field(default_factory=dict)
    calculations: dict[str, Any] = Field(default_factory=dict)
    design_code: str = "Eurocode 2"


class EiaScreeningInput(BaseModel):
    project_name: str = "Project"
    project_type: str = "building"
    country_code: str = "ZM"
    latitude: float = 0
    longitude: float = 0
    estimated_value_usd: float = 0
    gross_floor_area_m2: float = 0
    project_scale: dict[str, Any] = Field(default_factory=dict)
    proximity_to: dict[str, Any] = Field(default_factory=dict)
    geo_data: dict[str, Any] = Field(default_factory=dict)


class EsgReportInput(BaseModel):
    project_name: str = "Project"
    elements: list[dict[str, Any]] = Field(default_factory=list)
    material_totals: dict[str, float] = Field(default_factory=dict)


class MobileQuickCalcInput(BaseModel):
    calc_type: str = "concrete"
    grade: str = "C25"
    volume_m3: float = 1
    bar_size: str = "H16"
    length_m: float = 1
    quantity: int = 1
    span_m: float = 0
    depth_mm: float = 0


@router.post("/documents/generate-tender")
def doc_tender(inputs: TenderInput):
    try:
        return generate_tender(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/documents/calculation-report")
def doc_calc_report(inputs: CalcReportInput):
    try:
        return generate_calculation_report(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/documents/structural-report-pdf")
def doc_structural_report_pdf(inputs: CalcReportInput):
    """Production structural report PDF with draft watermark and page headers."""
    try:
        pdf_bytes = render_structural_report_pdf(inputs.model_dump())
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=structural_report.pdf"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/documents/eia-screening")
def doc_eia(inputs: EiaScreeningInput):
    try:
        return screen_eia(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/documents/esg-report")
def documents_esg_report(inputs: EsgReportInput):
    try:
        return generate_esg_report(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/mobile/quick-calc")
def mobile_quick_calc(inputs: MobileQuickCalcInput):
    try:
        d = inputs.model_dump()
        if d["calc_type"] == "concrete":
            return concrete_mix(d["grade"], d["volume_m3"])
        if d["calc_type"] == "rebar":
            return rebar_weight(d["bar_size"], d["length_m"], d["quantity"])
        if d["calc_type"] == "beam":
            return quick_beam_check(d["span_m"], d["depth_mm"])
        raise ValueError(f"Unknown calc_type: {d['calc_type']}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
