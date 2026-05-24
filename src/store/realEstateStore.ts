import { create } from 'zustand';
import { realEstateAPI } from '../services/boqAPI';
import { useGeoStore } from './geoStore';

type ReTab = 'valuation' | 'feasibility' | 'landuse';

interface RealEstateState {
  activeTab: ReTab;
  plotArea: number;
  askingPrice: number;
  city: string;
  neighbourhood: string;
  countryCode: string;
  gfa: number;
  salePricePerM2: number;
  valuationResult: Record<string, unknown> | null;
  feasibilityResult: Record<string, unknown> | null;
  landUseResult: Record<string, unknown> | null;
  mortgageResult: Record<string, unknown> | null;
  isLoading: boolean;
  error: string | null;
  setActiveTab: (t: ReTab) => void;
  setPlotArea: (v: number) => void;
  setAskingPrice: (v: number) => void;
  setCity: (v: string) => void;
  setNeighbourhood: (v: string) => void;
  setGfa: (v: number) => void;
  setSalePricePerM2: (v: number) => void;
  runValuation: () => Promise<void>;
  runFeasibility: () => Promise<void>;
  runLandUse: () => Promise<void>;
  runMortgage: () => Promise<void>;
}

export const useRealEstateStore = create<RealEstateState>((set, get) => ({
  activeTab: 'valuation',
  plotArea: 800,
  askingPrice: 45000,
  city: 'Lusaka',
  neighbourhood: 'Woodlands',
  countryCode: 'ZM',
  gfa: 250,
  salePricePerM2: 850,
  valuationResult: null,
  feasibilityResult: null,
  landUseResult: null,
  mortgageResult: null,
  isLoading: false,
  error: null,

  setActiveTab: (t) => set({ activeTab: t }),
  setPlotArea: (v) => set({ plotArea: v }),
  setAskingPrice: (v) => set({ askingPrice: v }),
  setCity: (v) => set({ city: v }),
  setNeighbourhood: (v) => set({ neighbourhood: v }),
  setGfa: (v) => set({ gfa: v }),
  setSalePricePerM2: (v) => set({ salePricePerM2: v }),

  runValuation: async () => {
    const s = get();
    const geo = useGeoStore.getState().analysis;
    set({ isLoading: true, error: null });
    try {
      const result = await realEstateAPI.valuePlot({
        plot_area_m2: s.plotArea,
        asking_price_usd: s.askingPrice,
        city: s.city,
        neighbourhood: s.neighbourhood,
        country_code: s.countryCode,
        services_available: { water: true, electricity: true, sewerage: true, tarred_road: true },
        title_deed_type: 'freehold',
        geo_data: geo ?? {},
      });
      set({ valuationResult: result, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Valuation failed', isLoading: false });
    }
  },

  runFeasibility: async () => {
    const s = get();
    set({ isLoading: true, error: null });
    try {
      const result = await realEstateAPI.feasibility({
        plot_data: { asking_price_usd: s.askingPrice, plot_area_m2: s.plotArea, neighbourhood: s.neighbourhood },
        land_cost_usd: s.askingPrice,
        gross_floor_area_m2: s.gfa,
        construction_standard: 'standard',
        target_sale_price_per_m2: s.salePricePerM2,
        country_code: s.countryCode,
        city: s.city,
      });
      set({ feasibilityResult: result, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Feasibility failed', isLoading: false });
    }
  },

  runLandUse: async () => {
    const s = get();
    const geo = useGeoStore.getState().analysis;
    set({ isLoading: true, error: null });
    try {
      const result = await realEstateAPI.optimiseUse({
        plot_data: { asking_price_usd: s.askingPrice, plot_area_m2: s.plotArea, neighbourhood: s.neighbourhood },
        country_code: s.countryCode,
        city: s.city,
        geo_data: geo ?? {},
      });
      set({ landUseResult: result, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Land use analysis failed', isLoading: false });
    }
  },

  runMortgage: async () => {
    const s = get();
    set({ isLoading: true, error: null });
    try {
      const gdv = (s.feasibilityResult?.gross_development_value_usd as number) ?? s.askingPrice * 3;
      const result = await realEstateAPI.mortgage({
        country_code: s.countryCode,
        property_value_usd: gdv,
        deposit_pct: 20,
        term_years: 15,
      });
      set({ mortgageResult: result, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Mortgage calc failed', isLoading: false });
    }
  },
}));
