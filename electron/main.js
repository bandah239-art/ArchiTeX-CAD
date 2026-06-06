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

const PYTHON_EXTERNAL = process.env.INFRA_PYTHON_EXTERNAL === '1';
let PYTHON_PORT = 8000;
let API_BASE = process.env.VITE_API_BASE ?? `http://127.0.0.1:${PYTHON_PORT}`;

// Prevent crash when concurrently closes stdout/stderr (common in electron:dev).
function ignorePipeErrors(stream) {
  stream?.on?.('error', (err) => {
    if (err?.code === 'EPIPE') return;
  });
}
ignorePipeErrors(process.stdout);
ignorePipeErrors(process.stderr);

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

/** Check if a TCP port is in use (any process). Resolves true if port is occupied. */
function isPortOccupied(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const tester = net.createServer()
      .once('error', () => resolve(true))
      .once('listening', () => { tester.close(); resolve(false); })
      .listen(port, '127.0.0.1');
  });
}

/**
 * Find a free port starting from `startPort`.
 * If `startPort` is occupied by our own Python server (responds to /health),
 * we reuse it. Otherwise we increment until a truly free port is found.
 */
async function findPythonPort(startPort = 8000, maxAttempts = 10) {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    const occupied = await isPortOccupied(port);
    if (!occupied) {
      safeLog(`[Python] Port ${port} is free — will bind there.`);
      return port;
    }
    // Port is in use — check if it's OUR Python server
    const isOurs = await checkServerHealth(port);
    if (isOurs) {
      safeLog(`[Python] Port ${port} already has our server running — reusing.`);
      return port;
    }
    safeWarn(`[Python] Port ${port} is occupied by another process — trying ${port + 1}.`);
  }
  safeWarn(`[Python] No free port found in range ${startPort}–${startPort + maxAttempts - 1}; falling back to ${startPort}.`);
  return startPort;
}

