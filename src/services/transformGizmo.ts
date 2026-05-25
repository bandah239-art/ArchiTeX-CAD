import { TransformControl, type Viewer } from '@xeokit/xeokit-sdk';
import type { SketchElement, SketchPoint } from '../store/drawStore';
import { useDrawStore } from '../store/drawStore';
import { useViewerStore } from '../store/viewerStore';
import { ifcElementFromEntity } from './ifcMeshXeokit';
import type { ParsedIfcElement } from './ifcParser';

export const SKETCH_LAYER_PREFIX = 'sketchLayer';

export type TransformMode = 'move' | 'rotate';

/** Parse sketch element id from a scene mesh id (`sketchLayer-{id}` or `sketchLayer-{id}-fill`, etc.). */
export function parseSketchMeshId(meshId: string): string | null {
  if (!meshId.startsWith(`${SKETCH_LAYER_PREFIX}-`)) return null;
  const rest = meshId.slice(SKETCH_LAYER_PREFIX.length + 1);
  if (rest.startsWith('preview-') || rest.startsWith('v-')) return null;
  const match = rest.match(/^(sk-\d+-[a-z0-9]+)/);
  return match ? match[1] : null;
}

function quatVec(q: number[], v: number[]): number[] {
  const [qx, qy, qz, qw] = q;
  const [vx, vy, vz] = v;
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [
    vx + qw * tx + (qy * tz - qz * ty),
    vy + qw * ty + (qz * tx - qx * tz),
    vz + qw * tz + (qx * ty - qy * tx),
  ];
}

function quatToMat4(q: number[]): number[] {
  const [x, y, z, w] = q;
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;
  return [
    1 - 2 * (yy + zz), 2 * (xy + wz), 2 * (xz - wy), 0,
    2 * (xy - wz), 1 - 2 * (xx + zz), 2 * (yz + wx), 0,
    2 * (xz + wy), 2 * (yz - wx), 1 - 2 * (xx + yy), 0,
    0, 0, 0, 1,
  ];
}

function multiplyMat4(a: number[], b: number[]): number[] {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

function translationMat4(x: number, y: number, z: number): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
}

function sketchCentroid(el: SketchElement, floorY: number): [number, number, number] {
  if (el.kind === 'column' && el.points.length >= 1) {
    const p = el.points[0];
    const h = el.height ?? 3;
    return [p.x, floorY + h / 2, p.z];
  }
  if (!el.points.length) return [0, floorY, 0];
  const cx = el.points.reduce((s, p) => s + p.x, 0) / el.points.length;
  const cz = el.points.reduce((s, p) => s + p.z, 0) / el.points.length;
  const h = el.height ?? 3;
  return [cx, floorY + h / 2, cz];
}

function entityCenter(viewer: Viewer, entityId: string): [number, number, number] | null {
  try {
    const aabb = viewer.scene.getAABB([entityId]);
    if (!aabb || aabb.length < 6) return null;
    return [
      (aabb[0] + aabb[3]) / 2,
      (aabb[1] + aabb[4]) / 2,
      (aabb[2] + aabb[5]) / 2,
    ];
  } catch {
    return null;
  }
}

export class TransformGizmoController {
  private control: TransformControl;
  private viewer: Viewer;
  private elementMap: Map<string, ParsedIfcElement>;
  private mode: TransformMode | null = null;
  private targetType: 'sketch' | 'ifc' | null = null;
  private targetId: string | null = null;
  private lastPosition: [number, number, number] = [0, 0, 0];
  private pivot: [number, number, number] = [0, 0, 0];
  private basePoints: SketchPoint[] | null = null;
  private baseMatrix: number[] | null = null;
  private onSketchChange?: () => void;

  constructor(
    viewer: Viewer,
    elementMap: Map<string, ParsedIfcElement>,
    onSketchChange?: () => void,
  ) {
    this.viewer = viewer;
    this.elementMap = elementMap;
    this.onSketchChange = onSketchChange;
    this.control = new TransformControl(viewer);
  }

  setElementMap(map: Map<string, ParsedIfcElement>) {
    this.elementMap = map;
  }

  destroy() {
    this.detach();
    this.control.destroy();
  }

  detach() {
    this.control.setHandlers(undefined);
    this.mode = null;
    this.targetType = null;
    this.targetId = null;
    this.basePoints = null;
    this.baseMatrix = null;
  }

  activate(mode: TransformMode): boolean {
    this.mode = mode;
    const target = this.resolveTarget();
    if (!target) {
      this.control.setHandlers(undefined);
      return false;
    }
    this.attach(target.type, target.id);
    return true;
  }

  attachToPick(entityId: string, mode: TransformMode): boolean {
    const sketchId = parseSketchMeshId(entityId);
    if (sketchId) {
      useDrawStore.getState().setSelectedId(sketchId);
      this.mode = mode;
      this.attach('sketch', sketchId);
      return true;
    }
    if (entityId.startsWith('ifc-')) {
      const parsed = ifcElementFromEntity(entityId, this.elementMap);
      if (parsed) {
        useViewerStore.getState().selectElement(parsed);
      }
      this.mode = mode;
      this.attach('ifc', entityId);
      return true;
    }
    return false;
  }

