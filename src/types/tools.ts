export type NavTool = 'select' | 'orbit' | 'pan' | 'zoom' | 'walk' | 'box-select' | 'annotate';

export type MeasureTool = 'distance' | 'angle' | 'area' | 'volume';

export type DrawTool =
  | 'line'
  | 'polyline'
  | 'wall'
  | 'slab'
  | 'column'
  | 'rectangle'
  | 'polygon'
  | 'pipe'
  | 'site-boundary'
  | 'move'
  | 'rotate'
  | 'extrude';

export type OrthoView = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

export type SectionAxis = 'x' | 'y' | 'z';

export type ActiveTool = NavTool | MeasureTool | DrawTool | null;

export type RibbonTab =
  | 'model'
  | 'draw'
  | 'geo'
  | 'realestate'
  | 'wash'
  | 'energy'
  | 'structure'
  | 'bim'
  | 'annotate'
  | 'roads'
  | 'gov'
  | 'field'
  | 'emerging';

export interface ToolGroup {
  id: string;
  labelKey: string;
}

export interface DrawModifiers {
  wallHeight: number;
  wallThickness: number;
  slabThickness: number;
  columnSize: number;
  pipeDiameter: number;
  extrudeHeight: number;
  orthoLock: boolean;
  gridSnap: number;
}

export const DEFAULT_DRAW_MODIFIERS: DrawModifiers = {
  wallHeight: 3,
  wallThickness: 0.2,
  slabThickness: 0.15,
  columnSize: 0.4,
  pipeDiameter: 0.15,
  extrudeHeight: 3,
  orthoLock: false,
  gridSnap: 0.5,
};
