# Test imports
try:
    from calculators.energy_bess import calculate_bess, BessRequest
    print("energy_bess: OK")
except Exception as e:
    print("energy_bess: FAILED -", e)

try:
    from calculators.energy_microgrid import calculate_voltage_drop, MicrogridRequest
    print("energy_microgrid: OK")
except Exception as e:
    print("energy_microgrid: FAILED -", e)

try:
    from calculators.energy_transmission import calculate_sag_tension, TransmissionRequest
    print("energy_transmission: OK")
except Exception as e:
    print("energy_transmission: FAILED -", e)

try:
    from calculators.energy_hydro import calculate_hydro, HydroRequest
    print("energy_hydro: OK")
except Exception as e:
    print("energy_hydro: FAILED -", e)

try:
    from calculators.energy_biogas import calculate_biogas, BiogasRequest
    print("energy_biogas: OK")
except Exception as e:
    print("energy_biogas: FAILED -", e)

try:
    from calculators.energy_wind_wake import calculate_wind_wake, WindWakeRequest
    print("energy_wind_wake: OK")
except Exception as e:
    print("energy_wind_wake: FAILED -", e)

try:
    from calculators.energy_grid_fault import calculate_grid_fault, GridFaultRequest
    print("energy_grid_fault: OK")
except Exception as e:
    print("energy_grid_fault: FAILED -", e)

try:
    from calculators.wash_water_tower import calculate_water_tower, WaterTowerRequest
    print("wash_water_tower: OK")
except Exception as e:
    print("wash_water_tower: FAILED -", e)

try:
    from calculators.wash_epanet import calculate_pipe_network, PipeNetworkRequest
    print("wash_epanet: OK")
except Exception as e:
    print("wash_epanet: FAILED -", e)

try:
    from calculators.wash_dewats import calculate_dewats, DewatsRequest
    print("wash_dewats: OK")
except Exception as e:
    print("wash_dewats: FAILED -", e)

try:
    from calculators.wash_wtp import calculate_wtp, WTPRequest
    print("wash_wtp: OK")
except Exception as e:
    print("wash_wtp: FAILED -", e)

try:
    from calculators.wash_stormwater import calculate_stormwater, StormwaterRequest
    print("wash_stormwater: OK")
except Exception as e:
    print("wash_stormwater: FAILED -", e)

try:
    from calculators.wash_landfill import calculate_landfill, LandfillRequest
    print("wash_landfill: OK")
except Exception as e:
    print("wash_landfill: FAILED -", e)

try:
    from calculators.wash_irrigation import calculate_irrigation, IrrigationRequest
    print("wash_irrigation: OK")
except Exception as e:
    print("wash_irrigation: FAILED -", e)

try:
    from calculators.energy_power_flow import run_power_flow, PowerFlowRequest
    print("energy_power_flow: OK")
except Exception as e:
    print("energy_power_flow: FAILED -", e)

try:
    from calculators.market_pricing import get_live_pricing, PricingRequest
    print("market_pricing: OK")
except Exception as e:
    print("market_pricing: FAILED -", e)

try:
    from calculators.geo_piles import calculate_piles, PilesRequest
    print("geo_piles: OK")
except Exception as e:
    print("geo_piles: FAILED -", e)

try:
    from calculators.geo_slope import calculate_slope, SlopeRequest
    print("geo_slope: OK")
except Exception as e:
    print("geo_slope: FAILED -", e)

try:
    from calculators.geo_consolidation import calculate_consolidation, ConsolidationRequest
    print("geo_consolidation: OK")
except Exception as e:
    print("geo_consolidation: FAILED -", e)

try:
    from calculators.geo_ground_improvement import calculate_ground_improvement, GroundImprovementRequest
    print("geo_ground_improvement: OK")
except Exception as e:
    print("geo_ground_improvement: FAILED -", e)

try:
    from calculators.geo_tunneling import calculate_tunneling, TunnelingRequest
    print("geo_tunneling: OK")
except Exception as e:
    print("geo_tunneling: FAILED -", e)
