"""Model-wide clash detection using axis-aligned bounding box overlap."""

from __future__ import annotations

from typing import Any


def _bbox_overlap(a: dict, b: dict, tolerance_m: float = 0.01) -> bool:
    """Return True if two AABB dicts {min:[x,y,z], max:[x,y,z]} overlap."""
    for i in range(3):
        if a["max"][i] + tolerance_m < b["min"][i]:
            return False
        if b["max"][i] + tolerance_m < a["min"][i]:
            return False
    return True


def _overlap_volume(a: dict, b: dict) -> float:
    """Approximate overlap volume (m³) from AABB intersection."""
    mins = [max(a["min"][i], b["min"][i]) for i in range(3)]
    maxs = [min(a["max"][i], b["max"][i]) for i in range(3)]
    dims = [max(0.0, maxs[i] - mins[i]) for i in range(3)]
    return dims[0] * dims[1] * dims[2]


def scan_model_clashes(
    elements: list[dict[str, Any]],
    *,
    tolerance_m: float = 0.01,
    min_overlap_m3: float = 0.001,
    discipline_filter: str | None = None,
) -> dict[str, Any]:
    """
    Scan all element pairs for AABB clashes.

    Each element dict expects:
        id, globalId, type, name, bounds: {min:[x,y,z], max:[x,y,z]}
    """
    structural = {"IfcBeam", "IfcColumn", "IfcSlab", "IfcFooting", "IfcWall", "IfcFoundation"}
    mep = {"IfcPipeSegment", "IfcDuctSegment", "IfcCableCarrierSegment", "IfcFlowTerminal"}

    eligible = [e for e in elements if e.get("bounds")]
    clashes: list[dict[str, Any]] = []

    for i in range(len(eligible)):
        for j in range(i + 1, len(eligible)):
            a, b = eligible[i], eligible[j]
            if a["id"] == b["id"]:
                continue

            ta, tb = a.get("type", ""), b.get("type", "")
            if discipline_filter == "structural_mep":
                a_disc = ta in structural
                b_disc = tb in mep or ta in mep
                if not ((a_disc and tb in mep) or (b_disc and ta in structural)):
                    continue

            if not _bbox_overlap(a["bounds"], b["bounds"], tolerance_m):
                continue

            vol = _overlap_volume(a["bounds"], b["bounds"])
            if vol < min_overlap_m3:
                continue

            severity = "critical" if vol > 0.05 else "warning" if vol > 0.01 else "minor"
            clashes.append({
                "element_a": {"id": a["id"], "globalId": a.get("globalId"), "type": ta, "name": a.get("name")},
                "element_b": {"id": b["id"], "globalId": b.get("globalId"), "type": tb, "name": b.get("name")},
                "overlap_volume_m3": round(vol, 4),
                "severity": severity,
                "discipline": "structural_mep" if (ta in structural and tb in mep) or (tb in structural and ta in mep) else "general",
            })

    clashes.sort(key=lambda c: c["overlap_volume_m3"], reverse=True)
    return {
        "status": "pass" if not clashes else "warning",
        "total_elements": len(eligible),
        "clash_count": len(clashes),
        "critical_count": sum(1 for c in clashes if c["severity"] == "critical"),
        "clashes": clashes[:200],
        "tolerance_m": tolerance_m,
    }
