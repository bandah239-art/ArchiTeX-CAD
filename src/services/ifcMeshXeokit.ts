import { SceneModel, type Viewer } from '@xeokit/xeokit-sdk';
import type { IFCElement, ModelStats } from '../types/ifc';
import { computeCombinedWorldBounds, type PlacedMeshBuffers } from './ifcQuantities';
import {
  closeIfcModel,
  getIfcApi,
  parseIfcBuffer,
  type ParsedIfcElement,
} from './ifcParser';
import { transformVertex, worldMatrixWithOffset } from './ifcTransforms';

export interface ServerMeshPayload {
  vertices: number[];
  faces: number[];
}

function ifcTypeColor(type: string): [number, number, number] {
  const palette: Record<string, [number, number, number]> = {
    IfcWall: [0.75, 0.72, 0.68],
    IfcSlab: [0.55, 0.55, 0.58],
    IfcBeam: [0.45, 0.55, 0.72],
    IfcColumn: [0.62, 0.48, 0.42],
    IfcFooting: [0.5, 0.45, 0.4],
    IfcDoor: [0.55, 0.35, 0.2],
    IfcWindow: [0.6, 0.75, 0.85],
    IfcRoof: [0.65, 0.3, 0.25],
    IfcStair: [0.5, 0.5, 0.52],
  };
  return palette[type] ?? [0.6, 0.62, 0.65];
}

function geometrySignature(buf: PlacedMeshBuffers): string {
  return `${buf.positions.length}:${buf.indices.length}:${buf.positions[0]}:${buf.indices[0]}`;
}

export interface IfcXeokitLoadResult {
  stats: ModelStats;
  elements: ParsedIfcElement[];
  elementByEntityId: Map<string, ParsedIfcElement>;
  modelId: number;
  /** World-space bbox centre used to recenter the model at origin. */
  modelCenterOffset: [number, number, number];
}

function collectAllMeshBuffers(elements: ParsedIfcElement[]): PlacedMeshBuffers[] {
  const all: PlacedMeshBuffers[] = [];
  for (const element of elements) {
    if (element.meshBuffers.length) all.push(...element.meshBuffers);
  }
  return all;
}

function centeredBounds(
  bounds: { min: [number, number, number]; max: [number, number, number] },
  center: [number, number, number],
): { min: [number, number, number]; max: [number, number, number] } {
  return {
    min: [
      bounds.min[0] - center[0],
      bounds.min[1] - center[1],
      bounds.min[2] - center[2],
    ],
    max: [
      bounds.max[0] - center[0],
      bounds.max[1] - center[1],
      bounds.max[2] - center[2],
    ],
  };
}

/**
 * Load IFC into xeokit using mesh data from parseIfcBuffer only.
 * Do NOT call StreamAllMeshes again here — a second pass aborts web-ifc WASM.
 */
