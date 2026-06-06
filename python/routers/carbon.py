"""Carbon & sustainability routes."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from calculations.sustainability.carbon import calculate_construction_carbon, calculate_carbon_credits
from calculations.core.engineer_control import wrap_calculation_result

router = APIRouter(tags=["carbon"])


class CarbonInputs(BaseModel):
    materials: dict = Field(default_factory=dict)
    transport: dict = Field(default_factory=dict)
    energy: dict = Field(default_factory=dict)


class CarbonCreditInputs(BaseModel):
    baseline_emissions_tCO2e: float = Field(100, ge=0)
    project_emissions_tCO2e: float = Field(60, ge=0)
    sequestration_tCO2e: float = Field(0, ge=0)
    project_life_years: int = Field(20, ge=1)
    price_per_vcu_usd: float = Field(15, ge=0)
    methodology: str = "VCS VM0045"


@router.post("/calculate/carbon")
def calculate_carbon_endpoint(inputs: CarbonInputs):
    try:
        return wrap_calculation_result(calculate_construction_carbon(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calculate/carbon/credits")
def calculate_carbon_credits_endpoint(inputs: CarbonCreditInputs):
    try:
        return wrap_calculation_result(calculate_carbon_credits(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
