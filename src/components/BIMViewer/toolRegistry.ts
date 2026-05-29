import { create } from 'zustand';
import type { RibbonTab } from '../../types/tools';
import type { ToolDef, ToolIconKey } from '../../types/toolRegistry';
import { EXTENDED_TOOLS, EXTRA_RIBBON_TABS } from './toolRegistryExtended';
import { CAD_TOOLS } from './toolRegistryCad';

export type { ToolDef, ToolIconKey };

interface ToolbarState {
  activeTab: RibbonTab;
  setActiveTab: (tab: RibbonTab) => void;
}

export const useToolbarStore = create<ToolbarState>((set) => ({
  activeTab: 'model',
  setActiveTab: (tab) => set({ activeTab: tab }),
}));

export const RIBBON_TABS: { id: RibbonTab; labelKey: string }[] = [
  { id: 'model', labelKey: 'tools.tabs.model' },
  { id: 'draw', labelKey: 'tools.tabs.draw' },
  { id: 'geo', labelKey: 'tools.tabs.geo' },
  { id: 'realestate', labelKey: 'tools.tabs.realestate' },
  { id: 'wash', labelKey: 'tools.tabs.wash' },
  { id: 'energy', labelKey: 'tools.tabs.energy' },
  { id: 'structure', labelKey: 'tools.tabs.structure' },
  { id: 'bim', labelKey: 'tools.tabs.bim' },
  ...EXTRA_RIBBON_TABS,
];

