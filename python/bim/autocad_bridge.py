"""Optional AutoCAD native bridge using GeometryExtensions C# library."""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
BRIDGE_DIR = REPO_ROOT / "GeometryExtensions" / "InfraAfricaBridge"
BRIDGE_EXE = BRIDGE_DIR / "bin" / "Release" / "net8.0-windows" / "InfraAfricaBridge.exe"
GEOMETRY_EXT_DIR = REPO_ROOT / "GeometryExtensions"


def _find_autocad_assemblies() -> list[str]:
    candidates = [
        r"C:\Program Files\Autodesk\AutoCAD 2026",
        r"C:\Program Files\Autodesk\AutoCAD 2025",
        r"C:\Program Files\Autodesk\AutoCAD 2024",
        r"F:\Program Files\Autodesk\AutoCAD 2026",
    ]
    found = []
    for base in candidates:
        if os.path.isdir(base):
            for name in ("AcCoreMgd.dll", "AcDbMgd.dll", "AcMgd.dll"):
                path = os.path.join(base, name)
                if os.path.isfile(path):
                    found.append(path)
            if found:
                break
    return found


def autocad_bridge_status() -> dict[str, Any]:
    dotnet = shutil.which("dotnet")
    return {
        "available": BRIDGE_EXE.is_file(),
        "bridge_exe": str(BRIDGE_EXE),
        "bridge_built": BRIDGE_EXE.is_file(),
        "dotnet_sdk": bool(dotnet),
        "geometry_extensions_source": str(GEOMETRY_EXT_DIR),
        "autocad_assemblies_detected": len(_find_autocad_assemblies()) > 0,
        "build_hint": (
            "Install AutoCAD ObjectARX SDK, set DLL paths in InfraAfricaBridge.csproj, "
            "then: dotnet build GeometryExtensions/InfraAfricaBridge -c Release"
        ),
    }


def export_dwg_geometry(dwg_path: str) -> dict[str, Any]:
    """Invoke native bridge when built; otherwise return guidance."""
    status = autocad_bridge_status()
    if not status["bridge_built"]:
        return {
            "status": "unavailable",
            "error": "AutoCAD bridge not built",
            "bridge": status,
            "fallback": "Use IFC import or Python geometry_extensions API",
        }
    if not os.path.isfile(dwg_path):
        return {"status": "error", "error": f"DWG not found: {dwg_path}"}

    try:
        proc = subprocess.run(
            [str(BRIDGE_EXE), dwg_path],
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
        if proc.returncode != 0:
            return {"status": "error", "error": proc.stderr or proc.stdout or "Bridge failed"}
        import json

        return json.loads(proc.stdout)
    except Exception as exc:
        return {"status": "error", "error": str(exc)}
