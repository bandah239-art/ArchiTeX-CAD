import { SceneModel, type Viewer } from '@xeokit/xeokit-sdk';
import type { IFCElement, ModelStats } from '../types/ifc';
import {
  closeIfcModel,
  getIfcApi,
  parseIfcBuffer,
  type ParsedIfcElement,
} from './ifcParser';

/** IFC Z-up → xeokit Y-up (rotate -90° about X). */
const IFC_TO_XEOKIT = [
  1, 0, 0, 0,
  0, 0, 1, 0,
  0, -1, 0, 0,
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

export interface IfcXeokitLoadResult {
  stats: ModelStats;
  elements: ParsedIfcElement[];
  elementByEntityId: Map<string, ParsedIfcElement>;
  modelId: number;
}

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
  const api = await getIfcApi();
  const elementByEntityId = new Map<string, ParsedIfcElement>();

  const sceneModel = new SceneModel(viewer.scene, {
    id: sceneModelId,
    isModel: true,
    pickable: true,
    edges: true,
  });

  const geometryCache = new Map<number, string>();
  let meshIndex = 0;
  let processed = 0;
  const totalMeshes = parsed.elements.reduce((n, el) => n + el.meshBuffers.length, 0) || 1;

  api.StreamAllMeshes(parsed.modelId, (flatMesh) => {
    const expressId = flatMesh.expressID;
    const element = parsed.elementByExpressId.get(expressId);
    const entityId = `ifc-${expressId}`;
    const meshIds: string[] = [];
    const color = ifcTypeColor(element?.type ?? 'IfcBuildingElementProxy');

    const geoms = flatMesh.geometries;
    for (let g = 0; g < geoms.size(); g++) {
      const placed = geoms.get(g);
      const geomExpressId = placed.geometryExpressID;
      let geometryId = geometryCache.get(geomExpressId);

      if (!geometryId) {
        const geom = api.GetGeometry(parsed.modelId, geomExpressId);
        const positions = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
        const indices = api.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());
        geom.delete();

        geometryId = `geom-${geomExpressId}`;
        geometryCache.set(geomExpressId, geometryId);
        sceneModel.createGeometry({
          id: geometryId,
          primitive: 'triangles',
          positions: Array.from(positions),
          indices: Array.from(indices),
        } as unknown as Parameters<SceneModel['createGeometry']>[0]);
      }

      const meshId = `mesh-${meshIndex++}`;
      const matrix = multiplyMat4(IFC_TO_XEOKIT, placed.flatTransformation);

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
      if (element) elementByEntityId.set(entityId, element);
    }

    flatMesh.delete();
  });

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