/** Build the loading screen HTML shown while Python starts up. */
function loadingScreenHTML(status = 'Starting calculation engine\u2026') {
  const safe = status.replace(/[<>&"']/g, '');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>ARCHITEX-CAD</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { height: 100vh; display: flex; flex-direction: column;
         align-items: center; justify-content: center;
         background: #0f1117; color: #e2e8f0;
         font-family: system-ui, -apple-system, sans-serif; }
  .logo { font-size: 1.6rem; font-weight: 700; letter-spacing: 2px;
          color: #60a5fa; margin-bottom: 0.5rem; }
  .sub  { font-size: 0.75rem; letter-spacing: 3px; color: #475569;
          text-transform: uppercase; margin-bottom: 2.5rem; }
  .spinner { width: 40px; height: 40px; border: 3px solid #1e293b;
             border-top-color: #3b82f6; border-radius: 50%;
             animation: spin 0.8s linear infinite; margin-bottom: 1.5rem; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .status { font-size: 0.85rem; color: #64748b; max-width: 360px; text-align: center; }
  #progress { width: 260px; height: 3px; background: #1e293b;
              border-radius: 2px; margin-top: 1.5rem; overflow: hidden; }
  #bar { height: 100%; width: 0%; background: #3b82f6;
         border-radius: 2px; transition: width 0.4s ease;
         animation: indeterminate 1.5s ease infinite; }
  @keyframes indeterminate {
    0%   { transform: translateX(-100%); width: 40%; }
    100% { transform: translateX(360px); width: 40%; }
  }
</style></head>
<body>
  <div class="logo">ARCHITEX-CAD</div>
  <div class="sub">Infrastructure Engineering Platform</div>
  <div class="spinner"></div>
  <div class="status" id="msg">${safe}</div>
  <div id="progress"><div id="bar"></div></div>
</body></html>`;
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
  const alreadyRunning = checkServerHealth(PYTHON_PORT).then((running) => {
    if (running) {
      safeLog('Python server already running on port', PYTHON_PORT);
      return;
    }

    const pythonDir = getPythonScriptPath();

    // Build spawn args using the resolved port (may differ from default 8000)
    const { cmd: _cmd, args: _defaultArgs, shell } = getPythonSpawnArgs();
    const exe = resolvePythonExecutable();

    // Override the port in uvicorn args to match the resolved port
    const portArg = `--port=${PYTHON_PORT}`;
    const args = _defaultArgs.map((a) =>
      typeof a === 'string' && a.startsWith('--port') ? portArg : a
    );
    // If args don't include --port, add it
    if (!args.some((a) => typeof a === 'string' && a.startsWith('--port'))) {
      args.push('--port', String(PYTHON_PORT));
    }

    safeLog(
      `[Python] Starting server on port ${PYTHON_PORT} (${describePythonSource(exe)})...`,
      exe ?? _cmd,
    );
    const cmd = _cmd;

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
  const envPort = Number(process.env.VITE_DEV_PORT) || 5190;
  const ports = [envPort];
  const maxAttempts = 45;
  const delay = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    safeLog(`[Electron] Checking dev server ports (attempt ${attempt}/${maxAttempts})...`);
    for (const port of ports) {
      try {
        const ok = await new Promise((resolve) => {
          const req = http.get(`http://localhost:${port}`, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk.toString(); });
            res.on('end', () => {
              const isArchitex = res.statusCode === 200 && (
                body.includes('data-app="architex-cad"') ||
                body.includes("data-app='architex-cad'") ||
                body.includes('<title>ARCHITEX-CAD</title>')
              );
              resolve(isArchitex);
            });
          });
          req.on('error', () => resolve(false));
          req.setTimeout(2000, () => {
            req.destroy();
            resolve(false);
          });
        });
        if (ok) {
          safeLog(`[Electron] Found ARCHITEX-CAD dev server on port ${port}`);
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
  safeLog('[Electron] No ARCHITEX-CAD dev server found on port', envPort);
  return `http://localhost:${envPort}`;
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

  let windowShown = false;

  /** Ensure the window becomes visible exactly once, regardless of load outcome. */
  function ensureWindowVisible() {
    if (windowShown || !mainWindow || mainWindow.isDestroyed()) return;
    windowShown = true;
    mainWindow.show();
  }

  /**
   * Display a user-friendly error page when loading fails.
   * Keeps the window visible so the user knows something went wrong.
   */
  function showErrorPage(title, detail) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const safeTitle = (title || 'Load Error').replace(/[<>&"']/g, '');
    const safeDetail = (detail || '').replace(/[<>&"']/g, '');
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"><title>ARCHITEX-CAD</title>
      <style>
        body { margin:0; display:flex; align-items:center; justify-content:center;
               height:100vh; background:#0f1117; color:#e2e8f0;
               font-family:system-ui,-apple-system,sans-serif; text-align:center; }
        .card { padding:3rem; max-width:520px; }
        h1 { font-size:1.5rem; color:#f87171; margin-bottom:0.5rem; }
        p  { font-size:0.95rem; color:#94a3b8; line-height:1.6; }
        code { background:#1e293b; padding:0.15rem 0.4rem; border-radius:4px; font-size:0.85rem; }
        button { margin-top:1.5rem; padding:0.6rem 1.6rem; border:none; border-radius:6px;
                 background:#3b82f6; color:#fff; font-size:0.9rem; cursor:pointer; }
        button:hover { background:#2563eb; }
      </style></head><body>
      <div class="card">
        <h1>${safeTitle}</h1>
        <p>${safeDetail}</p>
        <button onclick="location.reload()">Retry</button>
      </div></body></html>
    `)}`).catch(() => {});
    ensureWindowVisible();
  }

  // Dev-mode retry state
  let devLoadRetries = 0;
  const MAX_DEV_RETRIES = 3;
  const DEV_RETRY_DELAY = 2000;
  let currentDevUrl = null;

  if (isDev) {
    getDevServerUrl().then((url) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      currentDevUrl = url;
      safeLog(`[Electron] Loading dev URL: ${url}`);
      mainWindow.loadURL(url).catch((err) => {
        safeWarn(`[Electron] Failed to load dev URL ${url}:`, err.message);
        // did-fail-load handler will take care of retry / error page
      });
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }).catch((err) => {
      safeWarn(`[Electron] getDevServerUrl() rejected:`, err.message);
      showErrorPage(
        'Dev Server Unreachable',
        'Could not connect to the Vite dev server.<br>Run <code>npm run dev</code> first, then restart Electron.',
      );
    });
  } else {
    const prodPath = path.join(__dirname, '..', 'dist', 'index.html');
    safeLog(`[Electron] Loading production file: ${prodPath}`);
    if (!fs.existsSync(prodPath)) {
      safeWarn(`[Electron] Production build not found at ${prodPath}`);
      // Defer showing the error page until after 'ready-to-show' listeners are wired
      setTimeout(() => {
        showErrorPage(
          'Build Not Found',
          `Expected production build at:<br><code>${prodPath}</code><br>Run <code>npm run build</code> first.`,
        );
      }, 100);
    } else {
      mainWindow.loadFile(prodPath).catch((err) => {
        safeWarn(`[Electron] Failed to load production file:`, err.message);
        showErrorPage('Failed to Load', err.message);
      });
    }
  }

  // Catch renderer crashes that cause white screens
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    safeWarn(`[Electron] Renderer process gone: ${details.reason} (exit code: ${details.exitCode})`);
    showErrorPage(
      'Renderer Crashed',
      `The renderer process terminated unexpectedly.<br>Reason: <code>${details.reason}</code>`,
    );
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    safeWarn(`[Electron] Page failed to load: ${errorDescription} (code: ${errorCode}, url: ${validatedURL})`);

    // Ignore sub-frame / aborted loads
    if (errorCode === -3) return; // ERR_ABORTED — normal during navigation

    if (isDev && currentDevUrl && devLoadRetries < MAX_DEV_RETRIES) {
      devLoadRetries++;
      safeLog(`[Electron] Retrying dev URL in ${DEV_RETRY_DELAY}ms (attempt ${devLoadRetries}/${MAX_DEV_RETRIES})...`);
      setTimeout(() => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        mainWindow.loadURL(currentDevUrl).catch(() => {});
      }, DEV_RETRY_DELAY);
    } else {
      showErrorPage(
        'Page Failed to Load',
        `${errorDescription || 'Unknown error'} (code ${errorCode})<br>URL: <code>${validatedURL || 'N/A'}</code>`,
      );
    }
  });

  mainWindow.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) { // warning or error
      safeLog(`[Renderer ${level === 3 ? 'ERROR' : 'WARN'}] ${message}`);
    }
  });

  mainWindow.once('ready-to-show', () => {
    ensureWindowVisible();
  });

  // Safety timeout: if the window still hasn't shown after 15 seconds, force-show it.
  // This prevents the app from appearing frozen/hung when loading stalls.
  setTimeout(() => {
    if (!windowShown) {
      safeWarn('[Electron] Safety timeout reached — force-showing window.');
      ensureWindowVisible();
    }
  }, 15_000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createMenu(mainWindow);
}

// IPC handlers
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      {
        name: 'Supported CAD / GIS / BIM / Data Files',
        extensions: [
          'ifc', 'dwg', 'dxf',
          'step', 'stp', 'stl', 'obj', 'gltf', 'glb', 'fbx', '3ds',
          'geojson', 'json', 'shp',
          'csv', 'xlsx', 'xls'
        ]
      },
      { name: 'IFC BIM Models (*.ifc)', extensions: ['ifc'] },
      { name: 'CAD Drawing Exchange (*.dwg, *.dxf)', extensions: ['dwg', 'dxf'] },
      { name: '3D STEP Models (*.step, *.stp)', extensions: ['step', 'stp'] },
      { name: '3D Meshes (*.stl, *.obj, *.gltf, *.glb, *.fbx, *.3ds)', extensions: ['stl', 'obj', 'gltf', 'glb', 'fbx', '3ds'] },
      { name: 'GIS / GeoJSON / Shapefiles (*.geojson, *.json, *.shp)', extensions: ['geojson', 'json', 'shp'] },
      { name: 'Spreadsheets (*.csv, *.xlsx, *.xls)', extensions: ['csv', 'xlsx', 'xls'] },
      { name: 'All Files (*.*)', extensions: ['*'] }
    ]
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

