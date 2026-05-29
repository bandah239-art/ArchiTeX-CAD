from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any

from real_estate.plot_valuation import value_plot
from real_estate.feasibility import run_feasibility
from real_estate.land_use_optimiser import optimise_land_use
from real_estate.mortgage import calculate_mortgage
from calculations.core.engineer_control import wrap_calculation_result

router = APIRouter(prefix="/real-estate", tags=["real-estate"])


class PlotValuationInput(BaseModel):
    latitude: float = 0
    longitude: float = 0
    country_code: str = "ZM"
    city: str = "Lusaka"
    neighbourhood: str = "Woodlands"
    plot_area_m2: float
    asking_price_usd: float
    road_frontage_m: float = 15
    services_available: dict[str, bool] = Field(default_factory=dict)
    title_deed_type: str = "freehold"
    geo_data: dict[str, Any] = Field(default_factory=dict)


class FeasibilityInput(BaseModel):
    plot_data: dict[str, Any] = Field(default_factory=dict)
    land_cost_usd: float = 0
    development_type: str = "residential_single"
    units_planned: int = 1
    gross_floor_area_m2: float = 250
    construction_standard: str = "standard"
    finance_type: str = "cash"
    loan_percentage: float = 0
    interest_rate_annual: float = 0
    loan_term_months: int = 0
    target_sale_price_per_m2: float = 750
    target_rental_per_month: float = 0
    country_code: str = "ZM"
    city: str = "Lusaka"


class LandUseInput(BaseModel):
    plot_data: dict[str, Any]
    country_code: str = "ZM"
    city: str = "Lusaka"
    geo_data: dict[str, Any] = Field(default_factory=dict)


class MortgageInput(BaseModel):
    country_code: str = "ZM"
    property_value_usd: float
    deposit_pct: float = 20
    term_years: int = 15
    interest_rate_annual: float = 0
    monthly_income_usd: float = 0


@router.post("/value-plot")
def re_value_plot(inputs: PlotValuationInput):
    try:
        return value_plot(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/feasibility")
def re_feasibility(inputs: FeasibilityInput):
    try:
        return run_feasibility(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/optimise-use")
def re_optimise_use(inputs: LandUseInput):
    try:
        return optimise_land_use(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/mortgage")
def re_mortgage(inputs: MortgageInput):
    try:
        return wrap_calculation_result(calculate_mortgage(inputs.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
