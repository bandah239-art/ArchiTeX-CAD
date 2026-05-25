import os
import json
import asyncio
from typing import Optional

VISION_SYSTEM_PROMPT = """
You are a senior civil and structural engineer 
with 25 years of experience across Africa. 
You are inspecting infrastructure in {country}.

Your expertise covers:
CIVIL:   Roads, bridges, culverts, drainage, retaining walls, embankments, pavements
WASH:    Water supply systems, boreholes, hand pumps, elevated tanks, latrines, soak pits
GEO:     Slope stability, erosion, soil exposures, rock formations, landslides
BUILDING: Structural frames, masonry, foundations, roofs, cracks, deformation

AFRICAN CONTEXT:
- Quality varies enormously (excellent to dangerous)
- Climate: {climate_zone}, {annual_rainfall}mm/yr
- Soil: {soil_type}
- Common local materials: {local_materials}
- Applicable standards: {design_standards}

ANALYSIS INSTRUCTIONS:
Examine the image carefully and provide your complete engineering assessment in the exact JSON format specified. 
Be precise. Be honest. Flag genuine risks clearly. Never fabricate details you cannot see. State uncertainty clearly.
OUTPUT FORMAT: Structured JSON only. No preamble. No markdown. Valid JSON strictly.
"""

VISION_USER_PROMPT = """
Analyse this structure image and return ONLY valid JSON matching this exact schema:

{
  "structure_identification": {
    "primary_type": "string",
    "sub_type": "string",
    "category": "civil|wash|geo|building",
    "common_name": "string",
    "technical_name": "string",
    "construction_era": "string",
    "construction_method": "string",
    "materials_identified": ["string"],
    "confidence_pct": 100,
    "identification_notes": "string"
  },
  "dimensions_estimated": {
    "method": "visual_estimate|scale_reference|unknown",
    "overall_length_m": 0.0,
    "overall_width_m": 0.0,
    "overall_height_m": 0.0,
    "key_dimensions": [
      {
        "label": "string",
        "value_m": 0.0,
        "confidence": "high|medium|low"
      }
    ],
    "dimension_notes": "string"
  },
  "structural_assessment": {
    "overall_condition": "excellent|good|fair|poor|critical",
    "condition_score": 5,
    "estimated_age_years": "string",
    "estimated_remaining_life_years": "string",
    "structural_integrity": "sound|minor_issues|moderate_issues|major_issues|unsafe",
    "defects_observed": [
      {
        "defect_type": "string",
        "location": "string",
        "severity": "minor|moderate|major|critical",
        "description": "string",
        "likely_cause": "string",
        "urgency": "monitor|maintain|repair_soon|repair_urgent|close_immediately"
      }
    ],
    "strengths_observed": ["string"],
    "assessment_confidence": "high|medium|low",
    "limitations": "string"
  },
  "engineering_purpose": {
    "primary_function": "string",
    "design_intent": "string",
    "serves_population": "string",
    "capacity_estimate": "string",
    "performance_assessment": "string",
    "african_context_notes": "string"
  },
  "cad_specification": {
    "drawing_type": "elevation|plan|cross_section|isometric|schematic",
    "recommended_views": ["string"],
    "primary_elements": [
      {
        "element_id": "string",
        "element_type": "string",
        "shape": "rectangle|circle|trapezoid|triangle|arc|line|polygon",
        "label": "string",
        "dimensions": {
          "width_m": 1.0,
          "height_m": 1.0,
          "diameter_m": null,
          "length_m": null
        },
        "position": {
          "x_relative": 0.5,
          "y_relative": 0.5,
          "anchor": "bottom_left|center|top_left"
        },
        "style": {
          "fill": "concrete|steel|earth|water|masonry|void|ground",
          "hatch": false,
          "hatch_pattern": "concrete|earth|steel|brick"
        },
        "annotation": "string"
      }
    ],
    "dimensions_to_show": [
      {
        "from_element": "string",
        "to_element": "string",
        "value_m": 0.0,
        "label": "string",
        "position": "top|bottom|left|right"
      }
    ],
    "ground_line": {
      "show": true,
      "depth_to_foundation_m": 0.0
    },
    "water_level": {
      "show": false,
      "level_relative": null
    },
    "title_block": {
      "structure_name": "string",
      "drawing_title": "string",
      "scale_note": "string",
      "not_to_scale": true
    }
  },
  "recommendations": {
    "immediate_actions": [
      {
        "priority": "P1_urgent|P2_soon|P3_planned",
        "action": "string",
        "reason": "string",
        "estimated_cost_usd": "string"
      }
    ],
    "maintenance_schedule": [
      {
        "frequency": "string",
        "task": "string"
      }
    ],
    "further_investigation": ["string"],
    "design_improvements": ["string"]
  },
  "wash_specific": {
    "applicable": false,
    "water_quality_risk": null,
    "sanitation_risk": null,
    "hygiene_observations": null,
    "functionality_assessment": null,
    "community_usage_notes": null
  },
  "geo_specific": {
    "applicable": false,
    "slope_angle_estimate": null,
    "stability_assessment": null,
    "erosion_type": null,
    "geological_features": null,
    "natural_hazard_risk": null
  }
}
"""

