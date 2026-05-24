export interface ElectronAPI {
  openFileDialog: () => Promise<string | null>;
  saveFileDialog: (defaultName?: string) => Promise<string | null>;
  readIfcFile: (filePath: string) => Promise<Uint8Array>;
  getAppVersion: () => Promise<string>;
  getPythonServerStatus: () => Promise<{ running: boolean; status?: string }>;
  onPythonStatus: (callback: (status: { running: boolean }) => void) => () => void;
  syncStatus: () => Promise<{ pending: number; projects: number; calculations: number; db_path?: string }>;
  syncUnsyncedCount: () => Promise<number>;
  syncPush: () => Promise<{ pushed: number; pulled: number; conflicts: number }>;
  syncRecordChange: (table: string, recordId: string, operation: string, data: Record<string, unknown>) => Promise<{ id: string }>;
  offlineSaveProject: (id: string, data: Record<string, unknown>) => Promise<void>;
  offlineLoadProjects: () => Promise<Record<string, unknown>[]>;
  offlineSaveCalculation: (id: string, projectId: string, type: string, inputs: Record<string, unknown>, results: Record<string, unknown>) => Promise<void>;
  offlineLoadCalculations: (projectId: string) => Promise<Record<string, unknown>[]>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
