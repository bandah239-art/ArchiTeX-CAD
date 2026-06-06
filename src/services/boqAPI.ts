import type { BoQElement, CompiledBoQ } from '../types/boq';

import { API_BASE } from './apiConfig';

async function post<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail));
  }
  return response.json();
}

async function postBlob(endpoint: string, body: unknown): Promise<Blob> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Export failed: HTTP ${response.status}`);
  }
  return response.blob();
}

export interface BoQCompilePayload {
  project_id: string;
  project_name: string;
  client: string;
  country_code: string;
  currency_display: string;
  contractor_overhead: number;
  contractor_profit: number;
  contingency: number;
  elements: BoQElement[];
}

export const boqAPI = {
  extractQuantities: (payload: Record<string, unknown>) =>
    post<BoQElement>('/boq/extract-quantities', payload),

  extractFromBim: (payload: { elements: Record<string, unknown>[]; project_id?: string }) =>
    post<{ elements: BoQElement[]; material_totals: Record<string, number> }>(
      '/boq/extract-from-bim',
      payload
    ),

  compile: (payload: BoQCompilePayload) =>
    post<CompiledBoQ>('/boq/compile', payload),

  exportExcel: (payload: BoQCompilePayload) =>
    postBlob('/boq/export-excel', payload),

  exportPdf: (payload: BoQCompilePayload) =>
    postBlob('/boq/export-pdf', payload),
};

export interface GeoSitePayload {
  latitude: number;
  longitude: number;
  country_code: string;
  project_name: string;
  platform_area_m2?: number;
  use_cache?: boolean;
  offline_only?: boolean;
}

export const geoAPI = {
  siteAnalysis: (payload: GeoSitePayload) =>
    post<import('../types/boq').SiteAnalysis>('/geo/site-analysis', payload),

  siteReport: (payload: GeoSitePayload) =>
    post<{ status: string; analysis: import('../types/boq').SiteAnalysis; report_type: string }>(
      '/geo/site-report',
      payload
    ),

  siteReportDownload: async (payload: GeoSitePayload): Promise<Blob> => {
    const res = await fetch(`${API_BASE}/geo/site-report/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.blob();
  },

  geocode: (query: string) =>
    post<{ results: import('../types/geo').GeocodeResult[] }>('/geo/geocode', { query }),

  reverseGeocode: (latitude: number, longitude: number) =>
    post<import('../types/geo').GeocodeResult>('/geo/reverse-geocode', { latitude, longitude }),

  siteBudget: (payload: {
    latitude: number;
    longitude: number;
    country_code: string;
    project_name: string;
    project_type: string;
    gfa_m2: number;
    platform_area_m2?: number;
    use_cache?: boolean;
    offline_only?: boolean;
  }) => post<import('../types/geo').SiteBudget>('/geo/site-budget', payload),

  cacheStatus: () => fetch(`${API_BASE}/geo/cache/status`).then((r) => r.json()),

  clearCache: () => post<{ cleared: number }>('/geo/cache/clear', {}),

  terrain: (payload: GeoSitePayload) => post<Record<string, unknown>>('/geo/terrain', payload),

  soil: (payload: GeoSitePayload) => post<Record<string, unknown>>('/geo/soil', payload),

  climate: (payload: GeoSitePayload) => post<Record<string, unknown>>('/geo/climate', payload),

  seismic: (payload: GeoSitePayload) => post<Record<string, unknown>>('/geo/seismic', payload),
};

export const aiAPI = {
  generateDesign: (payload: Record<string, unknown>) =>
    post<{ design_brief: Record<string, unknown>; source?: string }>('/ai/generate-design', payload),

  generateVariants: (payload: Record<string, unknown>) =>
    post<Record<string, unknown>>('/ai/generate-variants', payload),

  pushToCalculators: (payload: Record<string, unknown>) =>
    post<{ calculators: Record<string, Record<string, unknown>> }>('/ai/push-to-calculators', payload),

  generateProposal: (payload: Record<string, unknown>) =>
    post<{ content: string; format: string }>('/ai/generate-proposal', payload),
};

