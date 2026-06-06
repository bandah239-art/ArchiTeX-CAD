import { create } from 'zustand';
import { governmentAPI } from '../services/boqAPI';

interface RegisterOptions {
  statuses: string[];
  sectors: string[];
  funding_sources: string[];
  provinces: string[];
}

interface GovernmentState {
  portfolio: Record<string, unknown> | null;
  selectedProject: Record<string, unknown> | null;
  registerOptions: RegisterOptions | null;
  filters: { status: string; province: string; search: string; project_type: string };
  isLoading: boolean;
  error: string | null;
  view: 'portfolio' | 'project' | 'register';
  loadPortfolio: () => Promise<void>;
  loadRegisterOptions: () => Promise<void>;
  setFilters: (f: Partial<GovernmentState['filters']>) => void;
  selectProject: (id: string) => Promise<void>;
  setView: (v: 'portfolio' | 'project' | 'register') => void;
  seedDemo: () => Promise<void>;
  createProject: (payload: Record<string, unknown>) => Promise<void>;
  addSnapshot: (payload: Record<string, unknown>) => Promise<void>;
  generateCertificate: (payload: Record<string, unknown>) => Promise<void>;
  approveCertificate: (certId: string, status: string, approvedBy: string, role?: string) => Promise<void>;
  exportRegister: () => Promise<void>;
}

export const useGovernmentStore = create<GovernmentState>((set, get) => ({
  portfolio: null,
  selectedProject: null,
  registerOptions: null,
  filters: { status: '', province: '', search: '', project_type: '' },
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

  loadRegisterOptions: async () => {
    try {
      const registerOptions = await governmentAPI.registerOptions();
      set({ registerOptions });
    } catch {
      set({ registerOptions: null });
    }
  },

  setFilters: (f) => set({ filters: { ...get().filters, ...f } }),

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
    await get().loadPortfolio();
  },

  createProject: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      await governmentAPI.createProject(payload);
      await get().loadPortfolio();
      set({ view: 'portfolio', isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create project', isLoading: false });
    }
  },

  addSnapshot: async (payload) => {
    const proj = get().selectedProject;
    if (!proj?.id) return;
    set({ isLoading: true, error: null });
    try {
      await governmentAPI.addSnapshot(String(proj.id), payload);
      await get().selectProject(String(proj.id));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Snapshot failed', isLoading: false });
    }
  },

  generateCertificate: async (payload) => {
    const proj = get().selectedProject;
    if (!proj?.id) return;
    set({ isLoading: true, error: null });
    try {
      await governmentAPI.generateCertificate(String(proj.id), payload);
      await get().selectProject(String(proj.id));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Certificate failed', isLoading: false });
    }
  },

  approveCertificate: async (certId, status, approvedBy, role = 'engineer') => {
    const proj = get().selectedProject;
    if (!proj?.id) return;
    try {
      await governmentAPI.approveCertificate(String(proj.id), certId, { status, approved_by: approvedBy, role });
      await get().selectProject(String(proj.id));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Approval failed' });
    }
  },

  exportRegister: async () => {
    const { filters } = get();
    const params: Record<string, string> = {};
    if (filters.status) params.status = filters.status;
    if (filters.province) params.province = filters.province;
    if (filters.project_type) params.project_type = filters.project_type;
    const blob = await governmentAPI.exportRegister(params);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project-register.csv';
    a.click();
    URL.revokeObjectURL(url);
  },
}));
