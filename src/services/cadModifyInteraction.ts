import type { DrawEngine } from './drawEngine';
import { pickSketchPoint, syncDrawToEngine } from './drawInteraction';
import { useDrawStore } from '../store/drawStore';
import { useCadSessionStore } from '../store/cadSessionStore';
import { useSketchBlockStore } from '../store/sketchBlockStore';
import { useSketchConstraintStore } from '../store/sketchConstraintStore';
import { useUndoStore } from '../store/undoStore';
import { useViewerStore } from '../store/viewerStore';
import type { SketchElement } from '../store/drawStore';
import {
  pickNearestSegment,
  pickNearestVertex,
  trimElementWithCutter,
  extendElementToBoundary,
  offsetPolyline,
  filletAtVertex,
  chamferAtVertex,
  breakElementAt,
  stretchElementBox,
  alignElements,
  sweepAlongPath,
  loftBetweenProfiles,
} from './sketchCadOps';

function syncAfterDraw(drawEngine: DrawEngine | null | undefined) {
  const s = useDrawStore.getState();
  syncDrawToEngine(drawEngine, useViewerStore.getState().activeTool);
  useViewerStore.getState().viewerControls?.syncSketches(s.elements, s.activePoints, s.floorElevation);
}

function replaceElement(id: string, next: SketchElement, drawEngine: DrawEngine | null | undefined) {
  const draw = useDrawStore.getState();
  const before = draw.getSnapshot();
  const elements = draw.elements.map((e) => (e.id === id ? next : e));
  useDrawStore.setState({ elements, selectedId: next.id });
  useUndoStore.getState().pushDrawAction('CAD modify', before, useDrawStore.getState().getSnapshot());
  syncAfterDraw(drawEngine);
}

function applyConstraintSolve(drawEngine: DrawEngine | null | undefined) {
  const draw = useDrawStore.getState();
  const solved = useSketchConstraintStore.getState().applyToElements(draw.elements);
  const before = draw.getSnapshot();
  useDrawStore.setState({ elements: solved as SketchElement[] });
  useUndoStore.getState().pushDrawAction('Apply constraints', before, useDrawStore.getState().getSnapshot());
  syncAfterDraw(drawEngine);
}

