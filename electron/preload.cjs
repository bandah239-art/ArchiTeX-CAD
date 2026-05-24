const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  saveFileDialog: (defaultName) => ipcRenderer.invoke('save-file-dialog', defaultName),
  readIfcFile: (filePath) => ipcRenderer.invoke('read-ifc-file', filePath),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPythonServerStatus: () => ipcRenderer.invoke('python-server-status'),
  onPythonStatus: (callback) => {
    ipcRenderer.on('python-server-status', (_, status) => callback(status));
    return () => ipcRenderer.removeAllListeners('python-server-status');
  },
  syncStatus: () => ipcRenderer.invoke('sync:status'),
  syncUnsyncedCount: () => ipcRenderer.invoke('sync:unsynced-count'),
  syncPush: () => ipcRenderer.invoke('sync:push'),
  syncRecordChange: (table, recordId, operation, data) =>
    ipcRenderer.invoke('sync:record-change', table, recordId, operation, data),
  offlineSaveProject: (id, data) => ipcRenderer.invoke('offline:save-project', id, data),
  offlineLoadProjects: () => ipcRenderer.invoke('offline:load-projects'),
  offlineSaveCalculation: (id, projectId, type, inputs, results) =>
    ipcRenderer.invoke('offline:save-calculation', id, projectId, type, inputs, results),
  offlineLoadCalculations: (projectId) => ipcRenderer.invoke('offline:load-calculations', projectId),
});
