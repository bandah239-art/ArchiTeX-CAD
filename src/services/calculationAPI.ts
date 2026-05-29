import type {
  BeamInputs,
  SlabInputs,
  ColumnInputs,
  FoundationInputs,
  LoadInputs,
  PavementInputs,
  DrainageInputs,
  WindInputs,
  CalculationResult,
  SteelInputs,
  TimberInputs,
} from '../types/calculations';
import type { LoadCombinationsResult } from '../types/loadCombinations';

import { API_BASE } from './apiConfig';

type FastAPIValidationError = {
  loc?: (string | number)[];
  msg?: string;
  type?: string;
};

function formatApiError(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item: FastAPIValidationError | string) => {
        if (typeof item === 'string') return item;
        const field = item.loc?.filter((part) => part !== 'body').join('.') ?? 'input';
        return item.msg ? `${field}: ${item.msg}` : JSON.stringify(item);
      })
      .join('; ');
  }
  if (detail && typeof detail === 'object') {
    return JSON.stringify(detail);
  }
  return 'Request failed';
}

async function post<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(formatApiError(error.detail) || `HTTP ${response.status}`);
  }

  return response.json();
}

function toBeamPayload(inputs: BeamInputs & { imposed_load?: number; live_load?: number }) {
  return {
    span: inputs.span,
    dead_load: inputs.dead_load,
    live_load: inputs.live_load ?? inputs.imposed_load ?? 0,
    width: inputs.width,
    depth: inputs.depth,
    fck: inputs.fck,
    fyk: inputs.fyk,
    support_condition: inputs.support_condition ?? 'simply_supported',
    exposure_class: inputs.exposure_class ?? 'XC1',
    design_code: inputs.design_code ?? 'Eurocode2',
  };
}

export const calculationAPI = {
  calculateBeam: (inputs: BeamInputs): Promise<CalculationResult> =>
    post('/calculate/beam', toBeamPayload(inputs)),

  calculateSlab: (inputs: SlabInputs): Promise<CalculationResult> =>
    post('/calculate/slab', inputs),

  calculateColumn: (inputs: ColumnInputs): Promise<CalculationResult> =>
    post('/calculate/column', inputs),

  calculateFoundation: (inputs: FoundationInputs): Promise<CalculationResult> =>
    post('/calculate/foundation', inputs),

  calculateSteel: (inputs: SteelInputs): Promise<CalculationResult> =>
    post('/calculate/steel', inputs),

  calculateTimber: (inputs: TimberInputs): Promise<CalculationResult> =>
    post('/calculate/timber', inputs),

  calculateFea: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/calculate/fea', inputs),

  calculateLoads: (inputs: LoadInputs): Promise<CalculationResult> =>
    post('/calculate/loads', inputs),

  calculateLoadCombinations: (inputs: {
    gk: number;
    qk: number;
    wk: number;
    ek: number;
    code: string;
    unit?: string;
  }): Promise<LoadCombinationsResult> =>
    post('/calculate/load-combinations', inputs),

  calculatePavement: (inputs: PavementInputs): Promise<CalculationResult> =>
    post('/calculate/road/pavement', inputs),

  calculateDrainage: (inputs: DrainageInputs): Promise<CalculationResult> =>
    post('/calculate/road/drainage', inputs),

  calculateGeometricDesign: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/roads/geometric-design', inputs),

  calculateTrafficLoad: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/roads/traffic-load', inputs),

  calculateWind: (inputs: WindInputs): Promise<CalculationResult> =>
    post('/calculate/wind', inputs),

  calculateBearing: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/calculate/bearing', inputs),

  recommendMaterial: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/materials/recommend', inputs),

  calculateCarbon: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/calculate/carbon', inputs),

  calculateCarbonCredits: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/calculate/carbon/credits', inputs),

  simulateFlood: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/simulate/flood', inputs),

  calculateWashWaterDemand: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/wash/water-demand', inputs),

  calculateWashPipeNetwork: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/wash/pipe-network', inputs),

  calculateWashSewerDesign: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/wash/sewer-design', inputs),

  calculateWashBorehole: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/wash/borehole', inputs),

  calculateWashTreatmentPlant: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/wash/treatment-plant', inputs),

  calculateGeoBearingCapacity: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/geo/bearing-capacity', inputs),

  calculateGeoSettlement: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/geo/settlement', inputs),

  calculateGeoSlopeStability: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/geo/slope-stability', inputs),

  calculateGeoSiteClassification: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/geo/site-classification', inputs),

  calculateEnergyBess: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/energy/bess', inputs),

  calculateEnergyMicrogrid: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/energy/microgrid', inputs),

  calculateEnergyTransmission: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/energy/transmission', inputs),

  calculateWashWaterTower: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/wash/water-tower', inputs),

  calculateWashDewats: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/wash/dewats', inputs),

  calculateEnergyGridFault: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/energy/grid-fault', inputs),

  calculateEnergyHydro: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/energy/hydro', inputs),

  calculateEnergyBiogas: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/energy/biogas', inputs),

  calculateEnergyWindWake: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/energy/wind-wake', inputs),

  calculateWashEpanet: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/wash/epanet', inputs),

  calculateWashWtp: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/wash/wtp', inputs),

  calculateWashStormwater: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/wash/stormwater', inputs),

  calculateWashLandfill: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/wash/landfill', inputs),

  calculateWashIrrigation: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/wash/irrigation', inputs),

  calculateGeoPiles: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/geo/piles', inputs),

  calculateGeoSlope: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/geo/slope', inputs),

  calculateGeoConsolidation: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/geo/consolidation', inputs),

  calculateGeoGroundImprovement: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/geo/ground-improvement', inputs),

  calculateGeoTunneling: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/geo/tunneling', inputs),

  calculateMasonry: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/calculate/masonry', inputs),

  calculateBlackCotton: (inputs: Record<string, unknown>): Promise<CalculationResult> =>
    post('/geotechnical/black-cotton', inputs),

  checkHealth: async (): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      return res.ok;
    } catch {
      return false;
    }
  },
};

export type CalculationAPI = typeof calculationAPI;
