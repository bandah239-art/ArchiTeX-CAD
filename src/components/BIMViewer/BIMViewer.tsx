import { useEffect, useRef, useState } from 'react';
import {
  Viewer,
  XKTLoaderPlugin,
  NavCubePlugin,
  TreeViewPlugin,
  SectionPlanesPlugin,
  AnnotationsPlugin,
  DistanceMeasurementsPlugin,
  DistanceMeasurementsMouseControl,
  AngleMeasurementsPlugin,
  AngleMeasurementsMouseControl,
  MarqueePicker,
  MarqueePickerMouseControl,
  ObjectsKdTree3,
  PointerLens,
  type SceneModel,
} from '@xeokit/xeokit-sdk';
import type { BIMViewerProps } from './ViewerTypes';
import type { IFCElement } from '../../types/ifc';
import { useViewerStore } from '../../store/viewerStore';
import { useDrawStore } from '../../store/drawStore';
import { useScheduleStore } from '../../store/scheduleStore';
import { isSketchDrawTool, SKETCH_FLOOR_PLANE_ID } from '../../services/sketchGeometry';
import { SketchWorkspaceEngine } from '../../services/sketchWorkspaceEngine';
import {
  processSketchClick,
  processSketchDblClick,
  processSketchMove,
  syncDrawToEngine,
} from '../../services/drawInteraction';
import { useIfcModelStore } from '../../store/ifcModelStore';
import { formatIfcLoadError, loadIfcIntoXeokit, ifcElementFromEntity } from '../../services/ifcMeshXeokit';
import { CollaborationPresence } from './CollaborationPresence';
import { collaborationClient } from '../../services/collaborationWS';
import { createViewerControls, buildEntityTypeMap, type ViewerPluginRefs } from '../../services/viewerControls';
import { DrawEngine } from '../../services/drawEngine';
import { TransformGizmoController, parseSketchMeshId } from '../../services/transformGizmo';
import { sketchMeshIdsForElement } from '../../services/sketchMeshIds';
import { GeoOverlayEngine, syncGeoOverlaysToViewer } from '../../services/geoOverlayEngine';
import { normalizeEntityId } from '../../services/selectionBridge';
import { AreaMeasureEngine } from '../../services/areaMeasureEngine';
import { MeasureResultBanner } from './MeasureResultBanner';
import { DrawToolBanner } from './DrawToolBanner';
import { MinimapPanel } from './MinimapPanel';
import { useMeasureStore } from '../../store/measureStore';
import { useUndoStore } from '../../store/undoStore';
import { quantitiesFromMesh, mergeMeshes } from '../../services/ifcQuantities';
import { buildAssetCatalog } from '../../services/ifcAssetCatalog';
import type { ParsedIfcElement } from '../../services/ifcParser';
import { usePlatformToolsStore } from '../../store/platformToolsStore';
import { useGeoStore } from '../../store/geoStore';
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
  const pluginsRef = useRef<ViewerPluginRefs | null>(null);
  const annotationsRef = useRef<AnnotationsPlugin | null>(null);
  const marqueePickerRef = useRef<MarqueePicker | null>(null);
  const drawEngineRef = useRef<DrawEngine | null>(null);
  const sketchWorkspaceRef = useRef<SketchWorkspaceEngine | null>(null);
  const transformGizmoRef = useRef<TransformGizmoController | null>(null);
  const geoOverlayRef = useRef<GeoOverlayEngine | null>(null);
  const areaMeasureRef = useRef<AreaMeasureEngine | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const {
    viewMode,
    setViewerControls,
    setLayerTypes,
    viewerControls,
    layerTypes,
    activeTool,
    selectedElement,
  } = useViewerStore();
  const { schedule, currentWeek, timelineEnabled } = useScheduleStore();
  const { parseFromPath, setParseResult, stats: modelStats } = useIfcModelStore();
  const { elements: sketchElements, activePoints, floorElevation, selectedId: selectedSketchId, previewPoint, modifiers, sketchCenterX, sketchCenterZ, sketchSpan } = useDrawStore();
  const terrainResult = usePlatformToolsStore((s) => s.terrainResult);
  const geoOverlayVisibility = usePlatformToolsStore((s) => s.geoOverlayVisibility);
  const floodResult = useGeoStore((s) => s.floodResult);
  const areaPoints = useMeasureStore((s) => s.areaPoints);
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

    const sectionPlanes = new SectionPlanesPlugin(viewer, { overviewVisible: true });
    const annotationsPlugin = new AnnotationsPlugin(viewer, {
      markerHTML: '<div style="background:#10b981;border-radius:50%;width:12px;height:12px;border:2px solid #fff;"></div>',
      labelHTML: '<div style="background:rgba(0,0,0,0.75);color:#fff;padding:4px 8px;border-radius:4px;font-size:11px;">{{title}}</div>',
    });
    annotationsRef.current = annotationsPlugin;

    const pointerLens = new PointerLens(viewer);
    const distanceMeasurements = new DistanceMeasurementsPlugin(viewer);
    const distanceControl = new DistanceMeasurementsMouseControl(distanceMeasurements, {
      pointerLens,
      snapping: true,
    });

    const angleMeasurements = new AngleMeasurementsPlugin(viewer);
    const angleControl = new AngleMeasurementsMouseControl(angleMeasurements, {
      pointerLens,
      snapping: true,
    });

    const marqueePicker = new MarqueePicker({
      viewer,
      objectsKdTree3: new ObjectsKdTree3({ viewer }),
    });
    marqueePickerRef.current = marqueePicker;
    marqueePicker.on('picked', (entityIds: string[]) => {
      const raw = entityIds ?? [];
      const ids = raw.map((id) => normalizeEntityId(String(id))).filter((id): id is string => !!id);
      useViewerStore.getState().setBoxSelectResults(ids.length ? ids : raw);
      const highlightIds = ids.length ? ids : raw;
      if (highlightIds.length) {
        viewer.scene.setObjectsHighlighted(viewer.scene.highlightedObjectIds, false);
        viewer.scene.setObjectsHighlighted(highlightIds, true);
      }
    });
    const marqueeControl = new MarqueePickerMouseControl({ marqueePicker });

    const drawEngine = new DrawEngine(viewer);
    drawEngineRef.current = drawEngine;

    const sketchWorkspace = new SketchWorkspaceEngine(viewer);
    sketchWorkspaceRef.current = sketchWorkspace;

    const syncSketchesFromStore = () => syncDrawToEngine(drawEngine);

    const transformGizmo = new TransformGizmoController(viewer, elementMapRef.current, syncSketchesFromStore);
    transformGizmoRef.current = transformGizmo;

    const geoOverlay = new GeoOverlayEngine(viewer);
    geoOverlayRef.current = geoOverlay;

    const areaMeasure = new AreaMeasureEngine(viewer);
    areaMeasureRef.current = areaMeasure;

    pluginsRef.current = {
      sectionPlanes,
      distanceMeasurements,
      distanceControl,
      angleMeasurements,
      angleControl,
      marqueeControl,
    };

    const controls = createViewerControls(
      viewer,
      new Map(),
      pluginsRef.current,
      drawEngine,
      transformGizmo,
      geoOverlay,
      areaMeasure,
      sketchWorkspace,
    );
    setViewerControls(controls);
    controls.exitSketchSession();
    useViewerStore.getState().setActiveTool('select');
    controls.setGridVisible(false);

    viewer.cameraControl.navMode = 'orbit';
    viewer.cameraControl.doublePickFlyTo = true;

    // Note: Do NOT call viewer.scene.render() inside a camera matrix listener.
    // It creates an infinite loop (render -> matrix change -> render -> ...).

    const canvasEl = canvas;

    const onCanvasClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const rect = canvasEl.getBoundingClientRect();
      const coords = [e.clientX - rect.left, e.clientY - rect.top];
      if (processSketchClick(drawEngine, coords)) {
        e.stopPropagation();
      }
    };

    const onCanvasMove = (e: MouseEvent) => {
      const rect = canvasEl.getBoundingClientRect();
      const coords = [e.clientX - rect.left, e.clientY - rect.top];
      processSketchMove(drawEngine, coords);
    };

    const onCanvasDblClick = (e: MouseEvent) => {
      if (processSketchDblClick(drawEngine)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    canvasEl.addEventListener('click', onCanvasClick, true);
    canvasEl.addEventListener('mousemove', onCanvasMove);
    canvasEl.addEventListener('dblclick', onCanvasDblClick, true);

    viewer.scene.input.on('mouseclicked', (coords: number[]) => {
      const tool = useViewerStore.getState().activeTool;
      const vc = useViewerStore.getState().viewerControls;
      const drawState = useDrawStore.getState();

      if (isSketchDrawTool(tool)) return;

      if (tool === 'area') {
        const pt = vc?.pickFloor(coords, drawState.floorElevation);
        if (!pt) return;
        useMeasureStore.getState().addAreaPoint(pt);
        const pts = useMeasureStore.getState().areaPoints;
        vc?.syncMeasureArea(pts, drawState.floorElevation);
        return;
      }

      if (tool === 'volume') {
        const hit = viewer.scene.pick({ canvasPos: coords, pickSurface: true });
        if (!hit?.entity?.id) return;
        const entityId = String(hit.entity.id);
        if (entityId.startsWith('sketchLayer-') || entityId.startsWith('measure') || entityId.startsWith('geoOverlay')) {
          return;
        }
        const parsed = elementMapRef.current.get(entityId);
        let volumeM3 = parsed?.volume ?? 0;
        let surfaceAreaM2 = parsed?.area ?? 0;
        let source: 'ifc' | 'mesh' = 'ifc';
        if ((!volumeM3 || !surfaceAreaM2) && parsed?.meshBuffers?.length) {
          const merged = mergeMeshes(parsed.meshBuffers);
          const q = quantitiesFromMesh(merged);
          volumeM3 = volumeM3 || q.volume;
          surfaceAreaM2 = surfaceAreaM2 || q.surfaceArea;
          source = 'mesh';
        }
        const meta = hit.entity as { name?: string; type?: string };
        useMeasureStore.getState().setVolumeResult({
          volumeM3: volumeM3 || 0,
          surfaceAreaM2: surfaceAreaM2 || 0,
          name: parsed?.name ?? meta.name ?? entityId,
          entityId,
          type: parsed?.type ?? meta.type ?? 'IfcElement',
          source,
        });
        viewer.scene.setObjectsHighlighted(viewer.scene.highlightedObjectIds, false);
        viewer.scene.setObjectsHighlighted([entityId], true);
        return;
      }

      if (tool === 'extrude') {
        const hit = viewer.scene.pick({ canvasPos: coords, pickSurface: true });
        if (!hit?.entity?.id) return;
        const sketchId = parseSketchMeshId(String(hit.entity.id));
        if (!sketchId) return;
        const drawState = useDrawStore.getState();
        const before = drawState.getSnapshot();
        const result = drawState.extrudeElement(sketchId);
        if (result) {
          useUndoStore.getState().pushDrawAction('Extrude sketch', before, useDrawStore.getState().getSnapshot());
          syncDrawToEngine(drawEngine);
        }
        return;
      }

      if (tool === 'move' || tool === 'rotate') {
        const hit = viewer.scene.pick({ canvasPos: coords, pickSurface: true });
        if (hit?.entity?.id) {
          transformGizmoRef.current?.attachToPick(String(hit.entity.id), tool);
        }
        return;
      }

      if (tool === 'annotate') {
        const hit = viewer.scene.pick({ canvasPos: coords, pickSurface: true });
        if (!hit) return;
        const text = window.prompt('Annotation label:', 'Note');
        if (!text) return;
        annotationsRef.current?.createAnnotation({
          id: `annot-${Date.now()}`,
          pickResult: hit,
          occludable: true,
          markerShown: true,
          labelShown: true,
          values: { title: text },
        });
        return;
      }

      if (tool && tool !== 'select') return;

      const hit = viewer.scene.pick({ canvasPos: coords, pickSurface: true });
      if (hit?.entity) {
        const entityId = String(hit.entity.id);
        if (
          entityId === SKETCH_FLOOR_PLANE_ID ||
          entityId.startsWith('sketchWorkspace-') ||
          entityId.startsWith('measureArea-')
        ) {
          return;
        }
        const sketchId = parseSketchMeshId(entityId);
        if (sketchId) {
          const el = useDrawStore.getState().elements.find((e) => e.id === sketchId);
          useDrawStore.getState().setSelectedId(sketchId);
          useViewerStore.getState().selectElement(null);
          const highlightIds = el ? sketchMeshIdsForElement(el) : [entityId];
          viewer.scene.setObjectsHighlighted(viewer.scene.highlightedObjectIds, false);
          viewer.scene.setObjectsHighlighted(highlightIds, true);
          return;
        }
        const meta = hit.entity as { type?: string; name?: string };
        const fromIfc = ifcElementFromEntity(entityId, elementMapRef.current);
        const element: IFCElement = fromIfc ?? {
          id: entityId,
          globalId: entityId,
          type: meta.type || 'IfcElement',
          name: meta.name || entityId,
          properties: {},
        };
        useDrawStore.getState().setSelectedId(null);
        viewer.scene.setObjectsHighlighted(viewer.scene.highlightedObjectIds, false);
        viewer.scene.setObjectsHighlighted([entityId], true);
        onElementSelected(element);
        collaborationClient.broadcastSelection(entityId, element.name ?? entityId);
      }
    });

    viewer.scene.input.on('dblclick', () => {
      const tool = useViewerStore.getState().activeTool;
      const vc = useViewerStore.getState().viewerControls;

      if (isSketchDrawTool(tool)) return;

      if (tool === 'area') {
        const pts = useMeasureStore.getState().areaPoints;
        if (pts.length >= 3) {
          void vc?.finishMeasureAreaPolygon(pts);
        }
      }
    });

    setViewerReady(true);

    return () => {
      canvasEl.removeEventListener('click', onCanvasClick, true);
      canvasEl.removeEventListener('mousemove', onCanvasMove);
      canvasEl.removeEventListener('dblclick', onCanvasDblClick, true);
      setViewerReady(false);
      setViewerControls(null);
      drawEngineRef.current?.destroy();
      drawEngineRef.current = null;
      sketchWorkspaceRef.current?.destroy();
      sketchWorkspaceRef.current = null;
      transformGizmoRef.current?.destroy();
      transformGizmoRef.current = null;
      geoOverlayRef.current?.destroy();
      geoOverlayRef.current = null;
      areaMeasureRef.current?.destroy();
      areaMeasureRef.current = null;
      xktLoaderRef.current = null;
      viewer.destroy();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            if (useViewerStore.getState().gridVisible) {
              useViewerStore.getState().viewerControls?.setGridVisible(true);
            }
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
          transformGizmoRef.current?.setElementMap(result.elementByEntityId);
          const typeMap = buildEntityTypeMap(result.elementByEntityId);
          const controls = createViewerControls(
            viewer,
            typeMap,
            pluginsRef.current ?? undefined,
            drawEngineRef.current ?? undefined,
            transformGizmoRef.current ?? undefined,
            geoOverlayRef.current ?? undefined,
            areaMeasureRef.current ?? undefined,
            sketchWorkspaceRef.current ?? undefined,
          );
          setViewerControls(controls);
          useViewerStore.getState().setActiveTool('select');
          controls.exitSketchSession();
          controls.fitToView();

          const catalog = buildAssetCatalog(result.elements, result.elementByEntityId);
          setLayerTypes(catalog.map((c) => c.type));

          setParseResult({
            path: modelPath,
            elements: result.elements,
            elementByEntityId: result.elementByEntityId,
            stats: result.stats,
            modelId: result.modelId,
          });

          const bmin = result.stats.bounds.min;
          const bmax = result.stats.bounds.max;
          const floorY = bmin[1];
          const cx = (bmin[0] + bmax[0]) / 2;
          const cz = (bmin[2] + bmax[2]) / 2;
          const span = Math.max(bmax[0] - bmin[0], bmax[2] - bmin[2], 20);
          useDrawStore.getState().setFloorElevation(floorY);
          useDrawStore.getState().setSketchBounds(cx, cz, span);

          if (useViewerStore.getState().gridVisible) {
            controls.setGridVisible(true);
          }

          onModelLoaded(result.stats);
          setLoading(false);
          setLoadProgress(100);
        } else {
          setError('Unsupported model format. Use .ifc or .xkt');
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        setError(formatIfcLoadError(err));
        setLoading(false);
      }
    };

    loadModel();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelPath, viewerReady]);

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
      viewer.camera.projection = 'ortho';
      viewerControls?.flyToPlanView();
    } else {
      viewer.camera.projection = 'perspective';
    }
  }, [viewMode, viewerControls]);

  useEffect(() => {
    try {
      syncDrawToEngine(drawEngineRef.current, activeTool);
    } catch (err) {
      console.error('[BIMViewer] sketch sync failed', err);
    }
  }, [sketchElements, activePoints, floorElevation, previewPoint, activeTool]);

  useEffect(() => {
    if (!viewerControls?.isSketchWorkspaceVisible?.()) return;
    viewerControls.syncSketchWorkspace();
  }, [floorElevation, modifiers.gridSnap, sketchCenterX, sketchCenterZ, sketchSpan, viewerControls]);

  useEffect(() => {
    viewerControls?.syncMeasureArea(areaPoints, floorElevation);
  }, [areaPoints, floorElevation, viewerControls]);

  useEffect(() => {
    if (activeTool !== 'move' && activeTool !== 'rotate') return;
    try {
      transformGizmoRef.current?.activate(activeTool);
    } catch (err) {
      console.error('[BIMViewer] transform gizmo activate failed', err);
    }
  }, [activeTool, selectedElement, selectedSketchId]);

  useEffect(() => {
    if (!terrainResult && !floodResult) return;
    syncGeoOverlaysToViewer(terrainResult, floodResult, {
      floorY: floorElevation,
      ...geoOverlayVisibility,
    });
  }, [terrainResult, floodResult, floorElevation, geoOverlayVisibility, modelStats]);

  return (
    <div className="relative w-full h-full" style={{
      background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
    }}>
      <CollaborationPresence />
      <MeasureResultBanner />
      <DrawToolBanner />

      <canvas
        ref={canvasRef}
        id="bimCanvas"
        className="absolute inset-0 w-full h-full z-0"
        style={{ outline: 'none' }}
      />

      <canvas
        id="navCubeCanvas"
        className="absolute top-2 right-2 w-32 h-32 pointer-events-auto"
        style={{ zIndex: 10 }}
      />

      <MinimapPanel viewer={viewerReady ? viewerRef.current : null} />

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
