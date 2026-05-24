import { useCallback, useRef, useState } from 'react';
import { useViewerStore } from '../store/viewerStore';
import type { IFCElement, ModelStats } from '../types/ifc';

export function useBIMViewer() {
  const viewerRef = useRef<unknown>(null);
  const [isReady, setIsReady] = useState(false);
  const { modelPath, selectElement, setLoadedModel } = useViewerStore();

  const handleElementSelected = useCallback(
    (element: IFCElement) => {
      selectElement(element);
    },
    [selectElement]
  );

  const handleModelLoaded = useCallback(
    (stats: ModelStats) => {
      if (modelPath) {
        setLoadedModel({
          id: crypto.randomUUID(),
          name: modelPath.split(/[/\\]/).pop() || 'Model',
          path: modelPath,
          elementCount: stats.elementCount,
          loadedAt: new Date().toISOString(),
        });
      }
    },
    [modelPath, setLoadedModel]
  );

  return {
    viewerRef,
    isReady,
    setIsReady,
    handleElementSelected,
    handleModelLoaded,
    modelPath,
  };
}
