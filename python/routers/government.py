from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any

from government.dashboard_engine import portfolio_summary
from government.portfolio_database import (
    add_snapshot, add_variation, create_project, init_db,
    list_projects, seed_demo_projects, update_project,
)
from government.project_tracker import cashflow_projection, generate_s_curve, get_project_detail
from government.payment_certificates import generate_certificate
from government.reporting_engine import generate_report

router = APIRouter(prefix="/government", tags=["government"])


class GovProjectInput(BaseModel):
    project_name: str
    project_code: str = ""
    project_type: str = "building"
    country_code: str = "ZM"
    province: str = ""
    district: str = ""
    contract_value_usd: float = 0
    funding_source: str = "GRZ"
    contractor_name: str = ""
    consultant_name: str = ""
    commencement_date: str = ""
    original_completion: str = ""
    status: str = "active"
    completion_pct: float = 0


class GovSnapshotInput(BaseModel):
    snapshot_date: str = ""
    completion_pct: float = 0
    expenditure_usd: float = 0
    report_narrative: str = ""


class GovVariationInput(BaseModel):
    variation_no: str = ""
    description: str = ""
    value_usd: float = 0
    direction: str = "addition"
    status: str = "pending"
    reason: str = ""


class GovCertificateInput(BaseModel):
    contract_value_usd: float = 0
    previous_cumulative_gross_usd: float = 0
    previous_net_certified_usd: float = 0
    works_value_usd: float = 0
    materials_on_site_usd: float = 0
    retention_pct: float = 10
    period_from: str = ""
    period_to: str = ""
    exchange_rate: float = 26.5
    currency: str = "ZMW"


class GovReportInput(BaseModel):
    reporting_period: str = ""
    employer: str = "Ministry of Infrastructure, Housing and Urban Development"
    country: str = "Zambia"


@router.get("/portfolio-summary")
def gov_portfolio_summary():
    init_db()
    try:
        return portfolio_summary()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/projects/seed")
def gov_seed_projects():
    return {"projects": seed_demo_projects()}


@router.post("/projects")
def gov_create_project(inputs: GovProjectInput):
    try:
        return create_project(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/projects")
def gov_list_projects():
    init_db()
    return {"projects": list_projects()}


@router.get("/projects/{project_id}")
def gov_get_project(project_id: str):
    try:
        result = get_project_detail(project_id)
        if result.get("error"):
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/projects/{project_id}")
def gov_update_project(project_id: str, inputs: GovProjectInput):
    try:
        result = update_project(project_id, inputs.model_dump())
        if not result:
            raise HTTPException(status_code=404, detail="Project not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/projects/{project_id}/snapshot")
def gov_add_snapshot(project_id: str, inputs: GovSnapshotInput):
    try:
        return add_snapshot(project_id, inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/projects/{project_id}/variation")
def gov_add_variation(project_id: str, inputs: GovVariationInput):
    try:
        return add_variation(project_id, inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/projects/{project_id}/certificate")
def gov_certificate(project_id: str, inputs: GovCertificateInput):
    try:
        return generate_certificate(project_id, inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/projects/{project_id}/timeline")
def gov_timeline(project_id: str):
    try:
        return generate_s_curve(project_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/projects/{project_id}/cashflow")
def gov_cashflow(project_id: str):
    try:
        return cashflow_projection(project_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reports/{report_type}")
def gov_report(report_type: str, inputs: GovReportInput):
    try:
        return generate_report(report_type, inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
