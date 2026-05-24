import { create } from 'zustand';
import type { IFCElement, ModelStats } from '../types/ifc';
import { loadIFC } from '../services/fileService';
import { closeIfcModel, getIfcApi, type ParsedIfcElement } from '../services/ifcParser';
import { disposeIfcModel } from '../services/ifcMeshXeokit';

interface IfcModelState {
  path: string | null;
  elements: ParsedIfcElement[];
  elementByExpressId: Map<number, ParsedIfcElement>;
  elementByEntityId: Map<string, ParsedIfcElement>;
  stats: ModelStats | null;
  openModelId: number | null;
  isParsing: boolean;
  parseError: string | null;
  parseFromPath: (path: string) => Promise<ArrayBuffer>;
  setParseResult: (result: {
    path: string;
    elements: ParsedIfcElement[];
    elementByEntityId: Map<string, ParsedIfcElement>;
    stats: ModelStats;
    modelId: number;
  }) => void;
  setElementMaps: (elementByEntityId: Map<string, ParsedIfcElement>) => void;
  getElementByEntityId: (entityId: string) => IFCElement | null;
  getBoqElements: () => IFCElement[];
  clear: () => void;
}

export const useIfcModelStore = create<IfcModelState>((set, get) => ({
  path: null,
  elements: [],
  elementByExpressId: new Map(),
  elementByEntityId: new Map(),
  stats: null,
  openModelId: null,
  isParsing: false,
  parseError: null,

  parseFromPath: async (path: string) => {
    set({ isParsing: true, parseError: null, path });
    try {
      const prevId = get().openModelId;
      if (prevId !== null) {
        await disposeIfcModel(prevId);
      }

      const { arrayBuffer } = await loadIFC(path);
      set({ isParsing: false });
      return arrayBuffer;
    } catch (err) {
      set({
        isParsing: false,
        parseError: err instanceof Error ? err.message : 'IFC load failed',
      });
      throw err;
    }
  },

  setParseResult: (result) => {
    const byExpress = new Map<number, ParsedIfcElement>();
    for (const el of result.elements) {
      byExpress.set(el.expressId, el);
    }
    set({
      path: result.path,
      elements: result.elements,
      elementByExpressId: byExpress,
      elementByEntityId: result.elementByEntityId,
      stats: result.stats,
      openModelId: result.modelId,
      isParsing: false,
      parseError: null,
    });
  },

  setElementMaps: (elementByEntityId) => set({ elementByEntityId }),

  getElementByEntityId: (entityId) => {
    const el = get().elementByEntityId.get(entityId);
    if (!el) return null;
    const { meshBuffers: _m, expressId: _e, ...rest } = el;
    return rest;
  },

  getBoqElements: () => {
    return get()
      .elements.filter((e) => e.volume || e.area || e.length)
      .map(({ meshBuffers: _m, expressId: _e, ...rest }) => rest);
  },

  clear: () => {
    const id = get().openModelId;
    if (id !== null) {
      getIfcApi().then((api) => closeIfcModel(api, id));
    }
    set({
      path: null,
      elements: [],
      elementByExpressId: new Map(),
      elementByEntityId: new Map(),
      stats: null,
      openModelId: null,
      parseError: null,
    });
  },
}));
