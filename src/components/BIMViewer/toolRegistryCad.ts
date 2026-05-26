import type { ToolDef } from '../../types/toolRegistry';

/** AutoCAD-style tools — merged into TOOL_REGISTRY; skips items already in base registry. */
export const CAD_TOOLS: ToolDef[] = [
  // ── 2D DRAFTING (draw tab) — line, polyline, rectangle, polygon exist in base registry ──
  { id: 'cadCircle', actionId: 'cad.draw.circle', labelKey: 'tools.cad.circle', icon: 'text', text: 'C', shortcut: 'C', group: 'tools.cadDraw', tab: 'draw', row: 'primary', activeWhen: 'circle' },
  { id: 'cadArc', actionId: 'cad.draw.arc', labelKey: 'tools.cad.arc', icon: 'text', text: 'A', group: 'tools.cadDraw', tab: 'draw', row: 'primary', activeWhen: 'arc' },
  { id: 'cadEllipse', actionId: 'cad.draw.ellipse', labelKey: 'tools.cad.ellipse', icon: 'text', text: 'EL', group: 'tools.cadDraw', tab: 'draw', row: 'primary', activeWhen: 'ellipse' },
  { id: 'cadHatch', actionId: 'cad.draw.hatch', labelKey: 'tools.cad.hatch', icon: 'text', text: 'H', group: 'tools.cadDraw', tab: 'draw', row: 'primary', activeWhen: 'hatch' },
  { id: 'cadBoundary', actionId: 'cad.draw.boundary', labelKey: 'tools.cad.boundary', icon: 'text', text: 'BO', group: 'tools.cadDraw', tab: 'draw', row: 'primary', activeWhen: 'boundary' },
  { id: 'cadXline', actionId: 'cad.draw.xline', labelKey: 'tools.cad.xline', icon: 'text', text: 'XL', group: 'tools.cadDraw', tab: 'draw', row: 'primary', activeWhen: 'xline' },
  { id: 'cadSpline', actionId: 'cad.draw.spline', labelKey: 'tools.cad.spline', icon: 'text', text: 'SPL', group: 'tools.cadDraw', tab: 'draw', row: 'primary', activeWhen: 'spline' },
  { id: 'cadPoint', actionId: 'cad.draw.point', labelKey: 'tools.cad.point', icon: 'text', text: 'PO', group: 'tools.cadDraw', tab: 'draw', row: 'primary', activeWhen: 'point' },
  { id: 'cadRegion', actionId: 'cad.draw.region', labelKey: 'tools.cad.region', icon: 'text', text: 'REG', group: 'tools.cadDraw', tab: 'draw', row: 'primary', activeWhen: 'region' },
  { id: 'cadDonut', actionId: 'cad.draw.donut', labelKey: 'tools.cad.donut', icon: 'text', text: 'DO', group: 'tools.cadDraw', tab: 'draw', row: 'primary', activeWhen: 'donut' },
  { id: 'cadRevcloud', actionId: 'cad.draw.revcloud', labelKey: 'tools.cad.revcloud', icon: 'text', text: 'RC', group: 'tools.cadDraw', tab: 'draw', row: 'primary', activeWhen: 'revcloud' },

  // ── MODIFY — move, copy, rotate, mirror, array, extrude exist in drawAdv ──
  { id: 'cadScale', actionId: 'cad.modify.scale', labelKey: 'tools.cad.scale', icon: 'text', text: 'SC', group: 'tools.cadModify', tab: 'draw', row: 'primary' },
  { id: 'cadStretch', actionId: 'cad.modify.stretch', labelKey: 'tools.cad.stretch', icon: 'text', text: 'S', group: 'tools.cadModify', tab: 'draw', row: 'primary' },
  { id: 'cadTrim', actionId: 'cad.modify.trim', labelKey: 'tools.cad.trim', icon: 'text', text: 'TR', group: 'tools.cadModify', tab: 'draw', row: 'primary' },
  { id: 'cadExtend', actionId: 'cad.modify.extend', labelKey: 'tools.cad.extend', icon: 'text', text: 'EX', group: 'tools.cadModify', tab: 'draw', row: 'primary' },
  { id: 'cadOffset', actionId: 'cad.modify.offset', labelKey: 'tools.cad.offset', icon: 'text', text: 'O', group: 'tools.cadModify', tab: 'draw', row: 'primary' },
  { id: 'cadFillet', actionId: 'cad.modify.fillet', labelKey: 'tools.cad.fillet', icon: 'text', text: 'F', group: 'tools.cadModify', tab: 'draw', row: 'primary' },
  { id: 'cadChamfer', actionId: 'cad.modify.chamfer', labelKey: 'tools.cad.chamfer', icon: 'text', text: 'CHA', group: 'tools.cadModify', tab: 'draw', row: 'primary' },
  { id: 'cadJoin', actionId: 'cad.modify.join', labelKey: 'tools.cad.join', icon: 'text', text: 'J', group: 'tools.cadModify', tab: 'draw', row: 'primary' },
  { id: 'cadBreak', actionId: 'cad.modify.break', labelKey: 'tools.cad.break', icon: 'text', text: 'BR', group: 'tools.cadModify', tab: 'draw', row: 'primary' },
  { id: 'cadExplodeSketch', actionId: 'cad.modify.explode', labelKey: 'tools.cad.explodeSketch', icon: 'text', text: 'X', group: 'tools.cadModify', tab: 'draw', row: 'primary' },
  { id: 'cadAlign', actionId: 'cad.modify.align', labelKey: 'tools.cad.align', icon: 'text', text: 'AL', group: 'tools.cadModify', tab: 'draw', row: 'primary' },
  { id: 'cadErase', actionId: 'cad.modify.erase', labelKey: 'tools.cad.erase', icon: 'text', text: 'E', shortcut: 'Del', group: 'tools.cadModify', tab: 'draw', row: 'primary' },

  // ── LAYERS (draw tab) ──
  { id: 'cadLayerProps', actionId: 'cad.layer.properties', labelKey: 'tools.cad.layerProps', icon: 'text', text: 'LA', group: 'tools.cadLayers', tab: 'draw', row: 'modifier' },
  { id: 'cadLayerMatch', actionId: 'cad.layer.match', labelKey: 'tools.cad.layerMatch', icon: 'text', text: 'Mch', group: 'tools.cadLayers', tab: 'draw', row: 'modifier' },
  { id: 'cadLayerIso', actionId: 'cad.layer.isolate', labelKey: 'tools.cad.layerIsolate', icon: 'text', text: 'Iso', group: 'tools.cadLayers', tab: 'draw', row: 'modifier', requiresModel: true },
  { id: 'cadLayerFreeze', actionId: 'cad.layer.freeze', labelKey: 'tools.cad.layerFreeze', icon: 'text', text: 'Frz', group: 'tools.cadLayers', tab: 'draw', row: 'modifier', requiresModel: true },
  { id: 'cadLayerOff', actionId: 'cad.layer.off', labelKey: 'tools.cad.layerOff', icon: 'text', text: 'Off', group: 'tools.cadLayers', tab: 'draw', row: 'modifier', requiresModel: true },
  { id: 'cadLayerLock', actionId: 'cad.layer.lock', labelKey: 'tools.cad.layerLock', icon: 'text', text: 'Lck', group: 'tools.cadLayers', tab: 'draw', row: 'modifier' },

  // ── ANNOTATE (annotate tab) — distance/angle/area on model tab ──
  { id: 'cadMtext', actionId: 'cad.annotate.mtext', labelKey: 'tools.cad.mtext', icon: 'text', text: 'MT', group: 'tools.cadAnnotate', tab: 'annotate', row: 'primary' },
  { id: 'cadText', actionId: 'cad.annotate.text', labelKey: 'tools.cad.text', icon: 'text', text: 'T', group: 'tools.cadAnnotate', tab: 'annotate', row: 'primary' },
  { id: 'cadDim', actionId: 'cad.annotate.dim', labelKey: 'tools.cad.dim', icon: 'measure', group: 'tools.cadAnnotate', tab: 'annotate', row: 'primary' },
  { id: 'cadDimLin', actionId: 'cad.annotate.dimLinear', labelKey: 'tools.cad.dimLinear', icon: 'measure', shortcut: 'D', group: 'tools.cadAnnotate', tab: 'annotate', row: 'primary', activeWhen: 'distance' },
  { id: 'cadDimAlign', actionId: 'cad.annotate.dimAligned', labelKey: 'tools.cad.dimAligned', icon: 'measure', group: 'tools.cadAnnotate', tab: 'annotate', row: 'primary' },
  { id: 'cadDimAng', actionId: 'cad.annotate.dimAngular', labelKey: 'tools.cad.dimAngular', icon: 'angle', group: 'tools.cadAnnotate', tab: 'annotate', row: 'primary', activeWhen: 'angle' },
  { id: 'cadDimRad', actionId: 'cad.annotate.dimRadius', labelKey: 'tools.cad.dimRadius', icon: 'text', text: 'R', group: 'tools.cadAnnotate', tab: 'annotate', row: 'primary' },
  { id: 'cadDimDia', actionId: 'cad.annotate.dimDiameter', labelKey: 'tools.cad.dimDiameter', icon: 'text', text: 'Ø', group: 'tools.cadAnnotate', tab: 'annotate', row: 'primary' },
  { id: 'cadLeader', actionId: 'cad.annotate.leader', labelKey: 'tools.cad.leader', icon: 'text', text: 'LD', group: 'tools.cadAnnotate', tab: 'annotate', row: 'primary', activeWhen: 'annotate' },
  { id: 'cadDimStyle', actionId: 'cad.annotate.dimStyle', labelKey: 'tools.cad.dimStyle', icon: 'text', text: 'DST', group: 'tools.cadAnnotate', tab: 'annotate', row: 'primary' },
  { id: 'cadTable', actionId: 'cad.annotate.table', labelKey: 'tools.cad.table', icon: 'text', text: 'TB', group: 'tools.cadAnnotate', tab: 'annotate', row: 'primary' },

  // ── BLOCKS (bim tab) ──
  { id: 'cadBlock', actionId: 'cad.block.create', labelKey: 'tools.cad.blockCreate', icon: 'text', text: 'B', group: 'tools.cadBlocks', tab: 'bim', row: 'primary' },
  { id: 'cadWblock', actionId: 'cad.block.wblock', labelKey: 'tools.cad.wblock', icon: 'text', text: 'W', group: 'tools.cadBlocks', tab: 'bim', row: 'primary' },
  { id: 'cadInsert', actionId: 'cad.block.insert', labelKey: 'tools.cad.insert', icon: 'text', text: 'I', group: 'tools.cadBlocks', tab: 'bim', row: 'primary' },
  { id: 'cadBlockEdit', actionId: 'cad.block.edit', labelKey: 'tools.cad.blockEdit', icon: 'text', text: 'BE', group: 'tools.cadBlocks', tab: 'bim', row: 'primary' },
  { id: 'cadXref', actionId: 'cad.block.xref', labelKey: 'tools.cad.xref', icon: 'text', text: 'XR', group: 'tools.cadBlocks', tab: 'bim', row: 'primary' },

  // ── PARAMETRIC (draw modifier) ──
  { id: 'cadGeomConstraint', actionId: 'cad.param.geometric', labelKey: 'tools.cad.geomConstraint', icon: 'text', text: 'GC', group: 'tools.cadParametric', tab: 'draw', row: 'modifier' },
  { id: 'cadDimConstraint', actionId: 'cad.param.dimensional', labelKey: 'tools.cad.dimConstraint', icon: 'text', text: 'DC', group: 'tools.cadParametric', tab: 'draw', row: 'modifier' },
  { id: 'cadConstraintBar', actionId: 'cad.param.bar', labelKey: 'tools.cad.constraintBar', icon: 'text', text: 'CB', group: 'tools.cadParametric', tab: 'draw', row: 'modifier' },

  // ── 3D SOLIDS (draw tab — extrude exists as drawExtrude) ──
  { id: 'cadPresspull', actionId: 'cad.solid.presspull', labelKey: 'tools.cad.presspull', icon: 'text', text: 'PP', group: 'tools.cadSolid3d', tab: 'draw', row: 'primary' },
  { id: 'cadRevolve', actionId: 'cad.solid.revolve', labelKey: 'tools.cad.revolve', icon: 'text', text: 'REV', group: 'tools.cadSolid3d', tab: 'draw', row: 'primary' },
  { id: 'cadSweep', actionId: 'cad.solid.sweep', labelKey: 'tools.cad.sweep', icon: 'text', text: 'SW', group: 'tools.cadSolid3d', tab: 'draw', row: 'primary' },
  { id: 'cadLoft', actionId: 'cad.solid.loft', labelKey: 'tools.cad.loft', icon: 'text', text: 'LF', group: 'tools.cadSolid3d', tab: 'draw', row: 'primary' },
  { id: 'cadUnion', actionId: 'cad.solid.union', labelKey: 'tools.cad.union', icon: 'text', text: 'UNI', group: 'tools.cadSolid3d', tab: 'draw', row: 'primary', requiresModel: true },
  { id: 'cadSubtract', actionId: 'cad.solid.subtract', labelKey: 'tools.cad.subtract', icon: 'text', text: 'SU', group: 'tools.cadSolid3d', tab: 'draw', row: 'primary', requiresModel: true, requiresTwoSelection: true },
  { id: 'cadIntersect', actionId: 'cad.solid.intersect', labelKey: 'tools.cad.intersect', icon: 'text', text: 'IN', group: 'tools.cadSolid3d', tab: 'draw', row: 'primary', requiresModel: true, requiresTwoSelection: true },
  { id: 'cadSlice', actionId: 'cad.solid.slice', labelKey: 'tools.cad.slice', icon: 'section', group: 'tools.cadSolid3d', tab: 'draw', row: 'primary', requiresModel: true },
  { id: 'cadOrbit3d', actionId: 'tool.orbit', labelKey: 'tools.orbit', icon: 'orbit', group: 'tools.cadSolid3d', tab: 'draw', row: 'primary' },
  { id: 'cadRender', actionId: 'cad.solid.render', labelKey: 'tools.cad.render', icon: 'snapshot', group: 'tools.cadSolid3d', tab: 'draw', row: 'primary', requiresModel: true },

  // ── UTILITY (model tab) — distance & area exist ──
  { id: 'cadPurge', actionId: 'cad.util.purge', labelKey: 'tools.cad.purge', icon: 'text', text: 'PU', group: 'tools.cadUtility', tab: 'model', row: 'modifier' },
  { id: 'cadProperties', actionId: 'cad.util.properties', labelKey: 'tools.cad.properties', icon: 'text', text: 'Pr', group: 'tools.cadUtility', tab: 'model', row: 'modifier' },
  { id: 'cadDesignCenter', actionId: 'cad.util.designCenter', labelKey: 'tools.cad.designCenter', icon: 'text', text: 'DC', group: 'tools.cadUtility', tab: 'model', row: 'modifier' },
  { id: 'cadToolPalettes', actionId: 'cad.util.toolPalettes', labelKey: 'tools.cad.toolPalettes', icon: 'text', text: 'TP', group: 'tools.cadUtility', tab: 'model', row: 'modifier' },
  { id: 'cadQuickCalc', actionId: 'cad.util.calc', labelKey: 'tools.cad.quickCalc', icon: 'text', text: 'QC', group: 'tools.cadUtility', tab: 'model', row: 'modifier' },
  { id: 'cadCleanScreen', actionId: 'cad.util.cleanScreen', labelKey: 'tools.cad.cleanScreen', icon: 'text', text: 'CS', group: 'tools.cadUtility', tab: 'model', row: 'modifier' },
];
