const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  saveFileDialog: (defaultName) => ipcRenderer.invoke('save-file-dialog', defaultName),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPythonServerStatus: () => ipcRenderer.invoke('python-server-status'),
  onPythonStatus: (callback) => {
    ipcRenderer.on('python-server-status', (_, status) => callback(status));
    return () => ipcRenderer.removeAllListeners('python-server-status');
  },
});
