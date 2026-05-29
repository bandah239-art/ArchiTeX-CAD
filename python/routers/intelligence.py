from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from typing import Any

from collaboration.room_manager import handle_message, join_room, leave_room, room_status
from collaboration.ws_manager import register, unregister, broadcast
from intelligence.digital_twin import get_asset, ingest_reading, list_assets, register_asset, seed_demo_assets
from intelligence.predictive_maintenance import analyse_asset, analyse_portfolio
from scheduling.construction_4d import build_schedule_from_bim
from calculations.generative.optimizer import optimize_structural_layout, optimize_solar_orientation
from sync.mobile_sync import list_sync_items, receive_sync_item
from sync.desktop_sync import process_sync_batch
from cache.calc_cache import cache_status as calc_cache_status, clear_cache as clear_calc_cache, get_cached, set_cached
from cache.project_cache import load_project_meta, save_project_meta

router = APIRouter(tags=["intelligence"])


class CollabJoinInput(BaseModel):
    user_id: str
    user_name: str = "Engineer"


class TwinAssetInput(BaseModel):
    asset_name: str
    asset_type: str = "structure"
    project_id: str = ""
    location: str = ""


class SensorReadingInput(BaseModel):
    asset_id: str
    sensor_type: str = "generic"
    value: float
    unit: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)


class ScheduleBuildInput(BaseModel):
    project_name: str = "Project"
    duration_weeks: int = 52
    elements: list[dict[str, Any]] = Field(default_factory=list)


class OptimizerInput(BaseModel):
    floor_area_m2: float = Field(400, gt=0)
    span_min_m: float = Field(4, gt=0)
    span_max_m: float = Field(12, gt=0)
    n_spans_min: int = Field(2, ge=1)
    n_spans_max: int = Field(8, ge=1)
    weight_steel: float = 1.0
    weight_cost: float = 1.5
    weight_deflection: float = 0.1
    max_iterations: int = Field(200, ge=10, le=1000)


class SolarOptimizerInput(BaseModel):
    latitude: float = -15.4
    longitude: float = 28.3
    roof_area_m2: float = Field(80, gt=0)
    n_trials: int = Field(100, ge=10, le=500)


class SyncReceiveInput(BaseModel):
    id: str = ""
    type: str = "site_report"
    project_id: str = ""
    priority: int = 5
    data: dict[str, Any] = Field(default_factory=dict)


class SyncBatchInput(BaseModel):
    operations: list[dict[str, Any]] = Field(default_factory=list)


class ProjectMetaInput(BaseModel):
    name: str = ""
    ifc_path: str = ""
    country_code: str = "ZM"
    last_opened: str = ""


# ── Collaboration ─────────────────────────────────────────────────────────────

@router.get("/collaboration/rooms/{project_id}")
def collab_room_status(project_id: str):
    return room_status(project_id)


@router.post("/collaboration/rooms/{project_id}/join")
def collab_join(project_id: str, inputs: CollabJoinInput):
    return join_room(project_id, inputs.user_id, inputs.user_name)


@router.post("/collaboration/rooms/{project_id}/leave")
def collab_leave(project_id: str, inputs: CollabJoinInput):
    return leave_room(project_id, inputs.user_id)


@router.websocket("/collaboration/ws/{project_id}/{user_id}")
async def collab_websocket(websocket: WebSocket, project_id: str, user_id: str):
    await websocket.accept()
    register(project_id, user_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            response = handle_message(project_id, user_id, raw)
            if response:
                await websocket.send_json(response)
                if response.get("type") in ("event", "room_state"):
                    await broadcast(project_id, response, exclude_user=user_id)
    except WebSocketDisconnect:
        leave_room(project_id, user_id)
        unregister(project_id, user_id)
        await broadcast(project_id, {"type": "room_state", "data": room_status(project_id)})


# ── Digital Twin ──────────────────────────────────────────────────────────────

@router.post("/intelligence/twin/assets")
def twin_register(inputs: TwinAssetInput):
    try:
        return register_asset(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/intelligence/twin/assets")
def twin_list_assets(project_id: str = ""):
    assets = list_assets(project_id)
    if not assets:
        assets = seed_demo_assets()
    return {"assets": assets}


@router.get("/intelligence/twin/assets/{asset_id}")
def twin_get_asset(asset_id: str):
    asset = get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.post("/intelligence/twin/ingest")
def twin_ingest(inputs: SensorReadingInput):
    try:
        return ingest_reading(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/intelligence/predictive/{asset_id}")
def predictive_asset(asset_id: str):
    result = analyse_asset(asset_id)
    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/intelligence/predictive")
def predictive_portfolio(project_id: str = ""):
    return analyse_portfolio(project_id)


@router.post("/intelligence/twin/seed")
def twin_seed():
    return {"assets": seed_demo_assets()}


# ── Schedule & Optimizer ──────────────────────────────────────────────────────

@router.post("/schedule/build-from-bim")
def schedule_build_from_bim_endpoint(inputs: ScheduleBuildInput):
    try:
        return build_schedule_from_bim(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/optimize/structural")
def optimize_structural_endpoint(inputs: OptimizerInput):
    try:
        return optimize_structural_layout(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/optimize/solar")
def optimize_solar_endpoint(inputs: SolarOptimizerInput):
    try:
        return optimize_solar_orientation(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Sync & Cache ──────────────────────────────────────────────────────────────

@router.post("/sync/receive")
def sync_receive(inputs: SyncReceiveInput):
    try:
        payload = inputs.model_dump()
        payload.update(payload.pop("data", {}))
        return receive_sync_item(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/sync/items")
def sync_items():
    return {"items": list_sync_items()}


@router.post("/sync/batch")
def sync_batch_endpoint(inputs: SyncBatchInput):
    try:
        return process_sync_batch(inputs.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/cache/calc/status")
def calc_cache_status_endpoint():
    return calc_cache_status()


@router.post("/cache/calc/clear")
def calc_cache_clear_endpoint():
    return clear_calc_cache()


@router.get("/cache/project")
def project_meta_load():
    return load_project_meta()


@router.post("/cache/project")
def project_meta_save(inputs: ProjectMetaInput):
    return save_project_meta(inputs.model_dump())
