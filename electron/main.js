import { app, BrowserWindow, ipcMain, dialog, session, shell } from 'electron';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { createMenu } from './menu.js';
import {
  describePythonSource,
  getPipInstallConfig,
  getUvicornLaunchConfig,
  resolvePythonExecutable,
} from '../scripts/resolve-python.mjs';
import {
  recordChange,
  getSyncStatus,
  getUnsyncedCount,
  syncToServer,
  saveProjectLocal,
  loadProjectsLocal,
  saveCalculationLocal,
  loadCalculationsLocal,
  closeOfflineDb,
} from './offline-sync.js';

const API_BASE = process.env.VITE_API_BASE ?? 'http://127.0.0.1:8000';
const PYTHON_EXTERNAL = process.env.INFRA_PYTHON_EXTERNAL === '1';

// Prevent crash when concurrently closes stdout/stderr (common in electron:dev).
function ignorePipeErrors(stream) {
  stream?.on?.('error', (err) => {
    if (err?.code === 'EPIPE') return;
  });
}
ignorePipeErrors(process.stdout);
ignorePipeErrors(process.stderr);

process.on('uncaughtException', (err) => {
  if (err?.code === 'EPIPE') return;
  console.error('Uncaught exception:', err);
});

function safeLog(...args) {
  try {
    console.log(...args);
  } catch (err) {
    if (err?.code !== 'EPIPE') throw err;
  }
}

function safeWarn(...args) {
  try {
    console.warn(...args);
  } catch (err) {
    if (err?.code !== 'EPIPE') throw err;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
const PYTHON_PORT = 8000;
const MIN_WIDTH = 1400;
const MIN_HEIGHT = 900;

let mainWindow = null;
let pythonProcess = null;

function getPythonSpawnArgs() {
  const { cmd, args, shell } = getUvicornLaunchConfig({
    host: '127.0.0.1',
    port: PYTHON_PORT,
    reload: false,
  });
  return { cmd, args, shell };
}

function getPythonScriptPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'python');
  }
  return path.join(process.resourcesPath, 'python');
}

function checkServerHealth(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function waitForServer(port, maxAttempts = 30, interval = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          retry();
        }
      });
      req.on('error', retry);
      req.setTimeout(2000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      attempts++;
      if (attempts >= maxAttempts) {
        reject(new Error(`Python server did not start within ${maxAttempts} seconds`));
      } else {
        setTimeout(check, interval);
      }
    };

    check();
  });
}

function getPythonPipArgs() {
  const { cmd, args, shell } = getPipInstallConfig();
  return { cmd, args, shell };
}

function ensurePythonDependencies() {
  return new Promise((resolve) => {
    if (!isDev || PYTHON_EXTERNAL) {
      resolve();
      return;
    }

    const pythonDir = getPythonScriptPath();
    const { cmd, args, shell } = getPythonPipArgs();
    const exe = resolvePythonExecutable();
    safeLog(
      `[Python] Checking dependencies (${describePythonSource(exe)})...`,
      exe ?? cmd,
    );

    const proc = spawn(cmd, args, {
      cwd: pythonDir,
      stdio: 'inherit',
      shell,
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        safeWarn(`[Python] Dependency install exited with code ${code}`);
      }
      resolve();
    });

    proc.on('error', (err) => {
      safeWarn('[Python] Dependency install failed:', err.message);
      resolve();
    });
  });
}

function spawnPythonServer() {
  checkServerHealth(PYTHON_PORT).then((alreadyRunning) => {
    if (alreadyRunning) {
      safeLog('Python server already running on port', PYTHON_PORT);
      return;
    }

    const pythonDir = getPythonScriptPath();
    const { cmd, args, shell } = getPythonSpawnArgs();
    const exe = resolvePythonExecutable();
    safeLog(
      `[Python] Starting server (${describePythonSource(exe)})...`,
      exe ?? cmd,
    );

    pythonProcess = spawn(cmd, args, {
      cwd: pythonDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell,
    });

    pythonProcess.stdout?.on('data', (data) => {
      const message = data.toString().trim();
      safeLog(`[Python] ${message}`);
      if (mainWindow) {
        mainWindow.webContents.send('python-server-log', message);
      }
    });

    pythonProcess.stderr?.on('data', (data) => {
      safeWarn(`[Python Error] ${data.toString().trim()}`);
    });

    pythonProcess.on('close', (code) => {
      safeLog(`Python server exited with code ${code}`);
      pythonProcess = null;
      if (mainWindow) {
        mainWindow.webContents.send('python-server-status', { running: false, code });
      }
    });
  });
}

function killPythonServer() {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
}

