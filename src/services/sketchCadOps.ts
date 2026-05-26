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

/** Get segment intersection between AB and CD (on-segment check). */
function getLineIntersection(
  a: SketchPoint,
  b: SketchPoint,
  c: SketchPoint,
  d: SketchPoint
): SketchPoint | null {
  const det = (b.x - a.x) * (d.z - c.z) - (b.z - a.z) * (d.x - c.x);
  if (Math.abs(det) < 1e-9) return null; // Parallel
  const u = ((c.x - a.x) * (d.z - c.z) - (c.z - a.z) * (d.x - c.x)) / det;
  const v = ((c.x - a.x) * (b.z - a.z) - (c.z - a.z) * (b.x - a.x)) / det;
  const tol = 1e-7;
  if (u >= -tol && u <= 1.0 + tol && v >= -tol && v <= 1.0 + tol) {
    return {
      x: a.x + u * (b.x - a.x),
      y: a.y,
      z: a.z + u * (b.z - a.z)
    };
  }
  return null;
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

/** Offset open/closed polyline in 2D with exact miter joints and spike limiting. */
export function offsetPolyline(points: SketchPoint[], distance: number, closed: boolean): SketchPoint[] {
  if (points.length < 2) return points;
  const n = points.length;
  
  // Calculate offset lines for each segment
  const offsetLines: { a: SketchPoint; b: SketchPoint; normal: SketchPoint }[] = [];
  const numSegs = closed ? n : n - 1;
  
  for (let i = 0; i < numSegs; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    
    offsetLines.push({
      a: { x: p1.x + nx * distance, y: p1.y, z: p1.z + nz * distance },
      b: { x: p2.x + nx * distance, y: p2.y, z: p2.z + nz * distance },
      normal: { x: nx, y: 0, z: nz }
    });
  }
  
  const out: SketchPoint[] = [];
  
  if (closed) {
    for (let i = 0; i < n; i++) {
      const prev = offsetLines[(i - 1 + n) % n];
      const curr = offsetLines[i];
      const ip = lineIntersect2d(prev.a, prev.b, curr.a, curr.b);
      if (ip) {
        const orig = points[i];
        if (dist2d(ip, orig) > Math.abs(distance) * 4) {
          out.push({ x: orig.x + curr.normal.x * distance, y: orig.y, z: orig.z + curr.normal.z * distance });
        } else {
          out.push(ip);
        }
      } else {
        const orig = points[i];
        out.push({ x: orig.x + curr.normal.x * distance, y: orig.y, z: orig.z + curr.normal.z * distance });
      }
    }
  } else {
    // Start point
    out.push(offsetLines[0].a);
    
    // Intermediate points
    for (let i = 1; i < n - 1; i++) {
      const prev = offsetLines[i - 1];
      const curr = offsetLines[i];
      const ip = lineIntersect2d(prev.a, prev.b, curr.a, curr.b);
      if (ip) {
        const orig = points[i];
        if (dist2d(ip, orig) > Math.abs(distance) * 4) {
          out.push({ x: orig.x + curr.normal.x * distance, y: orig.y, z: orig.z + curr.normal.z * distance });
        } else {
          out.push(ip);
        }
      } else {
        const orig = points[i];
        out.push({ x: orig.x + curr.normal.x * distance, y: orig.y, z: orig.z + curr.normal.z * distance });
      }
    }
    
    // End point
    out.push(offsetLines[offsetLines.length - 1].b);
  }
  
  return out;
}

/** Trim element using a cutter segment by performing topological point splits and discarding closest click side. */
export function trimElementWithCutter(
  el: SketchElement,
  cutter: Segment2D,
  click: SketchPoint,
): SketchElement | null {
  if (el.points.length < 2) return null;
  const pts = [...el.points];
  
  // Find all segment split points along the target polyline
  const splitSegments: SketchPoint[][] = [];
  let currentSegment: SketchPoint[] = [pts[0]];
  
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const ip = getLineIntersection(p1, p2, cutter.a, cutter.b);
    
    if (ip && dist2d(ip, p1) > 1e-5 && dist2d(ip, p2) > 1e-5) {
      currentSegment.push(ip);
      splitSegments.push(currentSegment);
      currentSegment = [ip, p2];
    } else {
      currentSegment.push(p2);
    }
  }
  splitSegments.push(currentSegment);
  
  if (splitSegments.length < 2) {
    // No intersection found
    return null;
  }
  
  // Find which split segment is closest to the user's click point
  let closestIndex = 0;
  let minDistance = Infinity;
  
  splitSegments.forEach((segPts, segIdx) => {
    // Check distance to each segment part
    for (let i = 0; i < segPts.length - 1; i++) {
      const { dist } = closestOnSegment(click, segPts[i], segPts[i + 1]);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = segIdx;
      }
    }
  });
  
  // Discard the clicked piece, gather the rest
  const keptSegments = splitSegments.filter((_, idx) => idx !== closestIndex);
  if (keptSegments.length === 0) return null;
  
  // Return the longest remaining piece to keep geometry contiguous and logical
  let longestSegment = keptSegments[0];
  let maxLength = 0;
  
  keptSegments.forEach((segPts) => {
    let len = 0;
    for (let i = 0; i < segPts.length - 1; i++) {
      len += dist2d(segPts[i], segPts[i + 1]);
    }
    if (len > maxLength) {
      maxLength = len;
      longestSegment = segPts;
    }
  });
  
  return { ...el, points: longestSegment };
}

