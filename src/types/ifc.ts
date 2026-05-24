export interface IFCElement {
  id: string;
  globalId: string;
  type: string;
  name: string;
  material?: string;
  length?: number;
  width?: number;
  height?: number;
  volume?: number;
  area?: number;
  weight?: number;
  storey?: string;
  properties?: Record<string, string | number>;
  notes?: string;
  specification?: string;
  costRate?: number;
  status?: 'designed' | 'pending' | 'approved';
}

export interface IFCModel {
  id: string;
  name: string;
  path: string;
  elementCount: number;
  loadedAt: string;
}

export interface ModelStats {
  elementCount: number;
  triangleCount: number;
  bounds: { min: number[]; max: number[] };
  loadTime: number;
}

export type ViewMode = 'perspective' | 'ortho' | 'plan';
