from pydantic import BaseModel

class TunnelingRequest(BaseModel):
    rqd_percent: float = 60.0 # Rock Quality Designation
    joint_spacing_rating: float = 10.0 # From RMR tables
    joint_condition_rating: float = 12.0 # From RMR tables
    groundwater_rating: float = 10.0 # From RMR tables
    intact_rock_strength_mpa: float = 50.0

def calculate_tunneling(req: TunnelingRequest) -> dict:
    """
    Calculates Rock Mass Rating (RMR) and provides tunnel support recommendations.
    """
    # 1. Strength Rating (simplified)
    strength_rating = 0
    if req.intact_rock_strength_mpa >= 250:
        strength_rating = 15
    elif req.intact_rock_strength_mpa >= 100:
        strength_rating = 12
    elif req.intact_rock_strength_mpa >= 50:
        strength_rating = 7
    elif req.intact_rock_strength_mpa >= 25:
        strength_rating = 4
    else:
        strength_rating = 2
        
    # 2. RQD Rating
    rqd_rating = 0
    if req.rqd_percent >= 90:
        rqd_rating = 20
    elif req.rqd_percent >= 75:
        rqd_rating = 17
    elif req.rqd_percent >= 50:
        rqd_rating = 13
    elif req.rqd_percent >= 25:
        rqd_rating = 8
    else:
        rqd_rating = 3
        
    # 3. Total RMR (Unadjusted for joint orientation for simplicity)
    rmr = strength_rating + rqd_rating + req.joint_spacing_rating + req.joint_condition_rating + req.groundwater_rating
    
    # 4. Support Recommendation based on RMR
    if rmr >= 81:
        class_desc = "Very Good Rock (Class I)"
        support = "None required. Spot bolting only."
    elif rmr >= 61:
        class_desc = "Good Rock (Class II)"
        support = "Locally applied rock bolts, 50mm shotcrete in crown."
    elif rmr >= 41:
        class_desc = "Fair Rock (Class III)"
        support = "Systematic rock bolts (1.5-2m spacing), 50-100mm shotcrete in crown and walls."
    elif rmr >= 21:
        class_desc = "Poor Rock (Class IV)"
        support = "Systematic rock bolts (1-1.5m spacing), 100-150mm shotcrete with wire mesh, light steel sets."
    else:
        class_desc = "Very Poor Rock (Class V)"
        support = "Systematic rock bolts, 150-200mm shotcrete, heavy steel sets."
        
    return {
        "status": "success",
        "rmr_score": rmr,
        "rock_class": class_desc,
        "recommended_support": support,
        "recommendation": f"The Rock Mass Rating (RMR) is {rmr} ({class_desc}). Support requirement: {support}"
    }
