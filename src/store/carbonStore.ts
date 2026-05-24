import { create } from 'zustand';
import { calculationAPI } from '../services/calculationAPI';
import type { CalculationResult } from '../types/calculations';

interface CarbonState {
  materials: Record<string, number>;
  transportKm: number;
  transportMass: number;
  energyKwh: number;
  result: CalculationResult | null;
  creditResult: CalculationResult | null;
  isLoading: boolean;
  error: string | null;
  setMaterial: (key: string, value: number) => void;
  runCarbon: () => Promise<void>;
  runCredits: () => Promise<void>;
}

export const useCarbonStore = create<CarbonState>((set, get) => ({
  materials: { concrete_m3_rcc: 120, steel_t: 8 },
  transportKm: 50,
  transportMass: 40,
  energyKwh: 5000,
  result: null,
  creditResult: null,
  isLoading: false,
  error: null,

  setMaterial: (key, value) =>
    set({ materials: { ...get().materials, [key]: value } }),

  runCarbon: async () => {
    const { materials, transportKm, transportMass, energyKwh } = get();
    set({ isLoading: true, error: null });
    try {
      const result = await calculationAPI.calculateCarbon({
        materials,
        transport: { route1: [transportKm, transportMass] },
        energy: { electricity_kWh: energyKwh },
      });
      set({ result, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Carbon calc failed', isLoading: false });
    }
  },

  runCredits: async () => {
    set({ isLoading: true, error: null });
    try {
      const creditResult = await calculationAPI.calculateCarbonCredits({
        baseline_emissions_tCO2e: 500,
        project_emissions_tCO2e: 320,
        sequestration_tCO2e: 50,
        project_life_years: 20,
      });
      set({ creditResult, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Credit calc failed', isLoading: false });
    }
  },
}));
