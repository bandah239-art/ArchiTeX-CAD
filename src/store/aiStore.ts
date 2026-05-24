import { create } from 'zustand';
import { aiAPI } from '../services/boqAPI';
import { useCalculationStore } from './calculationStore';
import { useGeoStore } from './geoStore';

interface AiState {
  prompt: string;
  countryCode: string;
  budgetUsd: number;
  projectType: string;
  designBrief: Record<string, unknown> | null;
  variants: Record<string, unknown> | null;
  isGenerating: boolean;
  error: string | null;
  setPrompt: (v: string) => void;
  setCountryCode: (v: string) => void;
  setBudgetUsd: (v: number) => void;
  setProjectType: (v: string) => void;
  generateDesign: () => Promise<void>;
  generateVariants: () => Promise<void>;
  pushToCalculators: () => Promise<void>;
  exportProposal: () => Promise<void>;
}

export const useAiStore = create<AiState>((set, get) => ({
  prompt:
    '3 bedroom house in Lusaka for a family of 5. Clay soil on site. Budget USD 45,000. Want a verandah and domestic quarters.',
  countryCode: 'ZM',
  budgetUsd: 45000,
  projectType: 'residential',
  designBrief: null,
  variants: null,
  isGenerating: false,
  error: null,

  setPrompt: (v) => set({ prompt: v }),
  setCountryCode: (v) => set({ countryCode: v }),
  setBudgetUsd: (v) => set({ budgetUsd: v }),
  setProjectType: (v) => set({ projectType: v }),

  generateDesign: async () => {
    const { prompt, countryCode, budgetUsd, projectType } = get();
    set({ isGenerating: true, error: null });
    try {
      const geo = useGeoStore.getState().analysis;
      const geoParams = (geo?.design_parameters ?? {}) as Record<string, unknown>;
      const result = await aiAPI.generateDesign({
        natural_language_prompt: prompt,
        country_code: countryCode,
        budget_usd: budgetUsd,
        project_type: projectType,
        geo_data: {
          bearing_capacity_mid: geoParams.soil_bearing_capacity_knm2,
          annual_rainfall_mm: geo?.executive_summary?.annual_rainfall_mm,
          seismic_design_category: geoParams.seismic_design_category,
          design_wind_speed_ms: geoParams.design_wind_speed_ms,
          climate_zone: geo?.executive_summary?.climate_zone,
        },
        site_latitude: useGeoStore.getState().latitude,
        site_longitude: useGeoStore.getState().longitude,
      });
      set({ designBrief: result.design_brief as Record<string, unknown>, isGenerating: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Design generation failed', isGenerating: false });
    }
  },

  generateVariants: async () => {
    const state = get();
    set({ isGenerating: true, error: null });
    try {
      const variants = await aiAPI.generateVariants({
        natural_language_prompt: state.prompt,
        country_code: state.countryCode,
        budget_usd: state.budgetUsd,
        base_brief: state.designBrief,
        project_type: state.projectType,
      });
      set({ variants, isGenerating: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Variant generation failed', isGenerating: false });
    }
  },

  pushToCalculators: async () => {
    const { designBrief, countryCode } = get();
    if (!designBrief) return;
    const geo = useGeoStore.getState().analysis;
    const result = await aiAPI.pushToCalculators({
      design_brief: designBrief,
      geo_data: geo?.design_parameters ?? {},
      country_code: countryCode,
    });
    const calc = useCalculationStore.getState();
    const inputs = result.calculators.foundation;
    if (inputs) {
      calc.setModule('foundation');
      Object.entries(inputs).forEach(([k, v]) => calc.setInput(k, v));
    }
  },

  exportProposal: async () => {
    const { designBrief } = get();
    if (!designBrief) return;
    const geo = useGeoStore.getState().analysis;
    const result = await aiAPI.generateProposal({
      project_name: 'InfraAfrica Project',
      client_name: 'Client',
      design_brief: designBrief,
      geo_data: geo ?? {},
    });
    const blob = new Blob([result.content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'infraafrica_proposal.html';
    a.click();
    URL.revokeObjectURL(url);
  },
}));
