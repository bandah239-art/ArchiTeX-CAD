import type { Viewer } from '@xeokit/xeokit-sdk';
import { Mesh, PhongMaterial, buildGridGeometry } from '@xeokit/xeokit-sdk';
import type {
  SectionPlanesPlugin,
  DistanceMeasurementsPlugin,
  DistanceMeasurementsMouseControl,
  AngleMeasurementsPlugin,
  AngleMeasurementsMouseControl,
  MarqueePickerMouseControl,
} from '@xeokit/xeokit-sdk';
import type { ActiveTool, DrawTool, OrthoView, SectionAxis } from '../types/tools';
import type { GeoOverlayInput } from './geoOverlayEngine';
import type { DrawEngine } from './drawEngine';
import type { TransformGizmoController } from './transformGizmo';
import type { GeoOverlayEngine } from './geoOverlayEngine';
import type { AreaMeasureEngine } from './areaMeasureEngine';
import type { SketchWorkspaceEngine } from './sketchWorkspaceEngine';
import type { SketchElement, SketchPoint } from '../store/drawStore';
import { useViewerStore } from '../store/viewerStore';
import { useMeasureStore } from '../store/measureStore';
import { useDrawStore } from '../store/drawStore';
import { useToolbarStore } from '../components/BIMViewer/toolRegistry';
import { SKETCH_DRAW_TOOLS, SKETCH_FLOOR_PLANE_ID } from './sketchGeometry';
import type { OverlayLayerId } from './selectionBridge';

type SceneModelLike = {
  objects: Record<string, { visible?: boolean; highlighted?: boolean; xrayed?: boolean; matrix?: number[] }>;
  aabb?: number[];
};

import type { TimelineActivity } from './timeline4d';
import { getHiddenTypesAtWeek, getInProgressTypesAtWeek } from './timeline4d';

export interface ViewerPluginRefs {
  sectionPlanes: SectionPlanesPlugin;
  distanceMeasurements: DistanceMeasurementsPlugin;
  distanceControl: DistanceMeasurementsMouseControl;
  angleMeasurements: AngleMeasurementsPlugin;
  angleControl: AngleMeasurementsMouseControl;
  marqueeControl?: MarqueePickerMouseControl & { setActive: (active: boolean) => void };
}

export interface ViewerControls {
  viewer: Viewer;
  setLayerVisibility: (type: string, visible: boolean) => void;
  setLayersVisibility: (hiddenTypes: string[]) => void;
  setOverlayVisibility: (hiddenOverlays: OverlayLayerId[]) => void;
  applyConstructionTimeline: (week: number, activities: TimelineActivity[], allTypes: string[]) => void;
  clearConstructionTimeline: () => void;
  highlightEntities: (entityIds: string[]) => void;
  isolateEntities: (entityIds: string[]) => void;
  showAll: () => void;
  flyToPlanView: () => void;
  flyToPerspective: () => void;
  flyToOrthoView: (view: OrthoView) => void;
  fitToView: () => void;
  /** Plan view for flat 2D CAD; otherwise standard model fit. */
  fitDrawingToView: (bounds?: { min: [number, number, number]; max: [number, number, number] }) => void;
  resetView: () => void;
  setExploded: (enabled: boolean, factor?: number) => void;
  setXRayed: (enabled: boolean) => void;
  captureScreenshot: () => string | null;
  setActiveTool: (tool: ActiveTool) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setGridVisible: (visible: boolean) => void;
  addSectionPlane: (axis: SectionAxis) => void;
  clearSectionPlanes: () => void;
  syncSketches: (
    elements: SketchElement[],
    activePoints: SketchPoint[],
    floorY: number,
    previewPoint?: SketchPoint | null,
    activeTool?: DrawTool | null,
  ) => void;
  syncSketchWorkspace: () => void;
  isSketchWorkspaceVisible: () => boolean;
  setSketchWorkspaceVisible: (visible: boolean) => void;
  prepareDrawSession: () => void;
  prepareMeasureSession: () => void;
  exitSketchSession: () => void;
  pickFloor: (canvasPos: number[], floorY: number) => SketchPoint | null;
  syncGeoOverlays: (input: GeoOverlayInput) => void;
  clearGeoOverlays: () => void;
  syncMeasureArea: (points: SketchPoint[], floorY: number) => void;
  clearMeasureArea: () => void;
  finishMeasureAreaPolygon: (points: SketchPoint[]) => Promise<void>;
  flyToWorldPoint: (world: [number, number, number]) => void;
  saveBcfViewpoint: () => void;
  loadBcfViewpoint: () => void;
  cycleStorey: () => void;
  toggleSunStudy: () => void;
  duplicateSelectedSketch: () => void;
  mirrorSelectedSketch: () => void;
  arraySelectedSketch: () => void;
}

