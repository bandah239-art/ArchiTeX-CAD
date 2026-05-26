import { create } from 'zustand';

export type GeometricConstraintType =
  | 'horizontal'
  | 'vertical'
  | 'parallel'
  | 'perpendicular'
  | 'coincident'
  | 'tangent'
  | 'equal'
  | 'symmetric'
  | 'fix';

export type DimensionalConstraintType = 'distance' | 'angle' | 'radius' | 'diameter';

export interface SketchConstraint {
  id: string;
  kind: 'geometric' | 'dimensional';
  type: GeometricConstraintType | DimensionalConstraintType;
  elementIds: string[];
  value?: number;
  label?: string;
}

interface SketchConstraintState {
  constraints: SketchConstraint[];
  barVisible: boolean;
  setBarVisible: (v: boolean) => void;
  addGeometric: (type: GeometricConstraintType, elementIds: string[]) => SketchConstraint;
  addDimensional: (type: DimensionalConstraintType, elementIds: string[], value: number) => SketchConstraint;
  remove: (id: string) => void;
  clearAll: () => void;
  applyToElements: (
    elements: { id: string; points: { x: number; y: number; z: number }[] }[],
  ) => { id: string; points: { x: number; y: number; z: number }[] }[];
}

function uid() {
  return `con-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function dist2d(
  a: { x: number; z: number },
  b: { x: number; z: number },
): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export const useSketchConstraintStore = create<SketchConstraintState>((set, get) => ({
  constraints: [],
  barVisible: false,

  setBarVisible: (barVisible) => set({ barVisible }),

  addGeometric: (type, elementIds) => {
    const c: SketchConstraint = {
      id: uid(),
      kind: 'geometric',
      type,
      elementIds,
    };
    set((s) => ({ constraints: [...s.constraints, c] }));
    return c;
  },

  addDimensional: (type, elementIds, value) => {
    const c: SketchConstraint = {
      id: uid(),
      kind: 'dimensional',
      type,
      elementIds,
      value,
      label: `${type}=${value.toFixed(2)}`,
    };
    set((s) => ({ constraints: [...s.constraints, c] }));
    return c;
  },

  remove: (id) => set((s) => ({ constraints: s.constraints.filter((c) => c.id !== id) })),

  clearAll: () => set({ constraints: [] }),

  applyToElements: (elements) => {
    const cons = get().constraints;
    if (!cons.length) return elements;

    const out = elements.map((e) => ({
      ...e,
      points: e.points.map((p) => ({ ...p })),
    }));

    for (const c of cons) {
      if (c.kind !== 'geometric') continue;
      const targets = out.filter((e) => c.elementIds.includes(e.id));
      if (!targets.length) continue;

      if (c.type === 'horizontal' && targets[0].points.length >= 2) {
        const z = targets[0].points[0].z;
        targets[0].points = targets[0].points.map((p) => ({ ...p, z }));
      }
      if (c.type === 'vertical' && targets[0].points.length >= 2) {
        const x = targets[0].points[0].x;
        targets[0].points = targets[0].points.map((p) => ({ ...p, x }));
      }
      if (c.type === 'equal' && targets.length >= 2) {
        const lenA = dist2d(targets[0].points[0], targets[0].points[targets[0].points.length - 1]);
        const lenB = dist2d(targets[1].points[0], targets[1].points[targets[1].points.length - 1]);
        if (lenB > 1e-6 && lenA > 1e-6) {
          const scale = lenA / lenB;
          const cx = targets[1].points.reduce((s, p) => s + p.x, 0) / targets[1].points.length;
          const cz = targets[1].points.reduce((s, p) => s + p.z, 0) / targets[1].points.length;
          targets[1].points = targets[1].points.map((p) => ({
            ...p,
            x: cx + (p.x - cx) * scale,
            z: cz + (p.z - cz) * scale,
          }));
        }
      }
      if (c.type === 'coincident' && targets.length >= 2) {
        const p0 = targets[0].points[0];
        const dx = p0.x - targets[1].points[0].x;
        const dz = p0.z - targets[1].points[0].z;
        targets[1].points = targets[1].points.map((p) => ({ ...p, x: p.x + dx, z: p.z + dz }));
      }
      if (c.type === 'fix' && targets[0]) {
        /* points unchanged — marker constraint */
      }
    }

    for (const c of cons) {
      if (c.kind !== 'dimensional' || c.value == null) continue;
      const el = out.find((e) => c.elementIds.includes(e.id));
      if (!el || el.points.length < 2) continue;
      if (c.type === 'distance') {
        const a = el.points[0];
        const b = el.points[el.points.length - 1];
        const len = dist2d(a, b);
        if (len < 1e-6) continue;
        const scale = c.value / len;
        el.points = el.points.map((p, i) =>
          i === 0
            ? p
            : {
                ...p,
                x: a.x + (p.x - a.x) * scale,
                z: a.z + (p.z - a.z) * scale,
              },
        );
      }
    }

    return out;
  },
}));
