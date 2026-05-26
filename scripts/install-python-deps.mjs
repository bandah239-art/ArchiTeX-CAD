import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  describePythonSource,
  getPipInstallConfig,
  resolvePythonExecutable,
} from './resolve-python.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pythonDir = path.join(__dirname, '..', 'python');

const exe = resolvePythonExecutable();
const { cmd, args, shell } = getPipInstallConfig();

console.log(
  `[Python] Installing requirements with ${describePythonSource(exe)}:`,
  exe ?? cmd,
);

const proc = spawn(cmd, args, {
  cwd: pythonDir,
  stdio: 'inherit',
  shell,
});

proc.on('error', (err) => {
  console.error(`[Python] Failed to run pip: ${err.message}`);
  process.exit(1);
});

proc.on('close', (code) => {
  process.exit(code ?? 0);
});
