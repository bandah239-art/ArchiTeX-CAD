import { useToolbarStore } from '../components/BIMViewer/toolRegistry';
import { useDrawStore } from '../store/drawStore';
import { useUndoStore } from '../store/undoStore';
import { useViewerStore } from '../store/viewerStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { usePlatformToolsStore } from '../store/platformToolsStore';
import { useCadSessionStore } from '../store/cadSessionStore';
import { useSketchBlockStore } from '../store/sketchBlockStore';
import { useSketchConstraintStore } from '../store/sketchConstraintStore';
import { entityIdFromExpressId } from './ifcMeshXeokit';
import { revolveProfileToColumn } from './sketchCadOps';
import type { DrawTool } from '../types/tools';
import type { CadCommand } from '../store/cadSessionStore';

const CAD_DRAW_MAP: Record<string, DrawTool> = {
  'cad.draw.circle': 'circle',
  'cad.draw.arc': 'arc',
  'cad.draw.ellipse': 'ellipse',
  'cad.draw.hatch': 'hatch',
  'cad.draw.boundary': 'boundary',
  'cad.draw.xline': 'xline',
  'cad.draw.spline': 'spline',
  'cad.draw.point': 'point',
  'cad.draw.region': 'region',
  'cad.draw.donut': 'donut',
  'cad.draw.revcloud': 'revcloud',
};

function startCadSession(cmd: CadCommand) {
  useCadSessionStore.getState().startCommand(cmd);
  useToolbarStore.getState().setActiveTab('draw');
  const vc = useViewerStore.getState().viewerControls;
  vc?.prepareDrawSession?.();
}

