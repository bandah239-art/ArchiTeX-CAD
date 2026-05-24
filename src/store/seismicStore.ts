import { create } from 'zustand';
import { seismicAPI } from '../services/optimizerAPI';

interface SeismicState {
  nStoreys: number;
  storeyHeight: number;
  pgaG: number;
  analysisType: 'modal' | 'time_history' | 'pushover';
  result: Record<string, unknown> | null;
  isRunning: boolean;
  error: string | null;
  runAnalysis: () => Promise<void>;
}

export const useSeismicStore = create<SeismicState>((set, get) => ({
  nStoreys: 4,
  storeyHeight: 3,
  pgaG: 0.15,
  analysisType: 'modal',
  result: null,
  isRunning: false,
  error: null,

  runAnalysis: async () => {
    const { nStoreys, storeyHeight, pgaG, analysisType } = get();
    set({ isRunning: true, error: null });
    try {
      const result = await seismicAPI.analyze({
        n_storeys: nStoreys,
        storey_height_m: storeyHeight,
        pga_g: pgaG,
        analysis_type: analysisType,
      });
      set({ result: result as Record<string, unknown>, isRunning: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Seismic analysis failed', isRunning: false });
    }
  },
}));
