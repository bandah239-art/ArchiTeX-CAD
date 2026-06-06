"""Emerging technology modules — blockchain, marketplace, disaster, satellite, drone, voice, CV, AR."""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import os
import time
from typing import Any

from emerging.capabilities import (
    check_cv_safety,
    check_drone,
    check_satellite,
)


def blockchain_anchor(payload: dict[str, Any]) -> dict[str, Any]:
    """Anchor document hash on simulated permissioned ledger."""
    doc = json.dumps(payload.get("document", {}), sort_keys=True, default=str)
    ts = int(time.time())
    block_hash = hashlib.sha256(f"{doc}{ts}".encode()).hexdigest()
    return {
        "status": "complete",
        "engine": "simulated_ledger",
        "block_hash": block_hash,
        "timestamp": ts,
        "chain": "architex-cad-permissioned",
        "anchored": True,
    }


def marketplace_listings(payload: dict[str, Any]) -> dict[str, Any]:
    """Real SQLite-backed marketplace listings with optional filters."""
    from emerging.marketplace_store import list_listings

    return list_listings(
        region=payload.get("country_code") or payload.get("region"),
        listing_type=payload.get("type"),
        q=payload.get("q"),
        max_price=payload.get("max_price"),
    )


def disaster_response_plan(payload: dict[str, Any]) -> dict[str, Any]:
    """Real hazard-specific planning engine with population-scaled resources."""
    from emerging.disaster_engine import build_plan

    return build_plan(payload)


def satellite_analysis(payload: dict[str, Any]) -> dict[str, Any]:
    """Satellite imagery analysis.

    Runs real rasterio/Sentinel NDVI analysis when configured; otherwise returns
    a deterministic land-cover preview plus the steps to enable production inference.
    """
    lat = float(payload.get("latitude", 0))
    lon = float(payload.get("longitude", 0))
    cap = check_satellite()

    preview = {
        "status": "preview",
        "enabled": False,
        "engine": cap["engine"],
        "location": {"latitude": lat, "longitude": lon},
        "tile_source": "sentinel-2-compatible",
        "land_cover": {
            "built_up_pct": 35,
            "vegetation_pct": 45,
            "bare_soil_pct": 15,
            "water_pct": 5,
        },
        "change_detection": {"construction_activity": "moderate", "period_months": 12},
        "requires": cap["requires"],
        "setup": (
            "Install rasterio + pyproj (GDAL), set SENTINEL_HUB_KEY or EARTHENGINE_TOKEN, "
            "then a bbox tile is downloaded and NDVI/land-cover computed."
        ),
    }

    if not cap["enabled"]:
        return preview

    try:
        from emerging.providers.satellite_sentinel import analyse_tile  # type: ignore

        result = analyse_tile(lat, lon, payload)
        return {"status": "complete", "enabled": True, "engine": "rasterio_ndvi", **result}
    except Exception as exc:  # pragma: no cover - depends on external provider
        preview["status"] = "error"
        preview["error"] = str(exc)
        return preview


def drone_photogrammetry(payload: dict[str, Any]) -> dict[str, Any]:
    """Drone photogrammetry.

    Submits an image set to a configured WebODM/NodeODM server, otherwise returns
    a processing plan preview and the steps to enable real reconstruction.
    """
    webodm_url = payload.get("webodm_url") or os.environ.get("WEBODM_URL", "").strip()
    cap = check_drone(webodm_url)
    images_count = int(payload.get("images_count", len(payload.get("images", []) or [])))

    preview = {
        "status": "preview",
        "enabled": False,
        "engine": cap["engine"],
        "images_count": images_count,
        "gsd_cm_est": 2.5,
        "orthomosaic_ready": False,
        "point_cloud_points": 0,
        "workflow": ["upload_images", "sfm_alignment", "dense_reconstruction", "mesh_texturing", "export_glb"],
        "requires": cap["requires"],
        "setup": "Run WebODM (https://www.opendronemap.org/webodm/), set WEBODM_URL (and WEBODM_TOKEN if secured).",
    }

    if not cap["enabled"]:
        return preview

    try:
        from emerging.providers.drone_webodm import submit_task  # type: ignore

        result = submit_task(webodm_url, payload)
        return {"status": "submitted", "enabled": True, "engine": "webodm", **result}
    except Exception as exc:  # pragma: no cover - depends on external server
        preview["status"] = "error"
        preview["error"] = str(exc)
        return preview


def voice_command(payload: dict[str, Any]) -> dict[str, Any]:
    from ai.voice_agent import process_voice_command
    transcript = payload.get("transcript", "")
    if not transcript.strip():
        return {"status": "complete", "transcript": "", "reply": "", "intent": "chat", "action": {}}
    result = process_voice_command(transcript)
    return {
        "status": "complete",
        "transcript": transcript,
        "reply": result.get("spoken_response", ""),
        "intent": result.get("intent", "chat"),
        "action": result.get("payload", {}),
    }


def _decode_image_bytes(payload: dict[str, Any]) -> bytes | None:
    """Extract image bytes from a base64 data-URL or raw base64 payload."""
    b64 = payload.get("image_base64") or payload.get("image") or ""
    if not b64:
        return None
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    try:
        return base64.b64decode(b64)
    except (binascii.Error, ValueError):
        return None


def cv_safety_scan(payload: dict[str, Any]) -> dict[str, Any]:
    """Construction-site PPE / hazard detection.

    Runs a real YOLO model on an uploaded image when ultralytics is installed;
    otherwise returns a manual-count preview and the steps to enable detection.
    """
    cap = check_cv_safety()
    image_bytes = _decode_image_bytes(payload)

    preview = {
        "status": "preview",
        "enabled": False,
        "engine": cap["engine"],
        "has_image": image_bytes is not None,
        "detections": [
            {"class": "hard_hat", "count": payload.get("hard_hats", 0), "compliant": True},
            {"class": "high_vis_vest", "count": payload.get("vests", 0), "compliant": True},
            {"class": "missing_ppe", "count": payload.get("violations", 0), "compliant": payload.get("violations", 0) == 0},
        ],
        "safety_score": max(0, 100 - int(payload.get("violations", 0)) * 15),
        "requires": cap["requires"],
        "setup": "pip install ultralytics, then POST an image as image_base64 to run YOLO PPE detection.",
    }

    if not cap["enabled"]:
        return preview
    if image_bytes is None:
        preview["status"] = "no_image"
        preview["message"] = "Detector is installed. Provide image_base64 to run a scan."
        return preview

    try:
        from emerging.providers.cv_yolo import detect_ppe  # type: ignore

        result = detect_ppe(image_bytes, payload)
        return {"status": "complete", "enabled": True, "engine": "ultralytics_yolo", **result}
    except Exception as exc:  # pragma: no cover - depends on model weights
        preview["status"] = "error"
        preview["error"] = str(exc)
        return preview


def ar_mobile_scene(payload: dict[str, Any]) -> dict[str, Any]:
    """Real geo-anchored AR scene with ENU coordinate math."""
    from emerging.ar_engine import build_scene

    return build_scene(payload)
