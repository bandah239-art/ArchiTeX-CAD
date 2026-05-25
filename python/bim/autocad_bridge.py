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


def export_dwg_geometry(
    dwg_path: str,
    elements: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Invoke native bridge when built; otherwise DXF plan fallback from BIM elements."""
    from bim.plan_export import export_plan_dxf_payload

    status = autocad_bridge_status()
    path_lower = (dwg_path or "").lower()

    if elements:
        return export_plan_dxf_payload(elements)

    if path_lower.endswith(".ifc") and os.path.isfile(dwg_path):
        try:
            from bim.ifc_geometry import parse_ifc_file

            parsed = parse_ifc_file(dwg_path)
            if parsed.get("elements"):
                out = export_plan_dxf_payload(parsed["elements"])
                out["ifc_path"] = dwg_path
                return out
        except Exception as exc:
            return {"status": "error", "error": f"IFC plan export failed: {exc}"}

    if not status["bridge_built"]:
        return {
            "status": "unavailable",
            "error": "AutoCAD bridge not built. Load an IFC model and export again for plan DXF fallback.",
            "bridge": status,
            "fallback": "Pass elements[] or an .ifc path for DXF plan export",
        }
    if not dwg_path or not os.path.isfile(dwg_path):
        return {
            "status": "error",
            "error": f"File not found: {dwg_path or '(empty path)'}",
            "hint": "Open an IFC model in the viewer, or provide a .dwg file path",
        }

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
