/** Mesh-based geometric quantity extraction (volume, area, length, bounding box). */

import { transformPositions, worldMatrixFromPlacement } from './ifcTransforms';

export interface MeshBuffers {
  positions: Float32Array;
  indices: Uint32Array;
}

/** Mesh geometry with optional IFC placement matrix (column-major 4×4). */
export interface PlacedMeshBuffers extends MeshBuffers {
  matrix?: number[];
}

export interface ElementQuantities {
  volume: number;
  surfaceArea: number;
  length: number;
  width: number;
  height: number;
  bounds: { min: [number, number, number]; max: [number, number, number] };
}

function vec3(a: number[], b: number[], c: number[]): number[] {
  return [
    b[0] - a[0],
    b[1] - a[1],
    b[2] - a[2],
    c[0] - a[0],
    c[1] - a[1],
    c[2] - a[2],
  ];
}

function cross(ab: number[]): number[] {
  return [
    ab[1] * ab[5] - ab[2] * ab[4],
    ab[2] * ab[3] - ab[0] * ab[5],
    ab[0] * ab[4] - ab[1] * ab[3],
  ];
}

function length3(v: number[]): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function scalarTriple(a: number[], b: number[], c: number[]): number {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cr = cross([...ab, ...ac]);
  return ab[0] * cr[0] + ab[1] * cr[1] + ab[2] * cr[2];
}

/** Signed volume of a closed triangle mesh (m³). Uses origin as reference point. */
export function meshVolume(positions: Float32Array, indices: Uint32Array): number {
  let volume = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i] * 3;
    const i1 = indices[i + 1] * 3;
    const i2 = indices[i + 2] * 3;
    const a = [positions[i0], positions[i0 + 1], positions[i0 + 2]];
    const b = [positions[i1], positions[i1 + 1], positions[i1 + 2]];
    const c = [positions[i2], positions[i2 + 1], positions[i2 + 2]];
    volume += scalarTriple(a, b, c) / 6;
  }
  return Math.abs(volume);
}

/** Total surface area of triangle mesh (m²). */
export function meshSurfaceArea(positions: Float32Array, indices: Uint32Array): number {
  let area = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i] * 3;
    const i1 = indices[i + 1] * 3;
    const i2 = indices[i + 2] * 3;
    const a = [positions[i0], positions[i0 + 1], positions[i0 + 2]];
    const b = [positions[i1], positions[i1 + 1], positions[i1 + 2]];
    const c = [positions[i2], positions[i2 + 1], positions[i2 + 2]];
    const ab = vec3(a, b, c);
    area += length3(cross(ab)) * 0.5;
  }
  return area;
}

export function meshBounds(positions: Float32Array): {
  min: [number, number, number];
  max: [number, number, number];
} {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    min[0] = Math.min(min[0], positions[i]);
    min[1] = Math.min(min[1], positions[i + 1]);
    min[2] = Math.min(min[2], positions[i + 2]);
    max[0] = Math.max(max[0], positions[i]);
    max[1] = Math.max(max[1], positions[i + 1]);
    max[2] = Math.max(max[2], positions[i + 2]);
  }
  return { min, max };
}

/** Axis-aligned bounding box dimensions sorted largest → smallest (m). */
export function bboxDimensions(bounds: {
  min: [number, number, number];
  max: [number, number, number];
}): { length: number; width: number; height: number } {
  const dx = Math.abs(bounds.max[0] - bounds.min[0]);
  const dy = Math.abs(bounds.max[1] - bounds.min[1]);
  const dz = Math.abs(bounds.max[2] - bounds.min[2]);
  const sorted = [dx, dy, dz].sort((a, b) => b - a);
  return { length: sorted[0], width: sorted[1], height: sorted[2] };
}

/** Merge multiple mesh buffers into one for quantity aggregation. */
export function mergeMeshes(meshes: MeshBuffers[]): MeshBuffers {
  if (meshes.length === 1) return meshes[0];
  const positions: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;
  for (const mesh of meshes) {
    for (let i = 0; i < mesh.positions.length; i++) {
      positions.push(mesh.positions[i]);
    }
    for (let i = 0; i < mesh.indices.length; i++) {
      indices.push(mesh.indices[i] + vertexOffset);
    }
    vertexOffset += mesh.positions.length / 3;
  }
  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
}

/** Merge IFC meshes with placement applied (world space, xeokit Y-up). */
export function mergePlacedMeshes(meshes: PlacedMeshBuffers[]): MeshBuffers {
  if (!meshes.length) return { positions: new Float32Array(0), indices: new Uint32Array(0) };
  if (meshes.length === 1) {
    const world = worldMatrixFromPlacement(meshes[0].matrix);
    return {
      positions: transformPositions(meshes[0].positions, world),
      indices: meshes[0].indices,
    };
  }
  const buffers: MeshBuffers[] = meshes.map((mesh) => ({
    positions: transformPositions(mesh.positions, worldMatrixFromPlacement(mesh.matrix)),
    indices: mesh.indices,
  }));
  return mergeMeshes(buffers);
}

export function quantitiesFromMesh(mesh: MeshBuffers): ElementQuantities {
  const bounds = meshBounds(mesh.positions);
  const dims = bboxDimensions(bounds);
  const volume = meshVolume(mesh.positions, mesh.indices);
  const surfaceArea = meshSurfaceArea(mesh.positions, mesh.indices);
  return {
    volume,
    surfaceArea,
    length: dims.length,
    width: dims.width,
    height: dims.height,
    bounds,
  };
}

/** Prefer IFC QTO property when present and positive. */
export function mergeWithPropertyQuantities(
  geom: ElementQuantities,
  properties: Record<string, string | number>
): ElementQuantities {
  const num = (keys: string[], maxReasonable: number): number | undefined => {
    for (const k of keys) {
      const v = properties[k];
      let n: number | undefined;
      if (typeof v === 'number' && v > 0) n = v;
      else if (typeof v === 'string') {
        const parsed = parseFloat(v);
        if (!Number.isNaN(parsed) && parsed > 0) n = parsed;
      }
      if (n !== undefined && n <= maxReasonable) return n;
    }
    return undefined;
  };

  return {
    ...geom,
    volume: num(['Volume', 'NetVolume', 'GrossVolume', 'volume'], 1e6) ?? geom.volume,
    surfaceArea: num(['Area', 'NetArea', 'GrossArea', 'area'], 1e6) ?? geom.surfaceArea,
    length: num(['Length', 'NetLength', 'length'], 1e4) ?? geom.length,
  };
}
