import { create } from 'zustand';
import { scheduleAPI } from '../services/scheduleAPI';
import { useIfcModelStore } from './ifcModelStore';
import { useProjectStore } from './projectStore';
import { getCumulativeCostAtWeek } from '../services/timeline4d';

export interface ScheduleActivity {
  id: string;
  name: string;
  ifc_type?: string;
  start_week: number;
  duration_weeks: number;
  cost_usd: number;
  element_ids?: string[];
}

export interface ScheduleData {
  duration_weeks: number;
  total_cost_usd: number;
  activities: ScheduleActivity[];
  cost_s_curve?: { weeks: number[]; cumulative_cost_usd: number[] };
}

interface ScheduleState {
  schedule: ScheduleData | null;
  currentWeek: number;
  isPlaying: boolean;
  playbackMs: number;
  timelineEnabled: boolean;
  isBuilding: boolean;
  error: string | null;
  buildFromBim: () => Promise<void>;
  setCurrentWeek: (week: number) => void;
  setTimelineEnabled: (enabled: boolean) => void;
  play: () => void;
  pause: () => void;
  tickPlayback: () => void;
  getCumulativeCost: () => number;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  schedule: null,
  currentWeek: 0,
  isPlaying: false,
  playbackMs: 400,
  timelineEnabled: false,
  isBuilding: false,
  error: null,

  buildFromBim: async () => {
    const elements = useIfcModelStore.getState().elements;
    if (!elements.length) {
      set({ error: 'No BIM elements — open an IFC model first' });
      return;
    }
    set({ isBuilding: true, error: null });
    try {
      const project = useProjectStore.getState().currentProject;
      const raw = await scheduleAPI.buildFromBim({
        project_name: project?.name ?? 'Project',
        duration_weeks: 52,
        elements: elements.map((e) => ({
          type: e.type,
          name: e.name,
          globalId: e.globalId,
          id: e.globalId,
          volume: e.volume,
          area: e.area,
          length: e.length,
        })),
      });
      const schedule = raw as ScheduleData;
      set({
        schedule,
        currentWeek: 0,
        timelineEnabled: true,
        isBuilding: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Schedule build failed',
        isBuilding: false,
      });
    }
  },

  setCurrentWeek: (week) => {
    const max = get().schedule?.duration_weeks ?? 52;
    set({ currentWeek: Math.max(0, Math.min(max, week)) });
  },

  setTimelineEnabled: (enabled) => set({ timelineEnabled: enabled }),

  play: () => set({ isPlaying: true, timelineEnabled: true }),

  pause: () => set({ isPlaying: false }),

  tickPlayback: () => {
    const { schedule, currentWeek, isPlaying } = get();
    if (!isPlaying || !schedule) return;
    if (currentWeek >= schedule.duration_weeks) {
      set({ isPlaying: false });
      return;
    }
    set({ currentWeek: currentWeek + 1 });
  },

  getCumulativeCost: () => {
    const { schedule, currentWeek } = get();
    if (!schedule) return 0;
    return getCumulativeCostAtWeek(schedule.activities, currentWeek);
  },
}));
