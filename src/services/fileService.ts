import type { ModelStats } from '../types/ifc';

export async function loadIFC(path: string): Promise<{ arrayBuffer: ArrayBuffer; stats: ModelStats }> {
  const start = performance.now();
  let arrayBuffer: ArrayBuffer;

  if (window.electronAPI?.readIfcFile) {
    const data = await window.electronAPI.readIfcFile(path);
    arrayBuffer = new Uint8Array(data).buffer;
  } else if (path.startsWith('blob:') || path.startsWith('http')) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load IFC: ${response.statusText}`);
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

  // Browser fallback: use a hidden file input to let the user pick an IFC file
  return new Promise<string | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ifc';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) {
        resolve(URL.createObjectURL(file));
      } else {
        resolve(null);
      }
      input.remove();
    });
    input.addEventListener('cancel', () => {
      resolve(null);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  });
}