async function getDevServerUrl() {
  const ports = [5173, 5174, 5175];
  const maxAttempts = 45;
  const delay = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    safeLog(`[Electron] Checking dev server ports (attempt ${attempt}/${maxAttempts})...`);
    for (const port of ports) {
      try {
        const ok = await new Promise((resolve) => {
          const req = http.get(`http://localhost:${port}`, (res) => {
            resolve(res.statusCode === 200);
          });
          req.on('error', () => resolve(false));
          req.setTimeout(800, () => {
            req.destroy();
            resolve(false);
          });
        });
        if (ok) {
          safeLog(`[Electron] Found active dev server on port ${port}`);
          return `http://localhost:${port}`;
        }
      } catch {
        // try next port
      }
    }
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  safeLog('[Electron] No active dev server found, falling back to default.');
  return 'http://localhost:5173';
}

function createWindow() {
  const preloadCjs = path.join(__dirname, 'preload.cjs');
  const preloadJs = path.join(__dirname, 'preload.js');
  const preloadPath = fs.existsSync(preloadCjs) ? preloadCjs : preloadJs;

  // #region agent log
  // #endregion

  mainWindow = new BrowserWindow({
    width: MIN_WIDTH,
    height: MIN_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    title: 'ARCHITEX-CAD',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' } : {}),
  });

  if (isDev) {
    getDevServerUrl().then((url) => {
      mainWindow.loadURL(url);
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createMenu(mainWindow);
}

// IPC handlers
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'IFC Files', extensions: ['ifc'] }],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('save-file-dialog', async (_, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'calculation-report.pdf',
    filters: [
      { name: 'PDF Files', extensions: ['pdf'] },
      { name: 'Excel Files', extensions: ['xlsx'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('read-ifc-file', async (_, filePath) => {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid IFC file path');
  }
  return fs.readFileSync(filePath);
});

ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('python-server-status', async () => {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${PYTHON_PORT}/health`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ running: true, ...JSON.parse(data) });
        } catch {
          resolve({ running: true });
        }
      });
    });
    req.on('error', () => resolve({ running: false }));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve({ running: false });
    });
  });
});

// Offline sync IPC
ipcMain.handle('sync:status', () => getSyncStatus());
ipcMain.handle('sync:unsynced-count', () => getUnsyncedCount());
ipcMain.handle('sync:push', () => syncToServer(API_BASE));
ipcMain.handle('sync:record-change', (_, table, recordId, operation, data) =>
  recordChange(table, recordId, operation, data)
);
ipcMain.handle('offline:save-project', (_, id, data) => saveProjectLocal(id, data));
ipcMain.handle('offline:load-projects', () => loadProjectsLocal());
ipcMain.handle('offline:save-calculation', (_, id, projectId, type, inputs, results) =>
  saveCalculationLocal(id, projectId, type, inputs, results)
);
ipcMain.handle('offline:load-calculations', (_, projectId) => loadCalculationsLocal(projectId));

// OS Action IPC
ipcMain.handle('os-action', async (_, action, targetPath) => {
  try {
    switch (action) {
      case 'minimize_app':
        if (mainWindow) mainWindow.minimize();
        return { success: true };
      case 'maximize_app':
        if (mainWindow) {
          if (mainWindow.isMaximized()) mainWindow.unmaximize();
          else mainWindow.maximize();
        }
        return { success: true };
      case 'open_folder':
        if (targetPath) {
          const result = await shell.openPath(targetPath);
          return { success: !result, error: result };
        }
        return { success: false, error: 'No path provided' };
      default:
        return { success: false, error: `Unknown OS action: ${action}` };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
});

app.whenReady().then(async () => {
  if (isDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' blob: http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.openstreetmap.org; font-src 'self' data:; worker-src 'self' blob:;",
          ],
        },
      });
    });
  }

  await ensurePythonDependencies();

  if (!process.env.INFRA_PYTHON_EXTERNAL) {
    spawnPythonServer();
  } else {
    const ok = await checkServerHealth(PYTHON_PORT);
    safeLog(
      ok
        ? `Using external Python server on port ${PYTHON_PORT}`
        : `Warning: INFRA_PYTHON_EXTERNAL set but no server on port ${PYTHON_PORT}`
    );
  }

  try {
    await waitForServer(PYTHON_PORT, PYTHON_EXTERNAL ? 60 : 30);
    safeLog('Python calculation server is ready');
    createWindow();
  } catch (err) {
    safeWarn('Failed to start Python server:', err.message);
    createWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  killPythonServer();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  killPythonServer();
  closeOfflineDb();
});

process.on('exit', () => {
  killPythonServer();
});
