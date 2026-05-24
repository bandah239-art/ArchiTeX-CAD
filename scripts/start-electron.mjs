import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

process.env.INFRA_PYTHON_EXTERNAL = '1';

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronBin = path.join(projectRoot, 'node_modules', 'electron', 'cli.js');

const proc = spawn(process.execPath, [electronBin, '.'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: process.env,
});

proc.on('close', (code) => {
  process.exit(code ?? 0);
});

proc.on('error', (err) => {
  console.error(`Failed to start Electron: ${err.message}`);
  process.exit(1);
});
