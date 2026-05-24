import { useEffect, useRef, useState } from 'react';
import {
  Viewer,
  XKTLoaderPlugin,
  NavCubePlugin,
  TreeViewPlugin,
  SectionPlanesPlugin,
  AnnotationsPlugin,
} from '@xeokit/xeokit-sdk';
import type { BIMViewerProps } from './ViewerTypes';
import { ViewerToolbar } from './ViewerToolbar';
import type { IFCElement } from '../../types/ifc';
import { useViewerStore } from '../../store/viewerStore';

export function BIMViewer({
  modelPath,
  onElementSelected,
  onModelLoaded,
  activeStorey: _activeStorey,
  visibleLayers: _visibleLayers,
}: BIMViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { viewMode, setViewMode } = useViewerStore();

  useEffect(() => {
    if (!canvasRef.current) return;

    const viewer = new Viewer({
      canvasId: 'bimCanvas',
      transparent: false,
      backgroundColor: [0.1, 0.1, 0.18],
    });

    viewerRef.current = viewer;

    viewer.scene.highlightMaterial.fillAlpha = 0.3;
    viewer.scene.highlightMaterial.edgeAlpha = 1.0;
    viewer.scene.highlightMaterial.fillColor = [0.9, 0.27, 0.38];
    viewer.scene.highlightMaterial.edgeColor = [0.9, 0.27, 0.38];

    const xktLoader = new XKTLoaderPlugin(viewer);

    new NavCubePlugin(viewer, {
      canvasId: 'navCubeCanvas',
      visible: true,
      cameraFly: true,
    });

    const initTreeView = () => {
      const treeContainer = document.getElementById('treeViewContainer');
      if (treeContainer) {
        new TreeViewPlugin(viewer, {
          containerElement: treeContainer,
          autoExpandDepth: 2,
        });
      }
    };
    requestAnimationFrame(initTreeView);

    new SectionPlanesPlugin(viewer);
    new AnnotationsPlugin(viewer, {});

    viewer.cameraControl.navMode = 'orbit';
    viewer.cameraControl.doublePickFlyTo = true;

    viewer.camera.on('matrix', () => {
      viewer.scene.render();
    });

    viewer.scene.input.on('mouseclicked', (coords: number[]) => {
      const hit = viewer.scene.pick({ canvasPos: coords, pickSurface: true });
      if (hit?.entity) {
        const entity = hit.entity;
        const entityId = String(entity.id);
        const meta = entity as { type?: string; name?: string };
        const element: IFCElement = {
          id: entityId,
          globalId: entityId,
          type: meta.type || 'IfcElement',
          name: meta.name || entityId,
          properties: {},
        };
        viewer.scene.setObjectsHighlighted(viewer.scene.highlightedObjectIds, false);
        entity.highlighted = true;
        onElementSelected(element);
      }
    });

    (viewer as unknown as { _xktLoader: typeof xktLoader })._xktLoader = xktLoader;

    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [onElementSelected]);

  useEffect(() => {
    if (!modelPath || !viewerRef.current) return;

    const viewer = viewerRef.current;
    const xktLoader = (viewer as unknown as { _xktLoader: XKTLoaderPlugin })._xktLoader;

    setLoading(true);
    setError(null);

    const loadModel = async () => {
      try {
        const start = performance.now();

        if (modelPath.endsWith('.xkt')) {
          const model = xktLoader.load({
            id: 'ifcModel',
            src: modelPath,
            edges: true,
          });

          model.on('loaded', () => {
            viewer.cameraFlight.flyTo(model);
            const stats = {
              elementCount: Object.keys(model.objects).length,
              triangleCount: 0,
              bounds: { min: [0, 0, 0], max: [0, 0, 0] },
              loadTime: performance.now() - start,
            };
            onModelLoaded(stats);
            setLoading(false);
          });

          model.on('error', (msg: string) => {
            setError(msg);
            setLoading(false);
          });
        } else {
          setError(null);
          setLoading(false);
          onModelLoaded({
            elementCount: 0,
            triangleCount: 0,
            bounds: { min: [0, 0, 0], max: [0, 0, 0] },
            loadTime: performance.now() - start,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load model');
        setLoading(false);
      }
    };

    loadModel();
  }, [modelPath, onModelLoaded]);

  useEffect(() => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;
    if (viewMode === 'ortho') {
      viewer.camera.projection = 'ortho';
    } else {
      viewer.camera.projection = 'perspective';
    }
  }, [viewMode]);

  const handleFitToView = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const model = viewer.scene.models['ifcModel'];
    if (model) viewer.cameraFlight.flyTo(model);
  };

  const handleResetView = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.cameraFlight.flyTo({
      eye: [-10, 10, 10],
      look: [0, 0, 0],
      up: [0, 1, 0],
    });
  };

  return (
    <div className="relative w-full h-full" style={{
      background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
    }}>
      <ViewerToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onFitToView={handleFitToView}
        onResetView={handleResetView}
      />

      <canvas
        ref={canvasRef}
        id="bimCanvas"
        className="absolute inset-0 w-full h-full"
        style={{ outline: 'none' }}
      />

      <canvas
        id="navCubeCanvas"
        className="absolute top-2 right-2 w-32 h-32 pointer-events-auto"
        style={{ zIndex: 10 }}
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
          <div className="text-white text-sm">Loading model...</div>
        </div>
      )}

      {!modelPath && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
          <div className="text-6xl mb-4 opacity-30">🏗️</div>
          <p className="text-gray-400 text-sm">Open an IFC file to view the 3D model</p>
          <p className="text-gray-600 text-xs mt-2">
            Use File → Open IFC or the Open IFC button above
          </p>
        </div>
      )}

      {modelPath && !modelPath.endsWith('.xkt') && !loading && (
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <div className="bg-infra-accent/80 backdrop-blur rounded-lg p-3 text-xs text-gray-300">
            IFC file loaded: <strong>{modelPath.split(/[/\\]/).pop()}</strong>.
            Convert to XKT format for full 3D rendering. Place .xkt files alongside IFC for xeokit loading.
          </div>
        </div>
      )}

      {error && (
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <div className="bg-red-900/80 backdrop-blur rounded-lg p-3 text-xs text-red-200">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
