def generate_markdown_report(analysis: dict) -> str:
    """Translates the JSON analysis into a readable Markdown engineering report."""
    
    struct_id = analysis.get("structure_identification", {})
    dimensions = analysis.get("dimensions_estimated", {})
    condition = analysis.get("structural_assessment", {})
    purpose = analysis.get("engineering_purpose", {})
    recs = analysis.get("recommendations", {})
    
    report = []
    report.append("# INFRASTRUCTURE STRUCTURE ASSESSMENT REPORT")
    report.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    report.append("Prepared by:  ARCHITEX-CAD Vision Engine")
    report.append("Platform:     ARCHITEX-CAD v1.0")
    report.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    
    report.append("\n## 1. STRUCTURE IDENTIFICATION")
    report.append(f"**Type:**           {struct_id.get('primary_type', 'Unknown')} — {struct_id.get('sub_type', 'Unknown')}")
    report.append(f"**Category:**       {struct_id.get('category', 'Unknown').upper()}")
    report.append(f"**Technical name:** {struct_id.get('technical_name', 'Unknown')}")
    report.append(f"**Construction:**   {struct_id.get('construction_method', 'Unknown')}")
    report.append(f"**Est. Age:**       {condition.get('estimated_age_years', 'Unknown')}")
    report.append(f"**ID Confidence:**  {struct_id.get('confidence_pct', 'Unknown')}%")
    
    report.append("\n## 2. ENGINEERING PURPOSE")
    report.append(f"**PRIMARY FUNCTION:**\n{purpose.get('primary_function', 'None')}\n")
    report.append(f"**DESIGN INTENT:**\n{purpose.get('design_intent', 'None')}\n")
    report.append(f"**CAPACITY ESTIMATE:**\n{purpose.get('capacity_estimate', 'None')}\n")
    report.append(f"**AFRICAN CONTEXT:**\n{purpose.get('african_context_notes', 'None')}")
    
    report.append("\n## 3. ESTIMATED DIMENSIONS")
    report.append(f"[Method: {dimensions.get('method', 'unknown')}]")
    report.append(f"- Overall Length: {dimensions.get('overall_length_m', 'N/A')}m")
    report.append(f"- Overall Width: {dimensions.get('overall_width_m', 'N/A')}m")
    report.append(f"- Overall Height: {dimensions.get('overall_height_m', 'N/A')}m")
    for dim in dimensions.get("key_dimensions", []):
        report.append(f"- {dim.get('label')}: {dim.get('value_m')}m [{dim.get('confidence')} confidence]")
    
    report.append("\n## 4. CONDITION ASSESSMENT")
    report.append(f"**OVERALL CONDITION:** {str(condition.get('overall_condition', 'Unknown')).upper()} [{condition.get('condition_score', '?')}/10]")
    report.append(f"**STRUCTURAL INTEGRITY:** {condition.get('structural_integrity', 'Unknown')}")
    
    defects = condition.get("defects_observed", [])
    if defects:
        report.append("\n### DEFECTS OBSERVED:")
        for i, defect in enumerate(defects, 1):
            report.append(f"\n**{i}. {defect.get('defect_type').upper()} — {defect.get('location')}**")
            report.append(f"- **Severity:** {str(defect.get('severity')).upper()}")
            report.append(f"- **Description:** {defect.get('description')}")
            report.append(f"- **Likely cause:** {defect.get('likely_cause')}")
            report.append(f"- **Urgency:** {str(defect.get('urgency')).upper()}")
    
    report.append("\n## 5. RECOMMENDATIONS")
    immediate = recs.get("immediate_actions", [])
    if immediate:
        report.append("### IMMEDIATE ACTIONS:")
        for act in immediate:
            report.append(f"- [{act.get('priority')}] {act.get('action')}: {act.get('reason')} (Est: ${act.get('estimated_cost_usd')})")
            
    maintenance = recs.get("maintenance_schedule", [])
    if maintenance:
        report.append("\n### MAINTENANCE SCHEDULE:")
        for m in maintenance:
            report.append(f"- {m.get('frequency')}: {m.get('task')}")
            
    report.append("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    report.append("### DISCLAIMER")
    report.append("This assessment is based on visual inspection of photographic images only. A qualified structural engineer must conduct physical inspection before any maintenance or repair work commences.")
    
    return "\n".join(report)
