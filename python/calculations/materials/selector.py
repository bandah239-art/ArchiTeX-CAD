"""Material Selection Engine."""

from datetime import datetime, timezone
from typing import Any

from calculations.utils.formatters import round_value

def recommend_material(inputs: dict[str, Any]) -> dict[str, Any]:
    structure_type = inputs.get("structure_type", "beam")
    span = float(inputs.get("span", 5.0))
    load = float(inputs.get("load", 10.0))
    exposure = inputs.get("exposure", "internal")
    budget = inputs.get("budget", "medium")
    availability = inputs.get("availability", "Zambia")
    
    primary = "Reinforced concrete (RC)"
    grade = "C25/30"
    reason = []
    cost_index = 3
    availability_score = 4
    sustainability = 3
    maintenance = "Low"
    life = "50 years"
    cover_mm = 25
    
    # Base decision tree based on span
    if span < 5:
        if budget == "low":
            if structure_type == "wall":
                primary = "Compressed earth blocks (CEB)"
                grade = "Strength class 3 MPa"
                cost_index = 1
                availability_score = 5
                sustainability = 5
                maintenance = "Medium"
                reason.append("CEB is highly cost-effective for short-span walls on low budgets.")
            else:
                primary = "Reinforced concrete (RC)"
                grade = "C25/30"
                cost_index = 2
                reason.append("Standard RC is optimal for short spans on restricted budgets.")
        elif budget == "medium":
            primary = "Reinforced concrete (RC)"
            grade = "C30/37"
            cost_index = 3
            reason.append("RC with local aggregate provides the best balance of cost and performance.")
        else:
            primary = "Structural steel or RC"
            grade = "S275 or C35/45"
            cost_index = 4
            reason.append("High budget allows for steel framing or high-spec RC for speed of construction.")
    
    elif 5 <= span <= 12:
        if budget == "low":
            if availability.lower() in ["zambia", "kenya", "ghana"]:
                primary = "Timber / RC composite"
                grade = "C25/30 or Structural Timber"
                reason.append("Local timber or standard RC used to minimize imported steel costs.")
                cost_index = 2
            else:
                primary = "Reinforced concrete (RC)"
                grade = "C30/37"
                cost_index = 3
                reason.append("Standard RC post-tensioned may be needed at higher end of span.")
        elif budget == "medium":
            primary = "Reinforced concrete (RC)"
            grade = "C35/45"
            cost_index = 3
            reason.append("RC or composite steel/concrete optimal for medium spans.")
        else:
            if structure_type == "roof":
                primary = "Glulam timber (premium)"
                grade = "GL24h"
                sustainability = 5
            else:
                primary = "Structural steel"
                grade = "S355"
            cost_index = 5
            reason.append("High budget allows premium materials like structural steel or glulam for long spans.")
            
    else: # span > 12m
        primary = "Structural steel primary"
        grade = "S355 / S460"
        cost_index = 5
        reason.append("Spans >12m require structural steel or post-tensioned concrete.")
        if structure_type == "roof":
            primary = "Space frame (roof only)"
            reason.append("Space frames are optimal for large open-span roofs.")

    # Foundations special logic
    if structure_type == "foundation":
        bearing_capacity = load # treated as bearing pressure for foundation
        if bearing_capacity < 100:
            primary = "Raft or Piled foundation (RC)"
            reason.append("Low bearing capacity requires deep foundations or raft.")
        elif 100 <= bearing_capacity <= 200:
            primary = "Pad or strip foundation (RC)"
            reason.append("Moderate bearing allows standard pad/strip footings.")
        else:
            primary = "Pad foundation or Mass concrete"
            reason.append("Good bearing allows economical mass concrete or small pads.")

    # Exposure adjustments
    if exposure in ["aggressive", "marine"]:
        cover_mm = 50
        grade = "C40/50"
        reason.append("Aggressive exposure requires high-performance concrete (fck ≥ 40 MPa, w/c ≤ 0.40).")
        reason.append("Increased minimum cover (50mm) and/or epoxy-coated rebar recommended.")
        cost_index += 1
        life = "50+ years with maintenance"
    elif exposure == "external":
        cover_mm = 35
    else: # internal
        cover_mm = 25

    # Zambia specific adjustments (from african_conditions placeholder integration)
    if availability.lower() == "zambia":
        reason.append("Zambia context: Local cement (Lafarge/Dangote). Local aggregates variable.")
        if exposure == "external":
            cover_mm += 5
            reason.append("Cover increased by 5mm above EC2 minimum for local construction quality factors.")
        if "RC" in primary or "concrete" in primary.lower():
            reason.append("Note: Reduce design strength by 15% (use fck,nominal = fck × 0.85) due to manual batching prevalence.")

    steps = [
        {
            "step_number": 1,
            "title": "Span and Load Assessment",
            "formula": "Span category check",
            "substitution": f"Span = {span}m, Load = {load}",
            "result": f"Span range: {'< 5m' if span < 5 else '5-12m' if span <= 12 else '> 12m'}",
            "unit": "",
            "reference": "Design Matrix",
            "status": "info"
        },
        {
            "step_number": 2,
            "title": "Exposure Classification",
            "formula": "Cover & Grade limits",
            "substitution": f"Exposure: {exposure}",
            "result": f"Min cover: {cover_mm}mm, Min Grade: {grade}",
            "unit": "",
            "reference": "Eurocode 2 / Local Code",
            "status": "info"
        },
        {
            "step_number": 3,
            "title": "Material Selection",
            "formula": "Budget & Availability match",
            "substitution": f"Budget: {budget}, Loc: {availability}",
            "result": primary,
            "unit": "",
            "reference": "Material Database",
            "status": "pass"
        }
    ]

    return {
        "status": "pass",
        "summary": {
            "primary_recommendation": primary,
            "grade_specification": grade,
            "cover_mm": cover_mm,
            "cost_index_1_to_5": min(cost_index, 5),
            "availability_score_1_to_5": availability_score,
            "sustainability_score_1_to_5": sustainability,
            "maintenance_requirements": maintenance,
            "expected_service_life": life,
        },
        "reasoning": reason,
        "steps": steps,
        "warnings": [],
        "errors": [],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
