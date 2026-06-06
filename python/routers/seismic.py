"""Seismic analysis and FEA modal routes."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from calculations.seismic.response_spectrum import run_seismic_spectrum, modal_seismic_response
from calculations.fea.modal_analysis import run_modal_analysis

router = APIRouter(tags=["seismic"])


class ModalAnalysisRequest(BaseModel):
    height: float = 4.0
    span: float = 6.0
    support_type: str = "fixed"
    E: float = 2.0e11
    A: float = 0.01
    I: float = 1.0e-5
    rho: float = 7850.0
    n_modes: int = 6


class SeismicSpectrumRequest(BaseModel):
    ag: float = 0.15
    ground_type: str = "B"
    xi_pct: float = 5.0
    q: float = 1.5
    importance_class: str = "II"
    spectrum_type: int = 1
    modal_periods: list[float] | None = None
    modal_eff_masses_x: list[float] | None = None
    modal_eff_masses_y: list[float] | None = None
    modal_mass_part_x: float | None = None
    combination: str = "SRSS"


class SeismicModalCombineRequest(BaseModel):
    modes: list[dict]
    ag: float = 0.15
    ground_type: str = "B"
    xi_pct: float = 5.0
    q: float = 1.5
    importance_class: str = "II"
    spectrum_type: int = 1
    combination: str = "SRSS"


@router.post("/fea/modal-analysis")
def fea_modal_endpoint(req: ModalAnalysisRequest):
    try:
        from calculations.fea.solver_2d import assemble_frame_stiffness
        K, nodes, elements, boundary_dofs = assemble_frame_stiffness(req.model_dump())
        return run_modal_analysis(nodes, elements, K, boundary_dofs, req.rho, req.n_modes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/seismic/response-spectrum")
def seismic_spectrum_endpoint(req: SeismicSpectrumRequest):
    try:
        return run_seismic_spectrum(
            req.ag, req.ground_type, req.xi_pct, req.q,
            req.importance_class, req.spectrum_type,
            req.modal_periods or None,
            req.modal_eff_masses_x or None,
            req.modal_eff_masses_y or None,
            req.modal_mass_part_x or None,
            req.combination,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/seismic/modal-combine")
def seismic_modal_combine_endpoint(req: SeismicModalCombineRequest):
    try:
        ag_ms2 = req.ag * 9.81
        return modal_seismic_response(
            req.modes, ag_ms2, req.ground_type, req.xi_pct,
            req.q, req.importance_class, req.spectrum_type, req.combination,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
