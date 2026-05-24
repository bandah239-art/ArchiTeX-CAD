import { API_BASE as API } from './apiConfig';

export interface GeometryExtensionsStatus {
  source: string;
  shapely: boolean;
  engines: {
    '2d_regions': string;
    '3d_mesh': string;
    autocad_native: boolean;
  };
  capabilities: string[];
  autocad_bridge: Record<string, unknown>;
}

export const geometryExtensionsAPI = {
  async status(): Promise<GeometryExtensionsStatus> {
    const res = await fetch(`${API}/geometry/extensions/status`);
    if (!res.ok) throw new Error('Geometry extensions status unavailable');
    return res.json();
  },

  async polygonArea(vertices: [number, number][]): Promise<{ area: number; centroid: number[] }> {
    const res = await fetch(`${API}/geometry/polygon/area`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vertices }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async polygonContains(vertices: [number, number][], point: [number, number]): Promise<{ inside: boolean }> {
    const res = await fetch(`${API}/geometry/polygon/contains`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vertices, point }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async polylineLength(segments: { start: number[]; end: number[]; bulge?: number }[]): Promise<number> {
    const res = await fetch(`${API}/geometry/polyline/length`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segments }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.length;
  },

  async regionBoolean(payload: {
    operation: 'union' | 'difference' | 'intersection';
    polygons_a: [number, number][][];
    polygons_b: [number, number][][];
  }): Promise<{ area: number; polygons: number[][][] }> {
    const res = await fetch(`${API}/geometry/region/boolean`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