export const TOOL_REGISTRY: ToolDef[] = [
  // ── MODEL tab ──
  { id: 'select', actionId: 'tool.select', labelKey: 'tools.selectTool', icon: 'select', shortcut: 'Q', group: 'tools.select', tab: 'model', row: 'primary' },
  { id: 'boxSelect', actionId: 'tool.boxSelect', labelKey: 'tools.boxSelect', icon: 'boxSelect', shortcut: 'B', group: 'tools.select', tab: 'model', row: 'primary', requiresModel: true },
  { id: 'orbit', actionId: 'tool.orbit', labelKey: 'tools.orbit', icon: 'orbit', shortcut: 'O', group: 'tools.navigate', tab: 'model', row: 'primary' },
  { id: 'pan', actionId: 'tool.pan', labelKey: 'tools.pan', icon: 'pan', shortcut: 'P', group: 'tools.navigate', tab: 'model', row: 'primary' },
  { id: 'zoom', actionId: 'tool.zoom', labelKey: 'tools.zoom', icon: 'zoom', shortcut: 'Z', group: 'tools.navigate', tab: 'model', row: 'primary' },
  { id: 'walk', actionId: 'tool.walk', labelKey: 'tools.walk', icon: 'walk', shortcut: 'W', group: 'tools.navigate', tab: 'model', row: 'primary' },
  { id: 'perspective', actionId: 'view.perspective', labelKey: 'tools.perspective', icon: 'perspective', shortcut: '1', group: 'tools.view', tab: 'model', row: 'primary', activeWhen: 'view.perspective' },
  { id: 'plan', actionId: 'view.plan', labelKey: 'tools.plan', icon: 'plan', shortcut: '2', group: 'tools.view', tab: 'model', row: 'primary', activeWhen: 'view.plan' },
  { id: 'ortho', actionId: 'view.ortho', labelKey: 'tools.ortho', icon: 'ortho', shortcut: '3', group: 'tools.view', tab: 'model', row: 'primary', activeWhen: 'view.ortho' },
  { id: 'fit', actionId: 'view.fit', labelKey: 'tools.fit', icon: 'fit', shortcut: 'F', group: 'tools.view', tab: 'model', row: 'primary', requiresModel: true },
  { id: 'reset', actionId: 'view.reset', labelKey: 'tools.reset', icon: 'reset', group: 'tools.view', tab: 'model', row: 'primary', requiresModel: true },
  { id: 'front', actionId: 'view.front', labelKey: 'tools.front', icon: 'text', text: 'F', group: 'tools.standard', tab: 'model', row: 'primary', requiresModel: true },
  { id: 'back', actionId: 'view.back', labelKey: 'tools.back', icon: 'text', text: 'Bk', group: 'tools.standard', tab: 'model', row: 'primary', requiresModel: true },
  { id: 'left', actionId: 'view.left', labelKey: 'tools.left', icon: 'text', text: 'L', group: 'tools.standard', tab: 'model', row: 'primary', requiresModel: true },
  { id: 'right', actionId: 'view.right', labelKey: 'tools.right', icon: 'text', text: 'R', group: 'tools.standard', tab: 'model', row: 'primary', requiresModel: true },
  { id: 'top', actionId: 'view.top', labelKey: 'tools.top', icon: 'text', text: 'T', group: 'tools.standard', tab: 'model', row: 'primary', requiresModel: true },
  { id: 'bottom', actionId: 'view.bottom', labelKey: 'tools.bottom', icon: 'text', text: 'Bt', group: 'tools.standard', tab: 'model', row: 'primary', requiresModel: true },
  { id: 'explode', actionId: 'display.explode', labelKey: 'tools.explode', icon: 'explode', shortcut: 'E', group: 'tools.display', tab: 'model', row: 'primary', requiresModel: true, activeWhen: 'exploded' },
  { id: 'xray', actionId: 'display.xray', labelKey: 'tools.xray', icon: 'xray', shortcut: 'X', group: 'tools.display', tab: 'model', row: 'primary', requiresModel: true, activeWhen: 'xray' },
  { id: 'showAll', actionId: 'display.showAll', labelKey: 'tools.showAll', icon: 'showAll', group: 'tools.display', tab: 'model', row: 'primary', requiresModel: true },
  { id: 'isolate', actionId: 'display.isolate', labelKey: 'tools.isolate', icon: 'text', text: 'Iso', group: 'tools.display', tab: 'model', row: 'primary', requiresModel: true },
  { id: 'highlight', actionId: 'display.highlight', labelKey: 'tools.highlight', icon: 'text', text: 'Hi', group: 'tools.display', tab: 'model', row: 'primary', requiresModel: true },
  { id: 'distance', actionId: 'measure.distance', labelKey: 'tools.distance', icon: 'measure', shortcut: 'M', group: 'tools.measure', tab: 'model', row: 'primary', requiresModel: true, activeWhen: 'distance' },
  { id: 'angle', actionId: 'measure.angle', labelKey: 'tools.angle', icon: 'angle', shortcut: 'A', group: 'tools.measure', tab: 'model', row: 'primary', requiresModel: true, activeWhen: 'angle' },
  { id: 'sectionX', actionId: 'section.x', labelKey: 'tools.sectionX', icon: 'text', text: 'X', group: 'tools.section', tab: 'model', row: 'primary', requiresModel: true },
  { id: 'sectionY', actionId: 'section.y', labelKey: 'tools.sectionY', icon: 'text', text: 'Y', group: 'tools.section', tab: 'model', row: 'primary', requiresModel: true },
  { id: 'sectionZ', actionId: 'section.z', labelKey: 'tools.sectionZ', icon: 'text', text: 'Z', group: 'tools.section', tab: 'model', row: 'primary', requiresModel: true },
  { id: 'sectionClear', actionId: 'section.clear', labelKey: 'tools.clearSections', icon: 'section', group: 'tools.section', tab: 'model', row: 'primary', requiresModel: true },
  { id: 'snapshot', actionId: 'capture.snapshot', labelKey: 'tools.snapshot', icon: 'snapshot', shortcut: 'Ctrl+S', group: 'tools.capture', tab: 'model', row: 'primary', requiresModel: true },

  // ── DRAW tab ──
  { id: 'drawLine', actionId: 'draw.line', labelKey: 'tools.drawLine', icon: 'line', shortcut: 'L', group: 'tools.draw', tab: 'draw', row: 'primary', activeWhen: 'line' },
  { id: 'drawPolyline', actionId: 'draw.polyline', labelKey: 'tools.drawPolyline', icon: 'line', group: 'tools.draw', tab: 'draw', row: 'primary', activeWhen: 'polyline' },
  { id: 'drawWall', actionId: 'draw.wall', labelKey: 'tools.drawWall', icon: 'wall', shortcut: 'Shift+W', group: 'tools.draw', tab: 'draw', row: 'primary', activeWhen: 'wall' },
  { id: 'drawSlab', actionId: 'draw.slab', labelKey: 'tools.drawSlab', icon: 'slab', group: 'tools.draw', tab: 'draw', row: 'primary', activeWhen: 'slab' },
  { id: 'drawColumn', actionId: 'draw.column', labelKey: 'tools.drawColumn', icon: 'column', group: 'tools.draw', tab: 'draw', row: 'primary', activeWhen: 'column' },
  { id: 'drawRect', actionId: 'draw.rectangle', labelKey: 'tools.drawRect', icon: 'polygon', group: 'tools.draw', tab: 'draw', row: 'primary', activeWhen: 'rectangle' },
  { id: 'drawPolygon', actionId: 'draw.polygon', labelKey: 'tools.drawPolygon', icon: 'polygon', group: 'tools.draw', tab: 'draw', row: 'primary', activeWhen: 'polygon' },
  { id: 'drawPipe', actionId: 'draw.pipe', labelKey: 'tools.drawPipe', icon: 'pipe', group: 'tools.draw', tab: 'draw', row: 'primary', activeWhen: 'pipe' },
  { id: 'drawSite', actionId: 'draw.siteBoundary', labelKey: 'tools.drawSite', icon: 'geo', group: 'tools.draw', tab: 'draw', row: 'primary', activeWhen: 'site-boundary' },
  { id: 'drawFinish', actionId: 'draw.finish', labelKey: 'tools.drawFinish', icon: 'text', text: '✓', group: 'tools.draw', tab: 'draw', row: 'primary' },
  { id: 'drawCancel', actionId: 'draw.cancel', labelKey: 'tools.drawCancel', icon: 'text', text: '✕', group: 'tools.draw', tab: 'draw', row: 'primary' },
  { id: 'drawClear', actionId: 'draw.clearAll', labelKey: 'tools.drawClear', icon: 'text', text: 'Clr', group: 'tools.draw', tab: 'draw', row: 'primary' },

  // ── GEO tab ──
  { id: 'geoOpen', actionId: 'geo.open', labelKey: 'tools.geoOpen', icon: 'geo', group: 'tools.geo', tab: 'geo', row: 'primary' },
  { id: 'geoAnalyse', actionId: 'geo.analyse', labelKey: 'tools.geoAnalyse', icon: 'geo', group: 'tools.geo', tab: 'geo', row: 'primary' },
  { id: 'geoBudget', actionId: 'geo.budget', labelKey: 'tools.geoBudget', icon: 'budget', group: 'tools.geo', tab: 'geo', row: 'primary' },
  { id: 'geoFlood', actionId: 'geo.flood', labelKey: 'tools.geoFlood', icon: 'flood', group: 'tools.geo', tab: 'geo', row: 'primary' },
  { id: 'geoReport', actionId: 'geo.report', labelKey: 'tools.geoReport', icon: 'snapshot', group: 'tools.geo', tab: 'geo', row: 'primary' },
  { id: 'geoPushCalc', actionId: 'geo.pushCalc', labelKey: 'tools.geoPushCalc', icon: 'text', text: 'Calc', group: 'tools.geo', tab: 'geo', row: 'primary' },
  { id: 'geoApplyAi', actionId: 'geo.applyAi', labelKey: 'tools.geoApplyAi', icon: 'ai', group: 'tools.geo', tab: 'geo', row: 'primary' },
  { id: 'geoApplyBoq', actionId: 'geo.applyBoq', labelKey: 'tools.geoApplyBoq', icon: 'boq', group: 'tools.geo', tab: 'geo', row: 'primary' },

  // ── REAL ESTATE tab ──
  { id: 'reOpen', actionId: 're.open', labelKey: 'tools.reOpen', icon: 'feasibility', group: 'tools.realestate', tab: 'realestate', row: 'primary' },
  { id: 'reFeasibility', actionId: 're.feasibility', labelKey: 'tools.reFeasibility', icon: 'feasibility', group: 'tools.realestate', tab: 'realestate', row: 'primary' },
  { id: 'reValuation', actionId: 're.valuation', labelKey: 'tools.reValuation', icon: 'budget', group: 'tools.realestate', tab: 'realestate', row: 'primary' },
  { id: 'reLandUse', actionId: 're.landUse', labelKey: 'tools.reLandUse', icon: 'geo', group: 'tools.realestate', tab: 'realestate', row: 'primary' },
  { id: 'reMortgage', actionId: 're.mortgage', labelKey: 'tools.reMortgage', icon: 'text', text: 'Mtge', group: 'tools.realestate', tab: 'realestate', row: 'primary' },

  // ── WASH tab ──
  { id: 'washOpen', actionId: 'wash.open', labelKey: 'tools.washOpen', icon: 'water', group: 'tools.wash', tab: 'wash', row: 'primary' },
  { id: 'washDemand', actionId: 'wash.demand', labelKey: 'tools.washDemand', icon: 'water', group: 'tools.wash', tab: 'wash', row: 'primary' },
  { id: 'washBorehole', actionId: 'wash.borehole', labelKey: 'tools.washBorehole', icon: 'text', text: 'Bh', group: 'tools.wash', tab: 'wash', row: 'primary' },
  { id: 'washSewerage', actionId: 'wash.sewerage', labelKey: 'tools.washSewerage', icon: 'text', text: 'Swg', group: 'tools.wash', tab: 'wash', row: 'primary' },

  // ── ENERGY tab ──
  { id: 'energyOpen', actionId: 'energy.open', labelKey: 'tools.energyOpen', icon: 'solar', group: 'tools.energy', tab: 'energy', row: 'primary' },
  { id: 'energySolar', actionId: 'energy.solar', labelKey: 'tools.energySolar', icon: 'solar', group: 'tools.energy', tab: 'energy', row: 'primary' },
  { id: 'energyBattery', actionId: 'energy.battery', labelKey: 'tools.energyBattery', icon: 'text', text: 'Bat', group: 'tools.energy', tab: 'energy', row: 'primary' },

  // ── STRUCTURE tab ──
  { id: 'seismicRun', actionId: 'seismic.run', labelKey: 'tools.seismicRun', icon: 'seismic', group: 'tools.structure', tab: 'structure', row: 'primary' },
  { id: 'optStructural', actionId: 'optimizer.structural', labelKey: 'tools.optStructural', icon: 'text', text: 'Opt', group: 'tools.structure', tab: 'structure', row: 'primary' },
  { id: 'optSolar', actionId: 'optimizer.solar', labelKey: 'tools.optSolar', icon: 'solar', group: 'tools.structure', tab: 'structure', row: 'primary' },
  { id: 'calcBeam', actionId: 'calc.beam', labelKey: 'tools.calcBeam', icon: 'text', text: 'Bm', group: 'tools.structure', tab: 'structure', row: 'primary' },
  { id: 'calcSlab', actionId: 'calc.slab', labelKey: 'tools.calcSlab', icon: 'text', text: 'Sl', group: 'tools.structure', tab: 'structure', row: 'primary' },
  { id: 'calcColumn', actionId: 'calc.column', labelKey: 'tools.calcColumn', icon: 'column', group: 'tools.structure', tab: 'structure', row: 'primary' },
  { id: 'calcFoundation', actionId: 'calc.foundation', labelKey: 'tools.calcFoundation', icon: 'text', text: 'Fd', group: 'tools.structure', tab: 'structure', row: 'primary' },

  // ── BIM tab ──
  { id: 'sketchBoq',    actionId: 'sketch.boq',       labelKey: 'tools.sketchBoq',    icon: 'text', text: '📐→💰', group: 'tools.bim', tab: 'bim', row: 'primary' },
  { id: 'sketchToIfc',  actionId: 'draw.exportIfc',   labelKey: 'tools.sketchToIfc',  icon: 'text', text: '→IFC', group: 'tools.bim', tab: 'bim', row: 'primary' },
  { id: 'bimBoq', actionId: 'bim.boq', labelKey: 'tools.bimBoq', icon: 'boq', group: 'tools.bim', tab: 'bim', row: 'primary' },
  { id: 'bimBoqImport', actionId: 'bim.boqImport', labelKey: 'tools.bimBoqImport', icon: 'text', text: 'Imp', group: 'tools.bim', tab: 'bim', row: 'primary' },
  { id: 'bimBoqExport', actionId: 'bim.boqExport', labelKey: 'tools.bimBoqExport', icon: 'text', text: 'Xls', group: 'tools.bim', tab: 'bim', row: 'primary' },
  { id: 'bimSchedule', actionId: 'bim.schedule', labelKey: 'tools.bimSchedule', icon: 'schedule', group: 'tools.bim', tab: 'bim', row: 'primary' },
  { id: 'bimSchedulePlay', actionId: 'bim.schedulePlay', labelKey: 'tools.bimSchedulePlay', icon: 'text', text: '▶', group: 'tools.bim', tab: 'bim', row: 'primary' },
  { id: 'bimSchedulePause', actionId: 'bim.schedulePause', labelKey: 'tools.bimSchedulePause', icon: 'text', text: '⏸', group: 'tools.bim', tab: 'bim', row: 'primary' },
  { id: 'bimTimeline', actionId: 'bim.scheduleToggle', labelKey: 'tools.bimTimeline', icon: 'text', text: '4D', group: 'tools.bim', tab: 'bim', row: 'primary', activeWhen: 'timeline' },
  { id: 'bimAi', actionId: 'bim.ai', labelKey: 'tools.bimAi', icon: 'ai', group: 'tools.bim', tab: 'bim', row: 'primary' },
  { id: 'bimAiPush', actionId: 'bim.aiPush', labelKey: 'tools.bimAiPush', icon: 'text', text: 'Push', group: 'tools.bim', tab: 'bim', row: 'primary' },
  { id: 'bimCarbon', actionId: 'bim.carbon', labelKey: 'tools.bimCarbon', icon: 'carbon', group: 'tools.bim', tab: 'bim', row: 'primary' },
  { id: 'bimQuantities', actionId: 'bim.quantities', labelKey: 'tools.bimQuantities', icon: 'text', text: 'Qty', group: 'tools.bim', tab: 'bim', row: 'primary' },

  // ── MODIFIER row (all tabs) ──
  { id: 'undo', actionId: 'mod.undo', labelKey: 'tools.undo', icon: 'undo', shortcut: 'Ctrl+Z', group: 'tools.modifiers', tab: 'model', row: 'modifier' },
  { id: 'redo', actionId: 'mod.redo', labelKey: 'tools.redo', icon: 'redo', shortcut: 'Ctrl+Y', group: 'tools.modifiers', tab: 'model', row: 'modifier' },
  { id: 'modSnap', actionId: 'display.snap', labelKey: 'tools.snap', icon: 'snap', shortcut: 'S', group: 'tools.modifiers', tab: 'model', row: 'modifier', activeWhen: 'snap' },
  { id: 'modGrid', actionId: 'display.grid', labelKey: 'tools.grid', icon: 'grid', group: 'tools.modifiers', tab: 'model', row: 'modifier', activeWhen: 'grid' },
  { id: 'modOrthoLock', actionId: 'mod.orthoLock', labelKey: 'tools.orthoLock', icon: 'text', text: '⊥', group: 'tools.modifiers', tab: 'draw', row: 'modifier', activeWhen: 'orthoLock' },

  ...EXTENDED_TOOLS,
  ...CAD_TOOLS,
];

export function toolsForTab(tab: RibbonTab, row: 'primary' | 'modifier'): ToolDef[] {
  if (row === 'modifier') {
    return TOOL_REGISTRY.filter((t) => t.row === 'modifier' && (t.tab === tab || t.tab === 'model'));
  }
  return TOOL_REGISTRY.filter((t) => t.tab === tab && t.row === 'primary');
}

export function groupedTools(tools: ToolDef[]): { group: string; tools: ToolDef[] }[] {
  const map = new Map<string, ToolDef[]>();
  for (const t of tools) {
    const list = map.get(t.group) ?? [];
    list.push(t);
    map.set(t.group, list);
  }
  return [...map.entries()].map(([group, items]) => ({ group, tools: items }));
}
