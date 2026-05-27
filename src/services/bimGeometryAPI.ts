import { API_BASE } from './apiConfig';

export interface CadParseResponse {
  status: string;
  engine?: string;
  element_count?: number;
  triangle_count?: number;
  elements: CadMeshElement[];
  bounds?: { min: [number, number, number]; max: [number, number, number] };
  warnings?: string[];
  error?: string;
  cad?: Record<string, unknown>;
}

export interface CadEngineStatus {
  ezdxf: boolean;
  oda_file_converter: boolean;
  oda_executable?: string | null;
  dwg_hint?: string;
}

export interface CadMeshElement {
  id: string;
  expressId: number;
  globalId?: string;
  type: string;
  name: string;
  layer?: string;
  entity_type?: string;
  vertices: number[];
  faces: number[];
  length?: number;
  width?: number;
  height?: number;
  volume?: number;
  area?: number;
  properties?: Record<string, unknown>;
}

export const bimGeometryAPI = {
  async status(): Promise<{ ifcopenshell: boolean; engines: { client: string; server: string } }> {
    const res = await fetch(`${API_BASE}/bim/status`);
    if (!res.ok) throw new Error('BIM geometry status unavailable');
    return res.json();
  },

  async parsePath(path: string): Promise<{ elements: Record<string, unknown>[]; element_count: number }> {
    const res = await fetch(`${API_BASE}/bim/parse-ifc-path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async parseUpload(file: File): Promise<{ elements: Record<string, unknown>[]; element_count: number }> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/bim/parse-ifc-upload`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async cadStatus(): Promise<CadEngineStatus> {
    const res = await fetch(`${API_BASE}/bim/cad/status`);
    if (!res.ok) throw new Error('CAD parser status unavailable');
    return res.json();
  },

  async parseCadPath(path: string): Promise<CadParseResponse> {
    const res = await fetch(`${API_BASE}/bim/parse-cad-path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(typeof err.detail === 'string' ? err.detail : res.statusText);
    }
    return res.json();
  },

  async parseCadUpload(file: File): Promise<CadParseResponse> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/bim/parse-cad-upload`, { method: 'POST', body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(typeof err.detail === 'string' ? err.detail : res.statusText);
    }
    return res.json();
  },

  async exportIfc(payload: {
    name: string;
    site_name?: string;
    elements: Record<string, unknown>[];
  }): Promise<{ status: string; ifc_bytes_b64?: string; element_count?: number; error?: string }> {
    const res = await fetch(`${API_BASE}/bim/export-ifc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async booleanOperation(payload: {
    operation: 'union' | 'difference' | 'intersection';
    mesh_a: { vertices: number[]; faces: number[] };
    mesh_b: { vertices: number[]; faces: number[] };
  }): Promise<Record<string, unknown>> {
    const res = await fetch(`${API_BASE}/bim/geometry/boolean`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async planTakeoff(path: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${API_BASE}/bim/plan-takeoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async intersectionVolume(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await fetch(`${API_BASE}/bim/geometry/intersection-volume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