const MODEL_ID = 'ifcModel';

export function createViewerControls(
  viewer: Viewer,
  entityTypeMap: Map<string, string>,
  plugins?: ViewerPluginRefs,
  drawEngine?: DrawEngine,
  transformGizmo?: TransformGizmoController,
  geoOverlayEngine?: GeoOverlayEngine,
  areaMeasureEngine?: AreaMeasureEngine,
  sketchWorkspace?: SketchWorkspaceEngine,
): ViewerControls {
  const explodeState = { enabled: false, factor: 1.5, originals: new Map<string, number[]>() };

  function getModel(): SceneModelLike | null {
    return (viewer.scene.models[MODEL_ID] as unknown as SceneModelLike | undefined) ?? null;
  }

  function entityIdsForType(type: string): string[] {
    const ids: string[] = [];
    for (const [entityId, t] of entityTypeMap) {
      if (t === type) ids.push(entityId);
    }
    return ids;
  }

  function setLayerVisibility(type: string, visible: boolean) {
    const ids = entityIdsForType(type);
    const model = getModel();
    if (!model) return;
    for (const id of ids) {
      const obj = model.objects[id];
      if (obj) obj.visible = visible;
    }
    viewer.scene.render();
  }

  function setLayersVisibility(hiddenTypes: string[]) {
    const hidden = new Set(hiddenTypes);
    for (const [entityId, type] of entityTypeMap) {
      const model = getModel();
      if (!model?.objects[entityId]) continue;
      model.objects[entityId].visible = !hidden.has(type);
    }
    viewer.scene.render();
  }

  function setOverlayVisibility(hiddenOverlays: OverlayLayerId[]) {
    const hidden = new Set(hiddenOverlays);
    for (const id of Object.keys(viewer.scene.objects)) {
      if (id.startsWith('sketchLayer') || id.startsWith('sketchWorkspace')) {
        const obj = viewer.scene.objects[id];
        if (obj) obj.visible = !hidden.has('sketchLayer');
      } else if (id.startsWith('geoOverlay')) {
        const obj = viewer.scene.objects[id];
        if (obj) obj.visible = !hidden.has('geoOverlay');
      } else if (id.startsWith('measure')) {
        const obj = viewer.scene.objects[id];
        if (obj) obj.visible = !hidden.has('measure');
      }
    }
    viewer.scene.render();
  }

  function applyConstructionTimeline(week: number, activities: TimelineActivity[], allTypes: string[]) {
    const hidden = getHiddenTypesAtWeek(activities, week, allTypes);
    const inProgress = getInProgressTypesAtWeek(activities, week);
    setLayersVisibility(hidden);

    viewer.scene.setObjectsHighlighted(viewer.scene.highlightedObjectIds, false);
    const highlightIds: string[] = [];
    for (const [entityId, type] of entityTypeMap) {
      const obj = viewer.scene.objects[entityId];
      if (!obj) continue;
      if (inProgress.has(type)) {
        obj.highlighted = true;
        highlightIds.push(entityId);
      }
    }
    if (highlightIds.length) {
      viewer.scene.setObjectsHighlighted(highlightIds, true);
    }
    viewer.scene.render();
  }

  function clearConstructionTimeline() {
    showAll();
  }

  function highlightEntities(entityIds: string[]) {
    viewer.scene.setObjectsHighlighted(viewer.scene.highlightedObjectIds, false);
    for (const id of entityIds) {
      const obj = viewer.scene.objects[id];
      if (obj) obj.highlighted = true;
    }
    viewer.scene.render();
  }

  function isolateEntities(entityIds: string[]) {
    const keep = new Set(entityIds);
    const model = getModel();
    if (!model) return;
    for (const id of Object.keys(model.objects)) {
      model.objects[id].visible = keep.has(id);
    }
    highlightEntities(entityIds);
    if (entityIds.length) {
      viewer.cameraFlight.flyTo({ aabb: viewer.scene.getAABB(entityIds) });
    }
    viewer.scene.render();
  }

  function showAll() {
    const model = getModel();
    if (model) {
      for (const id of Object.keys(model.objects)) {
        model.objects[id].visible = true;
        model.objects[id].xrayed = false;
      }
    }
    setOverlayVisibility([]);
    viewer.scene.setObjectsHighlighted(viewer.scene.highlightedObjectIds, false);
    viewer.scene.render();
  }

  function syncSketchBoundsFromModel() {
    const model = getModel();
    const draw = useDrawStore.getState();
    if (model?.aabb) {
      const aabb = model.aabb;
      const floorY = aabb[1];
      const cx = (aabb[0] + aabb[3]) / 2;
      const cz = (aabb[2] + aabb[5]) / 2;
      const span = Math.max(aabb[3] - aabb[0], aabb[4] - aabb[1], aabb[5] - aabb[2], 20);
      draw.setFloorElevation(floorY);
      draw.setSketchBounds(cx, cz, span);
      return;
    }
    if (draw.sketchSpan < 20) {
      draw.setSketchBounds(0, 0, 80);
    }
  }

  function flyToPlanView() {
    syncSketchBoundsFromModel();
    const draw = useDrawStore.getState();
    const floorY = draw.floorElevation;
    const cx = draw.sketchCenterX;
    const cz = draw.sketchCenterZ;
    const span = Math.max(draw.sketchSpan, 20);
    const dist = span * 1.25;

    viewer.camera.projection = 'ortho';
    viewer.cameraFlight.flyTo({
      eye: [cx, floorY + dist, cz],
      look: [cx, floorY, cz],
      up: [0, 0, 1],
      duration: 0.35,
    });
    viewer.scene.render();
  }

  function flyToPerspective() {
    viewer.camera.projection = 'perspective';
    const model = getModel();
    if (model) viewer.cameraFlight.flyTo(viewer.scene.models[MODEL_ID]);
  }

  function setExploded(enabled: boolean, factor = 1.5) {
    const model = getModel();
    if (!model) return;

    explodeState.enabled = enabled;
    explodeState.factor = factor;

    if (!enabled) {
      for (const [id, matrix] of explodeState.originals) {
        const obj = model.objects[id];
        if (obj && matrix) {
          (obj as { matrix?: number[] }).matrix = matrix;
        }
      }
      explodeState.originals.clear();
      viewer.scene.render();
      return;
    }

    const aabb = model.aabb;
    if (!aabb) return;

    const types = [...new Set(entityTypeMap.values())];
    const typeIndex = new Map(types.map((t, i) => [t, i]));

    for (const [entityId, type] of entityTypeMap) {
      const obj = model.objects[entityId];
      if (!obj) continue;

      if (!explodeState.originals.has(entityId)) {
        const m = (obj as { matrix?: number[] }).matrix;
        explodeState.originals.set(entityId, m ? [...m] : []);
      }

      const idx = typeIndex.get(type) ?? 0;
      const angle = (idx / Math.max(types.length, 1)) * Math.PI * 2;
      const dist = factor * (1 + idx * 0.3);
      const ox = Math.cos(angle) * dist;
      const oz = Math.sin(angle) * dist;
      const oy = idx * 0.15 * factor;

      const orig = explodeState.originals.get(entityId) ?? [];
      const tx = orig[12] ?? 0;
      const ty = orig[13] ?? 0;
      const tz = orig[14] ?? 0;

      const newMatrix = orig.length === 16 ? [...orig] : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      newMatrix[12] = tx + ox;
      newMatrix[13] = ty + oy;
      newMatrix[14] = tz + oz;
      (obj as { matrix?: number[] }).matrix = newMatrix;
    }

    viewer.cameraFlight.flyTo(model);
    viewer.scene.render();
  }

  function setXRayed(enabled: boolean) {
    const model = getModel();
    if (!model) return;
    for (const id of Object.keys(model.objects)) {
      model.objects[id].xrayed = enabled;
    }
    viewer.scene.render();
  }

  function captureScreenshot(): string | null {
    const canvas = document.getElementById('bimCanvas') as HTMLCanvasElement | null;
    if (!canvas) return null;
    viewer.scene.render();
    try {
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  function modelCenter(): [number, number, number] | null {
    const model = getModel();
    const aabb = model?.aabb;
    if (!aabb) return null;
    return [
      (aabb[0] + aabb[3]) / 2,
      (aabb[1] + aabb[4]) / 2,
      (aabb[2] + aabb[5]) / 2,
    ];
  }

  function modelSpan(): number {
    const model = getModel();
    const aabb = model?.aabb;
    if (!aabb) return 20;
    return Math.max(aabb[3] - aabb[0], aabb[4] - aabb[1], aabb[5] - aabb[2], 10);
  }

  function fitToView() {
    const model = getModel();
    if (model) viewer.cameraFlight.flyTo(viewer.scene.models[MODEL_ID]);
    viewer.scene.render();
  }

  function fitDrawingToView(bounds?: { min: [number, number, number]; max: [number, number, number] }) {
    if (bounds) {
      const min = bounds.min;
      const max = bounds.max;
      const cx = (min[0] + max[0]) / 2;
      const cy = (min[1] + max[1]) / 2;
      const cz = (min[2] + max[2]) / 2;
      const spanX = Math.max(max[0] - min[0], 1);
      const spanY = Math.max(max[1] - min[1], 1e-6);
      const spanZ = Math.max(max[2] - min[2], 1);
      const spanXZ = Math.max(spanX, spanZ, 1);
      const spanXY = Math.max(spanX, spanY, 1);

      // XZ-plane flat drawings (DWG/DXF with Y≈const): top-down ortho view.
      // flyTo cannot correctly set ortho.scale from a thin-Y AABB, so we snap
      // directly and set ortho.scale explicitly to fill the viewport.
      if (spanY / spanXZ < 0.08) {
        const dist = Math.max(spanXZ * 3.0, 50);
        viewer.camera.projection = 'ortho';
        viewer.camera.eye = [cx, cy + dist, cz];
        viewer.camera.look = [cx, cy, cz];
        viewer.camera.up = [0, 0, 1];
        // ortho.scale = viewport width in world units — set to drawing extent + 25% margin.
        viewer.camera.ortho.scale = spanXZ * 1.25;
        viewer.scene.render();
        return;
      }

      // XY-plane flat drawings (Z≈const): front ortho view.
      if (spanZ / spanXY < 0.08) {
        const dist = Math.max(spanXY * 3.0, 50);
        viewer.camera.projection = 'ortho';
        viewer.camera.eye = [cx, cy, cz + dist];
        viewer.camera.look = [cx, cy, cz];
        viewer.camera.up = [0, 1, 0];
        viewer.camera.ortho.scale = spanXY * 1.25;
        viewer.scene.render();
        return;
      }

      viewer.camera.projection = 'perspective';
      viewer.cameraFlight.flyTo({
        aabb: [min[0], min[1], min[2], max[0], max[1], max[2]],
        duration: 0.45,
      });
      viewer.scene.render();
      return;
    }

    fitToView();
  }

  function resetView() {
    viewer.cameraFlight.flyTo({
      eye: [-10, 10, 10],
      look: [0, 0, 0],
      up: [0, 1, 0],
    });
  }

  function flyToOrthoView(view: OrthoView) {
    const center = modelCenter();
    if (!center) return;
    const [cx, cy, cz] = center;
    const span = modelSpan() * 1.4;
    viewer.camera.projection = 'ortho';

    const views: Record<OrthoView, { eye: [number, number, number]; up: [number, number, number] }> = {
      front: { eye: [cx, cy - span, cz], up: [0, 0, 1] },
      back: { eye: [cx, cy + span, cz], up: [0, 0, 1] },
      left: { eye: [cx - span, cy, cz], up: [0, 0, 1] },
      right: { eye: [cx + span, cy, cz], up: [0, 0, 1] },
      top: { eye: [cx, cy, cz + span], up: [0, 1, 0] },
      bottom: { eye: [cx, cy, cz - span], up: [0, 1, 0] },
    };

    const cfg = views[view];
    viewer.cameraFlight.flyTo({
      eye: cfg.eye,
      look: [cx, cy, cz],
      up: cfg.up,
    });
  }

  let gridMesh: Mesh | null = null;
  let sunStudyOn = false;
  const storeyNames: string[] = [];
  let storeyIndex = 0;
  const bcfKey = 'infraafrica-bcf-view';

  function setGridVisible(visible: boolean) {
    if (gridMesh) {
      gridMesh.destroy();
      gridMesh = null;
    }
    if (!visible) {
      viewer.scene.render();
      return;
    }

    const model = getModel();
    const aabb = model?.aabb;
    const center = modelCenter() ?? [0, 0, 0];
    const floorY = aabb ? aabb[1] : 0;
    const spanX = aabb ? aabb[3] - aabb[0] : 40;
    const spanZ = aabb ? aabb[5] - aabb[2] : 40;
    const size = Math.max(spanX, spanZ, 40) * 1.4;
    const divisions = Math.min(80, Math.max(12, Math.round(size / 4)));

    gridMesh = new Mesh(viewer.scene, {
      id: 'viewerGridMesh',
      geometry: buildGridGeometry({ size, divisions }),
      material: new PhongMaterial(viewer.scene, {
        diffuse: [0.5, 0.58, 0.68],
        emissive: [0.22, 0.26, 0.32],
        alpha: 0.9,
        backfaces: true,
      }),
      position: [center[0], floorY + 0.02, center[2]],
      pickable: false,
    });
    viewer.scene.render();
  }

  function deactivateMeasurementTools() {
    try {
      plugins?.distanceControl?.deactivate();
    } catch {
      /* not active or plugin torn down */
    }
    try {
      plugins?.angleControl?.deactivate();
    } catch {
      /* not active or plugin torn down */
    }
    try {
      plugins?.marqueeControl?.setActive(false);
    } catch {
      /* ignore */
    }
    transformGizmo?.detach();
  }

  function isDrawTool(tool: ActiveTool): tool is DrawTool {
    return !!tool && SKETCH_DRAW_TOOLS.includes(tool as DrawTool);
  }

  function isSketchSessionTool(tool: ActiveTool): boolean {
    if (!tool) return false;
    return SKETCH_DRAW_TOOLS.includes(tool as DrawTool) || tool === 'extrude';
  }

  function syncSketchWorkspaceFromStore(visible: boolean) {
    if (!sketchWorkspace) return;
    const draw = useDrawStore.getState();
    const activeTool = useViewerStore.getState().activeTool;
    sketchWorkspace.sync({
      floorY: draw.floorElevation,
      centerX: draw.sketchCenterX,
      centerZ: draw.sketchCenterZ,
      span: draw.sketchSpan,
      gridSnap: draw.modifiers.gridSnap,
      visible,
      pickFloorOnly: activeTool === 'area',
    });
  }

  function isSketchWorkspaceVisible() {
    return sketchWorkspace?.isVisible() ?? false;
  }

  function syncSketchWorkspace() {
    if (!isSketchWorkspaceVisible()) {
      purgeSketchWorkspaceMeshes();
      return;
    }
    syncSketchWorkspaceFromStore(true);
  }

  function setSketchWorkspaceVisible(visible: boolean) {
    syncSketchWorkspaceFromStore(visible);
    viewer.scene.render();
  }

  /** Show sketch grid, align to model, fly top-down (does not persist plan mode in store). */
  function prepareDrawSession() {
    syncSketchBoundsFromModel();
    setSketchWorkspaceVisible(true);
    viewer.camera.projection = 'ortho';
    viewer.cameraControl.navMode = 'orbit';
    viewer.cameraControl.active = true;
    flyToPlanView();
    viewer.scene.render();
  }

  /** Pickable floor plane + plan view for area measure (no full draw grid). */
  function prepareMeasureSession() {
    syncSketchBoundsFromModel();
    setSketchWorkspaceVisible(true);
    viewer.camera.projection = 'ortho';
    viewer.cameraControl.navMode = 'orbit';
    viewer.cameraControl.active = true;
    flyToPlanView();
    viewer.scene.render();
  }

  function purgeSketchWorkspaceMeshes() {
    const floor = viewer.scene.objects[SKETCH_FLOOR_PLANE_ID];
    if (floor) floor.destroy();
    for (const id of Object.keys(viewer.scene.objects)) {
      if (id.startsWith('sketchWorkspace-')) {
        viewer.scene.objects[id]?.destroy?.();
      }
    }
  }

  function exitSketchSession() {
    setSketchWorkspaceVisible(false);
    purgeSketchWorkspaceMeshes();
    viewer.camera.projection = 'perspective';
    const { viewMode } = useViewerStore.getState();
    if (viewMode === 'plan') {
      useViewerStore.getState().setViewMode('perspective');
    }
    const model = getModel();
    if (model) {
      viewer.cameraFlight.flyTo(model);
    } else {
      flyToPerspective();
    }
    viewer.scene.render();
  }

  function ensureSketchView() {
    prepareDrawSession();
  }

  function setActiveTool(tool: ActiveTool) {
    const prev = useViewerStore.getState().activeTool;
    try {
      setActiveToolInner(tool, prev);
    } catch (err) {
      console.error('[viewerControls] setActiveTool failed', tool, err);
    }
  }

  function setActiveToolInner(tool: ActiveTool, prev: ActiveTool) {
    deactivateMeasurementTools();
    if (prev === 'area' && tool !== 'area') {
      useMeasureStore.getState().setAreaPoints([]);
      areaMeasureEngine?.sync([], floorYFromDraw());
      setSketchWorkspaceVisible(false);
      purgeSketchWorkspaceMeshes();
    }
    viewer.cameraControl.active = true;

    if (!isSketchSessionTool(tool) && isSketchSessionTool(prev)) {
      exitSketchSession();
    }

    switch (tool) {
      case 'select':
        exitSketchSession();
        viewer.cameraControl.navMode = 'orbit';
        break;
      case 'box-select':
        viewer.cameraControl.active = false;
        plugins?.marqueeControl?.setActive(true);
        break;
      case 'orbit':
        exitSketchSession();
        viewer.cameraControl.navMode = 'orbit';
        break;
      case 'pan':
        exitSketchSession();
        viewer.cameraControl.navMode = 'planView';
        break;
      case 'walk':
        viewer.cameraControl.navMode = 'firstPerson';
        break;
      case 'zoom':
        exitSketchSession();
        viewer.cameraControl.navMode = 'orbit';
        break;
      case 'distance':
        viewer.cameraControl.active = false;
        plugins?.distanceControl.activate();
        break;
      case 'angle':
        viewer.cameraControl.active = false;
        plugins?.angleControl.activate();
        break;
      case 'area':
        viewer.cameraControl.active = true;
        viewer.cameraControl.navMode = 'orbit';
        useMeasureStore.getState().clearMeasure();
        areaMeasureEngine?.resetSession();
        prepareMeasureSession();
        break;
      case 'volume':
        viewer.cameraControl.navMode = 'orbit';
        useMeasureStore.getState().clearMeasure();
        break;
      case 'annotate':
        viewer.cameraControl.navMode = 'orbit';
        break;
      case 'extrude':
        viewer.cameraControl.navMode = 'orbit';
        viewer.cameraControl.active = false;
        ensureSketchView();
        break;
      case 'move':
      case 'rotate':
        viewer.cameraControl.active = false;
        transformGizmo?.activate(tool);
        break;
      default:
        if (isDrawTool(tool)) {
          if (useToolbarStore.getState().activeTab === 'draw') {
            prepareDrawSession();
          } else {
            syncSketchBoundsFromModel();
            setSketchWorkspaceVisible(false);
            viewer.cameraControl.navMode = 'orbit';
          }
        } else {
          viewer.cameraControl.navMode = 'orbit';
        }
        break;
    }
  }

  function setSnapEnabled(enabled: boolean) {
    if (plugins?.distanceControl) {
      plugins.distanceControl.snapping = enabled;
    }
    if (plugins?.angleControl) {
      plugins.angleControl.snapping = enabled;
    }
  }

  const sectionPlaneIds: string[] = [];

  function addSectionPlane(axis: SectionAxis) {
    if (!plugins?.sectionPlanes) return;
    const center = modelCenter() ?? [0, 0, 0];
    const dirs: Record<SectionAxis, [number, number, number]> = {
      x: [1, 0, 0],
      y: [0, 1, 0],
      z: [0, 0, 1],
    };
    const id = `section-${axis}-${Date.now()}`;
    plugins.sectionPlanes.createSectionPlane({
      id,
      pos: center,
      dir: dirs[axis],
      active: true,
    });
    sectionPlaneIds.push(id);
    plugins.sectionPlanes.showControl(id);
    viewer.scene.render();
  }

  function clearSectionPlanes() {
    if (!plugins?.sectionPlanes) return;
    for (const id of sectionPlaneIds) {
      plugins.sectionPlanes.destroySectionPlane(id);
    }
    sectionPlaneIds.length = 0;
    viewer.scene.render();
  }

  function syncSketches(
    elements: SketchElement[],
    activePoints: SketchPoint[],
    floorY: number,
    previewPoint?: SketchPoint | null,
    activeTool?: DrawTool | null,
  ) {
    drawEngine?.sync(elements, activePoints, floorY, { previewPoint, activeTool });
  }

  function pickFloor(canvasPos: number[], floorY: number) {
    return drawEngine?.pickFloor(canvasPos, floorY) ?? null;
  }

  function syncGeoOverlays(input: GeoOverlayInput) {
    geoOverlayEngine?.sync(input);
  }

  function clearGeoOverlays() {
    geoOverlayEngine?.clear();
    viewer.scene.render();
  }

  function syncMeasureArea(points: SketchPoint[], floorY: number) {
    areaMeasureEngine?.sync(points, floorY);
  }

  function clearMeasureArea() {
    areaMeasureEngine?.clear();
    viewer.scene.render();
  }

  async function finishMeasureAreaPolygon(points: SketchPoint[]) {
    if (!areaMeasureEngine || points.length < 3) {
      useMeasureStore.getState().setMeasureError('Need at least 3 points for area measure');
      return;
    }
    areaMeasureEngine.pushCompleted(points);
    const result = await areaMeasureEngine.computeArea(points);
    useMeasureStore.getState().setAreaResult(result);
    useMeasureStore.getState().setAreaPoints([]);
    areaMeasureEngine.sync([], floorYFromDraw());
    viewer.scene.render();
  }

  function floorYFromDraw() {
    return useDrawStore.getState().floorElevation;
  }

  function flyToWorldPoint(world: [number, number, number]) {
    const cam = viewer.scene.camera;
    const dx = cam.eye[0] - cam.look[0];
    const dy = cam.eye[1] - cam.look[1];
    const dz = cam.eye[2] - cam.look[2];
    viewer.cameraFlight.flyTo({
      eye: [world[0] + dx, world[1] + dy, world[2] + dz],
      look: world,
      up: [...cam.up],
    });
  }

  function saveBcfViewpoint() {
    const cam = viewer.scene.camera;
    const data = { eye: [...cam.eye], look: [...cam.look], up: [...cam.up], projection: cam.projection };
    localStorage.setItem(bcfKey, JSON.stringify(data));
  }

  function loadBcfViewpoint() {
    const raw = localStorage.getItem(bcfKey);
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as { eye: number[]; look: number[]; up: number[]; projection?: string };
      if (data.projection) {
        viewer.camera.projection = data.projection as 'perspective' | 'ortho' | 'frustum' | 'customProjection';
      }
      viewer.cameraFlight.flyTo({ eye: data.eye, look: data.look, up: data.up });
    } catch {
      /* ignore */
    }
  }

  function cycleStorey() {
    if (!storeyNames.length) {
      const types = [...new Set(entityTypeMap.values())];
      storeyNames.push(...types.filter((t) => /storey|floor|level/i.test(t)).slice(0, 10));
      if (!storeyNames.length) storeyNames.push(...types.slice(0, 5));
    }
    if (!storeyNames.length) return;
    storeyIndex = (storeyIndex + 1) % storeyNames.length;
    const type = storeyNames[storeyIndex];
    useViewerStore.getState().setStorey(storeyIndex);
    setLayersVisibility([...entityTypeMap.values()].filter((t) => t !== type));
    highlightEntities(entityIdsForType(type));
  }

  function toggleSunStudy() {
    sunStudyOn = !sunStudyOn;
    const sceneLights = (viewer.scene as { lights?: Record<string, { dir?: number[] }> }).lights;
    if (sceneLights) {
      const first = Object.values(sceneLights)[0];
      if (first) {
        first.dir = sunStudyOn ? [-0.5, -0.8, -0.3] : [-0.5, -1, -0.5];
      }
    }
    viewer.scene.render();
  }

  function duplicateSelectedSketch() {
    const draw = useDrawStore.getState();
    const id = draw.selectedId;
    const dup = id ? draw.duplicateElement(id) : draw.duplicateLast();
    if (dup) {
      const s = useDrawStore.getState();
      syncSketches(s.elements, s.activePoints, s.floorElevation);
    }
  }

  function mirrorSelectedSketch() {
    const draw = useDrawStore.getState();
    const id = draw.selectedId;
    const dup = id ? draw.mirrorElement(id) : draw.mirrorLast();
    if (dup) {
      const s = useDrawStore.getState();
      syncSketches(s.elements, s.activePoints, s.floorElevation);
    }
  }

  function arraySelectedSketch() {
    const draw = useDrawStore.getState();
    const id = draw.selectedId;
    const copies = id ? draw.arrayElement(id, 3, 2) : draw.arrayLast(3, 2);
    if (copies.length) {
      const s = useDrawStore.getState();
      syncSketches(s.elements, s.activePoints, s.floorElevation);
    }
  }

  return {
    viewer,
    setLayerVisibility,
    setLayersVisibility,
    setOverlayVisibility,
    applyConstructionTimeline,
    clearConstructionTimeline,
    highlightEntities,
    isolateEntities,
    showAll,
    flyToPlanView,
    flyToPerspective,
    flyToOrthoView,
    fitToView,
    fitDrawingToView,
    resetView,
    setExploded,
    setXRayed,
    captureScreenshot,
    setActiveTool,
    setSnapEnabled,
    setGridVisible,
    addSectionPlane,
    clearSectionPlanes,
    syncSketches,
    syncSketchWorkspace,
    isSketchWorkspaceVisible,
    setSketchWorkspaceVisible,
    prepareDrawSession,
    prepareMeasureSession,
    exitSketchSession,
    pickFloor,
    syncGeoOverlays,
    clearGeoOverlays,
    syncMeasureArea,
    clearMeasureArea,
    finishMeasureAreaPolygon,
    flyToWorldPoint,
    saveBcfViewpoint,
    loadBcfViewpoint,
    cycleStorey,
    toggleSunStudy,
    duplicateSelectedSketch,
    mirrorSelectedSketch,
    arraySelectedSketch,
  };
}

/** Defer camera fit until xeokit has committed geometry and canvas layout is stable.
 *  300 ms allows GPU geometry upload + first paint; one more rAF ensures layout is final. */
export function scheduleCameraFitAfterLoad(
  controls: Pick<ViewerControls, 'fitDrawingToView'>,
  bounds?: { min: [number, number, number]; max: [number, number, number] },
) {
  setTimeout(() => {
    requestAnimationFrame(() => {
      controls.fitDrawingToView(bounds);
    });
  }, 300);
}

export function buildEntityTypeMap(
  elementByEntityId: Map<string, { type: string }>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [entityId, el] of elementByEntityId) {
    map.set(entityId, el.type);
  }
  return map;
}

/** Active Xeokit viewer instance, if the BIM canvas is mounted. */
export function getViewer(): Viewer | null {
  return useViewerStore.getState().viewerControls?.viewer ?? null;
}
