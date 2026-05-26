import { useToolbarStore } from '../components/BIMViewer/toolRegistry';
import { useDrawStore } from '../store/drawStore';
import { useUndoStore } from '../store/undoStore';
import { useViewerStore } from '../store/viewerStore';
import { usePlatformToolsStore } from '../store/platformToolsStore';
import { useCadSessionStore } from '../store/cadSessionStore';
import { useSketchBlockStore } from '../store/sketchBlockStore';
import { useSketchConstraintStore } from '../store/sketchConstraintStore';
import { entityIdFromExpressId } from './ifcMeshXeokit';
import { revolveProfileToColumn } from './sketchCadOps';
import type { DrawTool } from '../types/tools';
import type { CadCommand } from '../store/cadSessionStore';
import { occAPI } from './occAPI';
import { useFeatureTreeStore } from '../store/featureTreeStore';
import type { GeometricEntity } from '../cad/constraints/ConstraintTypes';

export function getGeometricEntities(elements?: any[]): GeometricEntity[] {
  const drawElements = elements || useDrawStore.getState().elements;
  return drawElements.map(el => {
    const type = el.kind === 'circle' ? 'circle' : el.kind === 'arc' ? 'arc' : el.kind === 'point' ? 'point' : 'line';
    let params: number[] = [];
    if (el.kind === 'circle' && el.points.length >= 2) {
      const r = Math.hypot(el.points[1].x - el.points[0].x, el.points[1].z - el.points[0].z);
      params = [el.points[0].x, el.points[0].z, r];
    } else if (el.kind === 'arc' && el.points.length >= 3) {
      const r = Math.hypot(el.points[1].x - el.points[0].x, el.points[1].z - el.points[0].z);
      const a1 = Math.atan2(el.points[1].z - el.points[0].z, el.points[1].x - el.points[0].x);
      const a2 = Math.atan2(el.points[2].z - el.points[0].z, el.points[2].x - el.points[0].x);
      params = [el.points[0].x, el.points[0].z, r, a1, a2];
    } else if (el.kind === 'point' && el.points.length >= 1) {
      params = [el.points[0].x, el.points[0].z];
    } else {
      const p1 = el.points[0];
      const p2 = el.points[el.points.length - 1];
      params = [p1.x, p1.z, p2.x, p2.z];
    }
    return {
      id: el.id,
      type,
      params,
      dof: type === 'point' ? 2 : type === 'line' ? 4 : type === 'circle' ? 3 : 5,
      fixed: false,
      name: el.label || el.id
    };
  });
}

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
    case 'cad.util.properties': {
      const entities = getGeometricEntities();
      if (entities.length === 0) {
        finish('Properties', 'Select or draw a sketch profile first.');
        return true;
      }
      occAPI.getProperties(entities)
        .then(res => {
          finish('Properties', `Area: ${res.area.toLocaleString()} mm², Centroid: (${res.centroid.x.toFixed(1)}, ${res.centroid.y.toFixed(1)}), Perimeter: ${res.perimeter.toFixed(1)} mm`);
        })
        .catch(err => {
          finish('Properties', `Failed: ${err.message}`);
        });
      return true;
    }
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
    case 'cad.modify.offset': {
      const entities = getGeometricEntities();
      if (entities.length === 0) {
        finish('Offset', 'Select or draw a sketch profile first.');
        return true;
      }
      const distStr = prompt("Enter offset distance (mm):", "200");
      if (distStr) {
        const distance = parseFloat(distStr);
        if (!isNaN(distance)) {
          occAPI.offsetProfile(entities, distance)
            .then(res => {
              if (res.status === 'ok') {
                const id = `offset_${Date.now()}`;
                useFeatureTreeStore.getState().addFeature({
                  id,
                  type: 'sketch',
                  name: `Offset_${distance}mm`,
                  inputs: { entities, height: 0 },
                  dependencies: [],
                  output: res.shape,
                  status: 'built',
                  error: null
                });
                finish('Offset', `Offset ${distance}mm applied.`);
              }
            })
            .catch(err => {
              finish('Offset', `Offset failed: ${err.message}`);
            });
        }
      }
      return true;
    }
    case 'cad.modify.fillet': {
      const entities = getGeometricEntities();
      if (entities.length === 0) {
        finish('Fillet', 'Select or draw a sketch profile first.');
        return true;
      }
      const radStr = prompt("Enter fillet radius (mm):", "50");
      if (radStr) {
        const radius = parseFloat(radStr);
        if (!isNaN(radius)) {
          occAPI.addFillet(entities, radius)
            .then(res => {
              if (res.status === 'ok') {
                const id = `fillet_${Date.now()}`;
                useFeatureTreeStore.getState().addFeature({
                  id,
                  type: 'fillet',
                  name: `Fillet_${radius}mm`,
                  inputs: { entities, radius },
                  dependencies: [],
                  output: res.shape,
                  status: 'built',
                  error: null
                });
                finish('Fillet', `Fillet R${radius}mm applied.`);
              }
            })
            .catch(err => {
              finish('Fillet', `Fillet failed: ${err.message}`);
            });
        }
      }
      return true;
    }
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
      const entities = getGeometricEntities();
      if (entities.length === 0) {
        finish('Extrude', 'Select or draw a sketch profile first.');
        return true;
      }
      const hStr = prompt("Enter extrusion height (mm):", "3000");
      if (hStr) {
        const height = parseFloat(hStr);
        if (!isNaN(height)) {
          occAPI.extrude(entities, height)
            .then(res => {
              if (res.status === 'ok') {
                const sketchId = `sketch_${Date.now()}`;
                useFeatureTreeStore.getState().addFeature({
                  id: sketchId,
                  type: 'sketch',
                  name: 'Sketch_Base',
                  inputs: { entities },
                  dependencies: [],
                  output: null,
                  status: 'built',
                  error: null
                });
                
                const id = `extrude_${Date.now()}`;
                useFeatureTreeStore.getState().addFeature({
                  id,
                  type: 'extrude',
                  name: `Extrude_${height}mm`,
                  inputs: { sketch_id: sketchId, height },
                  dependencies: [sketchId],
                  output: res.shape,
                  status: 'built',
                  error: null
                });
                finish('Extrude', `Extruded to ${height}mm.`);
              }
            })
            .catch(err => {
              finish('Extrude', `Extrusion failed: ${err.message}`);
            });
        }
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
    case 'cad.solid.subtract':
    case 'cad.solid.intersect': {
      const entities = getGeometricEntities();
      if (entities.length < 2) {
        finish('Boolean', 'Requires at least two sketch elements.');
        return true;
      }
      const op = actionId === 'cad.solid.union' ? 'union' : actionId === 'cad.solid.subtract' ? 'subtract' : 'intersect';
      const entA = [entities[0]];
      const entB = [entities[1]];
      
      occAPI.boolean(entA, entB, op)
        .then(res => {
          if (res.status === 'ok') {
            const id = `boolean_${Date.now()}`;
            useFeatureTreeStore.getState().addFeature({
              id,
              type: op === 'union' ? 'boolean_union' : 'boolean_subtract',
              name: `${op.toUpperCase()}_1`,
              inputs: { entities, operation: op },
              dependencies: [],
              output: res.shape,
              status: 'built',
              error: null
            });
            finish(op.toUpperCase(), `Boolean ${op} completed successfully.`);
          }
        })
        .catch(err => {
          finish(op.toUpperCase(), `Boolean failed: ${err.message}`);
        });
      return true;
    }
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
