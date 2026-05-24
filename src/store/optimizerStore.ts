import { create } from 'zustand';
import { optimizerAPI } from '../services/optimizerAPI';

interface OptimizerState {
  floorArea: number;
  spanMin: number;
  spanMax: number;
  latitude: number;
  longitude: number;
  roofArea: number;
  structuralResult: Record<string, unknown> | null;
  solarResult: Record<string, unknown> | null;
  isRunning: boolean;
  error: string | null;
  runStructural: () => Promise<void>;
  runSolar: () => Promise<void>;
}

export const useOptimizerStore = create<OptimizerState>((set, get) => ({
  floorArea: 400,
  spanMin: 4,
  spanMax: 12,
  latitude: -15.4167,
  longitude: 28.2833,
  roofArea: 80,
  structuralResult: null,
  solarResult: null,
  isRunning: false,
  error: null,

  runStructural: async () => {
    const { floorArea, spanMin, spanMax } = get();
    set({ isRunning: true, error: null });
    try {
      const result = await optimizerAPI.structural({
        floor_area_m2: floorArea,
        span_min_m: spanMin,
        span_max_m: spanMax,
      });
      set({ structuralResult: result as Record<string, unknown>, isRunning: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Optimization failed', isRunning: false });
    }
  },

  runSolar: async () => {
    const { latitude, longitude, roofArea } = get();
    set({ isRunning: true, error: null });
    try {
      const result = await optimizerAPI.solar({ latitude, longitude, roof_area_m2: roofArea });
      set({ solarResult: result as Record<string, unknown>, isRunning: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Solar optimization failed', isRunning: false });
    }
  },
}));
