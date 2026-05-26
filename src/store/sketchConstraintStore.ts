import { create } from 'zustand';
import { useDrawStore } from './drawStore';
import { useViewerStore } from './viewerStore';
import { GeometricEntity, Constraint, ConstraintType, SolverResult, DOFAnalysis } from '../cad/constraints/ConstraintTypes';
import { ConstraintSolver } from '../cad/constraints/ConstraintSolver';
import { DOFAnalyser } from '../cad/constraints/DOFAnalyser';
import { semanticRef } from '../cad/semantic/SemanticReference';

export type GeometricConstraintType =
  | 'horizontal'
  | 'vertical'
  | 'parallel'
  | 'perpendicular'
  | 'coincident'
  | 'tangent'
  | 'equal'
  | 'symmetric'
  | 'fixed_point'
  | 'midpoint'
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
  solverResult: SolverResult | null;
  dofAnalysis: DOFAnalysis | null;
  setBarVisible: (v: boolean) => void;
  addGeometric: (type: GeometricConstraintType, elementIds: string[]) => SketchConstraint;
  addDimensional: (type: DimensionalConstraintType, elementIds: string[], value: number) => SketchConstraint;
  remove: (id: string) => void;
  clearAll: () => void;
  solveConstraints: () => void;
}

function uid() {
  return `con-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export { semanticRef } from '../cad/semantic/SemanticReference';

export const useSketchConstraintStore = create<SketchConstraintState>((set, get) => ({
  constraints: [],
  barVisible: false,
  solverResult: null,
  dofAnalysis: null,

  setBarVisible: (barVisible) => set({ barVisible }),

  addGeometric: (type, elementIds) => {
    const c: SketchConstraint = {
      id: uid(),
      kind: 'geometric',
      type,
      elementIds,
    };
    set((s) => ({ constraints: [...s.constraints, c] }));
    get().solveConstraints();
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
    get().solveConstraints();
    return c;
  },

  remove: (id) => {
    set((s) => ({ constraints: s.constraints.filter((c) => c.id !== id) }));
    get().solveConstraints();
  },

  clearAll: () => {
    set({ constraints: [] });
    get().solveConstraints();
  },

  solveConstraints: () => {
    const draw = useDrawStore.getState();
    const elements = draw.elements;
    const cons = get().constraints;

    if (elements.length === 0) {
      set({ solverResult: null, dofAnalysis: null });
      return;
    }

    // 1. Build GeometricEntity array from drawStore elements
    const entities: GeometricEntity[] = elements.map(el => {
      const type = el.kind === 'circle' ? 'circle' : el.kind === 'arc' ? 'arc' : el.kind === 'point' ? 'point' : 'line';
      let params: number[] = [];
      if (el.kind === 'circle' && el.points.length >= 2) {
        const r = Math.hypot(el.points[1].x - el.points[0].x, el.points[1].z - el.points[0].z);
        params = [el.points[0].x, el.points[0].z, r];
      } else if (el.kind === 'arc' && el.points.length >= 3) {
        const r = Math.hypot(el.points[1].x - el.points[0].x, el.points[1].z - el.points[0].z);
        const a1 = Math.atan2(el.points[1].z - el.points[0].z, el.points[1].x - el.points[0].x);
        const a2 = Math.atan2(el.points[2].z - el.points[0].z, el.points[2].x - el.points[0].x);
        params = [el.points[0].x, el.points[0].z, r, a1, a2];
      } else if (el.kind === 'point' && el.points.length >= 1) {
        params = [el.points[0].x, el.points[0].z];
      } else {
        // Line segment
        const p1 = el.points[0];
        const p2 = el.points[el.points.length - 1];
        params = [p1.x, p1.z, p2.x, p2.z];
      }

      // Check if this entity has a fixed point constraint or is marked fixed
      const hasFix = cons.some(c => (c.type === 'fix' || c.type === 'fixed_point') && c.elementIds.includes(el.id));
      const name = semanticRef.resolveIdToName(el.id) ?? el.label ?? el.id;

      return {
        id: el.id,
        type,
        params,
        dof: type === 'point' ? 2 : type === 'line' ? 4 : type === 'circle' ? 3 : 5,
        fixed: hasFix,
        name
      };
    });

    // Make sure all entities are registered in semanticRef
    entities.forEach(ent => semanticRef.register(ent));

    // 2. Map frontend SketchConstraint list to the solver Constraint format
    const solverCons: Constraint[] = cons.map(c => {
      let type: ConstraintType = 'coincident';
      if (c.type === 'horizontal') type = 'horizontal';
      else if (c.type === 'vertical') type = 'vertical';
      else if (c.type === 'parallel') type = 'parallel';
      else if (c.type === 'perpendicular') type = 'perpendicular';
      else if (c.type === 'coincident') type = 'coincident';
      else if (c.type === 'equal') type = 'equal_length';
      else if (c.type === 'fix') type = 'fixed_point';
      else if (c.type === 'tangent') type = 'tangent';
      else if (c.type === 'symmetric') type = 'symmetric';
      else if (c.type === 'midpoint') type = 'midpoint';
      else if (c.type === 'angle') type = 'angle';
      else if (c.type === 'distance') type = 'fixed_distance';

      return {
        id: c.id,
        type,
        entities: c.elementIds,
        params: c.value != null ? [c.value] : [],
        satisfied: false,
        error: 0
      };
    });

    // 3. Solve
    const solver = new ConstraintSolver();
    const result = solver.solve(entities, solverCons);

    // 4. Update elements in drawStore
    const nextElements = elements.map(el => {
      const solvedEnt = result.updated_entities.find(e => e.id === el.id);
      if (!solvedEnt) return el;

      const pts = el.points.map(p => ({ ...p }));
      if (solvedEnt.type === 'circle' && pts.length >= 2) {
        const [cx, cz, r] = solvedEnt.params;
        pts[0] = { ...pts[0], x: cx, z: cz };
        pts[1] = { ...pts[1], x: cx + r, z: cz };
      } else if (solvedEnt.type === 'arc' && pts.length >= 3) {
        const [cx, cz, r, a1, a2] = solvedEnt.params;
        pts[0] = { ...pts[0], x: cx, z: cz };
        pts[1] = { ...pts[1], x: cx + r * Math.cos(a1), z: cz + r * Math.sin(a1) };
        pts[2] = { ...pts[2], x: cx + r * Math.cos(a2), z: cz + r * Math.sin(a2) };
      } else if (solvedEnt.type === 'point' && pts.length >= 1) {
        const [px, pz] = solvedEnt.params;
        pts[0] = { ...pts[0], x: px, z: pz };
      } else {
        // Line segment
        const [x1, z1, x2, z2] = solvedEnt.params;
        pts[0] = { ...pts[0], x: x1, z: z1 };
        pts[pts.length - 1] = { ...pts[pts.length - 1], x: x2, z: z2 };
      }

      return {
        ...el,
        points: pts,
        label: solvedEnt.name || el.label
      };
    });

    // Save back to drawStore
    useDrawStore.setState({ elements: nextElements });

    // 5. Update state
    const dofAnalyser = new DOFAnalyser();
    const dofAnalysis = dofAnalyser.analyse(entities, solverCons);

    set({
      solverResult: result,
      dofAnalysis
    });

    // Re-sync sketch rendering in 3D viewer
    useViewerStore.getState().viewerControls?.syncSketches(nextElements, draw.activePoints, draw.floorElevation);
  }
}));
