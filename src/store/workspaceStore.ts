import { create } from 'zustand';
import type { WorkspacePanel } from '../types/boq';

interface WorkspaceState {
  activePanel: WorkspacePanel;
  showInspector: boolean;
  setActivePanel: (panel: WorkspacePanel) => void;
  togglePanel: (panel: WorkspacePanel) => void;
  openPanel: (panel: WorkspacePanel) => void;
  setShowInspector: (show: boolean) => void;
  toggleInspector: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  activePanel: 'viewer',
  showInspector: true,

  setActivePanel: (panel) => set({ activePanel: panel }),

  togglePanel: (panel) => {
    const current = get().activePanel;
    set({ activePanel: current === panel ? 'viewer' : panel });
  },

  openPanel: (panel) => set({ activePanel: panel }),

  setShowInspector: (show) => set({ showInspector: show }),

  toggleInspector: () => set((s) => ({ showInspector: !s.showInspector })),
}));