  private resolveTarget(): { type: 'sketch' | 'ifc'; id: string } | null {
    const draw = useDrawStore.getState();
    const viewer = useViewerStore.getState();

    if (draw.selectedId) {
      const el = draw.elements.find((e) => e.id === draw.selectedId);
      if (el) return { type: 'sketch', id: el.id };
    }
    if (viewer.selectedElement) {
      return { type: 'ifc', id: `ifc-${viewer.selectedElement.id}` };
    }
    const last = draw.elements[draw.elements.length - 1];
    if (last) return { type: 'sketch', id: last.id };
    return null;
  }

  private attach(type: 'sketch' | 'ifc', id: string) {
    this.targetType = type;
    this.targetId = id;
    this.basePoints = null;
    this.baseMatrix = null;

    const floorY = useDrawStore.getState().floorElevation;

    if (type === 'sketch') {
      const el = useDrawStore.getState().elements.find((e) => e.id === id);
      if (!el) {
        this.detach();
        return;
      }
      this.pivot = sketchCentroid(el, floorY);
      this.basePoints = el.points.map((p) => ({ ...p }));
      this.lastPosition = [...this.pivot];
      this.control.setPosition(this.pivot);
      this.control.setQuaternion([0, 0, 0, 1]);
    } else {
      const center = entityCenter(this.viewer, id);
      if (!center) {
        this.detach();
        return;
      }
      this.pivot = center;
      this.lastPosition = [...center];
      const obj = this.viewer.scene.objects[id] as { matrix?: number[] } | undefined;
      this.baseMatrix = obj?.matrix ? [...obj.matrix] : [
        1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
      ];
      this.control.setPosition(center);
      this.control.setQuaternion([0, 0, 0, 1]);
    }

    this.bindHandlers();
    this.viewer.scene.render();
  }

  private bindHandlers() {
    if (this.mode === 'move') {
      this.control.setHandlers({
        onPosition: (pos) => this.onPosition(pos),
      });
      return;
    }
    this.control.setHandlers({
      onQuaternion: (q) => this.onQuaternion(q),
    });
  }

  private onPosition(pos: number[]) {
    const dx = pos[0] - this.lastPosition[0];
    const dy = pos[1] - this.lastPosition[1];
    const dz = pos[2] - this.lastPosition[2];
    this.lastPosition = [pos[0], pos[1], pos[2]];

    if (this.targetType === 'sketch' && this.targetId) {
      const el = useDrawStore.getState().elements.find((e) => e.id === this.targetId);
      if (!el) return;
      const points = el.points.map((p) => ({
        x: p.x + dx,
        y: p.y + dy,
        z: p.z + dz,
      }));
      useDrawStore.getState().updateElementPoints(this.targetId, points);
      this.basePoints = points.map((p) => ({ ...p }));
      this.pivot = [this.pivot[0] + dx, this.pivot[1] + dy, this.pivot[2] + dz];
      this.onSketchChange?.();
      return;
    }

    if (this.targetType === 'ifc' && this.targetId) {
      const obj = this.viewer.scene.objects[this.targetId] as { matrix?: number[] } | undefined;
      if (!obj) return;
      const m = obj.matrix ? [...obj.matrix] : [
        1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
      ];
      m[12] = (m[12] ?? 0) + dx;
      m[13] = (m[13] ?? 0) + dy;
      m[14] = (m[14] ?? 0) + dz;
      obj.matrix = m;
      this.baseMatrix = [...m];
      this.viewer.scene.render();
    }
  }

  private onQuaternion(q: number[]) {
    if (this.targetType === 'sketch' && this.targetId && this.basePoints) {
      const points = this.basePoints.map((p) => {
        const rel = [p.x - this.pivot[0], p.y - this.pivot[1], p.z - this.pivot[2]];
        const r = quatVec(q, rel);
        return {
          x: this.pivot[0] + r[0],
          y: this.pivot[1] + r[1],
          z: this.pivot[2] + r[2],
        };
      });
      useDrawStore.getState().updateElementPoints(this.targetId, points);
      this.onSketchChange?.();
      return;
    }

    if (this.targetType === 'ifc' && this.targetId && this.baseMatrix) {
      const obj = this.viewer.scene.objects[this.targetId] as { matrix?: number[] } | undefined;
      if (!obj) return;
      const rot = quatToMat4(q);
      const t1 = translationMat4(this.pivot[0], this.pivot[1], this.pivot[2]);
      const t2 = translationMat4(-this.pivot[0], -this.pivot[1], -this.pivot[2]);
      const localRot = multiplyMat4(multiplyMat4(t1, rot), t2);
      obj.matrix = multiplyMat4(localRot, this.baseMatrix);
      this.viewer.scene.render();
    }
  }
}
