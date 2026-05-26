import type { SketchElement, SketchPoint } from '../store/drawStore';

export interface Segment2D {
  a: SketchPoint;
  b: SketchPoint;
  elementId: string;
  index: number;
}

function dist2d(a: SketchPoint, b: SketchPoint): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function lerp(a: SketchPoint, b: SketchPoint, t: number): SketchPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y, z: a.z + (b.z - a.z) * t };
}

/** Closest point on segment AB to P; returns t in [0,1] and distance. */
function closestOnSegment(
  p: SketchPoint,
  a: SketchPoint,
  b: SketchPoint,
): { point: SketchPoint; t: number; dist: number } {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-12) {
    const d = dist2d(p, a);
    return { point: { ...a }, t: 0, dist: d };
  }
  let t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  const point = lerp(a, b, t);
  return { point, t, dist: dist2d(p, point) };
}

/** Infinite line intersection of segments (extended). */
function lineIntersect2d(
  a1: SketchPoint,
  a2: SketchPoint,
  b1: SketchPoint,
  b2: SketchPoint,
): SketchPoint | null {
  const x1 = a1.x;
  const z1 = a1.z;
  const x2 = a2.x;
  const z2 = a2.z;
  const x3 = b1.x;
  const z3 = b1.z;
  const x4 = b2.x;
  const z4 = b2.z;
  const denom = (x1 - x2) * (z3 - z4) - (z1 - z2) * (x3 - x4);
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((x1 - x3) * (z3 - z4) - (z1 - z3) * (x3 - x4)) / denom;
  return { x: x1 + t * (x2 - x1), y: a1.y, z: z1 + t * (z2 - z1) };
}

export function segmentsFromElement(el: SketchElement): Segment2D[] {
  const pts = el.points;
  const segs: Segment2D[] = [];
  if (pts.length < 2) return segs;
  const closed =
    el.kind === 'polygon' ||
    el.kind === 'rectangle' ||
    el.kind === 'slab' ||
    el.kind === 'hatch' ||
    el.kind === 'region' ||
    el.kind === 'boundary' ||
    el.kind === 'site-boundary';
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % pts.length;
    segs.push({ a: pts[i], b: pts[j], elementId: el.id, index: i });
  }
  if (el.kind === 'circle' && pts.length >= 2) {
    const cx = pts[0];
    const r = dist2d(pts[0], pts[1]);
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const t0 = (i / steps) * Math.PI * 2;
      const t1 = ((i + 1) / steps) * Math.PI * 2;
      segs.push({
        a: { x: cx.x + Math.cos(t0) * r, y: cx.y, z: cx.z + Math.sin(t0) * r },
        b: { x: cx.x + Math.cos(t1) * r, y: cx.y, z: cx.z + Math.sin(t1) * r },
        elementId: el.id,
        index: i,
      });
    }
  }
  return segs;
}

export function pickNearestSegment(
  elements: SketchElement[],
  world: SketchPoint,
  maxDist = 1.5,
): Segment2D | null {
  let best: Segment2D | null = null;
  let bestD = maxDist;
  for (const el of elements) {
    for (const seg of segmentsFromElement(el)) {
      const { dist } = closestOnSegment(world, seg.a, seg.b);
      if (dist < bestD) {
        bestD = dist;
        best = seg;
      }
    }
  }
  return best;
}

export function pickNearestVertex(
  elements: SketchElement[],
  world: SketchPoint,
  maxDist = 1.0,
): { elementId: string; index: number; point: SketchPoint } | null {
  let best: { elementId: string; index: number; point: SketchPoint } | null = null;
  let bestD = maxDist;
  for (const el of elements) {
    el.points.forEach((p, i) => {
      const d = dist2d(world, p);
      if (d < bestD) {
        bestD = d;
        best = { elementId: el.id, index: i, point: p };
      }
    });
  }
  return best;
}

