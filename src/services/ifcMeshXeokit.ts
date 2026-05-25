import { SceneModel, type Viewer } from '@xeokit/xeokit-sdk';
import type { IFCElement, ModelStats } from '../types/ifc';
import type { PlacedMeshBuffers } from './ifcQuantities';
import {
  closeIfcModel,
  getIfcApi,
  parseIfcBuffer,
  type ParsedIfcElement,
} from './ifcParser';

export interface ServerMeshPayload {
  vertices: number[];
  faces: number[];
}

/** IFC Z-up → xeokit Y-up (rotate -90° about X). */
const IFC_TO_XEOKIT = [
  1, 0, 0, 0,
  0, 0, 1, 0,
  0, -1, 0, 0,
  0, 0, 0, 1,
];

const IDENTITY_MAT4 = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

function multiplyMat4(a: number[], b: number[]): number[] {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return out;
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
        geometryId = `geom-${meshIndex}`;
        geometryCache.set(sig, geometryId);
        sceneModel.createGeometry({
          id: geometryId,
          primitive: 'triangles',
          positions: Array.from(mbuf.positions),
          indices: Array.from(mbuf.indices),
        } as unknown as Parameters<SceneModel['createGeometry']>[0]);
      }

      const meshId = `mesh-${meshIndex++}`;
      const matrix = multiplyMat4(IFC_TO_XEOKIT, mbuf.matrix ?? IDENTITY_MAT4);

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

  const stats: ModelStats = {
    elementCount: parsed.elements.filter((e) => e.meshBuffers.length > 0).length,
    triangleCount: parsed.triangleCount,
    bounds: {
      min: [...parsed.bounds.min],
      max: [...parsed.bounds.max],
    },
    loadTime: performance.now() - start,
  };

  options?.onProgress?.(100);

  return {
    stats,
    elements: parsed.elements,
    elementByEntityId,
    modelId: parsed.modelId,
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

function transformVertex(matrix: number[], x: number, y: number, z: number): [number, number, number] {
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ];
}

/** Merge placed IFC meshes into flat { vertices, faces } for server geometry ops (xeokit Y-up). */
export function placedMeshesToPayload(meshes: PlacedMeshBuffers[]): ServerMeshPayload | null {
  if (!meshes.length) return null;

  const vertices: number[] = [];
  const faces: number[] = [];
  let vertexOffset = 0;

  for (const mesh of meshes) {
    const placement = mesh.matrix ?? IDENTITY_MAT4;
    const world = multiplyMat4(IFC_TO_XEOKIT, placement);

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

export function exportElementMeshPayload(element: ParsedIfcElement): ServerMeshPayload | null {
  return placedMeshesToPayload(element.meshBuffers);
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
