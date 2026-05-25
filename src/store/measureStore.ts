import { create } from 'zustand';

export interface AreaMeasureResult {
  areaM2: number;
  perimeterM: number;
  pointCount: number;
  source: 'client' | 'server';
}

export interface VolumeMeasureResult {
  volumeM3: number;
  surfaceAreaM2: number;
  name: string;
  entityId: string;
  type: string;
  source: 'ifc' | 'mesh';
}

interface MeasureState {
  areaPoints: { x: number; y: number; z: number }[];
  areaResult: AreaMeasureResult | null;
  volumeResult: VolumeMeasureResult | null;
  measureError: string | null;
  setAreaPoints: (pts: { x: number; y: number; z: number }[]) => void;
  addAreaPoint: (pt: { x: number; y: number; z: number }) => void;
  clearAreaPoints: () => void;
  setAreaResult: (r: AreaMeasureResult | null) => void;
  setVolumeResult: (r: VolumeMeasureResult | null) => void;
  setMeasureError: (msg: string | null) => void;
  clearMeasure: () => void;
}

export const useMeasureStore = create<MeasureState>((set) => ({
  areaPoints: [],
  areaResult: null,
  volumeResult: null,
  measureError: null,

  setAreaPoints: (pts) => set({ areaPoints: pts }),
  addAreaPoint: (pt) => set((s) => ({ areaPoints: [...s.areaPoints, pt], measureError: null })),
  clearAreaPoints: () => set({ areaPoints: [], areaResult: null }),
  setAreaResult: (r) => set({ areaResult: r, measureError: null }),
  setVolumeResult: (r) => set({ volumeResult: r, measureError: null, areaResult: null, areaPoints: [] }),
  setMeasureError: (msg) => set({ measureError: msg }),
  clearMeasure: () =>
    set({ areaPoints: [], areaResult: null, volumeResult: null, measureError: null }),
}));
