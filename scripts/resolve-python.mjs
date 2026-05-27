import fs from 'fs';
import os from 'os';
import path from 'path';

const CONDA_ENV = process.env.INFRA_CONDA_ENV || 'occ';

function condaPythonCandidates() {
  const home = os.homedir();
  const names = ['miniconda3', 'Miniconda3', 'anaconda3', 'Anaconda3', 'miniforge3', 'Miniforge3'];
  const out = [];

  for (const root of names) {
    if (process.platform === 'win32') {
      out.push(path.join(home, root, 'envs', CONDA_ENV, 'python.exe'));
    } else {
      out.push(path.join(home, root, 'envs', CONDA_ENV, 'bin', 'python'));
    }
  }

  return out;
}

/** @returns {string | null} Absolute path to python executable, or null if not found. */
export function resolvePythonExecutable() {
  const override = process.env.INFRA_PYTHON;
  if (override) {
    const exe = path.resolve(override);
    if (fs.existsSync(exe)) return exe;
    console.warn(`[Python] INFRA_PYTHON is set but not found: ${exe}`);
  }

  for (const exe of condaPythonCandidates()) {
    if (fs.existsSync(exe)) return exe;
  }

  return null;
}

export function describePythonSource(exe) {
  if (!exe) return 'system launcher';
  if (exe.includes(`${path.sep}envs${path.sep}${CONDA_ENV}${path.sep}`)) {
    return `conda env "${CONDA_ENV}"`;
  }
  return 'custom INFRA_PYTHON';
}

/**
 * @param {{ host: string, port: number, reload?: boolean }}
 */
export function getUvicornLaunchConfig({ host, port, reload = false }) {
  const uvicornArgs = ['-m', 'uvicorn', 'main:app', '--host', host, '--port', String(port)];
  if (reload) uvicornArgs.push('--reload');

  const exe = resolvePythonExecutable();
  if (exe) {
    // shell:true is more reliable for conda python.exe on Windows (nested npm/concurrently).
    const shell = process.platform === 'win32';
    return { cmd: exe, args: uvicornArgs, shell, exe };
  }

  if (process.platform === 'win32') {
    return { cmd: 'py', args: ['-3.11', ...uvicornArgs], shell: true, exe: null };
  }

  return { cmd: 'python3', args: uvicornArgs, shell: false, exe: null };
}

export function getPipInstallConfig() {
  const exe = resolvePythonExecutable();
  const pipArgs = ['-m', 'pip', 'install', '-r', 'requirements.txt'];

  if (exe) {
    const shell = process.platform === 'win32';
    return { cmd: exe, args: pipArgs, shell, exe };
  }

  if (process.platform === 'win32') {
    return { cmd: 'py', args: ['-3.11', ...pipArgs], shell: true, exe: null };
  }

  return { cmd: 'python3', args: pipArgs, shell: false, exe: null };
}
