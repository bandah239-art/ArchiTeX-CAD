import { useCallback } from 'react';
import { useViewerStore } from '../store/viewerStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useDrawStore } from '../store/drawStore';
import { useUndoStore } from '../store/undoStore';
import { useGeoStore } from '../store/geoStore';
import { useRealEstateStore } from '../store/realEstateStore';
import { useWashStore } from '../store/washStore';
import { useEnergyStore } from '../store/energyStore';
import { useSeismicStore } from '../store/seismicStore';
import { useCarbonStore } from '../store/carbonStore';
import { useScheduleStore } from '../store/scheduleStore';
import { useBoQStore } from '../store/boqStore';
import { useAiStore } from '../store/aiStore';
import { useCalculationStore } from '../store/calculationStore';
import { useOptimizerStore } from '../store/optimizerStore';
import { toBimPayload } from '../services/ifcBoqService';
import { useIfcModelStore } from '../store/ifcModelStore';
import { entityIdFromExpressId } from '../services/ifcMeshXeokit';
import { usePlatformToolsStore } from '../store/platformToolsStore';
import { useToolbarStore } from '../components/BIMViewer/toolRegistry';
import { runCadToolAction } from '../services/cadToolHandlers';
import type { ActiveTool, OrthoView, RibbonTab, SectionAxis } from '../types/tools';
import type { ViewMode } from '../types/ifc';
import type { WorkspacePanel } from '../types/boq';

