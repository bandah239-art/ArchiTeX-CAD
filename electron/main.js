import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { createMenu } from './menu.js';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
const PYTHON_PORT = 8000;
const MIN_WIDTH = 1400;
const MIN_HEIGHT = 900;

let mainWindow = null;
let pythonProcess = null;

function getPythonSpawnArgs() {
  if (process.platform === 'win32') {
    return { cmd: 'py', args: ['-3', '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(PYTHON_PORT)] };
  }
  return { cmd: 'python3', args: ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(PYTHON_PORT)] };
}

function getPythonScriptPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'python');
  }
  return path.join(process.resourcesPath, 'python');
}

function checkServerHealth(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/health`, (res) => {
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
      const req = http.get(`http://localhost:${port}/health`, (res) => {
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
  if (process.platform === 'win32') {
    return { cmd: 'py', args: ['-3', '-m', 'pip', 'install', '-r', 'requirements.txt'] };
  }
  return { cmd: 'python3', args: ['-m', 'pip', 'install', '-r', 'requirements.txt'] };
}

function ensurePythonDependencies() {
  return new Promise((resolve) => {
    if (!isDev) {
      resolve();
      return;
    }

    const pythonDir = getPythonScriptPath();
    const { cmd, args } = getPythonPipArgs();
    console.log('[Python] Checking dependencies...');

    const proc = spawn(cmd, args, {
      cwd: pythonDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        console.warn(`[Python] Dependency install exited with code ${code}`);
      }
      resolve();
    });

    proc.on('error', (err) => {
      console.warn('[Python] Dependency install failed:', err.message);
      resolve();
    });
  });
}

function spawnPythonServer() {
  checkServerHealth(PYTHON_PORT).then((alreadyRunning) => {
    if (alreadyRunning) {
      console.log('Python server already running on port', PYTHON_PORT);
      return;
    }

    const pythonDir = getPythonScriptPath();
    const { cmd, args } = getPythonSpawnArgs();

    pythonProcess = spawn(cmd, args, {
      cwd: pythonDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    pythonProcess.stdout?.on('data', (data) => {
      const message = data.toString().trim();
      console.log(`[Python] ${message}`);
      if (mainWindow) {
        mainWindow.webContents.send('python-server-log', message);
      }
    });

    pythonProcess.stderr?.on('data', (data) => {
      console.error(`[Python Error] ${data.toString().trim()}`);
    });

    pythonProcess.on('close', (code) => {
      console.log(`Python server exited with code ${code}`);
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
  for (const port of [5173, 5174, 5175]) {
    try {
      const ok = await new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}`, (res) => {
          resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(1000, () => {
          req.destroy();
          resolve(false);
        });
      });
      if (ok) return `http://localhost:${port}`;
    } catch {
      // try next port
    }
  }
  return 'http://localhost:5173';
}

function createWindow() {
  const preloadCjs = path.join(__dirname, 'preload.cjs');
  const preloadJs = path.join(__dirname, 'preload.js');
  const preloadPath = fs.existsSync(preloadCjs) ? preloadCjs : preloadJs;

  // #region agent log
  fetch('http://127.0.0.1:7820/ingest/7d513013-2365-472f-b514-5c535ee848a3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9f3587'},body:JSON.stringify({sessionId:'9f3587',location:'electron/main.js:createWindow',message:'preload path resolved',data:{preloadPath,existsCjs:fs.existsSync(preloadCjs),existsJs:fs.existsSync(preloadJs)},timestamp:Date.now(),hypothesisId:'A-B-C'})}).catch(()=>{});
  // #endregion

  mainWindow = new BrowserWindow({
    width: MIN_WIDTH,
    height: MIN_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    title: 'INFRAFRICA',
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
    const req = http.get(`http://localhost:${PYTHON_PORT}/health`, (res) => {
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

app.whenReady().then(async () => {
  if (isDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.openstreetmap.org;",
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
    console.log(
      ok
        ? `Using external Python server on port ${PYTHON_PORT}`
        : `Warning: INFRA_PYTHON_EXTERNAL set but no server on port ${PYTHON_PORT}`
    );
  }

  try {
    await waitForServer(PYTHON_PORT);
    console.log('Python calculation server is ready');
    createWindow();
  } catch (err) {
    console.error('Failed to start Python server:', err.message);
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
