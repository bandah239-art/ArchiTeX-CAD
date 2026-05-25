import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useViewerStore } from '../../store/viewerStore';
import { useDrawStore } from '../../store/drawStore';
import { useUndoStore } from '../../store/undoStore';
import { useScheduleStore } from '../../store/scheduleStore';
import { usePlatformToolsStore } from '../../store/platformToolsStore';
import { useToolbarStore } from './toolRegistry';
import { isSketchDrawTool } from '../../services/sketchGeometry';
import { RIBBON_TABS, groupedTools, toolsForTab, type ToolDef } from './toolRegistry';
import { ToolIcons } from './ToolIcons';
import { useToolActions } from '../../hooks/useToolActions';
import { collectTargetEntityIds } from '../../store/ifcModelStore';

function ToolDivider() {
  return <div className="w-px h-7 bg-infra-accent/40 mx-1 flex-shrink-0" />;
}

function ToolGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-0.5 px-1 flex-shrink-0">
      <span className="text-[9px] uppercase tracking-wider text-gray-500 mr-1 hidden xl:inline select-none whitespace-nowrap">
        {label}
      </span>
      {children}
    </div>
  );
}

function renderIcon(tool: ToolDef) {
  if (tool.icon === 'text' && tool.text) {
    return <span className="text-[10px] font-bold">{tool.text}</span>;
  }
  const IconFn = ToolIcons[tool.icon as keyof typeof ToolIcons];
  return IconFn ? <IconFn size={15} /> : null;
}

function ToolButton({
  tool,
  active,
  disabled,
  onClick,
  label,
}: {
  tool: ToolDef;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  const tip = tool.shortcut ? `${label} (${tool.shortcut})` : label;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={tip}
      aria-label={label}
      className={[
        'flex items-center justify-center w-8 h-8 rounded border transition-colors flex-shrink-0',
        active
          ? 'bg-emerald-900/50 border-emerald-500/60 text-emerald-300'
          : 'bg-infra-darker/60 border-infra-accent/30 text-gray-300 hover:bg-infra-accent/40 hover:text-white',
        disabled ? 'opacity-40 cursor-not-allowed' : '',
      ].join(' ')}
    >
      {renderIcon(tool)}
    </button>
  );
}

function ModifierInputs() {
  const { modifiers, setModifiers, floorElevation, setFloorElevation } = useDrawStore();
  const viewerControls = useViewerStore((s) => s.viewerControls);
  const { t } = useTranslation();
  const { activeTab } = useToolbarStore();

  if (activeTab !== 'draw') return null;

  return (
    <div className="flex items-center gap-2 ml-2 pl-2 border-l border-infra-accent/30 flex-shrink-0">
      <label className="flex items-center gap-1 text-[10px] text-gray-400">
        {t('tools.wallHeight')}
        <input
          type="number"
          min={0.5}
          max={20}
          step={0.1}
          value={modifiers.wallHeight}
          onChange={(e) => setModifiers({ wallHeight: Number(e.target.value) })}
          className="w-12 px-1 py-0.5 text-[10px] bg-infra-dark border border-infra-accent/40 rounded text-white"
        />
      </label>
      <label className="flex items-center gap-1 text-[10px] text-gray-400">
        {t('tools.wallThickness')}
        <input
          type="number"
          min={0.05}
          max={2}
          step={0.05}
          value={modifiers.wallThickness}
          onChange={(e) => setModifiers({ wallThickness: Number(e.target.value) })}
          className="w-12 px-1 py-0.5 text-[10px] bg-infra-dark border border-infra-accent/40 rounded text-white"
        />
      </label>
      <label className="flex items-center gap-1 text-[10px] text-gray-400">
        Floor Y
        <input
          type="number"
          step={0.1}
          value={floorElevation}
          onChange={(e) => {
            setFloorElevation(Number(e.target.value));
            if (viewerControls?.isSketchWorkspaceVisible?.()) {
              viewerControls.syncSketchWorkspace();
            }
          }}
          className="w-14 px-1 py-0.5 text-[10px] bg-infra-dark border border-infra-accent/40 rounded text-white"
        />
      </label>
      <label className="flex items-center gap-1 text-[10px] text-gray-400">
        {t('tools.gridSnap')}
        <input
          type="number"
          min={0}
          max={5}
          step={0.25}
          value={modifiers.gridSnap}
          onChange={(e) => setModifiers({ gridSnap: Number(e.target.value) })}
          className="w-12 px-1 py-0.5 text-[10px] bg-infra-dark border border-infra-accent/40 rounded text-white"
        />
      </label>
      <label className="flex items-center gap-1 text-[10px] text-gray-400">
        {t('tools.extrudeHeight')}
        <input
          type="number"
          min={0.1}
          max={50}
          step={0.1}
          value={modifiers.extrudeHeight}
          onChange={(e) => setModifiers({ extrudeHeight: Number(e.target.value) })}
          className="w-12 px-1 py-0.5 text-[10px] bg-infra-dark border border-infra-accent/40 rounded text-white"
        />
      </label>
    </div>
  );
}

