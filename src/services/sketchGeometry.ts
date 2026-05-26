import type { SketchKind, SketchPoint } from '../store/drawStore';
import type { DrawTool } from '../types/tools';

export const SKETCH_FLOOR_PLANE_ID = 'sketchWorkspace-floor';

export const MIN_POINTS: Record<SketchKind, number> = {
  line: 2,
  polyline: 2,
  wall: 2,
  slab: 3,
  column: 1,
  rectangle: 2,
  polygon: 3,
  pipe: 2,
  'site-boundary': 3,
  circle: 2,
  arc: 3,
  ellipse: 2,
  hatch: 3,
  boundary: 3,
  xline: 2,
  spline: 3,
  point: 1,
  region: 3,
  donut: 2,
  revcloud: 3,
};

/** Sketch tools that place geometry via clicks (not gizmo). */
export const SKETCH_DRAW_TOOLS: DrawTool[] = [
  'line',
  'polyline',
  'wall',
  'slab',
  'column',
  'rectangle',
  'polygon',
  'pipe',
  'site-boundary',
  'circle',
  'arc',
  'ellipse',
  'hatch',
  'boundary',
  'xline',
  'spline',
  'point',
  'region',
  'donut',
  'revcloud',
];

export function isSketchDrawTool(tool: string | null | undefined): boolean {
  return !!tool && SKETCH_DRAW_TOOLS.includes(tool as DrawTool);
}

export function asSketchDrawTool(tool: string | null | undefined): DrawTool | null {
  return isSketchDrawTool(tool) ? (tool as DrawTool) : null;
}

export function autoFinishAfterClicks(tool: DrawTool): number | null {
  switch (tool) {
    case 'line':
    case 'rectangle':
    case 'circle':
    case 'ellipse':
    case 'donut':
    case 'xline':
      return 2;
    case 'column':
    case 'point':
      return 1;
    case 'arc':
      return 3;
    default:
      return null;
  }
}

export function polylineLength2d(pts: SketchPoint[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dz = pts[i].z - pts[i - 1].z;
    len += Math.sqrt(dx * dx + dz * dz);
  }
  return len;
}

export function polygonArea2d(pts: SketchPoint[]): number {
  if (pts.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].z - pts[j].x * pts[i].z;
  }
  return Math.abs(area / 2);
}

export function polygonPerimeter2d(pts: SketchPoint[], closed = true): number {
  if (pts.length < 2) return 0;
  const loop = closed && pts.length >= 3 ? [...pts, pts[0]] : pts;
  return polylineLength2d(loop);
}

export function rectangleFromDiagonal(a: SketchPoint, b: SketchPoint): SketchPoint[] {
  const y = a.y;
  return [
    { x: a.x, y, z: a.z },
    { x: b.x, y, z: a.z },
    { x: b.x, y, z: b.z },
    { x: a.x, y, z: b.z },
  ];
}

export function rectangleDimensions(a: SketchPoint, b: SketchPoint): { widthM: number; depthM: number; areaM2: number } {
  const widthM = Math.abs(b.x - a.x);
  const depthM = Math.abs(b.z - a.z);
  return { widthM, depthM, areaM2: widthM * depthM };
}

export function closePolygon(pts: SketchPoint[]): SketchPoint[] {
  if (pts.length < 3) return pts;
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (Math.hypot(first.x - last.x, first.z - last.z) < 1e-4) return pts;
  return [...pts, { ...first }];
}

export function isClosedRing(pts: SketchPoint[]): boolean {
  if (pts.length < 2) return false;
  const first = pts[0];
  const last = pts[pts.length - 1];
  return Math.hypot(first.x - last.x, first.z - last.z) < 1e-4;
}

export function normalizePointsForKind(kind: SketchKind, pts: SketchPoint[]): SketchPoint[] {
  switch (kind) {
    case 'rectangle':
      return pts.length >= 2 ? rectangleFromDiagonal(pts[0], pts[1]) : pts;
    case 'polygon':
    case 'site-boundary':
    case 'slab':
      return closePolygon(pts);
    default:
      return pts;
  }
}

export function bounds2d(pts: SketchPoint[]): { cx: number; cz: number; span: number } {
  if (!pts.length) return { cx: 0, cz: 0, span: 40 };
  let minX = pts[0].x;
  let maxX = pts[0].x;
  let minZ = pts[0].z;
  let maxZ = pts[0].z;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const span = Math.max(maxX - minX, maxZ - minZ, 1);
  return { cx, cz, span };
}

