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
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const args = [
  'rebuild',
  'better-sqlite3',
  `--target=${electronVersion}`,
  '--runtime=electron',
  '--dist-url=https://electronjs.org/headers',
  '--build-from-source',
];

console.log(`[Native] Rebuilding better-sqlite3 for Electron ${electronVersion}...`);

const proc = spawn(npmCmd, args, {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: false,
});

proc.on('error', (err) => {
  console.error(`[Native] Failed to start rebuild: ${err.message}`);
  process.exit(1);
});

proc.on('close', (code) => {
  process.exit(code ?? 0);
});
