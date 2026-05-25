import { ReadableGeometry, buildPlaneGeometry } from '@xeokit/xeokit-sdk';
import type { Scene } from '@xeokit/xeokit-sdk';
import type { SketchPoint } from '../store/drawStore';
import { bounds2d } from './sketchGeometry';

export function openRing(points: SketchPoint[]): SketchPoint[] {
  if (points.length < 3) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (Math.hypot(first.x - last.x, first.z - last.z) < 1e-4) {
    return points.slice(0, -1);
  }
  return points;
}

function cross2d(a: SketchPoint, b: SketchPoint, c: SketchPoint): number {
  return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
}

function pointInTriangle2d(p: SketchPoint, a: SketchPoint, b: SketchPoint, c: SketchPoint): boolean {
  const s1 = cross2d(a, b, p);
  const s2 = cross2d(b, c, p);
  const s3 = cross2d(c, a, p);
  const hasNeg = s1 < -1e-9 || s2 < -1e-9 || s3 < -1e-9;
  const hasPos = s1 > 1e-9 || s2 > 1e-9 || s3 > 1e-9;
  return !(hasNeg && hasPos);
}

function isConvexVertex(prev: SketchPoint, curr: SketchPoint, next: SketchPoint): boolean {
  return cross2d(prev, curr, next) > 1e-9;
}

/** Ear-clipping triangulation in XZ (handles concave simple polygons). */
export function earClipTriangulateXZ(ring: SketchPoint[]): number[] | null {
  if (ring.length < 3) return null;
  const idx = ring.map((_, i) => i);
  const triangles: number[] = [];
  let guard = 0;

  while (idx.length > 3 && guard++ < ring.length * ring.length) {
    let earFound = false;
    for (let i = 0; i < idx.length; i++) {
      const i0 = idx[(i - 1 + idx.length) % idx.length];
      const i1 = idx[i];
      const i2 = idx[(i + 1) % idx.length];
      const a = ring[i0];
      const b = ring[i1];
      const c = ring[i2];
      if (!isConvexVertex(a, b, c)) continue;
      let contains = false;
      for (const j of idx) {
        if (j === i0 || j === i1 || j === i2) continue;
        if (pointInTriangle2d(ring[j], a, b, c)) {
          contains = true;
          break;
        }
      }
      if (contains) continue;
      triangles.push(i0, i1, i2);
      idx.splice(i, 1);
      earFound = true;
      break;
    }
    if (!earFound) return null;
  }

  if (idx.length === 3) {
    triangles.push(idx[0], idx[1], idx[2]);
  }
  return triangles.length ? triangles : null;
}

export function fanTriangulateXZ(points: SketchPoint[]): {
  positions: number[];
  indices: number[];
} | null {
  const ring = openRing(points);
  if (ring.length < 3) return null;

  const earIndices = earClipTriangulateXZ(ring);
  if (earIndices && earIndices.length >= 3) {
    const positions: number[] = [];
    for (const p of ring) {
      positions.push(p.x, 0, p.z);
    }
    return { positions, indices: earIndices };
  }

  let cx = 0;
  let cz = 0;
  for (const p of ring) {
    cx += p.x;
    cz += p.z;
  }
  cx /= ring.length;
  cz /= ring.length;

  const positions: number[] = [cx, 0, cz];
  const indices: number[] = [];
  for (const p of ring) {
    positions.push(p.x, 0, p.z);
  }
  for (let i = 1; i < ring.length; i++) {
    indices.push(0, i, i + 1);
  }
  indices.push(0, ring.length, 1);
  return { positions, indices };
}

export function isAxisAlignedRectangle(points: SketchPoint[]): boolean {
  const ring = openRing(points);
  if (ring.length !== 4) return false;
  const xs = new Set(ring.map((p) => p.x.toFixed(4)));
  const zs = new Set(ring.map((p) => p.z.toFixed(4)));
  return xs.size === 2 && zs.size === 2;
}

export type PolygonFillGeometry = ReturnType<typeof buildPlaneGeometry> | ReadableGeometry;

export function isOwnedPolygonGeometry(geom: PolygonFillGeometry): geom is ReadableGeometry {
  return geom instanceof ReadableGeometry;
}

/** Horizontal polygon fill geometry in local XZ (mesh Y position set by caller). */
export function buildPolygonFillGeometry(scene: Scene, points: SketchPoint[]): PolygonFillGeometry | null {
  if (isAxisAlignedRectangle(points)) {
    const ring = openRing(points);
    const { cx, cz } = bounds2d(ring);
    let width = 0;
    let depth = 0;
    for (const p of ring) {
      width = Math.max(width, Math.abs(p.x - cx) * 2);
      depth = Math.max(depth, Math.abs(p.z - cz) * 2);
    }
    return new ReadableGeometry(scene, buildPlaneGeometry({ xSize: Math.max(width, 0.1), zSize: Math.max(depth, 0.1) }));
  }

  const tri = fanTriangulateXZ(points);
  if (!tri) return null;
  return new ReadableGeometry(scene, {
    primitive: 'triangles',
    positions: tri.positions,
    indices: tri.indices,
    autoVertexNormals: true,
  });
}

export function polygonFillCenter(points: SketchPoint[]): [number, number, number] {
  const ring = openRing(points);
  if (!ring.length) return [0, 0, 0];
  const cx = ring.reduce((s, p) => s + p.x, 0) / ring.length;
  const cz = ring.reduce((s, p) => s + p.z, 0) / ring.length;
  return [cx, 0, cz];
}