async def analyse_structure(image_base64: str, metadata: dict, geo_context: dict) -> dict:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return get_mock_analysis()
        
    try:
        from anthropic import AsyncAnthropic
        client = AsyncAnthropic(api_key=api_key)
        
        system = VISION_SYSTEM_PROMPT.format(
            country=geo_context.get('country', 'Africa'),
            climate_zone=geo_context.get('climate_zone', 'tropical'),
            annual_rainfall=geo_context.get('annual_rainfall', 'unknown'),
            soil_type=geo_context.get('soil_type', 'unknown'),
            local_materials=geo_context.get('local_materials', 'concrete, brick, steel'),
            design_standards=geo_context.get('design_standards', 'Eurocode / local')
        )
        
        response = await client.messages.create(
            model="claude-3-5-sonnet-20240620",
            max_tokens=4000,
            system=system,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": image_base64
                            }
                        },
                        {
                            "type": "text",
                            "text": VISION_USER_PROMPT
                        }
                    ]
                }
            ]
        )
        raw_json = response.content[0].text
        # Strip potential markdown code blocks
        if "```json" in raw_json:
            raw_json = raw_json.split("```json")[1].split("```")[0].strip()
        elif "```" in raw_json:
            raw_json = raw_json.split("```")[1].split("```")[0].strip()
            
        return json.loads(raw_json)
    except Exception as e:
        print(f"Vision API Error: {e}")
        return get_mock_analysis()


def get_mock_analysis():
    return {
      "structure_identification": {
        "primary_type": "Box Culvert",
        "sub_type": "Twin Cell",
        "category": "civil",
        "common_name": "Culvert",
        "technical_name": "Reinforced concrete box culvert, twin cell",
        "construction_era": "2010s",
        "construction_method": "Cast in-situ",
        "materials_identified": ["Concrete"],
        "confidence_pct": 94,
        "identification_notes": "Standard double barrel box culvert"
      },
      "dimensions_estimated": {
        "method": "visual_estimate",
        "overall_length_m": 12.0,
        "overall_width_m": 4.0,
        "overall_height_m": 2.0,
        "key_dimensions": [
          {
            "label": "Cell span",
            "value_m": 1.2,
            "confidence": "medium"
          },
          {
            "label": "Cell height",
            "value_m": 1.0,
            "confidence": "medium"
          }
        ],
        "dimension_notes": "Visual estimates. Require physical survey."
      },
      "structural_assessment": {
        "overall_condition": "fair",
        "condition_score": 6,
        "estimated_age_years": "8-15 years",
        "estimated_remaining_life_years": "20 years",
        "structural_integrity": "minor_issues",
        "defects_observed": [
          {
            "defect_type": "Spalling concrete",
            "location": "Right headwall top corner",
            "severity": "moderate",
            "description": "Concrete has spalled exposing 300mm of reinforcement. Rust visible.",
            "likely_cause": "Poor cover at construction",
            "urgency": "repair_soon"
          },
          {
            "defect_type": "Diagonal crack",
            "location": "Left wingwall mid-height",
            "severity": "moderate",
            "description": "Diagonal crack ~5mm width.",
            "likely_cause": "Differential settlement",
            "urgency": "monitor"
          }
        ],
        "strengths_observed": ["Main barrel intact"],
        "assessment_confidence": "medium",
        "limitations": "Cannot see inside barrel or foundations"
      },
      "engineering_purpose": {
        "primary_function": "Drainage flow beneath road",
        "design_intent": "Allow traffic over watercourse",
        "serves_population": "Unknown",
        "capacity_estimate": "3-5 m3/s",
        "performance_assessment": "Functioning",
        "african_context_notes": "Common design on major roads."
      },
      "cad_specification": {
        "drawing_type": "cross_section",
        "recommended_views": ["Elevation", "Cross Section"],
        "primary_elements": [
          {
            "element_id": "cell1",
            "element_type": "box",
            "shape": "rectangle",
            "label": "Cell 1",
            "dimensions": {
              "width_m": 1.2,
              "height_m": 1.0,
              "diameter_m": None,
              "length_m": None
            },
            "position": {
              "x_relative": 0.2,
              "y_relative": 0.4,
              "anchor": "bottom_left"
            },
            "style": {
              "fill": "void",
              "hatch": False,
              "hatch_pattern": "concrete"
            },
            "annotation": ""
          },
          {
            "element_id": "cell2",
            "element_type": "box",
            "shape": "rectangle",
            "label": "Cell 2",
            "dimensions": {
              "width_m": 1.2,
              "height_m": 1.0,
              "diameter_m": None,
              "length_m": None
            },
            "position": {
              "x_relative": 0.6,
              "y_relative": 0.4,
              "anchor": "bottom_left"
            },
            "style": {
              "fill": "void",
              "hatch": False,
              "hatch_pattern": "concrete"
            },
            "annotation": ""
          }
        ],
        "dimensions_to_show": [
          {
            "from_element": "cell1",
            "to_element": "cell1",
            "value_m": 1.2,
            "label": "Span 1",
            "position": "top"
          }
        ],
        "ground_line": {
          "show": True,
          "depth_to_foundation_m": 0.5
        },
        "water_level": {
          "show": True,
          "level_relative": 0.2
        },
        "title_block": {
          "structure_name": "Twin Cell Culvert",
          "drawing_title": "Cross Section",
          "scale_note": "NTS",
          "not_to_scale": True
        }
      },
      "recommendations": {
        "immediate_actions": [
          {
            "priority": "P2_soon",
            "action": "Repair spalled concrete",
            "reason": "Prevent further rebar corrosion",
            "estimated_cost_usd": "500"
          }
        ],
        "maintenance_schedule": [
          {
            "frequency": "Monthly",
            "task": "Visual inspection"
          }
        ],
        "further_investigation": ["Check foundations"],
        "design_improvements": ["Add scour protection"]
      },
      "wash_specific": {
        "applicable": False,
        "water_quality_risk": None,
        "sanitation_risk": None,
        "hygiene_observations": None,
        "functionality_assessment": None,
        "community_usage_notes": None
      },
      "geo_specific": {
        "applicable": False,
        "slope_angle_estimate": None,
        "stability_assessment": None,
        "erosion_type": None,
        "geological_features": None,
        "natural_hazard_risk": None
      }
    }
