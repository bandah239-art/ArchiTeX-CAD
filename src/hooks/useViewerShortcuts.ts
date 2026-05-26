import { useEffect } from 'react';

import { useViewerStore } from '../store/viewerStore';

import { useUndoStore } from '../store/undoStore';

import { useMeasureStore } from '../store/measureStore';

import { useDrawStore } from '../store/drawStore';

import { useToolbarStore } from '../components/BIMViewer/toolRegistry';

import { MIN_POINTS } from '../services/sketchGeometry';

import type { ActiveTool, DrawTool } from '../types/tools';

import type { SketchKind } from '../store/drawStore';



const NAV_TOOLS: Record<string, ActiveTool> = {

  q: 'select',

  b: 'box-select',

  o: 'orbit',

  p: 'pan',

  z: 'zoom',

  w: 'walk',

  m: 'distance',

  a: 'angle',

  l: 'line',

};



const DRAW_SHORTCUT_TOOLS: ActiveTool[] = ['line', 'wall', 'polyline'];



function syncDrawFromStore() {

  const vc = useViewerStore.getState().viewerControls;

  if (!vc) return;

  const s = useDrawStore.getState();

  vc.syncSketches(s.elements, s.activePoints, s.floorElevation);

}



function activateDrawTool(tool: ActiveTool) {

  useToolbarStore.getState().setActiveTab('draw');

  const draw = useDrawStore.getState();

  if (!draw.activePoints.length) {
    draw.beginStroke();
  }

  useViewerStore.getState().setActiveTool(tool);

  useViewerStore.getState().viewerControls?.prepareDrawSession?.();

}



export function useViewerShortcuts() {

  const {

    viewerControls,

    setViewMode,

    setActiveTool,

    setExploded,

    setXRay,

    exploded,

    xRay,

    showAllLayers,

  } = useViewerStore();

  const { undo, redo, pushDrawAction } = useUndoStore();



  useEffect(() => {

    const onKeyDown = (e: KeyboardEvent) => {

      const target = e.target as HTMLElement;

      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;



      const key = e.key.toLowerCase();



      if (e.ctrlKey && key === 'z') {

        e.preventDefault();

        undo();

        syncDrawFromStore();

        return;

      }

      if (e.ctrlKey && key === 'y') {

        e.preventDefault();

        redo();

        syncDrawFromStore();

        return;

      }



      if (e.ctrlKey && key === 's') {

        e.preventDefault();

        const dataUrl = viewerControls?.captureScreenshot();

        if (!dataUrl) return;

        const a = document.createElement('a');

        a.href = dataUrl;

        a.download = `architex-cad-view-${Date.now()}.png`;

        a.click();

        return;

      }



      if (e.shiftKey && key === 'w') {

        activateDrawTool('wall');

        return;

      }



      if (NAV_TOOLS[key] && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {

        const tool = NAV_TOOLS[key];

        if (DRAW_SHORTCUT_TOOLS.includes(tool)) {

          activateDrawTool(tool);

        } else {

          setActiveTool(tool);

        }

        return;

      }



      if (e.ctrlKey || e.altKey || e.metaKey) return;



      if (key === 'enter') {

        const tool = useViewerStore.getState().activeTool;

        if (tool === 'area') {

          const pts = useMeasureStore.getState().areaPoints;

          if (pts.length >= 3) {

            void viewerControls?.finishMeasureAreaPolygon(pts);

          }

          return;

        }

        if (tool && ['polyline', 'wall', 'slab', 'polygon', 'pipe', 'site-boundary', 'rectangle'].includes(tool)) {

          const draw = useDrawStore.getState();

          const kind = draw.toolToKind(tool as DrawTool) as SketchKind | null;

          if (kind && draw.activePoints.length >= MIN_POINTS[kind]) {

            const before = draw.getSnapshot();

            const el = draw.finishStroke(kind);

            if (el) {

              pushDrawAction(`Draw ${kind}`, before, useDrawStore.getState().getSnapshot());

              syncDrawFromStore();

            }

          }

        }

        return;

      }



      if (key === 'escape') {

        const tool = useViewerStore.getState().activeTool;

        if (tool === 'area') {

          useMeasureStore.getState().clearAreaPoints();

          viewerControls?.clearMeasureArea();

        } else {

          useDrawStore.getState().cancelStroke();

        }

        setActiveTool('select');

        syncDrawFromStore();

        return;

      }



      switch (key) {

        case '1':

          setViewMode('perspective');

          break;

        case '2':

          setViewMode('plan');

          break;

        case '3':

          setViewMode('ortho');

          break;

        case 'f':

          viewerControls?.fitToView();

          break;

        case 'home':

          viewerControls?.resetView();

          break;

        case 'e':

          setExploded(!exploded);

          break;

        case 'x':

          setXRay(!xRay);

          break;

        case 'h':

          showAllLayers();

          break;

        default:

          break;

      }

    };



    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);

  }, [viewerControls, setViewMode, setActiveTool, setExploded, setXRay, exploded, xRay, showAllLayers, undo, redo, pushDrawAction]);

}

