from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any

from emerging.platform import (
    ar_mobile_scene, blockchain_anchor, cv_safety_scan,
    disaster_response_plan, drone_photogrammetry,
    marketplace_listings, satellite_analysis, voice_command,
)
from emerging.capabilities import all_capabilities
from simulations.thermal.thermal_building import simulate_thermal
from simulations.seismic.seismic_response import simulate_seismic_response
from ai.text_to_bim import generate_bim_from_text

router = APIRouter(tags=["emerging"])


class EmergingInput(BaseModel):
    payload: dict[str, Any] = Field(default_factory=dict)


class CVSafetyInput(BaseModel):
    image_base64: str = Field("", description="Base64 image (data-URL or raw) for PPE detection")
    confidence: float = Field(0.35, ge=0.05, le=0.95)
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


class MarketplaceListingInput(BaseModel):
    type: str = Field("material", description="material|labour|equipment|carbon_credit|service")
    title: str = Field(..., min_length=1)
    price_usd: float = Field(..., ge=0)
    unit: str = "unit"
    region: str = "ZM"
    supplier: str | None = None
    description: str | None = None


@router.get("/emerging/marketplace")
def emerging_marketplace(
    country_code: str = "ZM",
    type: str | None = None,
    q: str | None = None,
    max_price: float | None = None,
):
    return marketplace_listings({
        "country_code": country_code, "type": type, "q": q, "max_price": max_price,
    })


@router.post("/emerging/marketplace")
def emerging_marketplace_create(listing: MarketplaceListingInput):
    from emerging.marketplace_store import create_listing
    try:
        return {"status": "complete", "listing": create_listing(listing.model_dump())}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/emerging/marketplace/{listing_id}")
def emerging_marketplace_delete(listing_id: str):
    from emerging.marketplace_store import delete_listing
    return delete_listing(listing_id)


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


@router.get("/emerging/capabilities")
def emerging_capabilities():
    return all_capabilities()


@router.post("/emerging/cv/safety")
def emerging_cv_safety(inputs: CVSafetyInput):
    merged = {**inputs.payload, "image_base64": inputs.image_base64, "confidence": inputs.confidence}
    return cv_safety_scan(merged)


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
