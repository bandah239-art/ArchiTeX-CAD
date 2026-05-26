import { create } from 'zustand';
import type { DrawModifiers, DrawTool } from '../types/tools';
import { DEFAULT_DRAW_MODIFIERS } from '../types/tools';
import {
  MIN_POINTS,
  applySnap,
  metricsForElement,
  normalizePointsForKind,
} from '../services/sketchGeometry';

export type SketchKind =
  | 'line'
  | 'polyline'
  | 'wall'
  | 'slab'
  | 'column'
  | 'rectangle'
  | 'polygon'
  | 'pipe'
  | 'site-boundary'
  | 'circle'
  | 'arc'
  | 'ellipse'
  | 'hatch'
  | 'boundary'
  | 'xline'
  | 'spline'
  | 'point'
  | 'region'
  | 'donut'
  | 'revcloud';

export interface SketchPoint {
  x: number;
  y: number;
  z: number;
}

export interface SketchElement {
  id: string;
  kind: SketchKind;
  points: SketchPoint[];
  height?: number;
  thickness?: number;
  diameter?: number;
  label?: string;
  areaM2?: number;
  lengthM?: number;
  createdAt: number;
}

export interface DrawSnapshot {
  elements: SketchElement[];
  activePoints: SketchPoint[];
}

interface DrawState {
  elements: SketchElement[];
  activePoints: SketchPoint[];
  previewPoint: SketchPoint | null;
  selectedId: string | null;
  modifiers: DrawModifiers;
  floorElevation: number;
  sketchCenterX: number;
  sketchCenterZ: number;
  sketchSpan: number;
  isDrawing: boolean;
  lastPickError: string | null;
  setModifiers: (patch: Partial<DrawModifiers>) => void;
  setFloorElevation: (y: number) => void;
  setSketchBounds: (centerX: number, centerZ: number, span: number) => void;
  setPreviewPoint: (point: SketchPoint | null) => void;
  beginStroke: () => void;
  addPoint: (point: SketchPoint) => void;
  finishStroke: (kind: SketchKind) => SketchElement | null;
  cancelStroke: () => void;
  removeElement: (id: string) => void;
  setSelectedId: (id: string | null) => void;
  updateElementPoints: (id: string, points: SketchPoint[]) => void;
  mirrorElement: (id: string) => SketchElement | null;
  duplicateElement: (id: string) => SketchElement | null;
  arrayElement: (id: string, count?: number, spacing?: number) => SketchElement[];
  extrudeElement: (id: string, height?: number) => SketchElement | null;
  clearAll: () => void;
  loadSnapshot: (snap: DrawSnapshot) => void;
  getSnapshot: () => DrawSnapshot;
  duplicateLast: () => SketchElement | null;
  mirrorLast: () => SketchElement | null;
  arrayLast: (count?: number, spacing?: number) => SketchElement[];
  scaleElement: (id: string, factor: number) => boolean;
  explodeElement: (id: string) => number;
  joinOpenPolylines: () => boolean;
  purgeEmptySketches: () => number;
  toolToKind: (tool: DrawTool) => SketchKind | null;
}

