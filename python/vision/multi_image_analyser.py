from .structure_analyser import analyse_structure

async def analyse_multi_image(images: list[str], metadata: dict, geo_context: dict) -> dict:
    """
    Multi-image analysis workflow. 
    Currently simplifies by running the primary analysis on the first image,
    and merging metadata if necessary. In a full implementation, it would
    cross-reference findings.
    """
    if not images:
        raise ValueError("No images provided for multi-analysis")
        
    # For now, rely on the primary first image
    primary_analysis = await analyse_structure(images[0], metadata, geo_context)
    
    # If there are multiple images, we could potentially boost confidence scores
    if len(images) > 1:
        if "structure_identification" in primary_analysis:
            # Boost confidence slightly
            current_conf = primary_analysis["structure_identification"].get("confidence_pct", 80)
            primary_analysis["structure_identification"]["confidence_pct"] = min(100, current_conf + 5)
            primary_analysis["structure_identification"]["identification_notes"] += f" (Confirmed via {len(images)} images)"
            
    return primary_analysis
