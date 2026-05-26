"""Procedural 3D Structural Frame Generator (Text-to-BIM)."""

from typing import Any, Dict, List
import logging
import math

logger = logging.getLogger(__name__)

def parse_bim_prompt(prompt: str) -> Dict[str, Any]:
    """
    NLP parsing to extract grid dimensions, materials, and envelope requirements.
    """
    params = {
        "width": 20,
        "length": 30,
        "stories": 3,
        "grid_x": 5,
        "grid_y": 5,
        "story_height": 3.5,
        "style": "concrete",
        "has_walls": False,
        "has_windows": False,
        "roof_type": "flat",
        "wall_material": "brick"
    }
    
    prompt_lower = prompt.lower()
    words = prompt_lower.split()
    
    for i, word in enumerate(words):
        if "story" in word or "stories" in word or "floor" in word:
            if i > 0 and words[i-1].isdigit():
                params["stories"] = int(words[i-1])
        if "x" in word and len(word) > 1:
            parts = word.split("x")
            if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                params["width"] = int(parts[0])
                params["length"] = int(parts[1])
                
        if word in ["steel", "concrete", "timber"]:
            params["style"] = word
            
    if "wall" in prompt_lower:
        params["has_walls"] = True
    if "brick" in prompt_lower:
        params["has_walls"] = True
        params["wall_material"] = "brick"
    if "glass" in prompt_lower:
        params["has_walls"] = True
        params["wall_material"] = "glass"
        
    if "window" in prompt_lower:
        params["has_windows"] = True
        
    if "pitched" in prompt_lower or "gable" in prompt_lower:
        params["roof_type"] = "pitched"
            
    return params

def generate_structural_frame(params: Dict[str, Any]) -> Dict[str, Any]:
    w = params["width"]
    l = params["length"]
    stories = params["stories"]
    gx = params["grid_x"]
    gy = params["grid_y"]
    sh = params["story_height"]
    
    nodes = []
    columns = []
    beams = []
    slabs = []
    walls = []
    windows = []
    roofs = []
    
    num_x = int(math.ceil(w / gx)) + 1
    num_y = int(math.ceil(l / gy)) + 1
    actual_gx = w / (num_x - 1) if num_x > 1 else w
    actual_gy = l / (num_y - 1) if num_y > 1 else l
    
    col_width = 0.4 if params["style"] == "concrete" else 0.2
    beam_width = 0.3 if params["style"] == "concrete" else 0.15
    beam_depth = 0.5 if params["style"] == "concrete" else 0.3
    
    # 1. Nodes
    node_idx = 0
    node_map = {}
    for z in range(stories + 1):
        for y in range(num_y):
            for x in range(num_x):
                nx = x * actual_gx
                ny = y * actual_gy
                nz = z * sh
                nodes.append({"id": node_idx, "x": nx, "y": nz, "z": ny})
                node_map[(x, y, z)] = node_idx
                node_idx += 1
                
    # 2. Columns
    col_id = 0
    for z in range(stories):
        for y in range(num_y):
            for x in range(num_x):
                columns.append({
                    "id": f"C{col_id}",
                    "start": node_map[(x, y, z)],
                    "end": node_map[(x, y, z+1)],
                    "width": col_width,
                    "depth": col_width
                })
                col_id += 1
                
    # 3. Beams & Slabs
    beam_id = 0
    wall_id = 0
    win_id = 0
    
    for z in range(1, stories + 1):
        slabs.append({
            "id": f"S{z}",
            "level": z * sh,
            "width": w,
            "length": l,
            "thickness": 0.2
        })
        
        # X-direction
        for y in range(num_y):
            for x in range(num_x - 1):
                start_n = node_map[(x, y, z)]
                end_n = node_map[(x+1, y, z)]
                beams.append({
                    "id": f"BX{beam_id}", "start": start_n, "end": end_n,
                    "width": beam_width, "depth": beam_depth
                })
                beam_id += 1
                
                # Exterior Walls along X
                if params["has_walls"] and (y == 0 or y == num_y - 1):
                    walls.append({
                        "id": f"WX{wall_id}",
                        "start": node_map[(x, y, z-1)],
                        "end": start_n,
                        "span_node": end_n,
                        "material": params["wall_material"]
                    })
                    wall_id += 1
                    if params["has_windows"]:
                        windows.append({
                            "id": f"WinX{win_id}",
                            "start": node_map[(x, y, z-1)],
                            "end": start_n,
                            "span_node": end_n
                        })
                        win_id += 1
                
        # Y-direction
        for x in range(num_x):
            for y in range(num_y - 1):
                start_n = node_map[(x, y, z)]
                end_n = node_map[(x, y+1, z)]
                beams.append({
                    "id": f"BY{beam_id}", "start": start_n, "end": end_n,
                    "width": beam_width, "depth": beam_depth
                })
                beam_id += 1
                
                # Exterior Walls along Y
                if params["has_walls"] and (x == 0 or x == num_x - 1):
                    walls.append({
                        "id": f"WY{wall_id}",
                        "start": node_map[(x, y, z-1)],
                        "end": start_n,
                        "span_node": end_n,
                        "material": params["wall_material"]
                    })
                    wall_id += 1
                    if params["has_windows"]:
                        windows.append({
                            "id": f"WinY{win_id}",
                            "start": node_map[(x, y, z-1)],
                            "end": start_n,
                            "span_node": end_n
                        })
                        win_id += 1

    # 4. Roof
    roofs.append({
        "id": "R1",
        "type": params["roof_type"],
        "level": stories * sh,
        "width": w,
        "length": l,
        "ridge_height": w * 0.25 # Pitch height
    })
                
    return {
        "status": "success",
        "parameters": params,
        "nodes": nodes,
        "columns": columns,
        "beams": beams,
        "slabs": slabs,
        "walls": walls,
        "windows": windows,
        "roofs": roofs,
        "stats": {
            "node_count": len(nodes),
            "column_count": len(columns),
            "beam_count": len(beams),
            "slab_count": len(slabs),
            "wall_count": len(walls),
            "window_count": len(windows)
        }
    }

def generate_bim_from_text(prompt: str) -> Dict[str, Any]:
    params = parse_bim_prompt(prompt)
    model = generate_structural_frame(params)
    return model
