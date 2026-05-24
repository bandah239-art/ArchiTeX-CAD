import { create } from 'zustand';
import type { IFCElement, IFCModel, ViewMode } from '../types/ifc';

interface ViewerState {
  loadedModel: IFCModel | null;
  selectedElement: IFCElement | null;
  activeStorey: number | null;
  visibleTypes: string[];
  viewMode: ViewMode;
  modelPath: string | null;
  loadModel: (path: string) => void;
  setLoadedModel: (model: IFCModel | null) => void;
  selectElement: (element: IFCElement | null) => void;
  setStorey: (level: number | null) => void;
  toggleType: (typeName: string) => void;
  setViewMode: (mode: ViewMode) => void;
}

export const useViewerStore = create<ViewerState>((set, get) => ({
  loadedModel: null,
  selectedElement: null,
  activeStorey: null,
  visibleTypes: [],
  viewMode: 'perspective',
  modelPath: null,

  loadModel: (path: string) => {
    set({ modelPath: path });
  },

  setLoadedModel: (model) => set({ loadedModel: model }),

  selectElement: (element) => set({ selectedElement: element }),

  setStorey: (level) => set({ activeStorey: level }),

  toggleType: (typeName) => {
    const { visibleTypes } = get();
    if (visibleTypes.includes(typeName)) {
      set({ visibleTypes: visibleTypes.filter((t) => t !== typeName) });
    } else {
      set({ visibleTypes: [...visibleTypes, typeName] });
    }
  },

  setViewMode: (mode) => set({ viewMode: mode }),
}));
