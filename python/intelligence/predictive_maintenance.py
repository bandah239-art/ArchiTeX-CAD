"""Predictive maintenance analysis from digital twin sensor data."""

from datetime import datetime, timezone
from typing import Any

from intelligence.digital_twin import get_asset, list_assets, seed_demo_assets

THRESHOLDS = {
    "vibration_mm_s": {"warning": 4.5, "critical": 7.0},
    "temperature_c": {"warning": 45, "critical": 60},
    "strain_microstrain": {"warning": 300, "critical": 500},
    "corrosion_rate_mpy": {"warning": 5, "critical": 10},
    "flow_rate_lps": {"warning_low": 0.5, "critical_low": 0.2},
}


def analyse_asset(asset_id: str) -> dict[str, Any]:
    asset = get_asset(asset_id)
    if not asset:
        return {"error": "Asset not found"}

    readings = asset.get("readings", [])
    alerts: list[dict[str, Any]] = []
    scores: list[float] = []

    for reading in readings:
        stype = reading.get("sensor_type", "")
        value = float(reading.get("value", 0))
        thresholds = THRESHOLDS.get(stype, {})
        score = 100.0
        severity = "OK"

        if "critical" in thresholds and value >= thresholds["critical"]:
            severity = "CRITICAL"
            score = 30
            alerts.append({"sensor": stype, "value": value, "severity": severity, "message": f"{stype} critical threshold exceeded"})
        elif "warning" in thresholds and value >= thresholds["warning"]:
            severity = "WARNING"
            score = 60
            alerts.append({"sensor": stype, "value": value, "severity": severity, "message": f"{stype} elevated — schedule inspection"})
        elif "critical_low" in thresholds and value <= thresholds["critical_low"]:
            severity = "CRITICAL"
            score = 35
            alerts.append({"sensor": stype, "value": value, "severity": severity, "message": f"{stype} critically low"})
        elif "warning_low" in thresholds and value <= thresholds["warning_low"]:
            severity = "WARNING"
            score = 65
            alerts.append({"sensor": stype, "value": value, "severity": severity, "message": f"{stype} below normal range"})

        scores.append(score)

    health_score = sum(scores) / len(scores) if scores else 85
    if health_score >= 80:
        overall = "HEALTHY"
        recommendation = "Continue routine monitoring"
    elif health_score >= 60:
        overall = "ATTENTION REQUIRED"
        recommendation = "Schedule inspection within 30 days"
    else:
        overall = "CRITICAL"
        recommendation = "Immediate engineering inspection required"

    return {
        "status": "complete",
        "asset_id": asset_id,
        "asset_name": asset.get("asset_name"),
        "health_score": round(health_score, 1),
        "overall_status": overall,
        "recommendation": recommendation,
        "alerts": alerts,
        "sensor_count": len(readings),
        "predicted_maintenance_days": 90 if overall == "HEALTHY" else 14 if overall == "ATTENTION REQUIRED" else 3,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def analyse_portfolio(project_id: str = "") -> dict[str, Any]:
    assets = list_assets(project_id)
    if not assets:
        assets = seed_demo_assets()
    results = []
    for a in assets:
        r = analyse_asset(a["id"])
        if "error" not in r:
            results.append(r)
    critical = [r for r in results if r.get("overall_status") == "CRITICAL"]
    return {
        "status": "complete",
        "project_id": project_id,
        "assets_analysed": len(results),
        "healthy": len([r for r in results if r.get("overall_status") == "HEALTHY"]),
        "attention": len([r for r in results if r.get("overall_status") == "ATTENTION REQUIRED"]),
        "critical": len(critical),
        "assets": results,
    }
