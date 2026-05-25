import { create } from 'zustand';
import type { IFCElement, IFCModel, ViewMode } from '../types/ifc';
import type { ActiveTool } from '../types/tools';
import type { ViewerControls } from '../services/viewerControls';
import { normalizeEntityId, resolveIfcElements, type OverlayLayerId } from '../services/selectionBridge';

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
  activeTool: ActiveTool;
  snapEnabled: boolean;
  gridVisible: boolean;
  minimapVisible: boolean;
  boxSelectResults: string[];
  resolvedBoxSelection: IFCElement[];
  hiddenOverlays: OverlayLayerId[];
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
  setActiveTool: (tool: ActiveTool) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setGridVisible: (visible: boolean) => void;
  setMinimapVisible: (visible: boolean) => void;
  setBoxSelectResults: (ids: string[]) => void;
  clearBoxSelectResults: () => void;
  selectEntityById: (entityId: string) => void;
  toggleOverlay: (layer: OverlayLayerId) => void;
  setOverlayVisible: (layer: OverlayLayerId, visible: boolean) => void;
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
  activeTool: 'select',
  snapEnabled: true,
  gridVisible: false,
  minimapVisible: true,
  boxSelectResults: [],
  resolvedBoxSelection: [],
  hiddenOverlays: [],
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
    set({ hiddenTypes: [], hiddenOverlays: [] });
    const vc = get().viewerControls;
    vc?.showAll();
    vc?.setOverlayVisibility([]);
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

  setActiveTool: (tool) => {
    set({ activeTool: tool });
    get().viewerControls?.setActiveTool(tool);
  },

  setSnapEnabled: (enabled) => {
    set({ snapEnabled: enabled });
    get().viewerControls?.setSnapEnabled(enabled);
  },

  setGridVisible: (visible) => {
    set({ gridVisible: visible });
    get().viewerControls?.setGridVisible(visible);
  },

  setMinimapVisible: (visible) => set({ minimapVisible: visible }),

  setBoxSelectResults: (ids) => {
    const resolved = resolveIfcElements(ids);
    set({ boxSelectResults: ids, resolvedBoxSelection: resolved });
  },

  clearBoxSelectResults: () => set({ boxSelectResults: [], resolvedBoxSelection: [] }),

  selectEntityById: (entityId) => {
    const normalized = normalizeEntityId(entityId);
    const resolved = resolveIfcElements([entityId]);
    const element = resolved[0] ?? null;
    set({ selectedElement: element });
    if (normalized) {
      get().viewerControls?.highlightEntities([normalized]);
    }
  },

  toggleOverlay: (layer) => {
    const { hiddenOverlays, viewerControls } = get();
    const next = hiddenOverlays.includes(layer)
      ? hiddenOverlays.filter((l) => l !== layer)
      : [...hiddenOverlays, layer];
    set({ hiddenOverlays: next });
    viewerControls?.setOverlayVisibility(next);
  },

  setOverlayVisible: (layer, visible) => {
    const { hiddenOverlays, viewerControls } = get();
    const next = visible
      ? hiddenOverlays.filter((l) => l !== layer)
      : hiddenOverlays.includes(layer)
        ? hiddenOverlays
        : [...hiddenOverlays, layer];
    set({ hiddenOverlays: next });
    viewerControls?.setOverlayVisibility(next);
  },
}));
