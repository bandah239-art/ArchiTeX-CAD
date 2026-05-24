export interface ElectronAPI {
  openFileDialog: () => Promise<string | null>;
  saveFileDialog: (defaultName?: string) => Promise<string | null>;
  getAppVersion: () => Promise<string>;
  getPythonServerStatus: () => Promise<{ running: boolean; status?: string }>;
  onPythonStatus: (callback: (status: { running: boolean }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
