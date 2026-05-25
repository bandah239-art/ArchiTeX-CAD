import type { CalculationResult } from '../types/calculations';
import { API_BASE } from './apiConfig';

export type PressureModule =
  | 'foundation-bearing'
  | 'lateral-earth'
  | 'wind-distribution'
  | 'boussinesq'
  | 'consolidation'
  | 'bridge-hydrostatic'
  | 'bridge-hydrodynamic'
  | 'bridge-foundation'
  | 'pavement-pressure'
  | 'pipe-pressure'
  | 'tank-pressure';

export interface PressureDiagramData {
  type: 'triangular' | 'trapezoidal' | 'contour' | 'arrows' | 'uniform';
  points: Record<string, unknown>[];
  labels: string[];
  resultant?: { value: number; location: number | string; unit?: string };
}

export interface PressureResult extends CalculationResult {
  pressure_diagram_data?: PressureDiagramData;
  review_summary?: Record<string, number>;
}

async function postPressure(module: PressureModule, body: Record<string, unknown>): Promise<PressureResult> {
  const res = await fetch(`${API_BASE}/pressure/${module}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail));
  }
  return res.json();
}

export const pressureAPI = {
  foundationBearing: (p: Record<string, unknown>) => postPressure('foundation-bearing', p),
  lateralEarth: (p: Record<string, unknown>) => postPressure('lateral-earth', p),
  windDistribution: (p: Record<string, unknown>) => postPressure('wind-distribution', p),
  boussinesq: (p: Record<string, unknown>) => postPressure('boussinesq', p),
  consolidation: (p: Record<string, unknown>) => postPressure('consolidation', p),
  bridgeHydrostatic: (p: Record<string, unknown>) => postPressure('bridge-hydrostatic', p),
  bridgeHydrodynamic: (p: Record<string, unknown>) => postPressure('bridge-hydrodynamic', p),
  bridgeFoundation: (p: Record<string, unknown>) => postPressure('bridge-foundation', p),
  pavement: (p: Record<string, unknown>) => postPressure('pavement-pressure', p),
  pipe: (p: Record<string, unknown>) => postPressure('pipe-pressure', p),
  tank: (p: Record<string, unknown>) => postPressure('tank-pressure', p),
};
