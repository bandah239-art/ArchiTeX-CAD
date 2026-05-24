import type { ViewMode } from '../../types/ifc';

interface ViewerToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onFitToView: () => void;
  onResetView: () => void;
}

export function ViewerToolbar({
  viewMode,
  onViewModeChange,
  onFitToView,
  onResetView,
}: ViewerToolbarProps) {
  return (
    <div className="absolute top-2 left-2 z-10 flex gap-1">
      <button
        onClick={() => onViewModeChange(viewMode === 'perspective' ? 'ortho' : 'perspective')}
        className="px-2 py-1 text-xs bg-infra-darker/80 backdrop-blur border border-infra-accent/40 rounded hover:bg-infra-accent/30 transition-colors"
        title="Toggle perspective/orthographic"
      >
        {viewMode === 'perspective' ? '3D' : '2D'}
      </button>
      <button
        onClick={onFitToView}
        className="px-2 py-1 text-xs bg-infra-darker/80 backdrop-blur border border-infra-accent/40 rounded hover:bg-infra-accent/30 transition-colors"
        title="Fit to view"
      >
        Fit
      </button>
      <button
        onClick={onResetView}
        className="px-2 py-1 text-xs bg-infra-darker/80 backdrop-blur border border-infra-accent/40 rounded hover:bg-infra-accent/30 transition-colors"
        title="Reset view"
      >
        Reset
      </button>
    </div>
  );
}
