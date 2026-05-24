import { create } from 'zustand';
import { governmentAPI } from '../services/boqAPI';

interface GovernmentState {
  portfolio: Record<string, unknown> | null;
  selectedProject: Record<string, unknown> | null;
  isLoading: boolean;
  error: string | null;
  view: 'portfolio' | 'project';
  loadPortfolio: () => Promise<void>;
  selectProject: (id: string) => Promise<void>;
  setView: (v: 'portfolio' | 'project') => void;
  seedDemo: () => Promise<void>;
}

export const useGovernmentStore = create<GovernmentState>((set) => ({
  portfolio: null,
  selectedProject: null,
  isLoading: false,
  error: null,
  view: 'portfolio',

  loadPortfolio: async () => {
    set({ isLoading: true, error: null });
    try {
      const portfolio = await governmentAPI.portfolioSummary();
      set({ portfolio, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load portfolio', isLoading: false });
    }
  },

  selectProject: async (id) => {
    set({ isLoading: true, error: null, view: 'project' });
    try {
      const selectedProject = await governmentAPI.getProject(id);
      set({ selectedProject, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load project', isLoading: false });
    }
  },

  setView: (v) => set({ view: v }),

  seedDemo: async () => {
    await governmentAPI.seedProjects();
    await useGovernmentStore.getState().loadPortfolio();
  },
}));
