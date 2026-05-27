import { create } from 'zustand';
import type { WorkspacePanel } from '../types/boq';

export type MainView = 'bim' | 'gis' | 'sld';

interface WorkspaceState {
  mainView: MainView;
  activePanel: WorkspacePanel;
  openTabs: WorkspacePanel[];
  showInspector: boolean;
  setMainView: (view: MainView) => void;
  setActivePanel: (panel: WorkspacePanel) => void;
  togglePanel: (panel: WorkspacePanel) => void;
  openPanel: (panel: WorkspacePanel) => void;
  closeTab: (panel: WorkspacePanel) => void;
  setShowInspector: (show: boolean) => void;
  toggleInspector: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  mainView: 'bim',
  activePanel: 'viewer',
  openTabs: ['viewer'],
  showInspector: true,

  setMainView: (view) => set({ mainView: view }),

  setActivePanel: (panel) => set((state) => {
    const openTabs = state.openTabs.includes(panel)
      ? state.openTabs
      : [...state.openTabs, panel];
    return { activePanel: panel, openTabs };
  }),

  togglePanel: (panel) => set((state) => {
    if (state.activePanel === panel) {
      return { activePanel: 'viewer' };
    } else {
      const openTabs = state.openTabs.includes(panel)
        ? state.openTabs
        : [...state.openTabs, panel];
      return { activePanel: panel, openTabs };
    }
  }),

  openPanel: (panel) => set((state) => {
    const openTabs = state.openTabs.includes(panel)
      ? state.openTabs
      : [...state.openTabs, panel];
    return { activePanel: panel, openTabs };
  }),

  closeTab: (panel) => set((state) => {
    if (panel === 'viewer') return {};
    const nextTabs = state.openTabs.filter((t) => t !== panel);
    let nextActive = state.activePanel;
    if (state.activePanel === panel) {
      const index = state.openTabs.indexOf(panel);
      if (index > 0) {
        nextActive = state.openTabs[index - 1];
      } else {
        nextActive = nextTabs[0] || 'viewer';
      }
    }
    return { openTabs: nextTabs, activePanel: nextActive };
  }),

  setShowInspector: (show) => set({ showInspector: show }),

  toggleInspector: () => set((s) => ({ showInspector: !s.showInspector })),
}));