export const realEstateAPI = {
  valuePlot: (payload: Record<string, unknown>) =>
    post<Record<string, unknown>>('/real-estate/value-plot', payload),

  feasibility: (payload: Record<string, unknown>) =>
    post<Record<string, unknown>>('/real-estate/feasibility', payload),

  optimiseUse: (payload: Record<string, unknown>) =>
    post<Record<string, unknown>>('/real-estate/optimise-use', payload),

  mortgage: (payload: Record<string, unknown>) =>
    post<Record<string, unknown>>('/real-estate/mortgage', payload),
};

export const governmentAPI = {
  portfolioSummary: () => fetch(`${API_BASE}/government/portfolio-summary`).then((r) => r.json()),

  listProjects: () => fetch(`${API_BASE}/government/projects`).then((r) => r.json()),

  getProject: (id: string) => fetch(`${API_BASE}/government/projects/${id}`).then((r) => r.json()),

  seedProjects: () => post<{ projects: Record<string, unknown>[] }>('/government/projects/seed', {}),

  createProject: (payload: Record<string, unknown>) =>
    post<Record<string, unknown>>('/government/projects', payload),

  addSnapshot: (id: string, payload: Record<string, unknown>) =>
    post<Record<string, unknown>>(`/government/projects/${id}/snapshot`, payload),

  generateCertificate: (id: string, payload: Record<string, unknown>) =>
    post<Record<string, unknown>>(`/government/projects/${id}/certificate`, payload),

  generateReport: (type: string, payload: Record<string, unknown>) =>
    post<Record<string, unknown>>(`/government/reports/${type}`, payload),
};

export const documentsAPI = {
  generateTender: (payload: Record<string, unknown>) =>
    post<Record<string, unknown>>('/documents/generate-tender', payload),

  calculationReport: (payload: Record<string, unknown>) =>
    post<Record<string, unknown>>('/documents/calculation-report', payload),

  eiaScreening: (payload: Record<string, unknown>) =>
    post<Record<string, unknown>>('/documents/eia-screening', payload),

  esgReport: (payload: Record<string, unknown>) =>
    post<Record<string, unknown>>('/documents/esg-report', payload),
};

export const tier2API = {
  washDemand: (payload: Record<string, unknown>) =>
    post<Record<string, unknown>>('/calculate/wash/demand', payload),
  washBorehole: (payload: Record<string, unknown>) =>
    post<Record<string, unknown>>('/calculate/wash/borehole', payload),
  washSewerage: (payload: Record<string, unknown>) =>
    post<Record<string, unknown>>('/calculate/wash/sewerage', payload),
  solarPv: (payload: Record<string, unknown>) =>
    post<Record<string, unknown>>('/calculate/energy/solar', payload),
  battery: (payload: Record<string, unknown>) =>
    post<Record<string, unknown>>('/calculate/energy/battery', payload),
  collabJoin: (projectId: string, payload: Record<string, unknown>) =>
    post<Record<string, unknown>>(`/collaboration/rooms/${projectId}/join`, payload),
  collabStatus: (projectId: string) =>
    fetch(`${API_BASE}/collaboration/rooms/${projectId}`).then((r) => r.json()),
};

export const tier3API = {
  listAssets: (projectId?: string) =>
    fetch(`${API_BASE}/intelligence/twin/assets${projectId ? `?project_id=${projectId}` : ''}`).then((r) => r.json()),
  getAsset: (assetId: string) =>
    fetch(`${API_BASE}/intelligence/twin/assets/${assetId}`).then((r) => r.json()),
  ingestReading: (payload: Record<string, unknown>) =>
    post<Record<string, unknown>>('/intelligence/twin/ingest', payload),
  analyseAsset: (assetId: string) =>
    fetch(`${API_BASE}/intelligence/predictive/${assetId}`).then((r) => r.json()),
  analysePortfolio: (projectId?: string) =>
    fetch(`${API_BASE}/intelligence/predictive${projectId ? `?project_id=${projectId}` : ''}`).then((r) => r.json()),
  seedTwin: () => post<{ assets: Record<string, unknown>[] }>('/intelligence/twin/seed', {}),
};
