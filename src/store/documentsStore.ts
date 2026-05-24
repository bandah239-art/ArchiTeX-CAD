import { create } from 'zustand';
import { documentsAPI } from '../services/boqAPI';
import { useBoQStore } from './boqStore';
import type { BoQElement } from '../types/boq';

type DocTab = 'tender' | 'calculation' | 'eia' | 'ipc' | 'esg';

function aggregateMaterialTotals(elements: BoQElement[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const el of elements) {
    for (const item of el.items ?? []) {
      const mid = item.material_id;
      if (!mid) continue;
      totals[mid] = (totals[mid] ?? 0) + Number(item.quantity ?? 0);
    }
  }
  return totals;
}

interface DocumentsState {
  activeTab: DocTab;
  projectName: string;
  employer: string;
  estimatedValue: number;
  countryCode: string;
  eiaType: string;
  result: Record<string, unknown> | null;
  isGenerating: boolean;
  error: string | null;
  setActiveTab: (t: DocTab) => void;
  setProjectName: (v: string) => void;
  setEmployer: (v: string) => void;
  setEstimatedValue: (v: number) => void;
  setCountryCode: (v: string) => void;
  setEiaType: (v: string) => void;
  generate: () => Promise<void>;
  downloadResult: () => void;
}

export const useDocumentsStore = create<DocumentsState>((set, get) => ({
  activeTab: 'tender',
  projectName: 'Kamwala Market Rehabilitation',
  employer: 'Ministry of Infrastructure',
  estimatedValue: 500000,
  countryCode: 'ZM',
  eiaType: 'building',
  result: null,
  isGenerating: false,
  error: null,

  setActiveTab: (t) => set({ activeTab: t, result: null }),
  setProjectName: (v) => set({ projectName: v }),
  setEmployer: (v) => set({ employer: v }),
  setEstimatedValue: (v) => set({ estimatedValue: v }),
  setCountryCode: (v) => set({ countryCode: v }),
  setEiaType: (v) => set({ eiaType: v }),

  generate: async () => {
    const s = get();
    set({ isGenerating: true, error: null });
    try {
      let result: Record<string, unknown>;
      if (s.activeTab === 'tender') {
        result = await documentsAPI.generateTender({
          project_name: s.projectName,
          employer: s.employer,
          country_code: s.countryCode,
          estimated_value_usd: s.estimatedValue,
        });
      } else if (s.activeTab === 'calculation') {
        result = await documentsAPI.calculationReport({
          project_name: s.projectName,
          client_name: 'Client',
          engineer_name: 'InfraAfrica Engineer',
        });
      } else if (s.activeTab === 'eia') {
        result = await documentsAPI.eiaScreening({
          project_name: s.projectName,
          project_type: s.eiaType,
          country_code: s.countryCode,
          estimated_value_usd: s.estimatedValue,
        });
      } else if (s.activeTab === 'esg') {
        const boq = useBoQStore.getState();
        const materialTotals = aggregateMaterialTotals(boq.elements);
        result = await documentsAPI.esgReport({
          project_name: s.projectName,
          material_totals: materialTotals,
          elements: boq.elements.map((el) => ({ items: el.items })),
        });
      } else {
        result = { content: 'Generate IPC from Government Dashboard project detail view.' };
      }
      set({ result, isGenerating: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Generation failed', isGenerating: false });
    }
  },

  downloadResult: () => {
    const content = String(get().result?.content ?? get().result?.document_text ?? '');
    if (!content) return;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `infraafrica_${get().activeTab}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  },
}));