/** Handle canvas click when a CAD modify/session command is active. */
export function processCadModifyClick(
  drawEngine: DrawEngine | null | undefined,
  canvasPos: number[],
): boolean {
  const session = useCadSessionStore.getState();
  if (!session.command) return false;

  const pt = pickSketchPoint(drawEngine, canvasPos);
  if (!pt) return false;

  const draw = useDrawStore.getState();
  const mods = draw.modifiers;
  const cmd = session.command;
  const step = session.step;

  if (cmd === 'trim') {
    if (step === 0) {
      const seg = pickNearestSegment(draw.elements, pt);
      if (!seg) {
        useCadSessionStore.getState().setHint('No edge near click — try again.');
        return true;
      }
      useCadSessionStore.getState().setStep(1, {
        cutterSeg: { elementId: seg.elementId, index: seg.index, a: seg.a, b: seg.b },
      });
      useCadSessionStore.getState().setHint('Pick object to trim.');
      return true;
    }
    const cutter = session.data.cutterSeg;
    if (!cutter) return true;
    const seg = pickNearestSegment(draw.elements, pt);
    if (!seg) return true;
    const el = draw.elements.find((e) => e.id === seg.elementId);
    if (!el || el.id === cutter.elementId) return true;
    const trimmed = trimElementWithCutter(el, { ...cutter, elementId: cutter.elementId, index: cutter.index }, pt);
    if (trimmed) replaceElement(el.id, trimmed, drawEngine);
    useCadSessionStore.getState().clear();
    return true;
  }

  if (cmd === 'extend') {
    if (step === 0) {
      const seg = pickNearestSegment(draw.elements, pt);
      if (!seg) return true;
      useCadSessionStore.getState().setStep(1, {
        cutterSeg: { elementId: seg.elementId, index: seg.index, a: seg.a, b: seg.b },
      });
      useCadSessionStore.getState().setHint('Click the end of the line to extend.');
      return true;
    }
    const boundary = session.data.cutterSeg;
    if (!boundary) return true;
    const seg = pickNearestSegment(draw.elements, pt);
    if (!seg) return true;
    const el = draw.elements.find((e) => e.id === seg.elementId);
    if (!el) return true;
    const dStart = Math.hypot(pt.x - el.points[0].x, pt.z - el.points[0].z);
    const dEnd = Math.hypot(
      pt.x - el.points[el.points.length - 1].x,
      pt.z - el.points[el.points.length - 1].z,
    );
    const extended = extendElementToBoundary(
      el,
      { a: boundary.a, b: boundary.b, elementId: boundary.elementId, index: boundary.index },
      dStart < dEnd ? 'start' : 'end',
    );
    if (extended) replaceElement(el.id, extended, drawEngine);
    useCadSessionStore.getState().clear();
    return true;
  }

  if (cmd === 'offset') {
    const seg = pickNearestSegment(draw.elements, pt);
    if (!seg) return true;
    const el = draw.elements.find((e) => e.id === seg.elementId);
    if (!el) return true;
    const closed =
      el.kind === 'polygon' || el.kind === 'rectangle' || el.kind === 'site-boundary';
    const dist = mods.offsetDistance ?? 1;
    const newPts = offsetPolyline(el.points, dist, closed);
    const before = draw.getSnapshot();
    const copy: SketchElement = {
      ...el,
      id: `sk-${Date.now()}`,
      points: newPts,
      createdAt: Date.now(),
    };
    useDrawStore.setState({ elements: [...draw.elements, copy], selectedId: copy.id });
    useUndoStore.getState().pushDrawAction('Offset', before, useDrawStore.getState().getSnapshot());
    syncAfterDraw(drawEngine);
    useCadSessionStore.getState().clear();
    return true;
  }

  if (cmd === 'fillet' || cmd === 'chamfer') {
    const vtx = pickNearestVertex(draw.elements, pt);
    if (!vtx) return true;
    const el = draw.elements.find((e) => e.id === vtx.elementId);
    if (!el) return true;
    const points =
      cmd === 'fillet'
        ? filletAtVertex(el.points, vtx.index, mods.filletRadius ?? 0.5)
        : chamferAtVertex(el.points, vtx.index, mods.chamferDistance ?? 0.3);
    replaceElement(el.id, { ...el, points }, drawEngine);
    useCadSessionStore.getState().clear();
    return true;
  }

  if (cmd === 'break') {
    const seg = pickNearestSegment(draw.elements, pt);
    if (!seg) return true;
    const el = draw.elements.find((e) => e.id === seg.elementId);
    if (!el) return true;
    const parts = breakElementAt(el, pt);
    if (parts.length === 2) {
      const before = draw.getSnapshot();
      const rest = draw.elements.filter((e) => e.id !== el.id);
      useDrawStore.setState({ elements: [...rest, ...parts], selectedId: parts[0].id });
      useUndoStore.getState().pushDrawAction('Break', before, useDrawStore.getState().getSnapshot());
      syncAfterDraw(drawEngine);
    }
    useCadSessionStore.getState().clear();
    return true;
  }

  if (cmd === 'stretch') {
    if (step === 0) {
      useCadSessionStore.getState().setStep(1, {
        elementId: draw.selectedId ?? undefined,
        cutterSeg: { elementId: '', index: 0, a: pt, b: pt },
      });
      useCadSessionStore.getState().setHint('Pick second point for stretch.');
      return true;
    }
    const id = draw.selectedId;
    const anchor = session.data.cutterSeg?.a;
    if (!id || !anchor) {
      useCadSessionStore.getState().clear();
      return true;
    }
    const el = draw.elements.find((e) => e.id === id);
    if (!el) return true;
    const points = stretchElementBox(el, anchor, {
      dx: pt.x - anchor.x,
      dz: pt.z - anchor.z,
    });
    replaceElement(id, { ...el, points }, drawEngine);
    useCadSessionStore.getState().clear();
    return true;
  }

  if (cmd === 'align') {
    const seg = pickNearestSegment(draw.elements, pt);
    if (!seg) return true;
    const ids = session.data.alignIds ?? [];
    if (!ids.includes(seg.elementId)) {
      useCadSessionStore.getState().setStep(step, { alignIds: [...ids, seg.elementId] });
      useCadSessionStore.getState().setHint(`Selected ${ids.length + 1} — open panel to align.`);
      useCadSessionStore.getState().setPanelOpen(true);
    }
    return true;
  }

  if (cmd === 'block-insert') {
    const name = useSketchBlockStore.getState().activeBlockName;
    if (!name) {
      useCadSessionStore.getState().setHint('Choose a block in the panel first.');
      return true;
    }
    const placed = useSketchBlockStore.getState().insertBlock(name, pt);
    if (placed.length) {
      const before = draw.getSnapshot();
      useDrawStore.setState({ elements: [...draw.elements, ...placed] });
      useUndoStore.getState().pushDrawAction('Insert block', before, useDrawStore.getState().getSnapshot());
      syncAfterDraw(drawEngine);
    }
    useCadSessionStore.getState().clear();
    return true;
  }

  if (cmd === 'param-geom' || cmd === 'param-dim') {
    const seg = pickNearestSegment(draw.elements, pt);
    if (!seg) return true;
    const ids = session.data.alignIds ?? [];
    if (ids.length < 1) {
      useCadSessionStore.getState().setStep(1, { alignIds: [seg.elementId] });
      useCadSessionStore.getState().setHint('Pick second entity.');
      return true;
    }
    if (ids.length === 1 && ids[0] !== seg.elementId) {
      const type = session.data.constraintType ?? 'horizontal';
      if (cmd === 'param-geom') {
        useSketchConstraintStore.getState().addGeometric(type as 'horizontal', [ids[0], seg.elementId]);
      } else {
        useSketchConstraintStore.getState().addDimensional('distance', [ids[0], seg.elementId], mods.offsetDistance ?? 2);
      }
      applyConstraintSolve(drawEngine);
      useCadSessionStore.getState().clear();
    }
    return true;
  }

  if (cmd === 'sweep') {
    if (step === 0) {
      const seg = pickNearestSegment(draw.elements, pt);
      if (!seg) return true;
      useCadSessionStore.getState().setStep(1, { profileId: seg.elementId });
      useCadSessionStore.getState().setHint('Pick path polyline.');
      return true;
    }
    const profileId = session.data.profileId;
    const pathSeg = pickNearestSegment(draw.elements, pt);
    if (!profileId || !pathSeg) return true;
    const profile = draw.elements.find((e) => e.id === profileId);
    const path = draw.elements.find((e) => e.id === pathSeg.elementId);
    if (!profile || !path) return true;
    const swept = sweepAlongPath(profile, path);
    if (swept) {
      const before = draw.getSnapshot();
      useDrawStore.setState({ elements: [...draw.elements, swept] });
      useUndoStore.getState().pushDrawAction('Sweep', before, useDrawStore.getState().getSnapshot());
      syncAfterDraw(drawEngine);
    }
    useCadSessionStore.getState().clear();
    return true;
  }

  if (cmd === 'loft') {
    if (step === 0) {
      const seg = pickNearestSegment(draw.elements, pt);
      if (!seg) return true;
      useCadSessionStore.getState().setStep(1, { profileId: seg.elementId });
      useCadSessionStore.getState().setHint('Pick second profile.');
      return true;
    }
    const aId = session.data.profileId;
    const seg = pickNearestSegment(draw.elements, pt);
    if (!aId || !seg) return true;
    const a = draw.elements.find((e) => e.id === aId);
    const b = draw.elements.find((e) => e.id === seg.elementId);
    if (!a || !b) return true;
    const lofted = loftBetweenProfiles(a, b);
    if (lofted) {
      const before = draw.getSnapshot();
      useDrawStore.setState({ elements: [...draw.elements, lofted] });
      useUndoStore.getState().pushDrawAction('Loft', before, useDrawStore.getState().getSnapshot());
      syncAfterDraw(drawEngine);
    }
    useCadSessionStore.getState().clear();
    return true;
  }

  return false;
}

export function runAlignFromPanel(
  mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom',
  drawEngine: DrawEngine | null | undefined,
) {
  const ids = useCadSessionStore.getState().data.alignIds ?? [];
  if (ids.length < 2) return;
  const draw = useDrawStore.getState();
  const before = draw.getSnapshot();
  const newPointSets = alignElements(draw.elements, ids, mode);
  const map = new Map(ids.map((id, i) => [id, newPointSets[i]]));
  const elements = draw.elements.map((e) =>
    map.has(e.id) ? { ...e, points: map.get(e.id)! } : e,
  );
  useDrawStore.setState({ elements });
  useUndoStore.getState().pushDrawAction(`Align ${mode}`, before, useDrawStore.getState().getSnapshot());
  syncAfterDraw(drawEngine);
  useCadSessionStore.getState().clear();
}
