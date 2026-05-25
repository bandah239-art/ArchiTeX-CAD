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

async function get<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export const platformAPI = {
  geoTerrain: (payload: Record<string, unknown>) => post<Record<string, unknown>>('/geo/terrain', payload),
  geoSoil: (payload: Record<string, unknown>) => post<Record<string, unknown>>('/geo/soil', payload),
  geoClimate: (payload: Record<string, unknown>) => post<Record<string, unknown>>('/geo/climate', payload),
  geoSeismic: (payload: Record<string, unknown>) => post<Record<string, unknown>>('/geo/seismic', payload),
  planTakeoff: (path: string) => post<Record<string, unknown>>('/bim/plan-takeoff', { path }),
  meshBoolean: (payload: Record<string, unknown>) => post<Record<string, unknown>>('/bim/geometry/boolean', payload),
  intersectionVolume: (payload: Record<string, unknown>) =>
    post<Record<string, unknown>>('/bim/geometry/intersection-volume', payload),
  exportDwg: (payload: { path?: string; elements?: Record<string, unknown>[] }) =>
    post<Record<string, unknown>>('/geometry/autocad/export-dwg', {
      path: payload.path ?? '',
      elements: payload.elements ?? [],
    }),
  autocadStatus: () => get<Record<string, unknown>>('/geometry/autocad/status'),
  mobileQuickCalc: (payload: Record<string, unknown>) => post<Record<string, unknown>>('/mobile/quick-calc', payload),
  syncBatch: (payload: Record<string, unknown>) => post<Record<string, unknown>>('/sync/batch', payload),
  syncReceive: (payload: Record<string, unknown>) => post<Record<string, unknown>>('/sync/receive', payload),
  disasterPlan: (payload: Record<string, unknown>) => post<Record<string, unknown>>('/emerging/disaster/plan', payload),
  droneProcess: (payload: Record<string, unknown>) => post<Record<string, unknown>>('/emerging/drone/process', payload),
  cvSafety: (payload: Record<string, unknown>) => post<Record<string, unknown>>('/emerging/cv/safety', payload),
  arScene: (payload: Record<string, unknown>) => post<Record<string, unknown>>('/emerging/ar/scene', payload),
  thermalSim: (payload: Record<string, unknown>) => post<Record<string, unknown>>('/simulate/thermal', payload),
  calcReport: (payload: Record<string, unknown>) => post<Record<string, unknown>>('/documents/calculation-report', payload),
  govCashflow: (projectId: string) => get<Record<string, unknown>>(`/government/projects/${projectId}/cashflow`),
  govTimeline: (projectId: string) => get<Record<string, unknown>>(`/government/projects/${projectId}/timeline`),
  govVariation: (projectId: string, payload: Record<string, unknown>) =>
    post<Record<string, unknown>>(`/government/projects/${projectId}/variation`, payload),
};
