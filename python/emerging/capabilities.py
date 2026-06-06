"""Capability detection for emerging-tech features.

Each emerging feature depends on an optional package, an external binary, a
network service, or an API key that is not bundled with the desktop app. This
module performs cheap, side-effect-free detection so endpoints can either run
real inference (when configured) or return a clear "how to enable" response.
"""

from __future__ import annotations

import importlib.util
import os
import shutil
from typing import Any


def _has_module(name: str) -> bool:
    """True if an importable module is installed (without importing it)."""
    try:
        return importlib.util.find_spec(name) is not None
    except (ImportError, ValueError):
        return False


def _has_env(*names: str) -> bool:
    return any(os.environ.get(n, "").strip() for n in names)


def check_cv_safety() -> dict[str, Any]:
    """YOLO-based PPE / hazard detection via ultralytics."""
    has_ultralytics = _has_module("ultralytics")
    has_pillow = _has_module("PIL")
    enabled = has_ultralytics and has_pillow
    return {
        "feature": "cv_safety",
        "enabled": enabled,
        "engine": "ultralytics_yolo" if enabled else "heuristic_preview",
        "requires": {
            "pip": [] if has_ultralytics else ["ultralytics"],
            "system": [],
            "env": [],
            "notes": "First run downloads YOLO weights (~6MB for yolov8n, larger for bigger models).",
        },
    }


def check_thermal() -> dict[str, Any]:
    """EnergyPlus simulation via eppy. Baseline steady-state always available."""
    has_eppy = _has_module("eppy")
    energyplus_bin = shutil.which("energyplus") or shutil.which("EnergyPlus")
    enabled = has_eppy and bool(energyplus_bin)
    return {
        "feature": "thermal",
        "enabled": enabled,
        "engine": "energyplus" if enabled else "steady_state_baseline",
        "energyplus_path": energyplus_bin,
        "requires": {
            "pip": [] if has_eppy else ["eppy"],
            "system": [] if energyplus_bin else ["EnergyPlus (https://energyplus.net/downloads)"],
            "env": [],
            "notes": "Steady-state degree-day estimate runs without EnergyPlus.",
        },
    }


def check_satellite() -> dict[str, Any]:
    """Sentinel/Earth-Engine imagery analysis via rasterio + provider key."""
    has_rasterio = _has_module("rasterio")
    has_numpy = _has_module("numpy")
    has_key = _has_env("SENTINEL_HUB_KEY", "SENTINELHUB_CLIENT_ID", "EARTHENGINE_TOKEN")
    enabled = has_rasterio and has_numpy and has_key
    return {
        "feature": "satellite",
        "enabled": enabled,
        "engine": "rasterio_ndvi" if enabled else "land_cover_preview",
        "requires": {
            "pip": [] if has_rasterio else ["rasterio", "pyproj"],
            "system": [] if has_rasterio else ["GDAL (OSGeo4W on Windows)"],
            "env": [] if has_key else ["SENTINEL_HUB_KEY or EARTHENGINE_TOKEN"],
            "notes": "Provider account/key required for live tile download.",
        },
    }


def check_drone(webodm_url: str | None = None) -> dict[str, Any]:
    """Photogrammetry via a WebODM/NodeODM server."""
    url = webodm_url or os.environ.get("WEBODM_URL", "").strip()
    has_token = _has_env("WEBODM_TOKEN")
    enabled = bool(url)
    return {
        "feature": "drone",
        "enabled": enabled,
        "engine": "webodm" if enabled else "photogrammetry_plan_preview",
        "webodm_url": url or None,
        "requires": {
            "pip": [],
            "system": ["WebODM or NodeODM server (cloud or self-hosted compute)"],
            "env": ["WEBODM_URL"] + ([] if has_token else ["WEBODM_TOKEN (if auth enabled)"]),
            "notes": "Photogrammetry needs significant compute; run WebODM separately.",
        },
    }


def all_capabilities() -> dict[str, Any]:
    """Aggregate status for the whole emerging-tech suite."""
    checks = [check_cv_safety(), check_thermal(), check_satellite(), check_drone()]
    return {
        "status": "complete",
        "capabilities": {c["feature"]: c for c in checks},
        "enabled_count": sum(1 for c in checks if c["enabled"]),
        "total": len(checks),
    }
