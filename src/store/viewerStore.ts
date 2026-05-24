import { create } from 'zustand';
import type { IFCElement, IFCModel, ViewMode } from '../types/ifc';
import type { ViewerControls } from '../services/viewerControls';

interface ViewerState {
  loadedModel: IFCModel | null;
  selectedElement: IFCElement | null;
  selectedAssetType: string | null;
  activeStorey: number | null;
  layerTypes: string[];
  hiddenTypes: string[];
  viewMode: ViewMode;
  modelPath: string | null;
  exploded: boolean;
  xRay: boolean;
  viewerControls: ViewerControls | null;
  loadModel: (path: string) => void;
  setLoadedModel: (model: IFCModel | null) => void;
  selectElement: (element: IFCElement | null) => void;
  selectAssetType: (type: string | null) => void;
  setStorey: (level: number | null) => void;
  setLayerTypes: (types: string[]) => void;
  toggleType: (typeName: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setViewerControls: (controls: ViewerControls | null) => void;
  setExploded: (enabled: boolean) => void;
  setXRay: (enabled: boolean) => void;
  showAllLayers: () => void;
}

export const useViewerStore = create<ViewerState>((set, get) => ({
  loadedModel: null,
  selectedElement: null,
  selectedAssetType: null,
  activeStorey: null,
  layerTypes: [],
  hiddenTypes: [],
  viewMode: 'perspective',
  modelPath: null,
  exploded: false,
  xRay: false,
  viewerControls: null,

  loadModel: (path: string) => {
    set({ modelPath: path, hiddenTypes: [], selectedAssetType: null });
  },

  setLoadedModel: (model) => set({ loadedModel: model }),

  selectElement: (element) => set({ selectedElement: element }),

  selectAssetType: (type) => set({ selectedAssetType: type }),

  setStorey: (level) => set({ activeStorey: level }),

  setLayerTypes: (types) => set({ layerTypes: types, hiddenTypes: [] }),

  toggleType: (typeName) => {
    const { hiddenTypes, viewerControls } = get();
    const next = hiddenTypes.includes(typeName)
      ? hiddenTypes.filter((t) => t !== typeName)
      : [...hiddenTypes, typeName];
    set({ hiddenTypes: next });
    viewerControls?.setLayersVisibility(next);
  },

  showAllLayers: () => {
    set({ hiddenTypes: [] });
    get().viewerControls?.showAll();
  },

  setViewMode: (mode) => {
    set({ viewMode: mode });
    const { viewerControls } = get();
    if (mode === 'plan') viewerControls?.flyToPlanView();
    else if (mode === 'perspective') viewerControls?.flyToPerspective();
  },

  setViewerControls: (controls) => set({ viewerControls: controls }),

  setExploded: (enabled) => {
    set({ exploded: enabled });
    get().viewerControls?.setExploded(enabled);
  },

  setXRay: (enabled) => {
    set({ xRay: enabled });
    get().viewerControls?.setXRayed(enabled);
  },
}));