export function ViewerToolRibbon() {
  const { t } = useTranslation();
  const { run } = useToolActions();
  const { activeTab, setActiveTab } = useToolbarStore();
  const {
    viewMode,
    exploded,
    xRay,
    activeTool,
    snapEnabled,
    gridVisible,
    loadedModel,
  } = useViewerStore();
  const { modifiers } = useDrawStore();
  const { canUndo, canRedo } = useUndoStore();
  const { timelineEnabled } = useScheduleStore();

  const hasModel = !!loadedModel;
  const selectionCount = collectTargetEntityIds().length;
  const viewerControls = useViewerStore((s) => s.viewerControls);
  const prevTabRef = useRef(activeTab);

  useEffect(() => {
    const prev = prevTabRef.current;
    if (prev === 'draw' && activeTab !== 'draw' && viewerControls) {
      const tool = useViewerStore.getState().activeTool;
      if (!isSketchDrawTool(tool) && tool !== 'extrude') {
        viewerControls.exitSketchSession();
      }
    }
    prevTabRef.current = activeTab;
  }, [activeTab, viewerControls]);

  const isActive = (tool: ToolDef): boolean => {
    if (!tool.activeWhen) return false;
    switch (tool.activeWhen) {
      case 'view.perspective':
        return viewMode === 'perspective';
      case 'view.plan':
        return viewMode === 'plan';
      case 'view.ortho':
        return viewMode === 'ortho';
      case 'exploded':
        return exploded;
      case 'xray':
        return xRay;
      case 'snap':
        return snapEnabled;
      case 'grid':
        return gridVisible;
      case 'timeline':
        return timelineEnabled;
      case 'orthoLock':
        return modifiers.orthoLock;
      case 'distance':
        return activeTool === 'distance';
      case 'angle':
        return activeTool === 'angle';
      default:
        return activeTool === tool.activeWhen;
    }
  };

  const isDisabled = (tool: ToolDef): boolean => {
    if (usePlatformToolsStore.getState().isRunning) return true;
    if (tool.actionId === 'mod.undo') return !canUndo;
    if (tool.actionId === 'mod.redo') return !canRedo;
    if (tool.requiresModel && !hasModel) return true;
    if (tool.requiresTwoSelection && selectionCount < 2) return true;
    return false;
  };

  const renderRow = (tools: ToolDef[]) => {
    const groups = groupedTools(tools);
    return groups.map(({ group, tools: groupTools }, gi) => (
      <div key={group} className="flex items-center">
        {gi > 0 && <ToolDivider />}
        <ToolGroup label={t(group)}>
          {groupTools.map((tool) => (
            <ToolButton
              key={tool.id}
              tool={tool}
              label={t(tool.labelKey)}
              active={isActive(tool)}
              disabled={isDisabled(tool)}
              onClick={() => run(tool.actionId)}
            />
          ))}
        </ToolGroup>
      </div>
    ));
  };

  const primaryTools = toolsForTab(activeTab, 'primary');
  const modifierTools = [
    ...toolsForTab('model', 'modifier'),
    ...(activeTab === 'draw' ? toolsForTab('draw', 'modifier').filter((t) => t.tab === 'draw') : []),
  ].filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i);

  return (
    <div className="flex flex-col bg-infra-darker/95 border-b border-infra-accent/30">
      {/* Tab strip */}
      <div className="flex items-center h-7 px-2 gap-0.5 border-b border-infra-accent/20 overflow-x-auto">
        {RIBBON_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              'px-3 py-0.5 text-[10px] uppercase tracking-wide rounded-t transition-colors flex-shrink-0',
              activeTab === tab.id
                ? 'bg-infra-accent/50 text-white border border-b-0 border-infra-accent/60'
                : 'text-gray-500 hover:text-gray-300 hover:bg-infra-accent/20',
            ].join(' ')}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Primary tool row */}
      <div className="h-11 flex items-center px-2 overflow-x-auto scrollbar-thin gap-1">
        {renderRow(primaryTools)}
      </div>

      {/* Modifier row (Blender-style) */}
      <div className="h-9 flex items-center px-2 overflow-x-auto scrollbar-thin gap-1 bg-infra-dark/50 border-t border-infra-accent/15">
        {renderRow(modifierTools)}
        <ModifierInputs />
        <div className="ml-auto flex-shrink-0 text-[10px] text-gray-500 px-2 hidden md:block">
          {activeTool && activeTool !== 'select' ? (
            <span>{t('tools.activeTool')}: <span className="text-emerald-400">{activeTool}</span></span>
          ) : (
            <span>{t('tools.hint')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
