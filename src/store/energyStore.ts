import { create } from 'zustand';
import { tier2API } from '../services/boqAPI';

type EnergyTab = 'solar' | 'battery';

interface EnergyState {
  activeTab: EnergyTab;
  dailyLoadKwh: number;
  autonomyDays: number;
  country: string;
  latitude: number;
  result: Record<string, unknown> | null;
  isLoading: boolean;
  error: string | null;
  setActiveTab: (t: EnergyTab) => void;
  setDailyLoadKwh: (v: number) => void;
  setAutonomyDays: (v: number) => void;
  runCalculation: () => Promise<void>;
}

export const useEnergyStore = create<EnergyState>((set, get) => ({
  activeTab: 'solar',
  dailyLoadKwh: 15,
  autonomyDays: 2,
  country: 'Zambia',
  latitude: -15.4,
  result: null,
  isLoading: false,
  error: null,

  setActiveTab: (t) => set({ activeTab: t, result: null }),
  setDailyLoadKwh: (v) => set({ dailyLoadKwh: v }),
  setAutonomyDays: (v) => set({ autonomyDays: v }),

  runCalculation: async () => {
    const s = get();
    set({ isLoading: true, error: null });
    try {
      const result =
        s.activeTab === 'solar'
          ? await tier2API.solarPv({ daily_load_kwh: s.dailyLoadKwh, country: s.country, latitude: s.latitude })
          : await tier2API.battery({ daily_load_kwh: s.dailyLoadKwh, autonomy_days: s.autonomyDays, country: s.country });
      set({ result, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Calculation failed', isLoading: false });
    }
  },
}));
