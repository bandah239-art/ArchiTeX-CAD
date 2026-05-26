from pydantic import BaseModel

class DewatsRequest(BaseModel):
    population: int
    wastewater_generation_lps_capita: float = 40.0 # liters per capita per day
    influent_bod_mg_l: float = 300.0 # Biological Oxygen Demand
    temperature_c: float = 25.0

def calculate_dewats(req: DewatsRequest) -> dict:
    """
    Calculates the sizing for a Decentralized Wastewater Treatment System (DEWATS).
    Sizes a Settler, Anaerobic Baffled Reactor (ABR), and Planted Gravel Filter (PGF).
    """
    # 1. Total Daily Flow (Q)
    daily_flow_liters = req.population * req.wastewater_generation_lps_capita
    q_m3_day = daily_flow_liters / 1000.0
    
    # 2. Settler Sizing (Primary Treatment)
    # HRT (Hydraulic Retention Time) = 2 hours
    hrt_settler_h = 2.0
    volume_settler_m3 = q_m3_day * (hrt_settler_h / 24.0)
    
    # 3. Anaerobic Baffled Reactor (ABR) (Secondary Treatment)
    # HRT typically 48 hours for domestic wastewater at 25C
    hrt_abr_h = 48.0
    volume_abr_m3 = q_m3_day * (hrt_abr_h / 24.0)
    
    # Calculate expected BOD removal in ABR (assume 70% removal)
    effluent_bod_abr = req.influent_bod_mg_l * (1 - 0.70)
    
    # Calculate number of compartments (typically 1 settling + 3 to 6 upflow chambers)
    compartments = max(4, min(int(volume_abr_m3 / 10) + 2, 8))
    
    # 4. Planted Gravel Filter (PGF) (Tertiary Treatment)
    # Organic loading rate typically 10 gBOD/m2/day
    organic_load_g_day = q_m3_day * effluent_bod_abr # m3/d * g/m3
    area_pgf_m2 = organic_load_g_day / 10.0
    
    return {
        "status": "success",
        "daily_flow_m3": round(q_m3_day, 1),
        "settler_volume_m3": round(volume_settler_m3, 1),
        "abr_volume_m3": round(volume_abr_m3, 1),
        "abr_compartments": compartments,
        "effluent_bod_abr_mg_l": round(effluent_bod_abr, 1),
        "pgf_area_m2": round(area_pgf_m2, 1),
        "recommendation": f"Construct a {round(volume_settler_m3, 1)}m³ Settler, a {compartments}-chamber ABR ({round(volume_abr_m3, 1)}m³), followed by a {round(area_pgf_m2, 1)}m² Planted Gravel Filter."
    }
