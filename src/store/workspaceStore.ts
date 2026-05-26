import { create } from 'zustand';
import type { WorkspacePanel } from '../types/boq';

export type MainView = 'bim' | 'gis' | 'sld';

interface WorkspaceState {
  mainView: MainView;
  activePanel: WorkspacePanel;
  showInspector: boolean;
  setMainView: (view: MainView) => void;
  setActivePanel: (panel: WorkspacePanel) => void;
  togglePanel: (panel: WorkspacePanel) => void;
  openPanel: (panel: WorkspacePanel) => void;
  setShowInspector: (show: boolean) => void;
  toggleInspector: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  mainView: 'bim',
  activePanel: 'viewer',
  showInspector: true,

  setMainView: (view) => set({ mainView: view }),

  setActivePanel: (panel) => set({ activePanel: panel }),

  togglePanel: (panel) => {
    const current = get().activePanel;
    set({ activePanel: current === panel ? 'viewer' : panel });
  },

  openPanel: (panel) => set({ activePanel: panel }),

  setShowInspector: (show) => set({ showInspector: show }),

  toggleInspector: () => set((s) => ({ showInspector: !s.showInspector })),
}));
