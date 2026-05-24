export type CalculationStatus = 'pass' | 'fail' | 'warning' | 'info';

export interface CalculationStep {
  step_number: number;
  title: string;
  formula: string;
  substitution: string;
  result: string;
  unit: string;
  reference: string;
  status?: CalculationStatus;
}

export interface CalculationResult {
  status: 'pass' | 'fail' | 'warning' | 'received';
  summary: Record<string, string | number | boolean>;
  steps: CalculationStep[];
  warnings: string[];
  errors: string[];
  timestamp: string;
}

export type SupportCondition =
  | 'simply_supported'
  | 'continuous_end'
  | 'continuous_internal'
  | 'cantilever';

export interface BeamInputs {
  span: number;
  support_condition: SupportCondition;
  dead_load: number;
  imposed_load: number;
  width: number;
  depth: number;
  fck: number;
  fyk: number;
  exposure_class: string;
  design_code: string;
}

export interface SlabInputs {
  slab_type: 'one_way' | 'two_way';
  span_lx: number;
  span_ly: number;
  dead_load: number;
  live_load: number;
  depth: number;
  fck: number;
  fyk: number;
  support_condition: 'simply_supported' | 'continuous';
}

export interface ColumnInputs {
  height: number;
  width: number;
  depth: number;
  axial_load: number;
  moment_major: number;
  moment_minor: number;
  fck: number;
  fyk: number;
  le_factor: number;
}

export interface FoundationInputs {
  foundation_type: 'pad' | 'strip' | 'raft';
  column_load: number;
  moment_x: number;
  moment_y: number;
  soil_bearing: number;
  soil_unit_weight: number;
  foundation_depth: number;
  foundation_width: number;
  foundation_length: number;
  foundation_depth_concrete: number;
  fck: number;
  fyk: number;
  column_width: number;
  column_depth: number;
}

export interface LoadInputs {
  dead_load_g: number;
  imposed_load_q: number;
  wind_load_w: number;
  snow_load_s: number;
  load_type: 'udl' | 'area';
  design_code: 'eurocode' | 'aci318';
  structure_class: string;
}

export interface PavementInputs {
  road_class: 'trunk' | 'primary' | 'secondary' | 'feeder';
  traffic_count: number;
  heavy_vehicle_pct: number;
  design_life: number;
  cbr_subgrade: number;
  subbase_material: string;
  base_material: string;
  climate_zone: 'wet' | 'dry' | 'semi_arid';
  country: string;
}

export interface DrainageInputs {
  catchment_area: number;
  rainfall_intensity: number;
  runoff_coefficient: number;
  pipe_gradient: number;
  pipe_material: 'concrete' | 'hdpe' | 'corrugated_steel';
  pipe_length: number;
  country: string;
  region: string;
}

export type CalculationModule =
  | 'beam'
  | 'slab'
  | 'column'
  | 'foundation'
  | 'loads'
  | 'road';

export type RoadSubmodule = 'pavement' | 'drainage';