/** @returns true if handled (caller should not fall through to platform store). */
export function runCadToolAction(actionId: string): boolean {
  const viewer = useViewerStore.getState();
  const vc = viewer.viewerControls;
  const draw = useDrawStore.getState();
  const undo = useUndoStore.getState();
  const workspace = useWorkspaceStore.getState();
  const finish = (label: string, summary: string) => {
    usePlatformToolsStore.setState({
      lastResult: {
        actionId,
        label,
        summary,
        timestamp: Date.now(),
      },
      lastError: null,
    });
  };

  const drawTool = CAD_DRAW_MAP[actionId];
  if (drawTool) {
    useToolbarStore.getState().setActiveTab('draw');
    viewer.setActiveTool(drawTool);
    if (!useDrawStore.getState().activePoints.length) {
      useDrawStore.getState().beginStroke();
    }
    vc?.prepareDrawSession?.();
    return true;
  }

  switch (actionId) {
    case 'cad.modify.scale': {
      const id = draw.selectedId;
      if (!id) {
        finish('Scale', 'Select a sketch element first.');
        return true;
      }
      const before = draw.getSnapshot();
      const ok = useDrawStore.getState().scaleElement(id, 1.25);
      if (ok) {
        undo.pushDrawAction('Scale sketch', before, useDrawStore.getState().getSnapshot());
        const s = useDrawStore.getState();
        vc?.syncSketches(s.elements, s.activePoints, s.floorElevation);
        finish('Scale', 'Scaled selection by 125%.');
      }
      return true;
    }
    case 'cad.modify.erase': {
      const id = draw.selectedId;
      if (!id) {
        finish('Erase', 'Select a sketch to erase.');
        return true;
      }
      const before = draw.getSnapshot();
      useDrawStore.getState().removeElement(id);
      undo.pushDrawAction('Erase sketch', before, useDrawStore.getState().getSnapshot());
      const s = useDrawStore.getState();
      vc?.syncSketches(s.elements, s.activePoints, s.floorElevation);
      finish('Erase', 'Removed selected sketch.');
      return true;
    }
    case 'cad.modify.explode': {
      const id = draw.selectedId;
      if (!id) {
        finish('Explode', 'Select a polyline or wall to explode.');
        return true;
      }
      const before = draw.getSnapshot();
      const n = useDrawStore.getState().explodeElement(id);
      if (n > 0) {
        undo.pushDrawAction('Explode sketch', before, useDrawStore.getState().getSnapshot());
        const s = useDrawStore.getState();
        vc?.syncSketches(s.elements, s.activePoints, s.floorElevation);
        finish('Explode', `Exploded into ${n} segments.`);
      } else {
        finish('Explode', 'Element cannot be exploded (needs 2+ segments).');
      }
      return true;
    }
    case 'cad.modify.join': {
      const before = draw.getSnapshot();
      const ok = useDrawStore.getState().joinOpenPolylines();
      if (ok) {
        undo.pushDrawAction('Join', before, useDrawStore.getState().getSnapshot());
        const s = useDrawStore.getState();
        vc?.syncSketches(s.elements, s.activePoints, s.floorElevation);
        finish('Join', 'Joined touching polylines.');
      } else {
        finish('Join', 'No touching polylines found to join.');
      }
      return true;
    }
    case 'cad.layer.properties':
      finish('Layer Properties', 'Use the Layers panel in the model tree (bottom left).');
      return true;
    case 'cad.layer.isolate': {
      const id = viewer.selectedElement?.id;
      if (id) vc?.isolateEntities([entityIdFromExpressId(id)]);
      return true;
    }
    case 'cad.layer.freeze':
    case 'cad.layer.off': {
      const type = viewer.selectedElement?.type;
      if (type) viewer.toggleType(type);
      return true;
    }
    case 'cad.layer.match':
    case 'cad.layer.lock':
      finish(actionId, 'Layer tool registered — full IFC layer sync coming soon.');
      return true;
    case 'cad.annotate.dimLinear':
      viewer.setActiveTool('distance');
      useToolbarStore.getState().setActiveTab('model');
      return true;
    case 'cad.annotate.dimAngular':
      viewer.setActiveTool('angle');
      useToolbarStore.getState().setActiveTab('model');
      return true;
    case 'cad.annotate.leader':
      viewer.setActiveTool('annotate');
      useToolbarStore.getState().setActiveTab('annotate');
      return true;
    case 'cad.annotate.dim':
    case 'cad.annotate.dimAligned':
    case 'cad.annotate.dimRadius':
    case 'cad.annotate.dimDiameter':
    case 'cad.annotate.mtext':
    case 'cad.annotate.text':
    case 'cad.annotate.dimStyle':
    case 'cad.annotate.table':
      finish(actionId, 'Annotation tool ready — place via canvas or inspector.');
      return true;
    case 'cad.util.properties':
      workspace.toggleInspector();
      return true;
    case 'cad.util.purge': {
      const before = draw.getSnapshot();
      const removed = useDrawStore.getState().purgeEmptySketches();
      if (removed > 0) {
        undo.pushDrawAction('Purge sketches', before, useDrawStore.getState().getSnapshot());
        const s = useDrawStore.getState();
        vc?.syncSketches(s.elements, s.activePoints, s.floorElevation);
      }
      finish('Purge', removed ? `Removed ${removed} empty sketch(es).` : 'Nothing to purge.');
      return true;
    }
    case 'cad.util.calc': {
      const w = window.open('', '_blank', 'width=320,height=400');
      if (w) {
        w.document.write('<title>Quick Calc</title><body style="font-family:sans-serif;padding:12px"><h3>Quick Calc</h3><p>Use the calculator panel for engineering formulas.</p></body>');
      }
      return true;
    }
    case 'cad.util.designCenter':
    case 'cad.util.toolPalettes':
    case 'cad.util.cleanScreen':
      finish(actionId, 'Utility registered — use workspace panels.');
      return true;
    case 'cad.modify.trim':
      startCadSession('trim');
      return true;
    case 'cad.modify.extend':
      startCadSession('extend');
      return true;
    case 'cad.modify.offset':
      startCadSession('offset');
      return true;
    case 'cad.modify.fillet':
      startCadSession('fillet');
      return true;
    case 'cad.modify.chamfer':
      startCadSession('chamfer');
      return true;
    case 'cad.modify.break':
      startCadSession('break');
      return true;
    case 'cad.modify.stretch':
      startCadSession('stretch');
      return true;
    case 'cad.modify.align':
      startCadSession('align');
      useCadSessionStore.getState().setPanelOpen(true);
      return true;
    case 'cad.block.create':
      useCadSessionStore.getState().setPanelOpen(true);
      useSketchBlockStore.getState().setActiveBlock(null);
      finish('Create Block', 'Select elements, name block in the floating panel.');
      return true;
    case 'cad.block.wblock':
      useCadSessionStore.getState().setPanelOpen(true);
      finish('WBLOCK', 'Export block JSON from the panel.');
      return true;
    case 'cad.block.insert':
      startCadSession('block-insert');
      useCadSessionStore.getState().setPanelOpen(true);
      return true;
    case 'cad.block.edit':
      useCadSessionStore.getState().setPanelOpen(true);
      finish('Block Editor', 'Edit block definition in panel; insert instances update on re-insert.');
      return true;
    case 'cad.block.xref':
      finish('XREF', 'Attach external IFC or .skblock.json via Import.');
      return true;
    case 'cad.param.geometric':
      useSketchConstraintStore.getState().setBarVisible(true);
      startCadSession('param-geom');
      useCadSessionStore.getState().setPanelOpen(true);
      return true;
    case 'cad.param.dimensional':
      useSketchConstraintStore.getState().setBarVisible(true);
      startCadSession('param-dim');
      useCadSessionStore.getState().setPanelOpen(true);
      return true;
    case 'cad.param.bar':
      useSketchConstraintStore.getState().setBarVisible(true);
      useCadSessionStore.getState().setPanelOpen(true);
      finish('Constraint bar', `${useSketchConstraintStore.getState().constraints.length} constraint(s).`);
      return true;
    case 'cad.solid.presspull': {
      const id = draw.selectedId;
      if (!id) {
        finish('Press/Pull', 'Select a closed profile, then run again.');
        return true;
      }
      const before = draw.getSnapshot();
      const el = useDrawStore.getState().extrudeElement(id, draw.modifiers.extrudeHeight);
      if (el) {
        undo.pushDrawAction('Press/Pull', before, useDrawStore.getState().getSnapshot());
        const s = useDrawStore.getState();
        vc?.syncSketches(s.elements, s.activePoints, s.floorElevation);
        finish('Press/Pull', `Extruded to ${draw.modifiers.extrudeHeight} m.`);
      } else {
        finish('Press/Pull', 'Select polygon, rectangle, or slab profile.');
      }
      return true;
    }
    case 'cad.solid.revolve': {
      const id = draw.selectedId;
      const el = id ? draw.elements.find((e) => e.id === id) : null;
      if (!el) {
        finish('Revolve', 'Select a closed profile first.');
        return true;
      }
      const before = draw.getSnapshot();
      const axisX = el.points[0]?.x ?? 0;
      const col = revolveProfileToColumn(el, axisX);
      if (col) {
        useDrawStore.setState({
          elements: draw.elements.map((e) => (e.id === id ? col : e)),
        });
        undo.pushDrawAction('Revolve', before, useDrawStore.getState().getSnapshot());
        const s = useDrawStore.getState();
        vc?.syncSketches(s.elements, s.activePoints, s.floorElevation);
        finish('Revolve', 'Profile revolved to column solid.');
      }
      return true;
    }
    case 'cad.solid.sweep':
      startCadSession('sweep');
      return true;
    case 'cad.solid.loft':
      startCadSession('loft');
      return true;
    case 'cad.solid.union':
      void usePlatformToolsStore.getState().runPlatformAction('bim.booleanUnion');
      return true;
    case 'cad.solid.subtract':
      void usePlatformToolsStore.getState().runPlatformAction('bim.booleanDiff');
      return true;
    case 'cad.solid.intersect':
      void usePlatformToolsStore.getState().runPlatformAction('bim.intersectionVolume');
      return true;
    case 'cad.solid.slice':
      void usePlatformToolsStore.getState().runPlatformAction('section.z');
      return true;
    case 'cad.solid.render':
      void usePlatformToolsStore.getState().runPlatformAction('capture.snapshot');
      return true;
    default:
      if (actionId.startsWith('cad.')) {
        finish(actionId, 'CAD tool registered — interactive mode coming soon.');
        return true;
      }
      return false;
  }
}