/** Offset open/closed polyline in 2D (positive = left of direction). */
export function offsetPolyline(points: SketchPoint[], distance: number, closed: boolean): SketchPoint[] {
  if (points.length < 2) return points;
  const n = closed ? points.length : points.length - 1;
  const out: SketchPoint[] = [];
  for (let i = 0; i < n; i++) {
    const i0 = i;
    const i1 = (i + 1) % points.length;
    const p0 = points[i0];
    const p1 = points[i1];
    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = (-dz / len) * distance;
    const nz = (dx / len) * distance;
    const mx = (p0.x + p1.x) / 2 + nx;
    const mz = (p0.z + p1.z) / 2 + nz;
    out.push({ x: mx, y: p0.y, z: mz });
  }
  if (!closed) {
    const p0 = points[0];
    const p1 = points[1];
    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;
    const len = Math.hypot(dx, dz) || 1;
    out.unshift({
      x: p0.x + (-dz / len) * distance,
      y: p0.y,
      z: p0.z + (dx / len) * distance,
    });
    const pn = points[points.length - 1];
    const pm = points[points.length - 2];
    const dx2 = pn.x - pm.x;
    const dz2 = pn.z - pm.z;
    const len2 = Math.hypot(dx2, dz2) || 1;
    out.push({
      x: pn.x + (-dz2 / len2) * distance,
      y: pn.y,
      z: pn.z + (dx2 / len2) * distance,
    });
  }
  return out;
}

export function trimElementWithCutter(
  el: SketchElement,
  cutter: Segment2D,
  click: SketchPoint,
): SketchElement | null {
  if (el.points.length < 2) return null;
  const pts = [...el.points];
  const hits: { t: number; seg: number; pt: SketchPoint }[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const hit = lineIntersect2d(pts[i], pts[i + 1], cutter.a, cutter.b);
    if (hit) {
      const t = dist2d(pts[i], hit) / (dist2d(pts[i], pts[i + 1]) || 1);
      hits.push({ t, seg: i, pt: hit });
    }
  }
  if (!hits.length) return null;
  const { seg: si } = hits[0];
  const keepStart = dist2d(click, pts[0]) < dist2d(click, pts[pts.length - 1]);
  const newPts = keepStart ? [...pts.slice(0, si + 1), hits[0].pt] : [hits[0].pt, ...pts.slice(si + 1)];
  if (newPts.length < 2) return null;
  return { ...el, points: newPts };
}

export function extendElementToBoundary(
  el: SketchElement,
  boundary: Segment2D,
  end: 'start' | 'end',
): SketchElement | null {
  if (el.points.length < 2) return null;
  const pts = [...el.points];
  const i = end === 'start' ? 0 : pts.length - 1;
  const j = end === 'start' ? 1 : pts.length - 2;
  const hit = lineIntersect2d(pts[i], pts[j], boundary.a, boundary.b);
  if (!hit) return null;
  if (end === 'start') pts[0] = hit;
  else pts[pts.length - 1] = hit;
  return { ...el, points: pts };
}

/** Fillet one interior vertex with radius r. */
export function filletAtVertex(points: SketchPoint[], index: number, radius: number): SketchPoint[] {
  if (points.length < 3 || index <= 0 || index >= points.length - 1) return points;
  const prev = points[index - 1];
  const curr = points[index];
  const next = points[index + 1];
  const v1x = prev.x - curr.x;
  const v1z = prev.z - curr.z;
  const v2x = next.x - curr.x;
  const v2z = next.z - curr.z;
  const len1 = Math.hypot(v1x, v1z);
  const len2 = Math.hypot(v2x, v2z);
  if (len1 < 1e-6 || len2 < 1e-6) return points;
  const r = Math.min(radius, len1 * 0.4, len2 * 0.4);
  const n1x = v1x / len1;
  const n1z = v1z / len1;
  const n2x = v2x / len2;
  const n2z = v2z / len2;
  const p1 = { x: curr.x + n1x * r, y: curr.y, z: curr.z + n1z * r };
  const p2 = { x: curr.x + n2x * r, y: curr.y, z: curr.z + n2z * r };
  const arcPts: SketchPoint[] = [];
  const steps = 6;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    arcPts.push({
      x: p1.x * (1 - t) + p2.x * t,
      y: curr.y,
      z: p1.z * (1 - t) + p2.z * t,
    });
  }
  return [...points.slice(0, index), ...arcPts, ...points.slice(index + 1)];
}

export function chamferAtVertex(points: SketchPoint[], index: number, dist: number): SketchPoint[] {
  if (points.length < 3 || index <= 0 || index >= points.length - 1) return points;
  const prev = points[index - 1];
  const curr = points[index];
  const next = points[index + 1];
  const d1 = Math.min(dist, dist2d(prev, curr) * 0.45);
  const d2 = Math.min(dist, dist2d(next, curr) * 0.45);
  const t1 = d1 / (dist2d(prev, curr) || 1);
  const t2 = d2 / (dist2d(next, curr) || 1);
  const p1 = lerp(curr, prev, t1);
  const p2 = lerp(curr, next, t2);
  return [...points.slice(0, index), p1, p2, ...points.slice(index + 1)];
}

