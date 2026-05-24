import type {
  BeamInputs,
  SlabInputs,
  ColumnInputs,
  FoundationInputs,
  LoadInputs,
  PavementInputs,
  DrainageInputs,
  CalculationResult,
} from '../types/calculations';

const API_BASE = 'http://localhost:8000';

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

  calculateLoads: (inputs: LoadInputs): Promise<CalculationResult> =>
    post('/calculate/loads', inputs),

  calculatePavement: (inputs: PavementInputs): Promise<CalculationResult> =>
    post('/calculate/road/pavement', inputs),

  calculateDrainage: (inputs: DrainageInputs): Promise<CalculationResult> =>
    post('/calculate/road/drainage', inputs),

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