/** Extend element endpoints along their tangents to snap precisely to a boundary. */
export function extendElementToBoundary(
  el: SketchElement,
  boundary: Segment2D,
  end: 'start' | 'end',
): SketchElement | null {
  if (el.points.length < 2) return null;
  const pts = [...el.points];
  const n = pts.length;
  
  let pEnd: SketchPoint;
  let pPrev: SketchPoint;
  let endIdx: number;
  
  if (end === 'start') {
    pEnd = pts[0];
    pPrev = pts[1];
    endIdx = 0;
  } else {
    pEnd = pts[n - 1];
    pPrev = pts[n - 2];
    endIdx = n - 1;
  }
  
  // Extrude end segment direction infinitely
  const dx = pEnd.x - pPrev.x;
  const dz = pEnd.z - pPrev.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return null;
  
  const pFar = {
    x: pEnd.x + (dx / len) * 1000.0,
    y: pEnd.y,
    z: pEnd.z + (dz / len) * 1000.0
  };
  
  const ip = getLineIntersection(pEnd, pFar, boundary.a, boundary.b);
  if (!ip) return null;
  
  pts[endIdx] = ip;
  return { ...el, points: pts };
}

/** Fillet one interior vertex with a true mathematical tangent circular arc. */
export function filletAtVertex(points: SketchPoint[], index: number, radius: number): SketchPoint[] {
  if (points.length < 3 || index <= 0 || index >= points.length - 1) return points;
  
  const pPrev = points[index - 1];
  const pCurr = points[index];
  const pNext = points[index + 1];
  
  const dx1 = pPrev.x - pCurr.x;
  const dz1 = pPrev.z - pCurr.z;
  const dx2 = pNext.x - pCurr.x;
  const dz2 = pNext.z - pCurr.z;
  
  const len1 = Math.hypot(dx1, dz1);
  const len2 = Math.hypot(dx2, dz2);
  if (len1 < 1e-6 || len2 < 1e-6) return points;
  
  const v1x = dx1 / len1;
  const v1z = dz1 / len1;
  const v2x = dx2 / len2;
  const v2z = dz2 / len2;
  
  // Dot product to compute interior angle
  const dot = v1x * v2x + v1z * v2z;
  const cosHalfTheta = Math.sqrt(Math.max(0, (1 + dot) / 2));
  const sinHalfTheta = Math.sqrt(Math.max(0, (1 - dot) / 2));
  if (sinHalfTheta < 1e-4) return points; // Collinear, fillet impossible
  
  const tanHalfTheta = sinHalfTheta / cosHalfTheta;
  
  // Bound the tangent distance to 40% of the shortest segment to prevent self-intersection collapse
  const maxD = Math.min(len1, len2) * 0.4;
  let d_tangent = radius / tanHalfTheta;
  let r = radius;
  if (d_tangent > maxD) {
    d_tangent = maxD;
    r = d_tangent * tanHalfTheta;
  }
  
  // Calculate tangent intersections
  const t1 = { x: pCurr.x + v1x * d_tangent, y: pCurr.y, z: pCurr.z + v1z * d_tangent };
  const t2 = { x: pCurr.x + v2x * d_tangent, y: pCurr.y, z: pCurr.z + v2z * d_tangent };
  
  // Center of fillet arc
  const bx = v1x + v2x;
  const bz = v1z + v2z;
  const blen = Math.hypot(bx, bz) || 1;
  const bnx = bx / blen;
  const bnz = bz / blen;
  
  const distToCenter = r / sinHalfTheta;
  const center = {
    x: pCurr.x + bnx * distToCenter,
    y: pCurr.y,
    z: pCurr.z + bnz * distToCenter
  };
  
  // Generate arc points
  const a1 = Math.atan2(t1.z - center.z, t1.x - center.x);
  const a2 = Math.atan2(t2.z - center.z, t2.x - center.x);
  
  let diff = a2 - a1;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  
  const steps = 8;
  const arcPts: SketchPoint[] = [];
  for (let s = 0; s <= steps; s++) {
    const angle = a1 + (s / steps) * diff;
    arcPts.push({
      x: center.x + Math.cos(angle) * r,
      y: pCurr.y,
      z: center.z + Math.sin(angle) * r
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
