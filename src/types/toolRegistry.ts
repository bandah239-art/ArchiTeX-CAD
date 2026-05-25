import type { RibbonTab } from './tools';

export type ToolIconKey =
  | 'select'
  | 'boxSelect'
  | 'orbit'
  | 'pan'
  | 'zoom'
  | 'walk'
  | 'perspective'
  | 'plan'
  | 'ortho'
  | 'fit'
  | 'reset'
  | 'explode'
  | 'xray'
  | 'showAll'
  | 'grid'
  | 'snap'
  | 'measure'
  | 'angle'
  | 'section'
  | 'snapshot'
  | 'line'
  | 'wall'
  | 'slab'
  | 'column'
  | 'pipe'
  | 'polygon'
  | 'undo'
  | 'redo'
  | 'geo'
  | 'flood'
  | 'budget'
  | 'feasibility'
  | 'water'
  | 'solar'
  | 'seismic'
  | 'boq'
  | 'schedule'
  | 'ai'
  | 'carbon'
  | 'text';

export interface ToolDef {
  id: string;
  actionId: string;
  labelKey: string;
  icon: ToolIconKey;
  text?: string;
  shortcut?: string;
  group: string;
  tab: RibbonTab;
  row: 'primary' | 'modifier';
  activeWhen?: string;
  requiresModel?: boolean;
  requiresTwoSelection?: boolean;
}
