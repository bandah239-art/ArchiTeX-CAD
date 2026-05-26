import { create } from 'zustand';
import type { BoQElement, CompiledBoQ } from '../types/boq';
import { boqAPI } from '../services/boqAPI';
import { API_BASE } from '../services/apiConfig';

const IFC_CALC_MAP: Record<string, BoQElement['calculation_type']> = {
  IfcFooting: 'foundation',
  IfcFoundation: 'foundation',
  IfcSlab: 'slab',
  IfcColumn: 'column',
  IfcBeam: 'beam',
};

interface BoQState {
  countryCode: string;
  projectName: string;
  client: string;
  elements: BoQElement[];
  compiledBoQ: CompiledBoQ | null;
  isGenerating: boolean;
  isExporting: boolean;
  isImportingBim: boolean;
  error: string | null;
  setCountryCode: (code: string) => void;
  setProjectName: (name: string) => void;
  setClient: (client: string) => void;
  addElement: (element: BoQElement) => void;
  removeElement: (ref: string) => void;
  generateBoQ: () => Promise<void>;
  exportExcel: () => Promise<void>;
  exportPdf: () => Promise<void>;
  loadDemoProject: () => void;
  importFromBim: (elements: Record<string, unknown>[]) => Promise<void>;
}

const CALC_ENDPOINTS: Record<string, string> = {
  beam: '/calculate/beam',
  slab: '/calculate/slab',
  column: '/calculate/column',
  foundation: '/calculate/foundation',
  road: '/calculate/road/pavement',
};

function toCalcPayload(el: BoQElement): Record<string, unknown> {
  const inputs = { ...(el.calculation_inputs ?? {}) };
  if (el.calculation_type === 'beam') {
    return {
      ...inputs,
      live_load: inputs.imposed_load ?? inputs.live_load ?? 10,
    };
  }
  if (el.calculation_type === 'column') {
    return {
      height: inputs.height ?? el.element_dimensions.length ?? 3.5,
      width: inputs.width ?? el.element_dimensions.width ?? 300,
      depth: inputs.depth ?? el.element_dimensions.depth ?? 300,
      axial_load: inputs.axial_load ?? 850,
      moment_major: inputs.moment_major ?? 45,
      moment_minor: inputs.moment_minor ?? 20,
      fck: inputs.fck ?? 30,
      fyk: inputs.fyk ?? 500,
      le_factor: inputs.le_factor ?? 0.85,
    };
  }
  if (el.calculation_type === 'slab') {
    return {
      slab_type: inputs.slab_type ?? 'two_way',
      span_lx: inputs.span_lx ?? el.element_dimensions.length ?? 8,
      span_ly: inputs.span_ly ?? el.element_dimensions.width ?? 10,
      dead_load: inputs.dead_load ?? 5,
      live_load: inputs.live_load ?? 3,
      depth: inputs.depth ?? el.element_dimensions.depth ?? 175,
      fck: inputs.fck ?? 30,
      fyk: inputs.fyk ?? 500,
      support_condition: inputs.support_condition ?? 'simply_supported',
    };
  }
  return inputs;
}

