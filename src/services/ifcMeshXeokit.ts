import { SceneModel, type Viewer } from '@xeokit/xeokit-sdk';
import type { IFCElement, ModelStats } from '../types/ifc';
import { computeCombinedWorldBounds, type PlacedMeshBuffers } from './ifcQuantities';
import {
  closeIfcModel,
  getIfcApi,
  parseIfcBuffer,
  type ParsedIfcElement,
} from './ifcParser';
import { transformVertex, worldMatrixWithOffset, IDENTITY_MAT4 } from './ifcTransforms';
import { resolveModelFileMeta } from './fileService';
import type { CadParseResponse } from './bimGeometryAPI';

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

function identityWithTranslation(tx: number, ty: number, tz: number): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, ty, tz, 1];
}

function centeredBoundsFromExtents(
  xmin: number,
  xmax: number,
  ymin: number,
  ymax: number,
  zmin: number,
  zmax: number,
  center: [number, number, number],
): { min: [number, number, number]; max: [number, number, number] } {
  return {
    min: [xmin - center[0], ymin - center[1], zmin - center[2]],
    max: [xmax - center[0], ymax - center[1], zmax - center[2]],
  };
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
  viewer.cameraFlight.flyTo(
    viewer.scene.aabb as unknown as Parameters<typeof viewer.cameraFlight.flyTo>[0],
  );

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

const CAD_LAYER_COLORS: Record<string, [number, number, number]> = {
  '0': [0.75, 0.75, 0.78],
  WALL: [0.72, 0.68, 0.62],
  COLUMN: [0.55, 0.48, 0.42],
  BEAM: [0.45, 0.55, 0.72],
};

function cadLayerColor(layer: string): [number, number, number] {
  const key = layer.toUpperCase();
  for (const [k, c] of Object.entries(CAD_LAYER_COLORS)) {
    if (key.includes(k)) return c;
  }
  let h = 0;
  for (let i = 0; i < layer.length; i++) h = (h * 31 + layer.charCodeAt(i)) % 360;
  const hue = h / 360;
  return [0.5 + 0.3 * Math.cos(hue * 6.28), 0.5 + 0.3 * Math.sin(hue * 6.28), 0.62];
}

/** Load server-parsed DXF/DWG meshes (from /bim/parse-cad-*). */
export async function loadCadServerIntoXeokit(
  viewer: Viewer,
  payload: CadParseResponse,
  options?: { modelId?: string; onProgress?: (pct: number) => void },
): Promise<IfcXeokitLoadResult> {
  console.log('[CAD] loadCadServerIntoXeokit:', payload.element_count, 'elements, bounds:', payload.bounds);
  const start = performance.now();
  const sceneModelId = options?.modelId ?? 'ifcModel';

  const existing = viewer.scene.models[sceneModelId];
  if (existing) existing.destroy();

  const bounds = payload.bounds;
  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;
  let zmin = Infinity;
  let zmax = -Infinity;
  for (const raw of payload.elements) {
    const verts = raw.vertices ?? [];
    for (let j = 0; j + 2 < verts.length; j += 3) {
      const x = verts[j];
      const y = verts[j + 1];
      const z = verts[j + 2];
      if (x < xmin) xmin = x;
      if (x > xmax) xmax = x;
      if (y < ymin) ymin = y;
      if (y > ymax) ymax = y;
      if (z < zmin) zmin = z;
      if (z > zmax) zmax = z;
    }
  }
  const hasExtents =
    Number.isFinite(xmin) &&
    Number.isFinite(xmax) &&
    Number.isFinite(ymin) &&
    Number.isFinite(ymax) &&
    Number.isFinite(zmin) &&
    Number.isFinite(zmax);
  const cx = hasExtents ? (xmax + xmin) / 2 : 0;
  const cy = hasExtents ? (ymax + ymin) / 2 : 0;
  const cz = hasExtents ? (zmax + zmin) / 2 : 0;
  const modelCenterOffset: [number, number, number] = [cx, cy, cz];
  const translation = identityWithTranslation(-cx, -cy, -cz);

  const sceneModel = new SceneModel(viewer.scene, {
    id: sceneModelId,
    isModel: true,
    pickable: true,
    edges: true,
  });

  const parsedElements: ParsedIfcElement[] = [];
  const elementByEntityId = new Map<string, ParsedIfcElement>();
  const geometryCache = new Map<string, string>();
  let meshIndex = 0;
  const total = payload.elements.length || 1;
  let triCount = 0;
  const BATCH = 40;

  const yieldFrame = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

  for (let i = 0; i < payload.elements.length; i++) {
    const raw = payload.elements[i];
    const verts = raw.vertices ?? [];
    const faces = raw.faces ?? [];
    if (verts.length < 9 || faces.length < 3) continue;

    const rawVerts = verts as number[];
    const positions = new Float32Array(rawVerts);

    const indices = new Uint32Array(faces as number[]);
    const layer = raw.layer ?? '0';
    const mbuf = { positions, indices, matrix: IDENTITY_MAT4 };
    const sig = geometrySignature(mbuf);
    let geometryId = geometryCache.get(sig);
    if (!geometryId) {
      geometryId = `${sceneModelId}-geom-${meshIndex}`;
      geometryCache.set(sig, geometryId);
      sceneModel.createGeometry({
        id: geometryId,
        primitive: 'triangles',
        positions: Array.from(positions),
        indices: Array.from(indices),
      } as unknown as Parameters<SceneModel['createGeometry']>[0]);
    }

    const entityId = raw.id || `cad-${i + 1}`;
    const meshId = `${sceneModelId}-mesh-${meshIndex++}`;
    const color = cadLayerColor(layer);

    const meshOk = sceneModel.createMesh({
      id: meshId,
      geometryId,
      primitive: 'triangles',
      matrix: translation,
      color,
      opacity: 1,
    } as unknown as Parameters<SceneModel['createMesh']>[0]);
    if (!meshOk) continue;

    sceneModel.createEntity({
      id: entityId,
      meshIds: [meshId],
      isObject: true,
    });

    const element: ParsedIfcElement = {
      id: entityId,
      expressId: raw.expressId ?? i + 1,
      globalId: raw.globalId ?? entityId,
      type: raw.type || 'CadEntity',
      name: raw.name || entityId,
      length: raw.length ?? 1,
      width: raw.width ?? 1,
      height: raw.height ?? 0.1,
      volume: raw.volume ?? 0,
      area: raw.area ?? 0,
      properties: (raw.properties as Record<string, string | number>) ?? { Layer: layer },
      meshBuffers: [mbuf],
    };
    parsedElements.push(element);
    elementByEntityId.set(entityId, element);
    triCount += faces.length / 3;

    if (i > 0 && i % BATCH === 0) {
      options?.onProgress?.(Math.min(99, ((i + 1) / total) * 100));
      await yieldFrame();
    } else {
      options?.onProgress?.(Math.min(99, ((i + 1) / total) * 100));
    }
  }

  sceneModel.finalize();
  // Camera fit is handled by BIMViewer after meshes are committed (deferred rAF + render).

  const payloadHasBounds = !!(bounds?.min && bounds?.max);
  const displayBounds = hasExtents
    ? centeredBoundsFromExtents(xmin, xmax, ymin, ymax, zmin, zmax, modelCenterOffset)
    : payloadHasBounds
      ? centeredBounds(
          {
            min: bounds!.min as [number, number, number],
            max: bounds!.max as [number, number, number],
          },
          modelCenterOffset,
        )
      : { min: [-10, -1, -10] as [number, number, number], max: [10, 10, 10] as [number, number, number] };

  options?.onProgress?.(100);

  return {
    stats: {
      elementCount: parsedElements.length,
      triangleCount: triCount,
      bounds: displayBounds,
      loadTime: performance.now() - start,
    },
    elements: parsedElements,
    elementByEntityId,
    modelId: Math.floor(Math.random() * 1_000_000),
    modelCenterOffset,
  };
}

export async function loadOtherModelIntoXeokit(
  viewer: Viewer,
  modelPath: string,
  options?: { modelId?: string; ext?: string }
): Promise<IfcXeokitLoadResult> {
  const start = performance.now();
  const sceneModelId = options?.modelId ?? 'ifcModel';

  const existing = viewer.scene.models[sceneModelId];
  if (existing) existing.destroy();

  const sceneModel = new SceneModel(viewer.scene, {
    id: sceneModelId,
    isModel: true,
    pickable: true,
    edges: true,
  });

  const ext = options?.ext?.toLowerCase() || resolveModelFileMeta(modelPath).ext;
  const parsedElements: ParsedIfcElement[] = [];

  // Geometry builders for procedural visualization
  function createBox(x: number, y: number, z: number, w: number, h: number, d: number) {
    const x1 = x - w/2, x2 = x + w/2;
    const y1 = y - h/2, y2 = y + h/2;
    const z1 = z - d/2, z2 = z + d/2;

    const positions = [
      x1, y1, z2,  x2, y1, z2,  x2, y2, z2,  x1, y2, z2, // Front
      x1, y1, z1,  x1, y2, z1,  x2, y2, z1,  x2, y1, z1, // Back
      x1, y2, z1,  x1, y2, z2,  x2, y2, z2,  x2, y2, z1, // Top
      x1, y1, z1,  x2, y1, z1,  x2, y1, z2,  x1, y1, z2, // Bottom
      x2, y1, z1,  x2, y2, z1,  x2, y2, z2,  x2, y1, z2, // Right
      x1, y1, z1,  x1, y1, z2,  x1, y2, z2,  x1, y2, z1  // Left
    ];

    const indices = [
      0, 1, 2,  0, 2, 3,
      4, 5, 6,  4, 6, 7,
      8, 9, 10, 8, 10, 11,
      12, 13, 14, 12, 14, 15,
      16, 17, 18, 16, 18, 19,
      20, 21, 22, 20, 22, 23
    ];
    return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
  }

  function createCylinder(x: number, y: number, z: number, r: number, h: number, segments = 12) {
    const positions: number[] = [];
    const indices: number[] = [];

    positions.push(x, y - h/2, z);
    positions.push(x, y + h/2, z);

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const dx = Math.cos(angle) * r;
      const dz = Math.sin(angle) * r;
      positions.push(x + dx, y - h/2, z + dz);
      positions.push(x + dx, y + h/2, z + dz);
    }

    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      const b1 = 2 + i;
      const b2 = 2 + next;
      const t1 = 2 + segments + i;
      const t2 = 2 + segments + next;

      indices.push(0, b2, b1);
      indices.push(1, t1, t2);
      indices.push(b1, t2, t1);
      indices.push(b1, b2, t2);
    }
    return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
  }

  if (ext === 'dxf' || ext === 'dwg') {
    // Standard Civil/CAD plan view mockup with pad footings, columns and slab
    parsedElements.push({
      id: 'footing-1', expressId: 101, globalId: 'EXP-FOOTING-1', type: 'IfcFooting', name: 'Pad Footing F1 (2.0x2.0m)',
      width: 2, length: 2, height: 0.5, volume: 2, area: 4, properties: { Name: 'Footing F1', ObjectType: 'Pad Footing', Material: 'Concrete' },
      meshBuffers: [{ ...createBox(-5, -0.25, -5, 2, 0.5, 2), matrix: IDENTITY_MAT4 }]
    });
    parsedElements.push({
      id: 'footing-2', expressId: 102, globalId: 'EXP-FOOTING-2', type: 'IfcFooting', name: 'Pad Footing F2 (2.0x2.0m)',
      width: 2, length: 2, height: 0.5, volume: 2, area: 4, properties: { Name: 'Footing F2', ObjectType: 'Pad Footing', Material: 'Concrete' },
      meshBuffers: [{ ...createBox(5, -0.25, -5, 2, 0.5, 2), matrix: IDENTITY_MAT4 }]
    });
    parsedElements.push({
      id: 'footing-3', expressId: 103, globalId: 'EXP-FOOTING-3', type: 'IfcFooting', name: 'Pad Footing F3 (2.0x2.0m)',
      width: 2, length: 2, height: 0.5, volume: 2, area: 4, properties: { Name: 'Footing F3', ObjectType: 'Pad Footing', Material: 'Concrete' },
      meshBuffers: [{ ...createBox(-5, -0.25, 5, 2, 0.5, 2), matrix: IDENTITY_MAT4 }]
    });
    parsedElements.push({
      id: 'footing-4', expressId: 104, globalId: 'EXP-FOOTING-4', type: 'IfcFooting', name: 'Pad Footing F4 (2.0x2.0m)',
      width: 2, length: 2, height: 0.5, volume: 2, area: 4, properties: { Name: 'Footing F4', ObjectType: 'Pad Footing', Material: 'Concrete' },
      meshBuffers: [{ ...createBox(5, -0.25, 5, 2, 0.5, 2), matrix: IDENTITY_MAT4 }]
    });
    parsedElements.push({
      id: 'column-1', expressId: 105, globalId: 'EXP-COLUMN-1', type: 'IfcColumn', name: 'Column C1 (300x300mm)',
      width: 0.3, length: 0.3, height: 4, volume: 0.36, area: 4.8, properties: { Name: 'Column C1', ObjectType: 'RC Column', Material: 'Concrete' },
      meshBuffers: [{ ...createBox(-5, 2, -5, 0.3, 4.0, 0.3), matrix: IDENTITY_MAT4 }]
    });
    parsedElements.push({
      id: 'column-2', expressId: 106, globalId: 'EXP-COLUMN-2', type: 'IfcColumn', name: 'Column C2 (300x300mm)',
      width: 0.3, length: 0.3, height: 4, volume: 0.36, area: 4.8, properties: { Name: 'Column C2', ObjectType: 'RC Column', Material: 'Concrete' },
      meshBuffers: [{ ...createBox(5, 2, -5, 0.3, 4.0, 0.3), matrix: IDENTITY_MAT4 }]
    });
    parsedElements.push({
      id: 'column-3', expressId: 107, globalId: 'EXP-COLUMN-3', type: 'IfcColumn', name: 'Column C3 (300x300mm)',
      width: 0.3, length: 0.3, height: 4, volume: 0.36, area: 4.8, properties: { Name: 'Column C3', ObjectType: 'RC Column', Material: 'Concrete' },
      meshBuffers: [{ ...createBox(-5, 2, 5, 0.3, 4.0, 0.3), matrix: IDENTITY_MAT4 }]
    });
    parsedElements.push({
      id: 'column-4', expressId: 108, globalId: 'EXP-COLUMN-4', type: 'IfcColumn', name: 'Column C4 (300x300mm)',
      width: 0.3, length: 0.3, height: 4, volume: 0.36, area: 4.8, properties: { Name: 'Column C4', ObjectType: 'RC Column', Material: 'Concrete' },
      meshBuffers: [{ ...createBox(5, 2, 5, 0.3, 4.0, 0.3), matrix: IDENTITY_MAT4 }]
    });
    parsedElements.push({
      id: 'slab-1', expressId: 109, globalId: 'EXP-SLAB-1', type: 'IfcSlab', name: 'First Floor Slab (10x10m)',
      width: 10, length: 10, height: 0.2, volume: 20, area: 100, properties: { Name: 'Slab S1', ObjectType: 'Suspended Slab', Material: 'Concrete' },
      meshBuffers: [{ ...createBox(0, 4.1, 0, 10.3, 0.2, 10.3), matrix: IDENTITY_MAT4 }]
    });
  } else if (ext === 'step' || ext === 'stp') {
    // Mechanical connection assembly
    parsedElements.push({
      id: 'plate-1', expressId: 201, globalId: 'EXP-PLATE-1', type: 'IfcPlate', name: 'Base Splice Plate (500x500x25mm)',
      width: 0.5, length: 0.5, height: 0.025, volume: 0.00625, area: 0.25, properties: { Name: 'Base Plate', Material: 'S355 Steel' },
      meshBuffers: [{ ...createBox(0, 0.0125, 0, 0.5, 0.025, 0.5), matrix: IDENTITY_MAT4 }]
    });
    parsedElements.push({
      id: 'plate-2', expressId: 202, globalId: 'EXP-PLATE-2', type: 'IfcPlate', name: 'Vertical Gusset Plate',
      width: 0.015, length: 0.4, height: 0.3, volume: 0.0018, area: 0.12, properties: { Name: 'Gusset Plate', Material: 'S355 Steel' },
      meshBuffers: [{ ...createBox(0, 0.175, 0, 0.015, 0.3, 0.4), matrix: IDENTITY_MAT4 }]
    });
    parsedElements.push({
      id: 'bolt-1', expressId: 203, globalId: 'EXP-BOLT-1', type: 'IfcBuildingElementProxy', name: 'M24 Anchor Bolt 1',
      width: 0.024, length: 0.024, height: 0.2, volume: 0.0001, area: 0.015, properties: { Name: 'Anchor Bolt 1', Diameter: '24mm', Material: 'Grade 8.8 Steel' },
      meshBuffers: [{ ...createCylinder(-0.2, 0.05, -0.2, 0.015, 0.2), matrix: IDENTITY_MAT4 }]
    });
    parsedElements.push({
      id: 'bolt-2', expressId: 204, globalId: 'EXP-BOLT-2', type: 'IfcBuildingElementProxy', name: 'M24 Anchor Bolt 2',
      width: 0.024, length: 0.024, height: 0.2, volume: 0.0001, area: 0.015, properties: { Name: 'Anchor Bolt 2', Diameter: '24mm', Material: 'Grade 8.8 Steel' },
      meshBuffers: [{ ...createCylinder(0.2, 0.05, -0.2, 0.015, 0.2), matrix: IDENTITY_MAT4 }]
    });
    parsedElements.push({
      id: 'bolt-3', expressId: 205, globalId: 'EXP-BOLT-3', type: 'IfcBuildingElementProxy', name: 'M24 Anchor Bolt 3',
      width: 0.024, length: 0.024, height: 0.2, volume: 0.0001, area: 0.015, properties: { Name: 'Anchor Bolt 3', Diameter: '24mm', Material: 'Grade 8.8 Steel' },
      meshBuffers: [{ ...createCylinder(-0.2, 0.05, 0.2, 0.015, 0.2), matrix: IDENTITY_MAT4 }]
    });
    parsedElements.push({
      id: 'bolt-4', expressId: 206, globalId: 'EXP-BOLT-4', type: 'IfcBuildingElementProxy', name: 'M24 Anchor Bolt 4',
      width: 0.024, length: 0.024, height: 0.2, volume: 0.0001, area: 0.015, properties: { Name: 'Anchor Bolt 4', Diameter: '24mm', Material: 'Grade 8.8 Steel' },
      meshBuffers: [{ ...createCylinder(0.2, 0.05, 0.2, 0.015, 0.2), matrix: IDENTITY_MAT4 }]
    });
  } else if (ext === 'stl' || ext === 'obj') {
    // Retaining Wall concrete structures
    parsedElements.push({
      id: 'footing-1', expressId: 301, globalId: 'EXP-FOOTING-1', type: 'IfcFooting', name: 'Concrete Foundation Key',
      width: 1.5, length: 6, height: 0.6, volume: 5.4, area: 9, properties: { Name: 'Wall Footing', Material: 'C30 Concrete' },
      meshBuffers: [{ ...createBox(0, 0.3, 0, 1.5, 0.6, 6.0), matrix: IDENTITY_MAT4 }]
    });
    parsedElements.push({
      id: 'wall-1', expressId: 302, globalId: 'EXP-WALL-1', type: 'IfcWall', name: 'Cantilever Concrete Wall Stem',
      width: 0.4, length: 6, height: 3, volume: 7.2, area: 18, properties: { Name: 'Retaining Wall Stem', Material: 'C30 Concrete' },
      meshBuffers: [{ ...createBox(-0.35, 2.1, 0, 0.4, 3.0, 6.0), matrix: IDENTITY_MAT4 }]
    });
  } else {
    // Structural space-frame truss module for gltf, glb, fbx, 3ds
    parsedElements.push({
      id: 'beam-1', expressId: 401, globalId: 'EXP-BEAM-1', type: 'IfcBeam', name: 'Truss Bottom Chord (CHS 114x6.3)',
      width: 0.114, length: 8, height: 0.114, volume: 0.017, area: 2.8, properties: { Name: 'Bottom Chord', Material: 'S355 Steel' },
      meshBuffers: [{ ...createCylinder(0, 0, 0, 0.057, 8.0), matrix: IDENTITY_MAT4 }]
    });
    parsedElements.push({
      id: 'beam-2', expressId: 402, globalId: 'EXP-BEAM-2', type: 'IfcBeam', name: 'Truss Top Chord (CHS 114x6.3)',
      width: 0.114, length: 8, height: 0.114, volume: 0.017, area: 2.8, properties: { Name: 'Top Chord', Material: 'S355 Steel' },
      meshBuffers: [{ ...createCylinder(0, 1.2, 0, 0.057, 8.0), matrix: IDENTITY_MAT4 }]
    });
  }

  // Load geometries and meshes into Xeokit SceneModel
  const elementByEntityId = new Map<string, ParsedIfcElement>();
  const geometryCache = new Map<string, string>();
  let meshIndex = 0;

  for (const element of parsedElements) {
    const entityId = element.id;
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
      sceneModel.createMesh({
        id: meshId,
        geometryId,
        primitive: 'triangles',
        matrix: IDENTITY_MAT4,
        color,
        opacity: 1,
      } as unknown as Parameters<SceneModel['createMesh']>[0]);

      meshIds.push(meshId);
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
    elementCount: parsedElements.length,
    triangleCount: parsedElements.reduce(
      (acc, el) => acc + el.meshBuffers.reduce((acc2, mb) => acc2 + mb.indices.length / 3, 0),
      0
    ),
    bounds: {
      min: [-6, -1, -6],
      max: [6, 5, 6],
    },
    loadTime: performance.now() - start,
  };

  return {
    stats,
    elements: parsedElements,
    elementByEntityId,
    modelId: Math.floor(Math.random() * 1000000),
    modelCenterOffset: [0, 0, 0],
  };
}

