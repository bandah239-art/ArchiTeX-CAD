import { create } from 'zustand';
import type { SketchElement } from './drawStore';

export interface SketchBlockDef {
  name: string;
  elements: SketchElement[];
  basePoint: { x: number; y: number; z: number };
  createdAt: number;
}

export interface BlockInstance {
  id: string;
  blockName: string;
  insert: { x: number; y: number; z: number };
  rotation: number;
  scale: number;
}

interface SketchBlockState {
  definitions: SketchBlockDef[];
  instances: BlockInstance[];
  activeBlockName: string | null;
  createFromElements: (name: string, elements: SketchElement[], basePoint: { x: number; y: number; z: number }) => void;
  insertBlock: (name: string, at: { x: number; y: number; z: number }) => SketchElement[];
  exportWblock: (name: string) => SketchBlockDef | null;
  setActiveBlock: (name: string | null) => void;
  listNames: () => string[];
}

function uid() {
  return `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const useSketchBlockStore = create<SketchBlockState>((set, get) => ({
  definitions: [],
  instances: [],
  activeBlockName: null,

  createFromElements: (name, elements, basePoint) => {
    const def: SketchBlockDef = {
      name,
      elements: elements.map((e) => ({
        ...e,
        points: e.points.map((p) => ({
          x: p.x - basePoint.x,
          y: p.y - basePoint.y,
          z: p.z - basePoint.z,
        })),
      })),
      basePoint,
      createdAt: Date.now(),
    };
    set((s) => ({
      definitions: [...s.definitions.filter((d) => d.name !== name), def],
      activeBlockName: name,
    }));
  },

  insertBlock: (name, at) => {
    const def = get().definitions.find((d) => d.name === name);
    if (!def) return [];
    const placed: SketchElement[] = def.elements.map((e) => ({
      ...e,
      id: uid(),
      points: e.points.map((p) => ({
        x: p.x + at.x,
        y: p.y + at.y,
        z: p.z + at.z,
      })),
      createdAt: Date.now(),
    }));
    set((s) => ({
      instances: [
        ...s.instances,
        { id: uid(), blockName: name, insert: at, rotation: 0, scale: 1 },
      ],
    }));
    return placed;
  },

  exportWblock: (name) => get().definitions.find((d) => d.name === name) ?? null,

  setActiveBlock: (activeBlockName) => set({ activeBlockName }),

  listNames: () => get().definitions.map((d) => d.name),
}));