async function fetchCalculation(el: BoQElement): Promise<Record<string, unknown>> {
  const endpoint = CALC_ENDPOINTS[el.calculation_type];
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toCalcPayload(el)),
  });
  if (!res.ok) {
    throw new Error(`Calculation failed for ${el.ref}`);
  }
  return res.json();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const useBoQStore = create<BoQState>((set, get) => ({
  countryCode: 'ZM',
  projectName: 'ARCHITEX-CAD Demo Project',
  client: 'Client Name',
  elements: [],
  compiledBoQ: null,
  isGenerating: false,
  isExporting: false,
  isImportingBim: false,
  error: null,

  setCountryCode: (code) => set({ countryCode: code }),
  setProjectName: (name) => set({ projectName: name }),
  setClient: (client) => set({ client: client }),

  addElement: (element) =>
    set({ elements: [...get().elements, element], compiledBoQ: null }),

  removeElement: (ref) =>
    set({
      elements: get().elements.filter((e) => e.ref !== ref),
      compiledBoQ: null,
    }),

  loadDemoProject: () => {
    set({
      elements: [
        {
          ref: 'F1',
          description: 'Pad Foundation F1 — 800kN',
          calculation_type: 'foundation',
          element_count: 6,
          element_dimensions: { width: 2.7, length: 2.7, depth: 0.4 },
          calculation_inputs: {
            foundation_type: 'pad',
            column_load: 800,
            moment_x: 30,
            moment_y: 0,
            soil_bearing: 150,
            soil_unit_weight: 18,
            foundation_depth: 1.2,
            foundation_depth_concrete: 400,
            fck: 25,
            fyk: 500,
            column_width: 300,
            column_depth: 300,
          },
          summary_text: '2.1 m³ concrete (each)',
        },
        {
          ref: 'C1',
          description: 'Column C1 300×300 — 3.5m',
          calculation_type: 'column',
          element_count: 12,
          element_dimensions: { width: 300, depth: 300, length: 3.5 },
          calculation_inputs: {
            height: 3.5,
            width: 300,
            depth: 300,
            axial_load: 850,
            moment_major: 45,
            moment_minor: 20,
            fck: 30,
            fyk: 500,
            le_factor: 0.85,
          },
          summary_text: '0.32 m³ concrete (each)',
        },
        {
          ref: 'S1',
          description: 'First Floor Slab 8×10m — 175mm',
          calculation_type: 'slab',
          element_count: 1,
          element_dimensions: { length: 8, width: 10, depth: 175 },
          calculation_inputs: {
            slab_type: 'two_way',
            span_lx: 8,
            span_ly: 10,
            dead_load: 5,
            live_load: 3,
            depth: 175,
            fck: 30,
            fyk: 500,
            support_condition: 'simply_supported',
          },
          summary_text: '14.0 m³ concrete',
        },
      ],
      compiledBoQ: null,
      error: null,
    });
  },

  generateBoQ: async () => {
    const { elements, countryCode, projectName, client } = get();
    if (!elements.length) {
      set({ error: 'Add at least one project element' });
      return;
    }
    set({ isGenerating: true, error: null });
    try {
      const extracted: BoQElement[] = [];
      for (const el of elements) {
        if (el.items?.length && el.source === 'bim_extraction') {
          extracted.push(el);
          continue;
        }
        const result = el.calculation_result ?? (await fetchCalculation(el));
        const qty = await boqAPI.extractQuantities({
          calculation_type: el.calculation_type,
          calculation_result: result,
          element_dimensions: el.element_dimensions,
          element_count: el.element_count,
          calculation_inputs: el.calculation_inputs ?? {},
          ref: el.ref,
          description: el.description,
          project_id: projectName,
        });
        extracted.push({ ...el, ...qty, items: qty.items });
      }
      const compiled = await boqAPI.compile({
        project_id: projectName,
        project_name: projectName,
        client,
        country_code: countryCode,
        currency_display: 'USD',
        contractor_overhead: 15,
        contractor_profit: 10,
        contingency: 10,
        elements: extracted,
      });
      set({ compiledBoQ: compiled, elements: extracted, isGenerating: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'BoQ generation failed',
        isGenerating: false,
      });
    }
  },

  exportExcel: async () => {
    if (!get().compiledBoQ) await get().generateBoQ();
    const { countryCode, projectName, client, elements } = get();
    if (!elements.length) return;
    set({ isExporting: true, error: null });
    try {
      const blob = await boqAPI.exportExcel({
        project_id: projectName,
        project_name: projectName,
        client,
        country_code: countryCode,
        currency_display: 'USD',
        contractor_overhead: 15,
        contractor_profit: 10,
        contingency: 10,
        elements,
      });
      downloadBlob(blob, 'architex-cad_boq.xlsx');
      set({ isExporting: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Excel export failed',
        isExporting: false,
      });
    }
  },

  exportPdf: async () => {
    if (!get().compiledBoQ) await get().generateBoQ();
    const { countryCode, projectName, client, elements } = get();
    if (!elements.length) return;
    set({ isExporting: true, error: null });
    try {
      const blob = await boqAPI.exportPdf({
        project_id: projectName,
        project_name: projectName,
        client,
        country_code: countryCode,
        currency_display: 'USD',
        contractor_overhead: 15,
        contractor_profit: 10,
        contingency: 10,
        elements,
      });
      const ext = blob.type.includes('pdf') ? 'pdf' : 'html';
      downloadBlob(blob, `architex-cad_boq.${ext}`);
      set({ isExporting: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'PDF export failed',
        isExporting: false,
      });
    }
  },

  importFromBim: async (bimElements) => {
    const { projectName } = get();
    if (!Array.isArray(bimElements)) {
      set({ error: 'BIM import expects an array of elements, not a count or object' });
      return;
    }
    if (!bimElements.length) {
      set({ error: 'No BIM elements to import' });
      return;
    }
    set({ isImportingBim: true, error: null });
    try {
      const result = await boqAPI.extractFromBim({
        elements: bimElements,
        project_id: projectName,
      });
      const mapped: BoQElement[] = result.elements.map((el) => {
        const ifcType = (el as { ifc_type?: string }).ifc_type ?? 'IfcBuildingElementProxy';
        return {
          ref: el.ref,
          description: el.description,
          calculation_type: IFC_CALC_MAP[ifcType] ?? 'foundation',
          element_count: 1,
          element_dimensions: {},
          items: el.items,
          summary_text: el.summary_text,
          section: (el as { section?: string }).section,
          source: 'bim_extraction',
          ifc_type: ifcType,
        };
      });
      set({ elements: mapped, compiledBoQ: null, isImportingBim: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'BIM import failed',
        isImportingBim: false,
      });
    }
  },
}));