export function breakElementAt(el: SketchElement, world: SketchPoint): SketchElement[] {
  const seg = pickNearestSegment([el], world, 2);
  if (!seg || el.points.length < 2) return [];
  const { t } = closestOnSegment(world, seg.a, seg.b);
  if (t <= 0.02 || t >= 0.98) return [];
  const split = lerp(seg.a, seg.b, t);
  const idx = seg.index;
  const pts = el.points;
  const a: SketchElement = {
    ...el,
    id: `${el.id}-a`,
    points: [...pts.slice(0, idx + 1), split],
    createdAt: Date.now(),
  };
  const b: SketchElement = {
    ...el,
    id: `${el.id}-b`,
    points: [split, ...pts.slice(idx + 1)],
    createdAt: Date.now(),
  };
  return [a, b];
}

export function stretchElementBox(
  el: SketchElement,
  corner: SketchPoint,
  delta: { dx: number; dz: number },
): SketchPoint[] {
  const xs = el.points.map((p) => p.x);
  const zs = el.points.map((p) => p.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const nearMinX = Math.abs(corner.x - minX) < Math.abs(corner.x - maxX);
  const nearMinZ = Math.abs(corner.z - minZ) < Math.abs(corner.z - maxZ);
  return el.points.map((p) => ({
    ...p,
    x: p.x + (nearMinX ? 0 : delta.dx) + (nearMinX ? delta.dx : 0),
    z: p.z + (nearMinZ ? 0 : delta.dz) + (nearMinZ ? delta.dz : 0),
  }));
}

export function alignElements(
  elements: SketchElement[],
  ids: string[],
  mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom',
): SketchPoint[][] {
  const sel = elements.filter((e) => ids.includes(e.id));
  if (!sel.length) return [];
  const xs = sel.flatMap((e) => e.points.map((p) => p.x));
  const zs = sel.flatMap((e) => e.points.map((p) => p.z));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  return sel.map((el) => {
    let dx = 0;
    let dz = 0;
    if (mode === 'left') dx = minX - Math.min(...el.points.map((p) => p.x));
    if (mode === 'right') dx = maxX - Math.max(...el.points.map((p) => p.x));
    if (mode === 'center') {
      const ex = (Math.min(...el.points.map((p) => p.x)) + Math.max(...el.points.map((p) => p.x))) / 2;
      dx = cx - ex;
    }
    if (mode === 'bottom') dz = minZ - Math.min(...el.points.map((p) => p.z));
    if (mode === 'top') dz = maxZ - Math.max(...el.points.map((p) => p.z));
    if (mode === 'middle') {
      const ez = (Math.min(...el.points.map((p) => p.z)) + Math.max(...el.points.map((p) => p.z))) / 2;
      dz = cz - ez;
    }
    return el.points.map((p) => ({ ...p, x: p.x + dx, z: p.z + dz }));
  });
}

export function revolveProfileToColumn(el: SketchElement, axisX: number): SketchElement | null {
  if (el.points.length < 3) return null;
  const cx = el.points.reduce((s, p) => s + p.x, 0) / el.points.length;
  const cz = el.points.reduce((s, p) => s + p.z, 0) / el.points.length;
  const maxR = Math.max(...el.points.map((p) => Math.hypot(p.x - axisX, p.z - cz)));
  return {
    id: el.id,
    kind: 'column',
    points: [{ x: cx, y: el.points[0].y, z: cz }],
    height: maxR * 2,
    thickness: maxR * 2,
    createdAt: Date.now(),
  };
}

export function sweepAlongPath(profile: SketchElement, path: SketchElement): SketchElement | null {
  if (profile.points.length < 2 || path.points.length < 2) return null;
  const wall: SketchElement = {
    id: profile.id,
    kind: 'wall',
    points: path.points.map((p) => ({ ...p })),
    height: profile.thickness ?? 3,
    thickness: profile.thickness ?? 0.2,
    createdAt: Date.now(),
  };
  return wall;
}

export function loftBetweenProfiles(a: SketchElement, b: SketchElement): SketchElement | null {
  if (a.points.length < 3 || b.points.length < 3) return null;
  const yMid = ((a.points[0].y + b.points[0].y) / 2);
  const merged = a.points.map((p, i) => ({
    x: (p.x + (b.points[i]?.x ?? p.x)) / 2,
    y: yMid,
    z: (p.z + (b.points[i]?.z ?? p.z)) / 2,
  }));
  return {
    id: a.id,
    kind: 'slab',
    points: merged,
    thickness: Math.abs(b.points[0].y - a.points[0].y) || 0.15,
    createdAt: Date.now(),
  };
}