export function useToolActions() {
  const viewer = useViewerStore();
  const workspace = useWorkspaceStore();
  const draw = useDrawStore();
  const undo = useUndoStore();
  const geo = useGeoStore();
  const re = useRealEstateStore();
  const wash = useWashStore();
  const energy = useEnergyStore();
  const seismic = useSeismicStore();
  const carbon = useCarbonStore();
  const schedule = useScheduleStore();
  const boq = useBoQStore();
  const ai = useAiStore();
  const calc = useCalculationStore();
  const optimizer = useOptimizerStore();
  const ifc = useIfcModelStore();

  const openAndRun = useCallback(
    async (panel: WorkspacePanel, fn: () => Promise<void> | void) => {
      workspace.openPanel(panel);
      await fn();
    },
    [workspace]
  );

  const run = useCallback(
    (actionId: string) => {
      const vc = viewer.viewerControls;
      switch (actionId) {
        // Navigation
        case 'tool.select':
          viewer.setActiveTool('select');
          break;
        case 'tool.boxSelect':
          viewer.setActiveTool('box-select');
          break;
        case 'tool.orbit':
          viewer.setActiveTool('orbit');
          break;
        case 'tool.pan':
          viewer.setActiveTool('pan');
          break;
        case 'tool.zoom':
          viewer.setActiveTool('zoom');
          break;
        case 'tool.walk':
          viewer.setActiveTool('walk');
          break;

        // View
        case 'view.perspective':
          viewer.setViewMode('perspective');
          break;
        case 'view.plan':
          viewer.setViewMode('plan');
          break;
        case 'view.ortho':
          viewer.setViewMode('ortho');
          break;
        case 'view.fit':
          vc?.fitToView();
          break;
        case 'view.reset':
          vc?.resetView();
          break;
        case 'view.front':
          vc?.flyToOrthoView('front');
          break;
        case 'view.back':
          vc?.flyToOrthoView('back');
          break;
        case 'view.left':
          vc?.flyToOrthoView('left');
          break;
        case 'view.right':
          vc?.flyToOrthoView('right');
          break;
        case 'view.top':
          vc?.flyToOrthoView('top');
          break;
        case 'view.bottom':
          vc?.flyToOrthoView('bottom');
          break;

        // Display
        case 'display.explode':
          viewer.setExploded(!viewer.exploded);
          break;
        case 'display.xray':
          viewer.setXRay(!viewer.xRay);
          break;
        case 'display.showAll':
          viewer.showAllLayers();
          break;
        case 'display.grid':
          viewer.setGridVisible(!viewer.gridVisible);
          break;
        case 'display.snap':
          viewer.setSnapEnabled(!viewer.snapEnabled);
          break;
        case 'display.isolate': {
          const id = viewer.selectedElement?.id;
          if (id) vc?.isolateEntities([entityIdFromExpressId(id)]);
          break;
        }
        case 'display.highlight': {
          const id = viewer.selectedElement?.id;
          if (id) vc?.highlightEntities([entityIdFromExpressId(id)]);
          break;
        }

        // Measure
        case 'measure.distance':
          viewer.setActiveTool('distance');
          break;
        case 'measure.angle':
          viewer.setActiveTool('angle');
          break;
        case 'measure.area':
          viewer.setActiveTool('area');
          break;
        case 'measure.volume':
          viewer.setActiveTool('volume');
          break;

        case 'annotate.add':
          viewer.setActiveTool('annotate');
          break;
        case 'annotate.bcfSave':
          vc?.saveBcfViewpoint?.();
          break;
        case 'annotate.bcfLoad':
          vc?.loadBcfViewpoint?.();
          break;

        case 'display.storeyCycle':
          vc?.cycleStorey?.();
          break;
        case 'display.sunStudy':
          vc?.toggleSunStudy?.();
          break;

        case 'draw.extrude': {
          viewer.setActiveTool('extrude');
          const targetId = useDrawStore.getState().selectedId;
          if (targetId) {
            const d = useDrawStore.getState();
            const before = d.getSnapshot();
            const result = d.extrudeElement(targetId);
            if (result) {
              undo.pushDrawAction('Extrude sketch', before, useDrawStore.getState().getSnapshot());
              const s = useDrawStore.getState();
              vc?.syncSketches(s.elements, s.activePoints, s.floorElevation);
            }
          }
          break;
        }
        case 'draw.move':
          viewer.setActiveTool('move');
          break;
        case 'draw.rotate':
          viewer.setActiveTool('rotate');
          break;
        case 'draw.copy': {
          const d = useDrawStore.getState();
          const before = d.getSnapshot();
          const dup = d.selectedId ? d.duplicateElement(d.selectedId) : d.duplicateLast();
          if (dup) {
            undo.pushDrawAction('Copy sketch', before, useDrawStore.getState().getSnapshot());
            const s = useDrawStore.getState();
            vc?.syncSketches(s.elements, s.activePoints, s.floorElevation);
          }
          break;
        }
        case 'draw.mirror': {
          const d = useDrawStore.getState();
          const before = d.getSnapshot();
          const dup = d.selectedId ? d.mirrorElement(d.selectedId) : d.mirrorLast();
          if (dup) {
            undo.pushDrawAction('Mirror sketch', before, useDrawStore.getState().getSnapshot());
            const s = useDrawStore.getState();
            vc?.syncSketches(s.elements, s.activePoints, s.floorElevation);
          }
          break;
        }
        case 'draw.array': {
          const d = useDrawStore.getState();
          const before = d.getSnapshot();
          const copies = d.selectedId ? d.arrayElement(d.selectedId, 3, 2) : d.arrayLast(3, 2);
          if (copies.length) {
            undo.pushDrawAction('Array sketch', before, useDrawStore.getState().getSnapshot());
            const s = useDrawStore.getState();
            vc?.syncSketches(s.elements, s.activePoints, s.floorElevation);
          }
          break;
        }

        // Section
        case 'section.x':
          vc?.addSectionPlane('x');
          break;
        case 'section.y':
          vc?.addSectionPlane('y');
          break;
        case 'section.z':
          vc?.addSectionPlane('z');
          break;
        case 'section.clear':
          vc?.clearSectionPlanes();
          break;

        // Capture
        case 'capture.snapshot': {
          const dataUrl = vc?.captureScreenshot();
          if (!dataUrl) break;
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = `architex-cad-view-${Date.now()}.png`;
          a.click();
          break;
        }

        // Draw tools
        case 'draw.line':
        case 'draw.polyline':
        case 'draw.wall':
        case 'draw.slab':
        case 'draw.column':
        case 'draw.rectangle':
        case 'draw.polygon':
        case 'draw.pipe':
        case 'draw.siteBoundary': {
          useToolbarStore.getState().setActiveTab('draw');
          const toolMap: Record<string, import('../types/tools').DrawTool> = {
            'draw.line': 'line',
            'draw.polyline': 'polyline',
            'draw.wall': 'wall',
            'draw.slab': 'slab',
            'draw.column': 'column',
            'draw.rectangle': 'rectangle',
            'draw.polygon': 'polygon',
            'draw.pipe': 'pipe',
            'draw.siteBoundary': 'site-boundary',
          };
          const drawTool = toolMap[actionId];
          viewer.setActiveTool(drawTool);
          if (!useDrawStore.getState().activePoints.length) {
            useDrawStore.getState().beginStroke();
          }
          break;
        }
        case 'draw.finish': {
          const tool = viewer.activeTool;
          if (!tool || tool === 'select') break;
          const kind = draw.toolToKind(tool as import('../types/tools').DrawTool);
          if (!kind) break;
          const d = useDrawStore.getState();
          const before = d.getSnapshot();
          const el = d.finishStroke(kind);
          if (!el) break;
          undo.pushDrawAction(`Draw ${kind}`, before, useDrawStore.getState().getSnapshot());
          const s = useDrawStore.getState();
          vc?.syncSketches(s.elements, s.activePoints, s.floorElevation);
          viewer.setActiveTool('select');
          break;
        }
        case 'draw.cancel':
          draw.cancelStroke();
          viewer.setActiveTool('select');
          break;
        case 'draw.clearAll': {
          const before = draw.getSnapshot();
          draw.clearAll();
          undo.pushDrawAction('Clear sketches', before, draw.getSnapshot());
          vc?.syncSketches?.([], [], draw.floorElevation);
          break;
        }

        // Modifiers
        case 'mod.undo':
          undo.undo();
          {
            const s = useDrawStore.getState();
            vc?.syncSketches?.(s.elements, s.activePoints, s.floorElevation);
          }
          break;
        case 'mod.redo':
          undo.redo();
          {
            const s = useDrawStore.getState();
            vc?.syncSketches?.(s.elements, s.activePoints, s.floorElevation);
          }
          break;
        case 'mod.orthoLock':
          draw.setModifiers({ orthoLock: !draw.modifiers.orthoLock });
          break;

        // Geo
        case 'geo.open':
          workspace.openPanel('geo');
          break;
        case 'geo.analyse':
          openAndRun('geo', () => geo.locateAnalyseAndBudget());
          break;
        case 'geo.budget':
          openAndRun('geo', () => geo.computeSiteBudget());
          break;
        case 'geo.flood':
          openAndRun('geo', async () => {
            await geo.runFloodSimulation();
            usePlatformToolsStore.setState({
              geoOverlayVisibility: { showTerrain: false, showContours: false, showFlood: true },
            });
          });
          break;
        case 'geo.report':
          openAndRun('geo', () => geo.exportSiteReport());
          break;
        case 'geo.pushCalc':
          geo.pushToCalculators();
          workspace.openPanel('calculator');
          break;
        case 'geo.applyAi':
          geo.applyBudgetToAi();
          workspace.openPanel('ai');
          break;
        case 'geo.applyBoq':
          geo.applyBudgetToBoq();
          workspace.openPanel('boq');
          break;

        // Real estate
        case 're.open':
          workspace.openPanel('realestate');
          break;
        case 're.feasibility':
          openAndRun('realestate', () => re.runFeasibility());
          break;
        case 're.valuation':
          openAndRun('realestate', () => re.runValuation());
          break;
        case 're.landUse':
          openAndRun('realestate', () => re.runLandUse());
          break;
        case 're.mortgage':
          openAndRun('realestate', () => re.runMortgage());
          break;

        // WASH
        case 'wash.open':
          workspace.openPanel('wash');
          break;
        case 'wash.demand':
          openAndRun('wash', async () => {
            wash.setActiveTab('demand');
            await wash.runCalculation();
          });
          break;
        case 'wash.borehole':
          openAndRun('wash', async () => {
            wash.setActiveTab('borehole');
            await wash.runCalculation();
          });
          break;
        case 'wash.sewerage':
          openAndRun('wash', async () => {
            wash.setActiveTab('sewerage');
            await wash.runCalculation();
          });
          break;

        // Energy
        case 'energy.open':
          workspace.openPanel('energy');
          break;
        case 'energy.solar':
          openAndRun('energy', async () => {
            energy.setActiveTab('solar');
            await energy.runCalculation();
          });
          break;
        case 'energy.battery':
          openAndRun('energy', async () => {
            energy.setActiveTab('battery');
            await energy.runCalculation();
          });
          break;

        // Structure
        case 'seismic.run':
          openAndRun('seismic', () => seismic.runAnalysis());
          break;
        case 'optimizer.structural':
          openAndRun('optimizer', () => optimizer.runStructural());
          break;
        case 'optimizer.solar':
          openAndRun('optimizer', () => optimizer.runSolar());
          break;
        case 'calc.beam':
          calc.setModule('beam');
          workspace.openPanel('calculator');
          break;
        case 'calc.slab':
          calc.setModule('slab');
          workspace.openPanel('calculator');
          break;
        case 'calc.column':
          calc.setModule('column');
          workspace.openPanel('calculator');
          break;
        case 'calc.foundation':
          calc.setModule('foundation');
          workspace.openPanel('calculator');
          break;

        // BIM pipeline
        case 'bim.boq':
          openAndRun('boq', () => boq.generateBoQ());
          break;
        case 'bim.boqImport':
          openAndRun('boq', () => boq.importFromBim(toBimPayload(ifc.getBoqElements())));
          break;
        case 'bim.boqExport':
          boq.exportExcel();
          break;
        case 'bim.schedule':
          openAndRun('schedule', () => schedule.buildFromBim());
          break;
        case 'bim.schedulePlay':
          schedule.play();
          schedule.setTimelineEnabled(true);
          break;
        case 'bim.schedulePause':
          schedule.pause();
          break;
        case 'bim.scheduleToggle':
          schedule.setTimelineEnabled(!schedule.timelineEnabled);
          break;
        case 'bim.ai':
          openAndRun('ai', () => ai.generateDesign());
          break;
        case 'bim.aiPush':
          ai.pushToCalcAndBoq();
          break;
        case 'bim.carbon':
          openAndRun('carbon', () => carbon.runCarbon());
          break;
        case 'bim.quantities':
          workspace.toggleInspector();
          break;

        default:
          if (!runCadToolAction(actionId)) {
            void usePlatformToolsStore.getState().runPlatformAction(actionId);
          }
          break;
      }
    },
    [
      viewer,
      workspace,
      draw,
      undo,
      geo,
      re,
      wash,
      energy,
      seismic,
      carbon,
      schedule,
      boq,
      ai,
      calc,
      optimizer,
      ifc,
      openAndRun,
    ]
  );

  const setTool = useCallback(
    (tool: ActiveTool) => viewer.setActiveTool(tool),
    [viewer]
  );

  const setViewMode = useCallback(
    (mode: ViewMode) => viewer.setViewMode(mode),
    [viewer]
  );

  return { run, setTool, setViewMode };
}

export type { RibbonTab, OrthoView, SectionAxis, ActiveTool };