function uid() {
  return `sk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const EXTRUDABLE_KINDS: SketchKind[] = ['polygon', 'rectangle', 'site-boundary'];

export const useDrawStore = create<DrawState>((set, get) => ({
  elements: [],
  activePoints: [],
  previewPoint: null,
  selectedId: null,
  modifiers: { ...DEFAULT_DRAW_MODIFIERS },
  floorElevation: 0,
  sketchCenterX: 0,
  sketchCenterZ: 0,
  sketchSpan: 80,
  isDrawing: false,
  lastPickError: null,

  setModifiers: (patch) => set((s) => ({ modifiers: { ...s.modifiers, ...patch } })),

  setFloorElevation: (y) => set({ floorElevation: y }),

  setSketchBounds: (centerX, centerZ, span) =>
    set({ sketchCenterX: centerX, sketchCenterZ: centerZ, sketchSpan: Math.max(span, 20) }),

  setPreviewPoint: (point) => set({ previewPoint: point }),

  beginStroke: () => set({ activePoints: [], previewPoint: null, isDrawing: true }),

  addPoint: (point) => {
    const { modifiers, floorElevation, activePoints } = get();
    const last = activePoints.length ? activePoints[activePoints.length - 1] : undefined;
    const snapped = applySnap(point, floorElevation, modifiers.gridSnap, modifiers.orthoLock, last);
    set((s) => ({ activePoints: [...s.activePoints, snapped] }));
  },

  finishStroke: (kind) => {
    const { activePoints, modifiers, elements } = get();
    const minPts = MIN_POINTS[kind];
    if (activePoints.length < minPts) {
      return null;
    }

    const pts = normalizePointsForKind(kind, activePoints);
    if (kind !== 'column' && pts.length < minPts) {
      return null;
    }

    const { lengthM, areaM2 } = metricsForElement(kind, activePoints);
    const el: SketchElement = {
      id: uid(),
      kind,
      points: pts,
      height: modifiers.wallHeight,
      thickness: kind === 'pipe' ? modifiers.pipeDiameter : modifiers.wallThickness,
      diameter: modifiers.pipeDiameter,
      lengthM,
      areaM2,
      createdAt: Date.now(),
    };
    if (kind === 'slab') el.thickness = modifiers.slabThickness;
    if (kind === 'column') {
      el.height = modifiers.wallHeight;
      el.thickness = modifiers.columnSize;
    }

    set({
      elements: [...elements, el],
      activePoints: [],
      previewPoint: null,
      isDrawing: false,
    });
    return el;
  },

  cancelStroke: () => set({ activePoints: [], previewPoint: null, isDrawing: false }),

  removeElement: (id) =>
    set((s) => ({
      elements: s.elements.filter((e) => e.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  setSelectedId: (id) => set({ selectedId: id }),

  updateElementPoints: (id, points) =>
    set((s) => ({
      elements: s.elements.map((e) => {
        if (e.id !== id) return e;
        const metrics = metricsForElement(e.kind, points);
        return {
          ...e,
          points: normalizePointsForKind(e.kind, points),
          lengthM: metrics.lengthM,
          areaM2: metrics.areaM2,
        };
      }),
    })),

  mirrorElement: (id) => {
    const { elements } = get();
    const el = elements.find((e) => e.id === id);
    if (!el) return null;
    const cx = el.points.reduce((s, p) => s + p.x, 0) / el.points.length;
    const copy: SketchElement = {
      ...el,
      id: uid(),
      points: el.points.map((p) => ({ ...p, x: 2 * cx - p.x })),
      createdAt: Date.now(),
    };
    set({ elements: [...elements, copy], selectedId: copy.id });
    return copy;
  },

  duplicateElement: (id) => {
    const { elements } = get();
    const el = elements.find((e) => e.id === id);
    if (!el) return null;
    const copy: SketchElement = {
      ...el,
      id: uid(),
      points: el.points.map((p) => ({ ...p, x: p.x + 1, z: p.z + 1 })),
      createdAt: Date.now(),
    };
    set({ elements: [...elements, copy], selectedId: copy.id });
    return copy;
  },

  arrayElement: (id, count = 3, spacing = 2) => {
    const { elements } = get();
    const el = elements.find((e) => e.id === id);
    if (!el) return [];
    const copies: SketchElement[] = [];
    for (let i = 1; i <= count; i++) {
      copies.push({
        ...el,
        id: uid(),
        points: el.points.map((p) => ({ ...p, x: p.x + spacing * i })),
        createdAt: Date.now(),
      });
    }
    set({ elements: [...elements, ...copies], selectedId: copies[copies.length - 1]?.id ?? id });
    return copies;
  },

  extrudeElement: (id, height) => {
    const { elements, modifiers } = get();
    const el = elements.find((e) => e.id === id);
    if (!el) return null;

    const h = height ?? modifiers.extrudeHeight;
    if (h <= 0) return null;

    let next: SketchElement;
    if (el.kind === 'slab') {
      next = {
        ...el,
        height: h,
        thickness: el.thickness ?? modifiers.slabThickness,
      };
    } else if (!EXTRUDABLE_KINDS.includes(el.kind)) {
      return null;
    } else {
      const pts = normalizePointsForKind(el.kind, el.points);
      const metrics = metricsForElement('slab', pts);
      next = {
        ...el,
        kind: 'slab',
        points: pts,
        height: h,
        thickness: modifiers.slabThickness,
        lengthM: metrics.lengthM,
        areaM2: metrics.areaM2,
      };
    }

    set({
      elements: elements.map((e) => (e.id === id ? next : e)),
      selectedId: id,
    });
    return next;
  },

  clearAll: () =>
    set({ elements: [], activePoints: [], previewPoint: null, selectedId: null, isDrawing: false }),

  loadSnapshot: (snap) =>
    set({
      elements: snap.elements,
      activePoints: snap.activePoints,
      previewPoint: null,
      isDrawing: snap.activePoints.length > 0,
    }),

  getSnapshot: () => {
    const { elements, activePoints } = get();
    return { elements: [...elements], activePoints: [...activePoints] };
  },

  duplicateLast: () => {
    const { elements } = get();
    const last = elements[elements.length - 1];
    if (!last) return null;
    const copy = {
      ...last,
      id: uid(),
      points: last.points.map((p) => ({ ...p, x: p.x + 1, z: p.z + 1 })),
      createdAt: Date.now(),
    };
    set({ elements: [...elements, copy] });
    return copy;
  },

  mirrorLast: () => {
    const { elements } = get();
    const last = elements[elements.length - 1];
    if (!last) return null;
    const cx = last.points.reduce((s, p) => s + p.x, 0) / last.points.length;
    const copy = {
      ...last,
      id: uid(),
      points: last.points.map((p) => ({ ...p, x: 2 * cx - p.x })),
      createdAt: Date.now(),
    };
    set({ elements: [...elements, copy] });
    return copy;
  },

  arrayLast: (count = 3, spacing = 2) => {
    const { elements } = get();
    const last = elements[elements.length - 1];
    if (!last) return [];
    const copies: SketchElement[] = [];
    for (let i = 1; i <= count; i++) {
      copies.push({
        ...last,
        id: uid(),
        points: last.points.map((p) => ({ ...p, x: p.x + spacing * i })),
        createdAt: Date.now(),
      });
    }
    set({ elements: [...elements, ...copies] });
    return copies;
  },

  scaleElement: (id, factor) => {
    const el = get().elements.find((e) => e.id === id);
    if (!el || el.points.length === 0) return false;
    const cx = el.points.reduce((s, p) => s + p.x, 0) / el.points.length;
    const cz = el.points.reduce((s, p) => s + p.z, 0) / el.points.length;
    const points = el.points.map((p) => ({
      ...p,
      x: cx + (p.x - cx) * factor,
      z: cz + (p.z - cz) * factor,
    }));
    get().updateElementPoints(id, points);
    return true;
  },

  explodeElement: (id) => {
    const el = get().elements.find((e) => e.id === id);
    if (!el || el.points.length < 2) return 0;
    const segmentKinds: SketchKind[] = ['polyline', 'wall', 'pipe', 'line', 'xline', 'spline'];
    if (!segmentKinds.includes(el.kind) && el.kind !== 'revcloud') return 0;
    const { elements } = get();
    const rest = elements.filter((e) => e.id !== id);
    const segments: SketchElement[] = [];
    for (let i = 0; i < el.points.length - 1; i++) {
      segments.push({
        id: uid(),
        kind: 'line',
        points: [el.points[i], el.points[i + 1]],
        createdAt: Date.now(),
      });
    }
    set({ elements: [...rest, ...segments], selectedId: null });
    return segments.length;
  },

  joinOpenPolylines: () => {
    const polys = get().elements.filter((e) => e.kind === 'polyline' || e.kind === 'line');
    if (polys.length < 2) return false;
    const a = polys[0];
    const b = polys[1];
    const tol = 0.05;
    const dist = (p: SketchPoint, q: SketchPoint) => Math.hypot(p.x - q.x, p.z - q.z);
    let merged: SketchPoint[] = [...a.points];
    const bPts = [...b.points];
    if (dist(merged[merged.length - 1], bPts[0]) < tol) {
      merged = [...merged, ...bPts.slice(1)];
    } else if (dist(merged[merged.length - 1], bPts[bPts.length - 1]) < tol) {
      merged = [...merged, ...bPts.slice(0, -1).reverse()];
    } else {
      return false;
    }
    const joined: SketchElement = {
      id: uid(),
      kind: 'polyline',
      points: merged,
      createdAt: Date.now(),
    };
    set({
      elements: get().elements.filter((e) => e.id !== a.id && e.id !== b.id).concat(joined),
      selectedId: joined.id,
    });
    return true;
  },

  purgeEmptySketches: () => {
    const before = get().elements.length;
    set({
      elements: get().elements.filter((e) => e.points.length >= 1),
    });
    return before - get().elements.length;
  },

  toolToKind: (tool) => {
    const map: Partial<Record<DrawTool, SketchKind>> = {
      line: 'line',
      polyline: 'polyline',
      wall: 'wall',
      slab: 'slab',
      column: 'column',
      rectangle: 'rectangle',
      polygon: 'polygon',
      pipe: 'pipe',
      'site-boundary': 'site-boundary',
      circle: 'circle',
      arc: 'arc',
      ellipse: 'ellipse',
      hatch: 'hatch',
      boundary: 'boundary',
      xline: 'xline',
      spline: 'spline',
      point: 'point',
      region: 'region',
      donut: 'donut',
      revcloud: 'revcloud',
    };
    return map[tool] ?? null;
  },
}));
