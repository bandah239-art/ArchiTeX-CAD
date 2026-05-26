import type { DrawEngine } from './drawEngine';
import { autoFinishAfterClicks, asSketchDrawTool, MIN_POINTS } from './sketchGeometry';
import { useDrawStore } from '../store/drawStore';
import type { SketchKind } from '../store/drawStore';
import { useUndoStore } from '../store/undoStore';
import { useViewerStore } from '../store/viewerStore';
import { useToolbarStore } from '../components/BIMViewer/toolRegistry';
import type { DrawTool } from '../types/tools';
import { useCadSessionStore } from '../store/cadSessionStore';
import { processCadModifyClick } from './cadModifyInteraction';

export function syncDrawToEngine(
  drawEngine: DrawEngine | null | undefined,
  activeTool: string | null = useViewerStore.getState().activeTool,
) {
  if (!drawEngine) return;
  const s = useDrawStore.getState();
  drawEngine.sync(s.elements, s.activePoints, s.floorElevation, {
    previewPoint: s.previewPoint,
    activeTool: asSketchDrawTool(activeTool),
  });
}

export function pickSketchPoint(
  drawEngine: DrawEngine | null | undefined,
  canvasPos: number[],
): { x: number; y: number; z: number } | null {
  if (!drawEngine) return null;
  const floorY = useDrawStore.getState().floorElevation;
  const pt = drawEngine.pickFloor(canvasPos, floorY);
  if (pt) return pt;

  const canvas = document.getElementById('bimCanvas') as HTMLCanvasElement | null;
  const cw = canvas?.clientWidth || 800;
  const ch = canvas?.clientHeight || 600;
  const draw = useDrawStore.getState();
  const nx = (canvasPos[0] / cw) * 2 - 1;
  const ny = 1 - (canvasPos[1] / ch) * 2;
  const half = draw.sketchSpan * 0.45;
  const aspect = cw / ch;
  return {
    x: draw.sketchCenterX + nx * half * aspect,
    y: floorY,
    z: draw.sketchCenterZ + ny * half,
  };
}

function commitFinishStroke(
  drawEngine: DrawEngine | null | undefined,
  drawTool: DrawTool,
  kind: SketchKind,
): boolean {
  const draw = useDrawStore.getState();
  if (draw.activePoints.length < MIN_POINTS[kind]) {
    useDrawStore.setState({
      lastPickError: `Need at least ${MIN_POINTS[kind]} point${MIN_POINTS[kind] > 1 ? 's' : ''}`,
    });
    return false;
  }

  const before = draw.getSnapshot();
  const el = draw.finishStroke(kind);
  if (!el) {
    useDrawStore.setState({
      lastPickError: `Could not finish ${kind} — check point count`,
    });
    return false;
  }

  useDrawStore.setState({ lastPickError: null });
  useUndoStore.getState().pushDrawAction(`Draw ${kind}`, before, useDrawStore.getState().getSnapshot());
  syncDrawToEngine(drawEngine, drawTool);
  return true;
}

/** Handle one sketch click (canvas coords). Returns true if handled. */
export function processSketchClick(
  drawEngine: DrawEngine | null | undefined,
  canvasPos: number[],
): boolean {
  if (useCadSessionStore.getState().command) {
    return processCadModifyClick(drawEngine, canvasPos);
  }

  const tool = useViewerStore.getState().activeTool;
  const drawTool = asSketchDrawTool(tool);
  if (!drawTool || useToolbarStore.getState().activeTab !== 'draw') return false;

  const pt = pickSketchPoint(drawEngine, canvasPos);
  if (!pt) {
    useDrawStore.setState({ lastPickError: 'Could not resolve click on sketch plane' });
    return true;
  }

  useDrawStore.setState({ lastPickError: null });
  const draw = useDrawStore.getState();
  draw.addPoint(pt);

  const updated = useDrawStore.getState();
  syncDrawToEngine(drawEngine, drawTool);

  const finishAt = autoFinishAfterClicks(drawTool);
  if (finishAt !== null && updated.activePoints.length >= finishAt) {
    const kind = draw.toolToKind(drawTool);
    if (kind) commitFinishStroke(drawEngine, drawTool, kind);
  }

  return true;
}

export function processSketchMove(
  drawEngine: DrawEngine | null | undefined,
  canvasPos: number[],
): boolean {
  const tool = useViewerStore.getState().activeTool;
  const drawTool = asSketchDrawTool(tool);
  if (!drawTool || useToolbarStore.getState().activeTab !== 'draw') {
    if (useDrawStore.getState().previewPoint) {
      useDrawStore.getState().setPreviewPoint(null);
      syncDrawToEngine(drawEngine, null);
    }
    return false;
  }

  const draw = useDrawStore.getState();
  if (!draw.isDrawing && draw.activePoints.length === 0) return false;

  const pt = pickSketchPoint(drawEngine, canvasPos);
  useDrawStore.getState().setPreviewPoint(pt);
  syncDrawToEngine(drawEngine, drawTool);
  return true;
}

export function processSketchDblClick(drawEngine: DrawEngine | null | undefined): boolean {
  const tool = useViewerStore.getState().activeTool;
  const drawTool = asSketchDrawTool(tool);
  if (!drawTool || useToolbarStore.getState().activeTab !== 'draw') return false;

  const draw = useDrawStore.getState();
  const kind = draw.toolToKind(drawTool);
  if (!kind) return false;

  return commitFinishStroke(drawEngine, drawTool, kind);
}
