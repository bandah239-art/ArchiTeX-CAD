import {
  IfcAPI,
  IFCBEAM,
  IFCCOLUMN,
  IFCCOVERING,
  IFCDOOR,
  IFCFOOTING,
  IFCMEMBER,
  IFCPLATE,
  IFCROOF,
  IFCSLAB,
  IFCSTAIR,
  IFCWALL,
  IFCWINDOW,
  IFCBUILDINGELEMENTPROXY,
  IFCRAILING,
} from 'web-ifc';
import type { IFCElement } from '../types/ifc';
import {
  mergeMeshes,
  mergeWithPropertyQuantities,
  quantitiesFromMesh,
  type PlacedMeshBuffers,
} from './ifcQuantities';

const WASM_PATH = import.meta.env.BASE_URL + 'wasm/';

const ELEMENT_TYPE_IDS = [
  IFCWALL,
  IFCSLAB,
  IFCBEAM,
  IFCCOLUMN,
  IFCFOOTING,
  IFCDOOR,
  IFCWINDOW,
  IFCROOF,
  IFCSTAIR,
  IFCCOVERING,
  IFCMEMBER,
  IFCPLATE,
  IFCRAILING,
  IFCBUILDINGELEMENTPROXY,
];

let sharedApi: IfcAPI | null = null;
let initPromise: Promise<IfcAPI> | null = null;
/** Serialize parse/load — concurrent StreamAllMeshes aborts WASM. */
let parseChain: Promise<unknown> = Promise.resolve();
let lastOpenedModelId: number | null = null;

/** web-ifc StreamAllMeshes callbacks may return plain objects without delete(). */
export function releaseIfcWasmObject(obj: { delete?: () => void } | null | undefined): void {
  try {
    if (obj && typeof obj.delete === 'function') {
      obj.delete();
    }
  } catch {
    /* already freed or unsupported in this web-ifc build */
  }
}

export async function getIfcApi(): Promise<IfcAPI> {
  if (sharedApi) return sharedApi;
  if (!initPromise) {
    initPromise = (async () => {
      const api = new IfcAPI();
      api.SetWasmPath(WASM_PATH, true);
      // forceSingleThread=true — avoids worker/mt wasm path that can abort in Electron.
      await api.Init(undefined, true);
      sharedApi = api;
      return api;
    })().catch((err) => {
      initPromise = null;
      sharedApi = null;
      throw err;
    });
  }
  return initPromise;
}

export interface ParsedIfcElement extends IFCElement {
  expressId: number;
  meshBuffers: PlacedMeshBuffers[];
}

export interface IfcParseResult {
  modelId: number;
  elements: ParsedIfcElement[];
  elementByExpressId: Map<number, ParsedIfcElement>;
  triangleCount: number;
  bounds: { min: [number, number, number]; max: [number, number, number] };
}

function readPropValue(val: unknown): string | number | undefined {
  if (val == null) return undefined;
  if (typeof val === 'string' || typeof val === 'number') return val;
  if (typeof val === 'object' && val !== null && 'value' in val) {
    const v = (val as { value: unknown }).value;
    if (typeof v === 'string' || typeof v === 'number') return v;
  }
  return undefined;
}

function extractProperties(api: IfcAPI, modelId: number, expressId: number): Record<string, string | number> {
  const props: Record<string, string | number> = {};
  try {
    const line = api.GetLine(modelId, expressId, true);
    const name = readPropValue(line.Name);
    const globalId = readPropValue(line.GlobalId);
    const objectType = readPropValue(line.ObjectType);
    if (name) props.Name = name;
    if (globalId) props.GlobalId = globalId;
    if (objectType) props.ObjectType = objectType;

    const definedBy = line.IsDefinedBy;
    if (!Array.isArray(definedBy)) return props;

    for (const relRef of definedBy) {
      const relId = readPropValue(relRef);
      if (typeof relId !== 'number') continue;
      const rel = api.GetLine(modelId, relId, true);
      if (rel.type !== 'IfcRelDefinesByProperties') continue;

      const psetId = readPropValue(rel.RelatingPropertyDefinition);
      if (typeof psetId !== 'number') continue;
      const pset = api.GetLine(modelId, psetId, true);

      if (pset.type === 'IfcElementQuantity' && Array.isArray(pset.Quantities)) {
        for (const qRef of pset.Quantities) {
          const qId = readPropValue(qRef);
          if (typeof qId !== 'number') continue;
          const q = api.GetLine(modelId, qId, true);
          const qName = readPropValue(q.Name);
          if (typeof qName !== 'string') continue;
          if (q.type === 'IfcQuantityVolume') {
            const v = readPropValue(q.VolumeValue);
            if (typeof v === 'number') props[qName] = v;
          } else if (q.type === 'IfcQuantityArea') {
            const v = readPropValue(q.AreaValue);
            if (typeof v === 'number') props[qName] = v;
          } else if (q.type === 'IfcQuantityLength') {
            const v = readPropValue(q.LengthValue);
            if (typeof v === 'number') props[qName] = v;
          }
        }
      }

      if (pset.type === 'IfcPropertySet' && Array.isArray(pset.HasProperties)) {
        for (const pRef of pset.HasProperties) {
          const pId = readPropValue(pRef);
          if (typeof pId !== 'number') continue;
          const p = api.GetLine(modelId, pId, true);
          const pName = readPropValue(p.Name);
          if (typeof pName !== 'string') continue;
          const val =
            readPropValue(p.NominalValue) ??
            readPropValue(p.LengthValue) ??
            readPropValue(p.AreaValue) ??
            readPropValue(p.VolumeValue);
          if (val !== undefined) props[pName] = val;
        }
      }
    }
  } catch {
    // Some lines fail on malformed IFC; skip silently.
  }
  return props;
}

