import type { Viewer } from '@xeokit/xeokit-sdk';

type SceneModelLike = {
  objects: Record<string, { visible?: boolean; highlighted?: boolean; xrayed?: boolean; matrix?: number[] }>;
  aabb?: number[];
};

import type { TimelineActivity } from './timeline4d';
import { getHiddenTypesAtWeek, getInProgressTypesAtWeek } from './timeline4d';

export interface ViewerControls {
  viewer: Viewer;
  setLayerVisibility: (type: string, visible: boolean) => void;
  setLayersVisibility: (hiddenTypes: string[]) => void;
  applyConstructionTimeline: (week: number, activities: TimelineActivity[], allTypes: string[]) => void;
  clearConstructionTimeline: () => void;
  highlightEntities: (entityIds: string[]) => void;
  isolateEntities: (entityIds: string[]) => void;
  showAll: () => void;
  flyToPlanView: () => void;
  flyToPerspective: () => void;
  setExploded: (enabled: boolean, factor?: number) => void;
  setXRayed: (enabled: boolean) => void;
  captureScreenshot: () => string | null;
}

const MODEL_ID = 'ifcModel';

export function createViewerControls(
  viewer: Viewer,
  entityTypeMap: Map<string, string>
): ViewerControls {
  const explodeState = { enabled: false, factor: 1.5, originals: new Map<string, number[]>() };

  function getModel(): SceneModelLike | null {
    return (viewer.scene.models[MODEL_ID] as unknown as SceneModelLike | undefined) ?? null;
  }

  function entityIdsForType(type: string): string[] {
    const ids: string[] = [];
    for (const [entityId, t] of entityTypeMap) {
      if (t === type) ids.push(entityId);
    }
    return ids;
  }

  function setLayerVisibility(type: string, visible: boolean) {
    const ids = entityIdsForType(type);
    const model = getModel();
    if (!model) return;
    for (const id of ids) {
      const obj = model.objects[id];
      if (obj) obj.visible = visible;
    }
    viewer.scene.render();
  }

  function setLayersVisibility(hiddenTypes: string[]) {
    const hidden = new Set(hiddenTypes);
    for (const [entityId, type] of entityTypeMap) {
      const model = getModel();
      if (!model?.objects[entityId]) continue;
      model.objects[entityId].visible = !hidden.has(type);
    }
    viewer.scene.render();
  }

  function applyConstructionTimeline(week: number, activities: TimelineActivity[], allTypes: string[]) {
    const hidden = getHiddenTypesAtWeek(activities, week, allTypes);
    const inProgress = getInProgressTypesAtWeek(activities, week);
    setLayersVisibility(hidden);

    viewer.scene.setObjectsHighlighted(viewer.scene.highlightedObjectIds, false);
    const highlightIds: string[] = [];
    for (const [entityId, type] of entityTypeMap) {
      const obj = viewer.scene.objects[entityId];
      if (!obj) continue;
      if (inProgress.has(type)) {
        obj.highlighted = true;
        highlightIds.push(entityId);
      }
    }
    if (highlightIds.length) {
      viewer.scene.setObjectsHighlighted(highlightIds, true);
    }
    viewer.scene.render();
  }

  function clearConstructionTimeline() {
    showAll();
  }

  function highlightEntities(entityIds: string[]) {
    viewer.scene.setObjectsHighlighted(viewer.scene.highlightedObjectIds, false);
    for (const id of entityIds) {
      const obj = viewer.scene.objects[id];
      if (obj) obj.highlighted = true;
    }
    viewer.scene.render();
  }

  function isolateEntities(entityIds: string[]) {
    const keep = new Set(entityIds);
    const model = getModel();
    if (!model) return;
    for (const id of Object.keys(model.objects)) {
      model.objects[id].visible = keep.has(id);
    }
    highlightEntities(entityIds);
    if (entityIds.length) {
      viewer.cameraFlight.flyTo({ aabb: viewer.scene.getAABB(entityIds) });
    }
    viewer.scene.render();
  }

  function showAll() {
    const model = getModel();
    if (!model) return;
    for (const id of Object.keys(model.objects)) {
      model.objects[id].visible = true;
      model.objects[id].xrayed = false;
    }
    viewer.scene.setObjectsHighlighted(viewer.scene.highlightedObjectIds, false);
    viewer.scene.render();
  }

  function flyToPlanView() {
    const model = getModel();
    if (!model) return;
    const aabb = model.aabb;
    if (!aabb) return;
    const cx = (aabb[0] + aabb[3]) / 2;
    const cy = (aabb[1] + aabb[4]) / 2;
    const cz = (aabb[2] + aabb[5]) / 2;
    const span = Math.max(aabb[3] - aabb[0], aabb[5] - aabb[2], 10);
    viewer.camera.projection = 'ortho';
    viewer.cameraFlight.flyTo({
      eye: [cx, cy + span * 1.2, cz],
      look: [cx, cy, cz],
      up: [0, 0, -1],
    });
  }

  function flyToPerspective() {
    viewer.camera.projection = 'perspective';
    const model = getModel();
    if (model) viewer.cameraFlight.flyTo(viewer.scene.models[MODEL_ID]);
  }

  function setExploded(enabled: boolean, factor = 1.5) {
    const model = getModel();
    if (!model) return;

    explodeState.enabled = enabled;
    explodeState.factor = factor;

    if (!enabled) {
      for (const [id, matrix] of explodeState.originals) {
        const obj = model.objects[id];
        if (obj && matrix) {
          (obj as { matrix?: number[] }).matrix = matrix;
        }
      }
      explodeState.originals.clear();
      viewer.scene.render();
      return;
    }

    const aabb = model.aabb;
    if (!aabb) return;

    const types = [...new Set(entityTypeMap.values())];
    const typeIndex = new Map(types.map((t, i) => [t, i]));

    for (const [entityId, type] of entityTypeMap) {
      const obj = model.objects[entityId];
      if (!obj) continue;

      if (!explodeState.originals.has(entityId)) {
        const m = (obj as { matrix?: number[] }).matrix;
        explodeState.originals.set(entityId, m ? [...m] : []);
      }

      const idx = typeIndex.get(type) ?? 0;
      const angle = (idx / Math.max(types.length, 1)) * Math.PI * 2;
      const dist = factor * (1 + idx * 0.3);
      const ox = Math.cos(angle) * dist;
      const oz = Math.sin(angle) * dist;
      const oy = idx * 0.15 * factor;

      const orig = explodeState.originals.get(entityId) ?? [];
      const tx = orig[12] ?? 0;
      const ty = orig[13] ?? 0;
      const tz = orig[14] ?? 0;

      const newMatrix = orig.length === 16 ? [...orig] : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      newMatrix[12] = tx + ox;
      newMatrix[13] = ty + oy;
      newMatrix[14] = tz + oz;
      (obj as { matrix?: number[] }).matrix = newMatrix;
    }

    viewer.cameraFlight.flyTo(model);
    viewer.scene.render();
  }

  function setXRayed(enabled: boolean) {
    const model = getModel();
    if (!model) return;
    for (const id of Object.keys(model.objects)) {
      model.objects[id].xrayed = enabled;
    }
    viewer.scene.render();
  }

  function captureScreenshot(): string | null {
    const canvas = document.getElementById('bimCanvas') as HTMLCanvasElement | null;
    if (!canvas) return null;
    viewer.scene.render();
    try {
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  return {
    viewer,
    setLayerVisibility,
    setLayersVisibility,
    applyConstructionTimeline,
    clearConstructionTimeline,
    highlightEntities,
    isolateEntities,
    showAll,
    flyToPlanView,
    flyToPerspective,
    setExploded,
    setXRayed,
    captureScreenshot,
  };
}

export function buildEntityTypeMap(
  elementByEntityId: Map<string, { type: string }>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [entityId, el] of elementByEntityId) {
    map.set(entityId, el.type);
  }
  return map;
}
