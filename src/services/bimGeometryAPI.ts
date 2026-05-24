import { API_BASE } from './apiConfig';

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
};