ipcMain.handle('restart-python-server', async () => {
  killPythonServer();
  spawnPythonServer();
  return { success: true };
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

// ── Frontend error logging ────────────────────────────────────────────────────
const _logDir = path.join(__dirname, 'logs');
try { fs.mkdirSync(_logDir, { recursive: true }); } catch { /* already exists */ }

const _crashLogPath = path.join(_logDir, 'crash.log');

function appendCrashLog(entry) {
  try {
    const line = JSON.stringify({ ...entry, _written: new Date().toISOString() }) + '\n';
    fs.appendFileSync(_crashLogPath, line, 'utf8');
  } catch { /* never crash the crash logger */ }
}

ipcMain.handle('log-frontend-error', (_, payload) => {
  appendCrashLog({ ...payload, source: 'renderer' });
  safeWarn('[FrontendError]', payload?.errorId, payload?.message);
  return { ok: true };
});

// Upgrade uncaughtException to also write to crash.log
process.on('uncaughtException', (err) => {
  if (err?.code === 'EPIPE') return;
  appendCrashLog({
    timestamp: new Date().toISOString(),
    level: 'fatal',
    source: 'main-process',
    message: err.message,
    stack: err.stack,
  });
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  appendCrashLog({
    timestamp: new Date().toISOString(),
    level: 'fatal',
    source: 'main-process',
    message: String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  console.error('Unhandled rejection:', reason);
});

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

  // ── Port resolution ──────────────────────────────────────────────────────
  if (!PYTHON_EXTERNAL) {
    PYTHON_PORT = await findPythonPort(8000);
    API_BASE = `http://127.0.0.1:${PYTHON_PORT}`;
    safeLog(`[Python] Resolved API port: ${PYTHON_PORT} → ${API_BASE}`);
  }

  // ── Create loading window early so the user sees progress ────────────────
  const loadingWindow = new BrowserWindow({
    width: 480,
    height: 320,
    frame: false,
    resizable: false,
    center: true,
    show: false,
    backgroundColor: '#0f1117',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  loadingWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(loadingScreenHTML('Checking Python environment\u2026'))}`
  );
  loadingWindow.once('ready-to-show', () => loadingWindow.show());

  /** Update the loading screen message via JS eval */
  function setLoadingStatus(msg) {
    if (loadingWindow && !loadingWindow.isDestroyed()) {
      loadingWindow.webContents.executeJavaScript(
        `document.getElementById('msg') && (document.getElementById('msg').textContent = ${JSON.stringify(msg)})`
      ).catch(() => {});
    }
    // Mirror to main window if it exists (IPC)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('python-startup-status', { message: msg });
    }
  }

  // ── Python startup ────────────────────────────────────────────────────────
  setLoadingStatus('Installing Python dependencies\u2026');
  await ensurePythonDependencies();

  if (!PYTHON_EXTERNAL) {
    setLoadingStatus(`Starting calculation engine on port ${PYTHON_PORT}\u2026`);
    spawnPythonServer();
  } else {
    const ok = await checkServerHealth(PYTHON_PORT);
    safeLog(
      ok
        ? `Using external Python server on port ${PYTHON_PORT}`
        : `Warning: INFRA_PYTHON_EXTERNAL set but no server on port ${PYTHON_PORT}`
    );
  }

  setLoadingStatus('Waiting for calculation engine to be ready\u2026');

  let serverReady = false;
  try {
    await waitForServer(PYTHON_PORT, PYTHON_EXTERNAL ? 60 : 30);
    serverReady = true;
    setLoadingStatus('Calculation engine ready — launching interface\u2026');
    safeLog('Python calculation server is ready');
  } catch (err) {
    safeWarn('Failed to start Python server:', err.message);
    setLoadingStatus('Calculation engine unavailable — launching in offline mode\u2026');
  }

  // Small delay so user can read the final status message
  await new Promise((resolve) => setTimeout(resolve, serverReady ? 400 : 800));

  // ── Launch main window and close loading window ───────────────────────────
  createWindow();
  if (!loadingWindow.isDestroyed()) {
    // Wait for main window to show before closing the loading screen
    setTimeout(() => {
      if (!loadingWindow.isDestroyed()) loadingWindow.close();
    }, 1500);
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
