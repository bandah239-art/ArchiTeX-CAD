import { create } from 'zustand';
import type {
  CalculationModule,
  CalculationResult,
  BeamInputs,
  SlabInputs,
  ColumnInputs,
  FoundationInputs,
  LoadInputs,
  PavementInputs,
  DrainageInputs,
  WindInputs,
  RoadSubmodule,
} from '../types/calculations';
import { calculationAPI } from '../services/calculationAPI';

const DEFAULT_INPUTS: Record<CalculationModule, Record<string, unknown>> = {
  beam: {
    span: 6,
    support_condition: 'simply_supported',
    dead_load: 15,
    imposed_load: 10,
    width: 300,
    depth: 500,
    fck: 30,
    fyk: 500,
    exposure_class: 'XC1',
    design_code: 'Eurocode2',
  },
  slab: {
    slab_type: 'two_way',
    span_lx: 4,
    span_ly: 5,
    dead_load: 5,
    live_load: 3,
    depth: 175,
    fck: 30,
    fyk: 500,
    support_condition: 'simply_supported',
  },
  column: {
    height: 4,
    width: 300,
    depth: 300,
    axial_load: 850,
    moment_major: 45,
    moment_minor: 20,
    fck: 30,
    fyk: 500,
    le_factor: 0.85,
  },
  foundation: {
    foundation_type: 'pad',
    column_load: 800,
    moment_x: 30,
    moment_y: 0,
    soil_bearing: 150,
    soil_unit_weight: 18,
    foundation_depth: 1.2,
    foundation_width: 1.2,
    foundation_length: 1.0,
    foundation_depth_concrete: 400,
    fck: 25,
    fyk: 500,
    column_width: 300,
    column_depth: 300,
  },
  loads: {
    dead_load_g: 20,
    imposed_load_q: 15,
    wind_load_w: 5,
    snow_load_s: 0,
    load_type: 'udl',
    design_code: 'eurocode',
    structure_class: 'ordinary',
  },
  wind: {
    basic_wind_speed: 45,
    building_height: 12,
    building_width: 20,
    building_length: 30,
    exposure_category: 'B',
  },
  road: {
    road_submodule: 'pavement' as RoadSubmodule,
    road_class: 'secondary',
    traffic_count: 500,
    heavy_vehicle_pct: 12,
    design_life: 20,
    cbr_subgrade: 6,
    subbase_material: 'natural_gravel',
    base_material: 'crushed_stone',
    climate_zone: 'semi_arid',
    country: 'Zambia',
    catchment_area: 2.5,
    rainfall_intensity: 65,
    runoff_coefficient: 0.6,
    pipe_gradient: 1.5,
    pipe_material: 'concrete',
    pipe_length: 100,
    region: '',
  },
};

function mergeWithDefaults(
  module: CalculationModule,
  inputs: Record<string, unknown>
): Record<string, unknown> {
  return { ...DEFAULT_INPUTS[module], ...inputs };
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as Error).message === 'string') {
    return (err as Error).message;
  }
  return 'Calculation failed';
}

interface CalculationState {
  activeModule: CalculationModule;
  currentInputs: Record<string, unknown>;
  currentResults: CalculationResult | null;
  savedCalculations: CalculationResult[];
  isCalculating: boolean;
  error: string | null;
  setModule: (module: CalculationModule) => void;
  setInput: (key: string, value: unknown) => void;
  setInputs: (inputs: Record<string, unknown>) => void;
  runCalculation: () => Promise<void>;
  saveResult: (result: CalculationResult) => void;
  clearResults: () => void;
}

export const useCalculationStore = create<CalculationState>((set, get) => ({
  activeModule: 'beam',
  currentInputs: DEFAULT_INPUTS.beam,
  currentResults: null,
  savedCalculations: [],
  isCalculating: false,
  error: null,

  setModule: (module) =>
    set({
      activeModule: module,
      currentInputs: DEFAULT_INPUTS[module],
      currentResults: null,
      error: null,
    }),

  setInput: (key, value) => {
    set({ currentInputs: { ...get().currentInputs, [key]: value } });
  },

  setInputs: (inputs) => set({ currentInputs: inputs }),

  runCalculation: async () => {
    const { activeModule, currentInputs } = get();
    const inputs = mergeWithDefaults(activeModule, currentInputs);
    set({ isCalculating: true, error: null, currentInputs: inputs });

    try {
      let result: CalculationResult;

      switch (activeModule) {
        case 'beam':
          result = await calculationAPI.calculateBeam(inputs as unknown as BeamInputs);
          break;
        case 'slab':
          result = await calculationAPI.calculateSlab(inputs as unknown as SlabInputs);
          break;
        case 'column':
          result = await calculationAPI.calculateColumn(inputs as unknown as ColumnInputs);
          break;
        case 'foundation':
          result = await calculationAPI.calculateFoundation(inputs as unknown as FoundationInputs);
          break;
        case 'loads':
          result = await calculationAPI.calculateLoads(inputs as unknown as LoadInputs);
          break;
        case 'wind':
          result = await calculationAPI.calculateWind(inputs as unknown as WindInputs);
          break;
        case 'road': {
          const submodule = (inputs.road_submodule as RoadSubmodule) ?? 'pavement';
          result =
            submodule === 'drainage'
              ? await calculationAPI.calculateDrainage(inputs as unknown as DrainageInputs)
              : await calculationAPI.calculatePavement(inputs as unknown as PavementInputs);
          break;
        }
        default:
          throw new Error(`Unknown module: ${activeModule}`);
      }

      set({ currentResults: result, isCalculating: false });

      // Persist to Electron offline SQLite when available
      if (window.electronAPI?.offlineSaveCalculation) {
        const projectId = 'default';
        void window.electronAPI.offlineSaveCalculation(
          crypto.randomUUID(),
          projectId,
          activeModule,
          inputs as Record<string, unknown>,
          result as unknown as Record<string, unknown>
        );
      }
    } catch (err) {
      set({
        error: getErrorMessage(err),
        isCalculating: false,
      });
    }
  },

  saveResult: (result) => {
    set({ savedCalculations: [...get().savedCalculations, result] });
  },

  clearResults: () => set({ currentResults: null, error: null }),
}));
