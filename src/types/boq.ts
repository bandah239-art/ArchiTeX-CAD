export interface BoQItem {
  material_id: string;
  quantity: number;
  notes?: string;
}

export interface BoQElement {
  ref: string;
  description: string;
  calculation_type: 'beam' | 'slab' | 'column' | 'foundation' | 'road';
  element_count: number;
  element_dimensions: Record<string, number>;
  calculation_inputs?: Record<string, unknown>;
  calculation_result?: Record<string, unknown>;
  items?: BoQItem[];
  summary_text?: string;
  section?: string;
  source?: 'bim_extraction' | 'calculator';
  ifc_type?: string;
}

export interface BoQSummary {
  construction_cost_usd: number;
  construction_cost_range_usd: [number, number];
  overhead_usd: number;
  profit_usd: number;
  subtotal_usd: number;
  contingency_usd: number;
  total_project_estimate_usd: number;
  total_project_range_usd: [number, number];
  local_currency: string;
  exchange_rate: number;
  total_local_currency: number;
  total_local_range: [number, number];
}

export interface CompiledBoQ {
  status: string;
  project_name: string;
  client: string;
  country_code: string;
  summary: BoQSummary;
  section_totals: Record<string, { min: number; max: number; mid: number }>;
  disclaimer: string;
}

export interface GeoDesignParameters {
  soil_bearing_capacity_knm2: number;
  soil_bearing_range_knm2: [number, number];
  min_foundation_depth_m: number;
  cbr_subgrade_pct: number;
  cbr_range_pct: [number, number];
  design_wind_speed_ms: number;
  design_wind_pressure_knm2: number;
  design_rainfall_10yr_mmhr: number;
  seismic_design_category: string;
  terrain_category: string;
  elevation_m: number;
}

export interface SiteAnalysis {
  status: string;
  project_name: string;
  latitude: number;
  longitude: number;
  country_code: string;
  country_flag: string;
  executive_summary: {
    buildability_score: number;
    buildability_label: string;
    soil_conditions: string;
    seismic_risk: string;
    flood_risk: string;
    annual_rainfall_mm: number;
    climate_zone: string;
    design_wind_speed_ms: number;
  };
  terrain: Record<string, unknown>;
  soil: Record<string, unknown>;
  climate: Record<string, unknown>;
  seismic: Record<string, unknown>;
  design_parameters: GeoDesignParameters;
  recommendations: string[];
}

export type WorkspacePanel = 'viewer' | 'calculator' | 'boq' | 'geo' | 'ai' | 'vision' | 'realestate' | 'government' | 'documents' | 'wash' | 'energy' | 'intelligence' | 'carbon' | 'schedule' | 'emerging' | 'optimizer' | 'seismic' | 'project' | 'site' | 'verification' | 'materials';
