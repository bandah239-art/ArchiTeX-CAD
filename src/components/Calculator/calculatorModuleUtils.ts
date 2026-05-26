import type { CalculationModule } from '../../types/calculations';

/** Modules that render their own Calculate button (hide panel-level CALCULATE). */
export const MODULES_WITH_INLINE_CALCULATE: CalculationModule[] = [
  'energy_bess',
  'energy_microgrid',
  'energy_transmission',
  'energy_hydro',
  'energy_biogas',
  'energy_wind_wake',
  'energy_grid_fault',
  'wash_water_tower',
  'wash_epanet',
  'wash_dewats',
  'wash_wtp',
  'wash_stormwater',
  'wash_landfill',
  'wash_irrigation',
  'geo_piles',
  'geo_slope',
  'geo_consolidation',
  'geo_ground_improvement',
  'geo_tunneling',
];
