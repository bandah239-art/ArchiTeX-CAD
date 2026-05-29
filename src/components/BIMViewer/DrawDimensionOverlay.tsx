import { useDrawStore } from '../../store/drawStore';
import { useViewerStore } from '../../store/viewerStore';

export function DrawDimensionOverlay() {
  const { isDrawing, activePoints, previewPoint } = useDrawStore();
  const activeTool = useViewerStore((s) => s.activeTool);

  const isDrawTool = typeof activeTool === 'string' && (
    activeTool.startsWith('draw.') ||
    activeTool === 'wall' || activeTool === 'slab' ||
    activeTool === 'column' || activeTool === 'pipe'
  );

  if (!isDrawTool && !isDrawing) return null;

  const last = activePoints.length > 0 ? activePoints[activePoints.length - 1] : null;
  const preview = previewPoint;

  const segmentDist = last && preview
    ? Math.hypot(preview.x - last.x, preview.z - last.z)
    : null;

  const totalLen = activePoints.length > 1
    ? activePoints.reduce((acc, pt, i) => {
        if (i === 0) return acc;
        return acc + Math.hypot(pt.x - activePoints[i - 1].x, pt.z - activePoints[i - 1].z);
      }, 0)
    : 0;

  const angle = last && preview
    ? (Math.atan2(preview.x - last.x, preview.z - last.z) * 180 / Math.PI + 360) % 360
    : null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[200] bg-[#0a0f1e]/95 border-t border-infra-highlight/40 px-4 py-1.5 flex items-center gap-6 text-xs font-mono select-none pointer-events-none">
      {/* Coordinates */}
      {preview && (
        <span className="text-gray-400">
          X: <span className="text-white font-bold">{preview.x.toFixed(3)}</span>
          &nbsp; Z: <span className="text-white font-bold">{preview.z.toFixed(3)}</span>
          &nbsp; Y: <span className="text-gray-500">{preview.y.toFixed(2)}</span>
        </span>
      )}

      {/* Current segment */}
      {segmentDist !== null && (
        <span className="text-infra-highlight">
          Segment: <span className="font-bold text-white">{segmentDist.toFixed(3)} m</span>
        </span>
      )}

      {/* Angle */}
      {angle !== null && (
        <span className="text-blue-400">
          Angle: <span className="font-bold">{angle.toFixed(1)}°</span>
        </span>
      )}

      {/* Running total */}
      {totalLen > 0 && (
        <span className="text-emerald-400">
          Total: <span className="font-bold">{totalLen.toFixed(3)} m</span>
        </span>
      )}

      {/* Point count */}
      <span className="text-gray-600">
        {activePoints.length} {activePoints.length === 1 ? 'point' : 'points'} placed
        {activePoints.length > 0 && ' — press Enter/F to finish, Esc to cancel'}
      </span>
    </div>
  );
}
