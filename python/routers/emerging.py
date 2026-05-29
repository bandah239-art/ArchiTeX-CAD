from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any

from emerging.platform import (
    ar_mobile_scene, blockchain_anchor, cv_safety_scan,
    disaster_response_plan, drone_photogrammetry,
    marketplace_listings, satellite_analysis, voice_command,
)
from simulations.thermal.thermal_building import simulate_thermal
from simulations.seismic.seismic_response import simulate_seismic_response
from ai.text_to_bim import generate_bim_from_text

router = APIRouter(tags=["emerging"])


class EmergingInput(BaseModel):
    payload: dict[str, Any] = Field(default_factory=dict)


class SeismicAnalysisInput(BaseModel):
    analysis_type: str = Field("modal", pattern="^(modal|time_history|pushover)$")
    pga_g: float = Field(0.15, gt=0)
    n_storeys: int = Field(4, ge=1, le=30)
    storey_height_m: float = Field(3.0, gt=0)
    bay_width_m: float = Field(6.0, gt=0)
    n_bays: int = Field(3, ge=1)
    site_class: str = "B"
    mass_t: float = Field(500, gt=0)


class GenerativeBIMRequest(BaseModel):
    prompt: str = Field(..., description="Natural language prompt for structural frame generation")


@router.post("/emerging/blockchain/anchor")
def emerging_blockchain(inputs: EmergingInput):
    return blockchain_anchor(inputs.payload)


@router.get("/emerging/marketplace")
def emerging_marketplace(country_code: str = "ZM"):
    return marketplace_listings({"country_code": country_code})


@router.post("/emerging/disaster/plan")
def emerging_disaster(inputs: EmergingInput):
    return disaster_response_plan(inputs.payload)


@router.post("/emerging/satellite/analyse")
def emerging_satellite(inputs: EmergingInput):
    return satellite_analysis(inputs.payload)


@router.post("/emerging/drone/process")
def emerging_drone(inputs: EmergingInput):
    return drone_photogrammetry(inputs.payload)


@router.post("/emerging/voice/command")
def emerging_voice(inputs: EmergingInput):
    return voice_command(inputs.payload)


@router.post("/emerging/cv/safety")
def emerging_cv_safety(inputs: EmergingInput):
    return cv_safety_scan(inputs.payload)


@router.post("/emerging/ar/scene")
def emerging_ar(inputs: EmergingInput):
    return ar_mobile_scene(inputs.payload)


@router.post("/simulate/thermal")
def simulate_thermal_endpoint(inputs: EmergingInput):
    try:
        return simulate_thermal(inputs.payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/simulate/seismic")
def simulate_seismic_endpoint(inputs: SeismicAnalysisInput):
    try:
        return simulate_seismic_response(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/generate/bim")
async def generate_bim_endpoint(payload: GenerativeBIMRequest):
    try:
        return generate_bim_from_text(payload.prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
