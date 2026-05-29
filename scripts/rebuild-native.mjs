import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const packageJsonPath = path.join(projectRoot, 'package.json');

function readElectronVersion() {
  const pkgRaw = fs.readFileSync(packageJsonPath, 'utf8');
  const pkg = JSON.parse(pkgRaw);
  const raw = pkg?.devDependencies?.electron ?? pkg?.dependencies?.electron;
  if (!raw) {
    throw new Error('Electron dependency not found in package.json');
  }
  const normalized = String(raw).trim().replace(/^[^\d]*/, '');
  const match = normalized.match(/^(\d+\.\d+\.\d+)/);
  if (!match) {
    throw new Error(`Could not parse Electron version from "${raw}"`);
  }
  return match[1];
}

const electronVersion = readElectronVersion();
const args = [
  'rebuild',
  'better-sqlite3',
  '--foreground-scripts',
];

console.log(`[Native] Rebuilding better-sqlite3 for Electron ${electronVersion}...`);

function spawnNpm(commandArgs) {
  const rebuildEnv = {
    ...process.env,
    npm_config_runtime: 'electron',
    npm_config_target: electronVersion,
    npm_config_disturl: 'https://electronjs.org/headers',
  };

  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath) {
    return spawn(process.execPath, [npmExecPath, ...commandArgs], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: false,
      env: rebuildEnv,
    });
  }

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return spawn(npmCmd, commandArgs, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: rebuildEnv,
  });
}

const proc = spawnNpm(args);

proc.on('error', (err) => {
  console.warn(`[Native] Warning: Failed to start native rebuild: ${err.message}`);
  console.warn(`[Native] The application will fall back to in-memory/mock offline storage.`);
  process.exit(0);
});

proc.on('close', (code) => {
  if (code !== 0) {
    console.warn(`[Native] Warning: Native rebuild for better-sqlite3 failed (code ${code}).`);
    console.warn(`[Native] The application will fall back to in-memory/mock offline storage.`);
  } else {
    console.log('[Native] Native rebuild completed successfully.');
  }
  process.exit(0);
});

