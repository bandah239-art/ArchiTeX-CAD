import { create } from 'zustand';
import type { IFCElement, ModelStats } from '../types/ifc';
import { loadIFC } from '../services/fileService';
import { closeIfcModel, getIfcApi, type ParsedIfcElement } from '../services/ifcParser';
import {
  disposeIfcModel,
  entityIdFromExpressId,
  exportElementMeshPayload,
  placedMeshesToPayload,
  type ServerMeshPayload,
} from '../services/ifcMeshXeokit';
import type { PlacedMeshBuffers } from '../services/ifcQuantities';
import { useViewerStore } from './viewerStore';

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
  exportMeshByEntityId: (entityId: string) => ServerMeshPayload | null;
  exportMergedModelMesh: (excludeEntityIds?: string[]) => ServerMeshPayload | null;
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

  exportMeshByEntityId: (entityId) => {
    const el = get().elementByEntityId.get(entityId);
    if (!el) return null;
    return exportElementMeshPayload(el);
  },

  exportMergedModelMesh: (excludeEntityIds = []) => {
    const excluded = new Set(excludeEntityIds);
    const meshes: PlacedMeshBuffers[] = [];
    for (const el of get().elements) {
      const entityId = entityIdFromExpressId(el.expressId);
      if (excluded.has(entityId) || !el.meshBuffers.length) continue;
      meshes.push(...el.meshBuffers);
    }
    return placedMeshesToPayload(meshes);
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

function uniqueEntityIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Collect entity ids from current selection + box-select results (normalized). */
export function collectTargetEntityIds(): string[] {
  const { selectedElement, boxSelectResults, resolvedBoxSelection } = useViewerStore.getState();
  const ids: string[] = [];
  if (selectedElement) ids.push(entityIdFromExpressId(selectedElement.id));
  if (boxSelectResults.length) {
    ids.push(...boxSelectResults);
  } else if (resolvedBoxSelection.length) {
    for (const el of resolvedBoxSelection) {
      ids.push(entityIdFromExpressId(el.id));
    }
  }
  return uniqueEntityIds(ids);
}

function requireMeshPayload(entityId: string, label: string): ServerMeshPayload {
  const mesh = useIfcModelStore.getState().exportMeshByEntityId(entityId);
  if (!mesh?.vertices.length || !mesh.faces.length) {
    throw new Error(`${label} has no exportable mesh geometry`);
  }
  return mesh;
}

/** Resolve two meshes for boolean / clash / intersection server ops. */
export function resolveTwoMeshPayloads(): { mesh_a: ServerMeshPayload; mesh_b: ServerMeshPayload } {
  const entityIds = collectTargetEntityIds();
  if (entityIds.length < 2) {
    throw new Error('Select two elements (pick one, then box-select or pick another)');
  }
  return {
    mesh_a: requireMeshPayload(entityIds[0], 'First element'),
    mesh_b: requireMeshPayload(entityIds[1], 'Second element'),
  };
}

/** Selected element mesh, or first box-select result. */
export function resolvePrimaryMeshPayload(): ServerMeshPayload {
  const entityIds = collectTargetEntityIds();
  if (!entityIds.length) {
    throw new Error('Select an element first');
  }
  return requireMeshPayload(entityIds[0], 'Selected element');
}
