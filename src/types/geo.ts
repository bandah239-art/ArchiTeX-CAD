export interface GeocodeResult {
  latitude: number;
  longitude: number;
  display_name: string;
  country_code: string | null;
  city: string | null;
}

export interface SiteBudgetLineItem {
  id: string;
  label: string;
  amount_usd: number;
}

export interface SiteBudget {
  status: string;
  latitude: number;
  longitude: number;
  country_code: string;
  project_type: string;
  gfa_m2: number;
  budget_usd: { min: number; likely: number; max: number };
  suggested_budget_usd: number;
  line_items: SiteBudgetLineItem[];
  subtotal_usd: number;
  contingency_pct: number;
  buildability_score: number;
  accuracy_note: string;
  assumptions: string[];
  site_analysis?: import('./boq').SiteAnalysis;
}
