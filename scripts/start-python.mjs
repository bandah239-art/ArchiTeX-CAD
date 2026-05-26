import http from 'http';
import { spawn } from 'child_process';
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

  const proc = spawn(cmd, args, {
    cwd: path.join(projectRoot, 'python'),
    stdio: 'inherit',
    shell,
  });

  proc.on('error', (err) => {
    console.error(`Failed to start Python server: ${err.message}`);
    process.exit(1);
  });

  proc.on('close', (code) => {
    process.exit(code ?? 0);
  });
}

const healthy = await checkHealth();
if (healthy) {
  keepAlive();
} else {
  startServer();
}