export function applySnap(
  point: SketchPoint,
  floorY: number,
  gridSnap: number,
  orthoLock: boolean,
  last?: SketchPoint,
): SketchPoint {
  let { x, y, z } = point;
  y = floorY;
  if (gridSnap > 0) {
    x = Math.round(x / gridSnap) * gridSnap;
    z = Math.round(z / gridSnap) * gridSnap;
  }
  if (orthoLock && last) {
    const dx = Math.abs(x - last.x);
    const dz = Math.abs(z - last.z);
    if (dx > dz) z = last.z;
    else x = last.x;
  }
  return { x, y, z };
}

/** Map canvas click to XZ on horizontal plane y = floorY (plan / top-down friendly). */
export function pickOnHorizontalPlane(
  canvasPos: number[],
  canvasW: number,
  canvasH: number,
  eye: number[],
  look: number[],
  up: number[],
  floorY: number,
): SketchPoint | null {
  const nx = (canvasPos[0] / canvasW) * 2 - 1;
  const ny = 1 - (canvasPos[1] / canvasH) * 2;

  const fx = look[0] - eye[0];
  const fy = look[1] - eye[1];
  const fz = look[2] - eye[2];
  const fl = Math.hypot(fx, fy, fz) || 1;

  if (Math.abs(fy) > 0.65 * fl) {
    const camHeight = Math.max(Math.abs(eye[1] - floorY), 5);
    const half = camHeight * 0.58;
    const aspect = canvasW / canvasH;
    return {
      x: look[0] + nx * half * aspect,
      y: floorY,
      z: look[2] + ny * half,
    };
  }

  const forward = [fx / fl, fy / fl, fz / fl];
  const rx = forward[1] * up[2] - forward[2] * up[1];
  const ry = forward[2] * up[0] - forward[0] * up[2];
  const rz = forward[0] * up[1] - forward[1] * up[0];
  const rl = Math.hypot(rx, ry, rz) || 1;
  const right = [rx / rl, ry / rl, rz / rl];
  const ux = right[1] * forward[2] - right[2] * forward[1];
  const uy = right[2] * forward[0] - right[0] * forward[2];
  const uz = right[0] * forward[1] - right[1] * forward[0];
  const tanHalfFov = 0.55;
  const aspect = canvasW / canvasH;
  const rayDir = [
    forward[0] + right[0] * nx * tanHalfFov * aspect + ux * ny * tanHalfFov,
    forward[1] + right[1] * nx * tanHalfFov * aspect + uy * ny * tanHalfFov,
    forward[2] + right[2] * nx * tanHalfFov * aspect + uz * ny * tanHalfFov,
  ];
  const dl = Math.hypot(rayDir[0], rayDir[1], rayDir[2]) || 1;
  rayDir[0] /= dl;
  rayDir[1] /= dl;
  rayDir[2] /= dl;

  if (Math.abs(rayDir[1]) < 1e-8) return null;
  const t = (floorY - eye[1]) / rayDir[1];
  if (t < 0) return null;

  return {
    x: eye[0] + rayDir[0] * t,
    y: floorY,
    z: eye[2] + rayDir[2] * t,
  };
}

export function metricsForElement(kind: SketchKind, rawPts: SketchPoint[]): { lengthM: number; areaM2: number } {
  const pts = normalizePointsForKind(kind, rawPts);
  switch (kind) {
    case 'line':
      return { lengthM: polylineLength2d(pts), areaM2: 0 };
    case 'polyline':
    case 'wall':
    case 'pipe':
      return { lengthM: polylineLength2d(pts), areaM2: 0 };
    case 'rectangle':
      return {
        lengthM: polygonPerimeter2d(pts, true),
        areaM2: pts.length >= 2 ? rectangleDimensions(rawPts[0], rawPts[1]).areaM2 : 0,
      };
    case 'column':
      return { lengthM: 0, areaM2: 0 };
    case 'slab':
    case 'polygon':
    case 'site-boundary':
      return {
        lengthM: polygonPerimeter2d(pts, true),
        areaM2: polygonArea2d(pts),
      };
    default:
      return { lengthM: polylineLength2d(pts), areaM2: polygonArea2d(pts) };
  }
}
