import { create } from 'zustand';
import { tier2API } from '../services/boqAPI';

type WashTab = 'demand' | 'borehole' | 'sewerage';

interface WashState {
  activeTab: WashTab;
  population: number;
  lpcd: number;
  dailyDemandM3: number;
  country: string;
  result: Record<string, unknown> | null;
  isLoading: boolean;
  error: string | null;
  setActiveTab: (t: WashTab) => void;
  setPopulation: (v: number) => void;
  setLpcd: (v: number) => void;
  setDailyDemandM3: (v: number) => void;
  runCalculation: () => Promise<void>;
}

export const useWashStore = create<WashState>((set, get) => ({
  activeTab: 'demand',
  population: 500,
  lpcd: 50,
  dailyDemandM3: 50,
  country: 'Zambia',
  result: null,
  isLoading: false,
  error: null,

  setActiveTab: (t) => set({ activeTab: t, result: null }),
  setPopulation: (v) => set({ population: v }),
  setLpcd: (v) => set({ lpcd: v }),
  setDailyDemandM3: (v) => set({ dailyDemandM3: v }),

  runCalculation: async () => {
    const s = get();
    set({ isLoading: true, error: null });
    try {
      let result: Record<string, unknown>;
      if (s.activeTab === 'demand') {
        result = await tier2API.washDemand({ population: s.population, lpcd: s.lpcd, country: s.country });
      } else if (s.activeTab === 'borehole') {
        result = await tier2API.washBorehole({ daily_demand_m3: s.dailyDemandM3, country: s.country });
      } else {
        result = await tier2API.washSewerage({ population: s.population, lpcd: s.lpcd, country: s.country });
      }
      set({ result, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Calculation failed', isLoading: false });
    }
  },
}));