function resolveTypeName(api: IfcAPI, modelId: number, expressId: number): string {
  try {
    const typeInfo = api.GetLineType(modelId, expressId);
    if (typeInfo?.typeName) return typeInfo.typeName;
  } catch {
    /* ignore */
  }
  return 'IfcBuildingElementProxy';
}

function extractMeshBuffers(api: IfcAPI, modelId: number, geometryExpressId: number): PlacedMeshBuffers | null {
  try {
    const geom = api.GetGeometry(modelId, geometryExpressId);
    const positions = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
    const indices = api.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());
    releaseIfcWasmObject(geom);
    if (positions.length < 9 || indices.length < 3) return null;
    return { positions, indices };
  } catch {
    return null;
  }
}

function updateGlobalBounds(
  global: { min: [number, number, number]; max: [number, number, number] },
  local: { min: [number, number, number]; max: [number, number, number] }
) {
  for (let i = 0; i < 3; i++) {
    global.min[i] = Math.min(global.min[i], local.min[i]);
    global.max[i] = Math.max(global.max[i], local.max[i]);
  }
}

export async function parseIfcBuffer(buffer: ArrayBuffer): Promise<IfcParseResult> {
  const task = parseChain.then(() => parseIfcBufferInner(buffer));
  parseChain = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}

async function parseIfcBufferInner(buffer: ArrayBuffer): Promise<IfcParseResult> {
  const api = await getIfcApi();
  if (lastOpenedModelId !== null) {
    closeIfcModel(api, lastOpenedModelId);
    lastOpenedModelId = null;
  }
  const modelId = api.OpenModel(new Uint8Array(buffer));
  lastOpenedModelId = modelId;

  const meshByExpressId = new Map<number, PlacedMeshBuffers[]>();
  let triangleCount = 0;

  api.StreamAllMeshes(modelId, (flatMesh) => {
    const expressId = flatMesh.expressID;
    const geoms = flatMesh.geometries;
    const buffers: PlacedMeshBuffers[] = [];

    for (let g = 0; g < geoms.size(); g++) {
      const placed = geoms.get(g);
      const mesh = extractMeshBuffers(api, modelId, placed.geometryExpressID);
      if (mesh) {
        buffers.push({
          ...mesh,
          matrix: Array.from(placed.flatTransformation),
        });
        triangleCount += mesh.indices.length / 3;
      }
    }

    if (buffers.length) {
      const existing = meshByExpressId.get(expressId) ?? [];
      meshByExpressId.set(expressId, [...existing, ...buffers]);
    }
    releaseIfcWasmObject(flatMesh);
  });

  const elementByExpressId = new Map<number, ParsedIfcElement>();
  const globalBounds = {
    min: [Infinity, Infinity, Infinity] as [number, number, number],
    max: [-Infinity, -Infinity, -Infinity] as [number, number, number],
  };

  const expressIds = new Set<number>();
  for (const typeId of ELEMENT_TYPE_IDS) {
    const ids = api.GetLineIDsWithType(modelId, typeId);
    for (let i = 0; i < ids.size(); i++) {
      expressIds.add(ids.get(i));
    }
  }
  for (const id of meshByExpressId.keys()) {
    expressIds.add(id);
  }

  for (const expressId of expressIds) {
    const meshBuffers = meshByExpressId.get(expressId) ?? [];
    const properties = extractProperties(api, modelId, expressId);
    const type = resolveTypeName(api, modelId, expressId);
    const name =
      (typeof properties.Name === 'string' ? properties.Name : undefined) ??
      `${type.replace('Ifc', '')}-${expressId}`;
    const globalId =
      (typeof properties.GlobalId === 'string' ? properties.GlobalId : undefined) ??
      `EXP-${expressId}`;

    let length: number | undefined;
    let width: number | undefined;
    let height: number | undefined;
    let volume: number | undefined;
    let area: number | undefined;

    if (meshBuffers.length > 0) {
      const merged = mergeMeshes(meshBuffers);
      const geom = quantitiesFromMesh(merged);
      const mergedQty = mergeWithPropertyQuantities(geom, properties);
      length = mergedQty.length;
      width = mergedQty.width;
      height = mergedQty.height;
      volume = mergedQty.volume;
      area = mergedQty.surfaceArea;
      updateGlobalBounds(globalBounds, geom.bounds);
    } else {
      const vol = properties.Volume ?? properties.NetVolume;
      const ar = properties.Area ?? properties.NetArea;
      if (typeof vol === 'number') volume = vol;
      if (typeof ar === 'number') area = ar;
    }

    const element: ParsedIfcElement = {
      id: String(expressId),
      expressId,
      globalId,
      type,
      name,
      length,
      width,
      height,
      volume,
      area,
      properties,
      meshBuffers,
    };
    elementByExpressId.set(expressId, element);
  }

  if (!Number.isFinite(globalBounds.min[0])) {
    globalBounds.min = [0, 0, 0];
    globalBounds.max = [0, 0, 0];
  }

  return {
    modelId,
    elements: Array.from(elementByExpressId.values()),
    elementByExpressId,
    triangleCount,
    bounds: globalBounds,
  };
}

export function closeIfcModel(api: IfcAPI, modelId: number): void {
  try {
    api.CloseModel(modelId);
    if (lastOpenedModelId === modelId) lastOpenedModelId = null;
  } catch {
    /* ignore */
  }
}