export async function loadIfcIntoXeokit(
  viewer: Viewer,
  buffer: ArrayBuffer,
  options?: { modelId?: string; onProgress?: (pct: number) => void }
): Promise<IfcXeokitLoadResult> {
  const start = performance.now();
  const sceneModelId = options?.modelId ?? 'ifcModel';

  const existing = viewer.scene.models[sceneModelId];
  if (existing) existing.destroy();

  const parsed = await parseIfcBuffer(buffer);
  const elementByEntityId = new Map<string, ParsedIfcElement>();

  const allMeshes = collectAllMeshBuffers(parsed.elements);
  const worldBounds = computeCombinedWorldBounds(allMeshes);
  const modelCenterOffset: [number, number, number] = worldBounds?.center ?? [0, 0, 0];

  const sceneModel = new SceneModel(viewer.scene, {
    id: sceneModelId,
    isModel: true,
    pickable: true,
    edges: true,
  });

  const geometryCache = new Map<string, string>();
  let meshIndex = 0;
  let processed = 0;
  const totalMeshes =
    parsed.elements.reduce((n, el) => n + el.meshBuffers.length, 0) || 1;

  for (const element of parsed.elements) {
    if (!element.meshBuffers.length) continue;

    const entityId = entityIdFromExpressId(element.expressId);
    const meshIds: string[] = [];
    const color = ifcTypeColor(element.type);

    for (const mbuf of element.meshBuffers) {
      const sig = geometrySignature(mbuf);
      let geometryId = geometryCache.get(sig);

      if (!geometryId) {
        geometryId = `${sceneModelId}-geom-${meshIndex}`;
        geometryCache.set(sig, geometryId);
        sceneModel.createGeometry({
          id: geometryId,
          primitive: 'triangles',
          positions: Array.from(mbuf.positions),
          indices: Array.from(mbuf.indices),
        } as unknown as Parameters<SceneModel['createGeometry']>[0]);
      }

      const meshId = `${sceneModelId}-mesh-${meshIndex++}`;
      const matrix = worldMatrixWithOffset(mbuf.matrix, modelCenterOffset);

      sceneModel.createMesh({
        id: meshId,
        geometryId,
        primitive: 'triangles',
        matrix,
        color,
        opacity: 1,
      } as unknown as Parameters<SceneModel['createMesh']>[0]);

      meshIds.push(meshId);
      processed++;
      options?.onProgress?.(Math.min(99, (processed / totalMeshes) * 100));
    }

    if (meshIds.length) {
      sceneModel.createEntity({
        id: entityId,
        meshIds,
        isObject: true,
      });
      elementByEntityId.set(entityId, element);
    }
  }

  sceneModel.finalize();
  viewer.cameraFlight.flyTo(sceneModel);

  const displayBounds = worldBounds
    ? centeredBounds(worldBounds, modelCenterOffset)
    : centeredBounds(parsed.bounds, modelCenterOffset);

  const stats: ModelStats = {
    elementCount: parsed.elements.filter((e) => e.meshBuffers.length > 0).length,
    triangleCount: parsed.triangleCount,
    bounds: {
      min: [...displayBounds.min],
      max: [...displayBounds.max],
    },
    loadTime: performance.now() - start,
  };

  options?.onProgress?.(100);

  return {
    stats,
    elements: parsed.elements,
    elementByEntityId,
    modelId: parsed.modelId,
    modelCenterOffset,
  };
}

export function ifcElementFromEntity(
  entityId: string,
  elementByEntityId: Map<string, ParsedIfcElement>
): IFCElement | null {
  const parsed = elementByEntityId.get(entityId);
  if (!parsed) return null;
  const { meshBuffers: _m, expressId: _e, ...element } = parsed;
  return element;
}

export async function disposeIfcModel(modelId: number): Promise<void> {
  const api = await getIfcApi();
  closeIfcModel(api, modelId);
}

/** Merge placed IFC meshes into flat { vertices, faces } for server geometry ops (xeokit Y-up). */
export function placedMeshesToPayload(
  meshes: PlacedMeshBuffers[],
  modelCenterOffset: [number, number, number] = [0, 0, 0],
): ServerMeshPayload | null {
  if (!meshes.length) return null;

  const vertices: number[] = [];
  const faces: number[] = [];
  let vertexOffset = 0;

  for (const mesh of meshes) {
    const world = worldMatrixWithOffset(mesh.matrix, modelCenterOffset);

    for (let i = 0; i < mesh.positions.length; i += 3) {
      const [x, y, z] = transformVertex(
        world,
        mesh.positions[i],
        mesh.positions[i + 1],
        mesh.positions[i + 2],
      );
      vertices.push(x, y, z);
    }

    for (let i = 0; i < mesh.indices.length; i++) {
      faces.push(mesh.indices[i] + vertexOffset);
    }
    vertexOffset += mesh.positions.length / 3;
  }

  if (!vertices.length || !faces.length) return null;
  return { vertices, faces };
}

export function exportElementMeshPayload(
  element: ParsedIfcElement,
  modelCenterOffset: [number, number, number] = [0, 0, 0],
): ServerMeshPayload | null {
  return placedMeshesToPayload(element.meshBuffers, modelCenterOffset);
}

export function entityIdFromExpressId(expressId: number | string): string {
  const str = String(expressId);
  return str.startsWith('ifc-') ? str : `ifc-${str}`;
}

/** User-facing message for web-ifc / Emscripten aborts. */
export function formatIfcLoadError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/aborted/i.test(msg)) {
    return (
      'IFC geometry engine crashed (WebAssembly Aborted). ' +
      'This is often caused by loading the same model twice in WASM or missing wasm files. ' +
      'Restart the app and try again.'
    );
  }
  return msg || 'Failed to load IFC model';
}
