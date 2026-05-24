import { create } from 'zustand';

interface OfflineSyncState {
  pending: number;
  projects: number;
  isSyncing: boolean;
  lastSync: string | null;
  error: string | null;
  refreshStatus: () => Promise<void>;
  pushSync: () => Promise<void>;
  saveProjectOffline: (id: string, data: Record<string, unknown>) => Promise<void>;
}

export const useOfflineSyncStore = create<OfflineSyncState>((set) => ({
  pending: 0,
  projects: 0,
  isSyncing: false,
  lastSync: null,
  error: null,

  refreshStatus: async () => {
    if (!window.electronAPI?.syncStatus) return;
    try {
      const status = await window.electronAPI.syncStatus();
      set({ pending: status.pending ?? 0, projects: status.projects ?? 0 });
    } catch {
      /* desktop only */
    }
  },

  pushSync: async () => {
    if (!window.electronAPI?.syncPush) {
      set({ error: 'Offline sync requires Electron desktop app' });
      return;
    }
    set({ isSyncing: true, error: null });
    try {
      const result = await window.electronAPI.syncPush();
      set({
        isSyncing: false,
        lastSync: new Date().toISOString(),
        pending: 0,
      });
      if (result.conflicts > 0) {
        set({ error: `${result.conflicts} conflict(s) — review sync queue` });
      }
      await useOfflineSyncStore.getState().refreshStatus();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Sync failed', isSyncing: false });
    }
  },

  saveProjectOffline: async (id, data) => {
    if (!window.electronAPI?.offlineSaveProject) return;
    await window.electronAPI.offlineSaveProject(id, data);
    await useOfflineSyncStore.getState().refreshStatus();
  },
}));
