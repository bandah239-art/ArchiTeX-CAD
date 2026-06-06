from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Any

from government.dashboard_engine import portfolio_summary
from government.evm_engine import evm_monthly_series
from government.portfolio_database import (
    add_snapshot, add_variation, create_project, export_register_csv, init_db,
    list_projects, seed_demo_projects, update_certificate_status, update_project,
)
from government.project_tracker import cashflow_projection, generate_s_curve, get_project_detail
from government.payment_certificates import generate_certificate
from government.reporting_engine import generate_report

router = APIRouter(prefix="/government", tags=["government"])

LIFECYCLE_STATUSES = [
    "feasibility", "design", "tender", "construction", "defects", "closed",
    "active", "complete", "suspended",
]

SECTORS = ["road", "water_wash", "building", "energy", "social"]
FUNDING_SOURCES = ["GRZ", "World_Bank", "AfDB", "bilateral", "PPP"]
PROVINCES = [
    "Central", "Copperbelt", "Eastern", "Luapula", "Lusaka", "Muchinga",
    "Northern", "North-Western", "Southern", "Western",
]


class GovProjectInput(BaseModel):
    project_name: str
    project_code: str = ""
    project_type: str = "building"
    country_code: str = "ZM"
    province: str = ""
    district: str = ""
    gps_lat: float | None = None
    gps_lon: float | None = None
    contract_value_usd: float = 0
    contract_value_local: float = 0
    currency: str = "ZMW"
    funding_source: str = "GRZ"
    contractor_name: str = ""
    consultant_name: str = ""
    contract_date: str = ""
    commencement_date: str = ""
    original_completion: str = ""
    status: str = "construction"
    completion_pct: float = 0
    changed_by: str = "user"


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
    retention_pct: float | None = None
    advance_recovery_usd: float = 0
    period_from: str = ""
    period_to: str = ""
    exchange_rate: float = 26.5
    currency: str = "ZMW"


class GovCertApprovalInput(BaseModel):
    status: str
    approved_by: str = ""
    role: str = "engineer"


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


@router.get("/register-options")
def gov_register_options():
    return {
        "statuses": LIFECYCLE_STATUSES,
        "sectors": SECTORS,
        "funding_sources": FUNDING_SOURCES,
        "provinces": PROVINCES,
    }


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
def gov_list_projects(
    status: str | None = None,
    province: str | None = None,
    project_type: str | None = None,
    funding_source: str | None = None,
    search: str | None = None,
    min_value_usd: float | None = None,
    max_value_usd: float | None = None,
):
    init_db()
    filters = {
        k: v for k, v in {
            "status": status,
            "province": province,
            "project_type": project_type,
            "funding_source": funding_source,
            "search": search,
            "min_value_usd": min_value_usd,
            "max_value_usd": max_value_usd,
        }.items() if v is not None
    }
    return {"projects": list_projects(filters)}


@router.get("/projects/export")
def gov_export_register(
    status: str | None = None,
    province: str | None = None,
    project_type: str | None = None,
):
    filters = {k: v for k, v in {"status": status, "province": province, "project_type": project_type}.items() if v}
    csv_data = export_register_csv(filters)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=project-register.csv"},
    )


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


@router.patch("/projects/{project_id}/certificates/{certificate_id}")
def gov_approve_certificate(project_id: str, certificate_id: str, inputs: GovCertApprovalInput):
    try:
        result = update_certificate_status(
            project_id, certificate_id, inputs.status, inputs.approved_by, inputs.role
        )
        if not result:
            raise HTTPException(status_code=404, detail="Certificate not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/projects/{project_id}/timeline")
def gov_timeline(project_id: str):
    try:
        return generate_s_curve(project_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/projects/{project_id}/evm-series")
def gov_evm_series(project_id: str):
    try:
        return {"series": evm_monthly_series(project_id)}
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
