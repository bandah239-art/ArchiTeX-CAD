import { useProjectStore } from '../../store/projectStore';
import { useProject } from '../../hooks/useProject';

interface TopBarProps {
  onBack: () => void;
  onToggleCalculator: () => void;
  onToggleInspector: () => void;
}

export function TopBar({ onBack, onToggleCalculator, onToggleInspector }: TopBarProps) {
  const { currentProject } = useProjectStore();
  const { openIFC, saveProject } = useProject();

  return (
    <header className="h-12 flex items-center px-4 bg-infra-darker border-b border-infra-accent/30 gap-4">
      <button
        onClick={onBack}
        className="text-gray-400 hover:text-white text-sm transition-colors"
      >
        ← Dashboard
      </button>
      <div className="flex-1">
        <span className="font-semibold text-white">
          {currentProject?.name || 'Untitled Project'}
        </span>
        {currentProject?.ifcPath && (
          <span className="ml-3 text-xs text-gray-500 truncate">
            {currentProject.ifcPath}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={openIFC}
          className="px-3 py-1 text-xs bg-infra-accent hover:bg-infra-accent/80 rounded transition-colors"
        >
          Open IFC
        </button>
        <button
          onClick={saveProject}
          className="px-3 py-1 text-xs bg-infra-accent/50 hover:bg-infra-accent/70 rounded transition-colors"
        >
          Save
        </button>
        <button
          onClick={onToggleInspector}
          className="px-3 py-1 text-xs border border-infra-accent/50 hover:bg-infra-accent/20 rounded transition-colors"
        >
          Inspector
        </button>
        <button
          onClick={onToggleCalculator}
          className="px-3 py-1 text-xs border border-infra-highlight/50 text-infra-highlight hover:bg-infra-highlight/10 rounded transition-colors"
        >
          Calculator
        </button>
      </div>
    </header>
  );
}
