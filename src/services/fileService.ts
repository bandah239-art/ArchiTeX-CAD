import type { ModelStats } from '../types/ifc';

/** Blob URLs from the browser file picker have no extension in the URL — use embedded `name`. */
export function resolveModelFileMeta(modelPath: string): { ext: string; fileName: string } {
  const embeddedName = (modelPath as unknown as { name?: string }).name;
  const fileName =
    embeddedName ||
    modelPath.split(/[/\\]/).pop() ||
    modelPath;
  const dot = fileName.lastIndexOf('.');
  const ext = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
  return { ext, fileName };
}

export const BIM_CAD_3D_EXTENSIONS = new Set([
  'step',
  'stp',
  'stl',
  'obj',
  'gltf',
  'glb',
  'fbx',
  '3ds',
]);

export function isBimCad3DExtension(ext: string): boolean {
  return BIM_CAD_3D_EXTENSIONS.has(ext.toLowerCase());
}

export function isCadDrawingExtension(ext: string): boolean {
  const e = ext.toLowerCase();
  return e === 'dwg' || e === 'dxf';
}

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

  // Browser fallback: use a hidden file input to let the user pick a supported file
  return new Promise<string | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    // Extensions + common MIME hints — some OS file pickers ignore extension-only accept lists.
    input.accept =
      '.ifc,.dwg,.dxf,.step,.stp,.stl,.obj,.gltf,.glb,.fbx,.3ds,.geojson,.json,.shp,.csv,.xlsx,.xls,' +
      'application/octet-stream,application/acad,image/vnd.dwg,model/step,model/stl,model/obj';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) {
        // Embed the filename or metadata in the object URL so the caller can extract the extension
        const url = URL.createObjectURL(file);
        // We override toString of the string object to preserve the filename for extension checks
        const fileUrlObj = new String(url);
        Object.defineProperty(fileUrlObj, 'name', { value: file.name, enumerable: true });
        resolve(fileUrlObj as unknown as string);
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
