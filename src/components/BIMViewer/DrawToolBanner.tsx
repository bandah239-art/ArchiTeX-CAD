import { useDrawStore } from '../../store/drawStore';
import { useViewerStore } from '../../store/viewerStore';
import { isSketchDrawTool } from '../../services/sketchGeometry';
import type { DrawTool } from '../../types/tools';

const TOOL_HINTS: Record<DrawTool, string> = {
  line: 'Click start, then end point (2 clicks)',
  polyline: 'Click each vertex — double-click or Enter to finish',
  wall: 'Click wall path — double-click or Enter to finish',
  slab: 'Click slab corners (min 3) — double-click or Enter to close',
  column: 'Click once to place column',
  rectangle: 'Click opposite corners (2 clicks)',
  polygon: 'Click vertices (min 3) — double-click or Enter to close',
  pipe: 'Click pipe route — double-click or Enter to finish',
  'site-boundary': 'Click site boundary (min 3) — double-click or Enter to close',
  move: 'Click a sketch or model element to move',
  rotate: 'Click a sketch or model element to rotate',
  extrude: 'Select a closed polygon sketch to extrude',
};

function previewMetrics(activeTool: DrawTool, activePoints: ReturnType<typeof useDrawStore.getState>['activePoints'], previewPoint: ReturnType<typeof useDrawStore.getState>['previewPoint']) {
  const pts = previewPoint ? [...activePoints, previewPoint] : activePoints;
  if (pts.length < 2) return null;
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  }
  if (activeTool === 'rectangle' && pts.length >= 2) {
    const w = Math.abs(pts[1].x - pts[0].x);
    const d = Math.abs(pts[1].z - pts[0].z);
    return `${w.toFixed(2)} m × ${d.toFixed(2)} m = ${(w * d).toFixed(2)} m²`;
  }
  if (activeTool === 'polygon' || activeTool === 'slab' || activeTool === 'site-boundary') {
    if (pts.length >= 3) {
      let area = 0;
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        area += pts[i].x * pts[j].z - pts[j].x * pts[i].z;
      }
      return `${Math.abs(area / 2).toFixed(2)} m² preview`;
    }
  }
  return `${len.toFixed(2)} m length`;
}

const GIZMO_TOOLS: DrawTool[] = ['move', 'rotate', 'extrude'];

function isDrawBannerTool(tool: string | null): tool is DrawTool {
  return !!tool && (isSketchDrawTool(tool) || GIZMO_TOOLS.includes(tool as DrawTool));
}

export function DrawToolBanner() {
  const activeTool = useViewerStore((s) => s.activeTool);
  const { activePoints, previewPoint, floorElevation, modifiers, isDrawing, selectedId, lastPickError, elements } = useDrawStore();

  if (!isDrawBannerTool(activeTool)) return null;
  const drawTool = activeTool;

  const hint = TOOL_HINTS[drawTool];
  const metrics = isSketchDrawTool(drawTool)
    ? previewMetrics(drawTool, activePoints, previewPoint)
    : null;

  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-lg bg-infra-dark/90 border border-emerald-500/40 text-xs shadow-lg max-w-lg pointer-events-none">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-emerald-300 font-semibold uppercase tracking-wide">{drawTool.replace('-', ' ')}</span>
        <span className="text-gray-300">{hint}</span>
        <span className="text-gray-500">
          Floor Y: {floorElevation.toFixed(2)} m · Grid: {modifiers.gridSnap} m
          {drawTool === 'extrude' ? ` · Height: ${modifiers.extrudeHeight} m` : ''}
        </span>
        {drawTool === 'extrude' && selectedId && (
          <span className="text-sky-300">Selected sketch ready — click another or re-run Extrude</span>
        )}
        {isDrawing && isSketchDrawTool(drawTool) && (
          <span className="text-amber-300">
            Points: {activePoints.length}
            {metrics ? ` · ${metrics}` : ''}
            {elements.length > 0 ? ` · ${elements.length} shape(s)` : ''}
          </span>
        )}
        {lastPickError && (
          <span className="text-red-300">{lastPickError}</span>
        )}
      </div>
    </div>
  );
}
