import { useEffect, useRef, useState } from 'react';
import {
  Viewer,
  XKTLoaderPlugin,
  NavCubePlugin,
  TreeViewPlugin,
  SectionPlanesPlugin,
  AnnotationsPlugin,
  type SceneModel,
} from '@xeokit/xeokit-sdk';
import type { BIMViewerProps } from './ViewerTypes';
import { ViewerToolbar } from './ViewerToolbar';
import type { IFCElement } from '../../types/ifc';
import { useViewerStore } from '../../store/viewerStore';
import { useScheduleStore } from '../../store/scheduleStore';
import { useIfcModelStore } from '../../store/ifcModelStore';
import { loadIfcIntoXeokit, ifcElementFromEntity } from '../../services/ifcMeshXeokit';
import { CollaborationPresence } from './CollaborationPresence';
import { collaborationClient } from '../../services/collaborationWS';
import { createViewerControls, buildEntityTypeMap } from '../../services/viewerControls';
import { buildAssetCatalog } from '../../services/ifcAssetCatalog';
import type { ParsedIfcElement } from '../../services/ifcParser';

export function BIMViewer({
  modelPath,
  onElementSelected,
  onModelLoaded,
  activeStorey: _activeStorey,
  hiddenLayers,
}: BIMViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const xktLoaderRef = useRef<XKTLoaderPlugin | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const {
    viewMode,
    setViewMode,
    setViewerControls,
    setLayerTypes,
    exploded,
    xRay,
    setExploded,
    setXRay,
    showAllLayers,
    viewerControls,
    layerTypes,
  } = useViewerStore();
  const { schedule, currentWeek, timelineEnabled } = useScheduleStore();
  const { parseFromPath, setParseResult } = useIfcModelStore();
  const elementMapRef = useRef<Map<string, ParsedIfcElement>>(new Map());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const viewer = new Viewer({
      canvasElement: canvas,
      transparent: false,
      backgroundColor: [0.1, 0.1, 0.18],
    });

    viewerRef.current = viewer;

    viewer.scene.highlightMaterial.fillAlpha = 0.3;
    viewer.scene.highlightMaterial.edgeAlpha = 1.0;
    viewer.scene.highlightMaterial.fillColor = [0.9, 0.27, 0.38];
    viewer.scene.highlightMaterial.edgeColor = [0.9, 0.27, 0.38];

    const xktLoader = new XKTLoaderPlugin(viewer);
    xktLoaderRef.current = xktLoader;

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
        const entityId = String(hit.entity.id);
        const meta = hit.entity as { type?: string; name?: string };
        const fromIfc = ifcElementFromEntity(entityId, elementMapRef.current);
        const element: IFCElement = fromIfc ?? {
          id: entityId,
          globalId: entityId,
          type: meta.type || 'IfcElement',
          name: meta.name || entityId,
          properties: {},
        };
        viewer.scene.setObjectsHighlighted(viewer.scene.highlightedObjectIds, false);
        viewer.scene.setObjectsHighlighted([entityId], true);
        onElementSelected(element);
        collaborationClient.broadcastSelection(entityId, element.name ?? entityId);
      }
    });

    setViewerReady(true);

    return () => {
      setViewerReady(false);
      setViewerControls(null);
      xktLoaderRef.current = null;
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [onElementSelected, setViewerControls]);

  useEffect(() => {
    if (!viewerReady || !modelPath || !viewerRef.current || !xktLoaderRef.current) return;

    const viewer = viewerRef.current;
    const xktLoader = xktLoaderRef.current;
    let cancelled = false;

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
          }) as SceneModel;

          model.on('loaded', () => {
            if (cancelled) return;
            viewer.cameraFlight.flyTo(model);
            onModelLoaded({
              elementCount: Object.keys(model.objects).length,
              triangleCount: 0,
              bounds: { min: [0, 0, 0], max: [0, 0, 0] },
              loadTime: performance.now() - start,
            });
            setLoading(false);
          });

          model.on('error', (msg: string) => {
            if (cancelled) return;
            setError(msg);
            setLoading(false);
          });
        } else if (modelPath.toLowerCase().endsWith('.ifc')) {
          setLoadProgress(0);
          const buffer = await parseFromPath(modelPath);
          if (cancelled) return;

          const result = await loadIfcIntoXeokit(viewer, buffer, {
            onProgress: (pct) => {
              if (!cancelled) setLoadProgress(pct);
            },
          });
          if (cancelled) return;

          elementMapRef.current = result.elementByEntityId;
          const typeMap = buildEntityTypeMap(result.elementByEntityId);
          const controls = createViewerControls(viewer, typeMap);
          setViewerControls(controls);

          const catalog = buildAssetCatalog(result.elements, result.elementByEntityId);
          setLayerTypes(catalog.map((c) => c.type));

          setParseResult({
            path: modelPath,
            elements: result.elements,
            elementByEntityId: result.elementByEntityId,
            stats: result.stats,
            modelId: result.modelId,
          });
          onModelLoaded(result.stats);
          setLoading(false);
          setLoadProgress(100);
        } else {
          setError('Unsupported model format. Use .ifc or .xkt');
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load model');
        setLoading(false);
      }
    };

    loadModel();

    return () => {
      cancelled = true;
    };
  }, [
    modelPath,
    viewerReady,
    onModelLoaded,
    parseFromPath,
    setParseResult,
    setViewerControls,
    setLayerTypes,
  ]);

  useEffect(() => {
    viewerControls?.setLayersVisibility(hiddenLayers);
  }, [hiddenLayers, viewerControls]);

  useEffect(() => {
    if (!viewerControls || !schedule) return;
    if (timelineEnabled) {
      viewerControls.applyConstructionTimeline(currentWeek, schedule.activities, layerTypes);
    } else {
      viewerControls.clearConstructionTimeline();
      viewerControls.setLayersVisibility(hiddenLayers);
    }
  }, [viewerControls, schedule, currentWeek, timelineEnabled, layerTypes, hiddenLayers]);

  useEffect(() => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;
    if (viewMode === 'ortho') {
      viewer.camera.projection = 'ortho';
    } else if (viewMode === 'plan') {
      viewerControls?.flyToPlanView();
    } else {
      viewer.camera.projection = 'perspective';
    }
  }, [viewMode, viewerControls]);

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

  const handleScreenshot = () => {
    const dataUrl = viewerControls?.captureScreenshot();
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `infraafrica-view-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="relative w-full h-full" style={{
      background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
    }}>
      <ViewerToolbar
        viewMode={viewMode}
        exploded={exploded}
        xRay={xRay}
        onViewModeChange={setViewMode}
        onFitToView={handleFitToView}
        onResetView={handleResetView}
        onToggleExplode={() => setExploded(!exploded)}
        onToggleXRay={() => setXRay(!xRay)}
        onScreenshot={handleScreenshot}
        onShowAll={showAllLayers}
      />

      <CollaborationPresence />

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
          <div className="text-white text-sm text-center">
            <div>Loading model…</div>
            {loadProgress > 0 && loadProgress < 100 && (
              <div className="mt-2 text-xs text-gray-300">{Math.round(loadProgress)}% geometry</div>
            )}
          </div>
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
