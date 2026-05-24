import type { ModelStats } from '../types/ifc';

export async function loadIFC(path: string): Promise<{ arrayBuffer: ArrayBuffer; stats: ModelStats }> {
  const start = performance.now();

  let arrayBuffer: ArrayBuffer;

  if (window.electronAPI) {
    const response = await fetch(`file://${path}`);
    arrayBuffer = await response.arrayBuffer();
  } else {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load IFC: ${response.statusText}`);
    arrayBuffer = await response.arrayBuffer();
  }

  const loadTime = performance.now() - start;

  return {
    arrayBuffer,
    stats: {
      elementCount: 0,
      triangleCount: 0,
      bounds: { min: [0, 0, 0], max: [0, 0, 0] },
      loadTime,
    },
  };
}

export async function openIFCFile(): Promise<string | null> {
  if (window.electronAPI) {
    return window.electronAPI.openFileDialog();
  }
  return null;
}
