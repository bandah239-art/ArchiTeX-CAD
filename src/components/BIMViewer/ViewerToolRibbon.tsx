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
  return <div className="w-px h-9 bg-infra-accent/40 mx-1.5 flex-shrink-0" />;
}

function ToolGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1 px-1.5 flex-shrink-0">
      <span className="tool-ribbon-group-label">{label}</span>
      {children}
    </div>
  );
}

function renderIcon(tool: ToolDef) {
  if (tool.icon === 'text' && tool.text) {
    return <span className="text-sm font-bold">{tool.text}</span>;
  }
  const IconFn = ToolIcons[tool.icon as keyof typeof ToolIcons];
  return IconFn ? <IconFn size={20} /> : null;
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
        'tool-ribbon-btn',
        active ? 'tool-ribbon-btn-active' : 'tool-ribbon-btn-idle',
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
    <div className="flex items-center gap-3 ml-2 pl-3 border-l border-infra-accent/30 flex-shrink-0">
      <label className="flex items-center gap-2 text-sm text-gray-300">
        {t('tools.wallHeight')}
        <input
          type="number"
          min={0.5}
          max={20}
          step={0.1}
          value={modifiers.wallHeight}
          onChange={(e) => setModifiers({ wallHeight: Number(e.target.value) })}
          className="w-16 px-2 py-1.5 text-sm bg-infra-dark border border-infra-accent/40 rounded-lg text-white"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-300">
        {t('tools.wallThickness')}
        <input
          type="number"
          min={0.05}
          max={2}
          step={0.05}
          value={modifiers.wallThickness}
          onChange={(e) => setModifiers({ wallThickness: Number(e.target.value) })}
          className="w-16 px-2 py-1.5 text-sm bg-infra-dark border border-infra-accent/40 rounded-lg text-white"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-300">
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
          className="w-20 px-2 py-1.5 text-sm bg-infra-dark border border-infra-accent/40 rounded-lg text-white"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-300">
        {t('tools.gridSnap')}
        <input
          type="number"
          min={0}
          max={5}
          step={0.25}
          value={modifiers.gridSnap}
          onChange={(e) => setModifiers({ gridSnap: Number(e.target.value) })}
          className="w-16 px-2 py-1.5 text-sm bg-infra-dark border border-infra-accent/40 rounded-lg text-white"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-300">
        {t('tools.extrudeHeight')}
        <input
          type="number"
          min={0.1}
          max={50}
          step={0.1}
          value={modifiers.extrudeHeight}
          onChange={(e) => setModifiers({ extrudeHeight: Number(e.target.value) })}
          className="w-16 px-2 py-1.5 text-sm bg-infra-dark border border-infra-accent/40 rounded-lg text-white"
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
    <div className="tool-ribbon-shell">
      <div className="tool-ribbon-tabs">
        {RIBBON_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              'tool-ribbon-tab',
              activeTab === tab.id ? 'tool-ribbon-tab-active' : 'tool-ribbon-tab-idle',
            ].join(' ')}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      <div className="tool-ribbon-row-primary">
        {renderRow(primaryTools)}
      </div>

      <div className="tool-ribbon-row-modifier">
        {renderRow(modifierTools)}
        <ModifierInputs />
        <div className="ml-auto flex-shrink-0 text-sm text-gray-400 px-3 hidden md:block">
          {activeTool && activeTool !== 'select' ? (
            <span>
              {t('tools.activeTool')}: <span className="text-infra-highlight font-medium">{activeTool}</span>
            </span>
          ) : (
            <span>{t('tools.hint')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
