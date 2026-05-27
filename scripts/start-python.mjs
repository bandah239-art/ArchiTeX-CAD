import http from 'http';
import { spawn, spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  describePythonSource,
  getUvicornLaunchConfig,
  resolvePythonExecutable,
} from './resolve-python.mjs';

const PORT = Number(process.env.INFRA_PYTHON_PORT || 8000);
const HOST = process.env.INFRA_PYTHON_HOST || '127.0.0.1';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get(`http://${HOST}:${PORT}/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function keepAlive() {
  console.log(`Python server already running at http://${HOST}:${PORT} — reusing it.`);
  setInterval(() => {}, 1 << 30);
}

function assertPythonRunnable(exe, cmd, shell) {
  if (!exe) return;

  const probe = spawnSync(exe, ['--version'], {
    encoding: 'utf8',
    shell,
    windowsHide: true,
  });

  if (probe.error) {
    console.error(`[Python] Cannot execute: ${exe}`);
    console.error(`[Python] ${probe.error.message}`);
    process.exit(1);
  }

  if (probe.status !== 0) {
    console.error(`[Python] ${exe} --version failed (code ${probe.status})`);
    if (probe.stderr) console.error(probe.stderr.trim());
    process.exit(1);
  }
}

function startServer() {
  const exe = resolvePythonExecutable();
  const { cmd, args, shell } = getUvicornLaunchConfig({
    host: HOST,
    port: PORT,
    reload: true,
  });

  console.log(
    `Starting Python server at http://${HOST}:${PORT} (${describePythonSource(exe)}) ...`,
  );
  if (exe) console.log(`  ${exe}`);
  else console.log(`  ${cmd}`);

  assertPythonRunnable(exe, cmd, shell);

  let child = null;
  let shuttingDown = false;
  let restartTimer = null;

  const clearRestartTimer = () => {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  };

  const stopChild = () => {
    if (!child) return;
    if (process.platform === 'win32') {
      child.kill('SIGTERM');
    } else {
      child.kill('SIGINT');
    }
  };

  const scheduleRestart = () => {
    clearRestartTimer();
    restartTimer = setTimeout(() => {
      launch();
    }, 1500);
  };

  const launch = () => {
    if (shuttingDown) return;

    child = spawn(cmd, args, {
      cwd: path.join(projectRoot, 'python'),
      stdio: 'inherit',
      shell,
      windowsHide: true,
      env: process.env,
    });

    child.on('error', (err) => {
      console.error(`Failed to start Python server: ${err.message}`);
      console.error(`Command: ${cmd}`);
      console.error(`Args: ${args.join(' ')}`);
      if (!shuttingDown) scheduleRestart();
    });

    child.on('close', (code) => {
      const exitCode = code ?? 0;
      child = null;
      if (shuttingDown) {
        process.exit(0);
        return;
      }
      console.warn(`[Python] Server exited with code ${exitCode}; restarting...`);
      scheduleRestart();
    });
  };

  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearRestartTimer();
    stopChild();
    if (!child) process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('beforeExit', shutdown);

  launch();
}

const healthy = await checkHealth();
if (healthy) {
  keepAlive();
} else {
  startServer();
}
