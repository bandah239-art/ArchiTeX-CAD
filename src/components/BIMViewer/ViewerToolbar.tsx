import type { ViewMode } from '../../types/ifc';

interface ViewerToolbarProps {
  viewMode: ViewMode;
  exploded: boolean;
  xRay: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onFitToView: () => void;
  onResetView: () => void;
  onToggleExplode: () => void;
  onToggleXRay: () => void;
  onScreenshot: () => void;
  onShowAll: () => void;
}

export function ViewerToolbar({
  viewMode,
  exploded,
  xRay,
  onViewModeChange,
  onFitToView,
  onResetView,
  onToggleExplode,
  onToggleXRay,
  onScreenshot,
  onShowAll,
}: ViewerToolbarProps) {
  const btn =
    'px-2 py-1 text-xs bg-infra-darker/80 backdrop-blur border border-infra-accent/40 rounded hover:bg-infra-accent/30 transition-colors';
  const active = 'bg-emerald-900/40 border-emerald-500/50 text-emerald-300';

  return (
    <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-1 max-w-[90%]">
      <button
        onClick={() => onViewModeChange('perspective')}
        className={`${btn} ${viewMode === 'perspective' ? active : ''}`}
        title="3D perspective"
      >
        3D
      </button>
      <button
        onClick={() => onViewModeChange('plan')}
        className={`${btn} ${viewMode === 'plan' ? active : ''}`}
        title="Plan view (top-down)"
      >
        Plan
      </button>
      <button
        onClick={() => onViewModeChange('ortho')}
        className={`${btn} ${viewMode === 'ortho' ? active : ''}`}
        title="Orthographic 3D"
      >
        Ortho
      </button>
      <button onClick={onFitToView} className={btn} title="Fit to view">
        Fit
      </button>
      <button onClick={onResetView} className={btn} title="Reset view">
        Reset
      </button>
      <button
        onClick={onToggleExplode}
        className={`${btn} ${exploded ? active : ''}`}
        title="Exploded assembly view"
      >
        Explode
      </button>
      <button
        onClick={onToggleXRay}
        className={`${btn} ${xRay ? active : ''}`}
        title="X-ray transparency"
      >
        X-Ray
      </button>
      <button onClick={onShowAll} className={btn} title="Show all layers">
        Show All
      </button>
      <button onClick={onScreenshot} className={btn} title="Capture viewport snapshot">
        Snapshot
      </button>
    </div>
  );
}
