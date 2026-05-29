import type { Viewer } from '@xeokit/xeokit-sdk';
import { Mesh, PhongMaterial, buildBoxGeometry, ReadableGeometry } from '@xeokit/xeokit-sdk';
import type { SketchElement, SketchKind, SketchPoint } from '../store/drawStore';
import type { DrawTool } from '../types/tools';
import { useFeatureTreeStore } from '../store/featureTreeStore';
import {
  SKETCH_FLOOR_PLANE_ID,
  isClosedRing,
  pickOnHorizontalPlane,
  rectangleFromDiagonal,
} from './sketchGeometry';
import { buildPolygonFillGeometry, isOwnedPolygonGeometry, polygonFillCenter } from './sketchPolygonMesh';

const LAYER_ID = 'sketchLayer';

type SceneMesh = { destroy: () => void };
type SceneMaterial = { destroy: () => void };

export interface DrawSyncOptions {
  previewPoint?: SketchPoint | null;
  activeTool?: DrawTool | null;
}

const KIND_COLORS: Record<SketchKind, [number, number, number]> = {
  line: [0.55, 0.75, 0.95],
  polyline: [0.45, 0.7, 0.92],
  wall: [0.85, 0.65, 0.35],
  slab: [0.35, 0.72, 0.88],
  column: [0.75, 0.55, 0.35],
  rectangle: [0.4, 0.78, 0.65],
  polygon: [0.38, 0.68, 0.82],
  pipe: [0.55, 0.55, 0.6],
  'site-boundary': [0.25, 0.88, 0.45],
  circle: [0.5, 0.85, 0.95],
  arc: [0.65, 0.8, 0.95],
  ellipse: [0.45, 0.75, 0.88],
  hatch: [0.3, 0.55, 0.45],
  boundary: [0.55, 0.9, 0.7],
  xline: [0.4, 0.45, 0.5],
  spline: [0.7, 0.55, 0.9],
  point: [1, 0.9, 0.2],
  region: [0.35, 0.65, 0.78],
  donut: [0.9, 0.7, 0.25],
  revcloud: [0.95, 0.45, 0.35],
  text: [1, 1, 1],
};

export class DrawEngine {
  private viewer: Viewer;
  private meshes = new Map<string, SceneMesh>();
  private materials: SceneMaterial[] = [];
  private ownedGeometries: SceneMesh[] = [];
  private previewIds: string[] = [];

  constructor(viewer: Viewer) {
    this.viewer = viewer;
  }

  sync(
    elements: SketchElement[],
    activePoints: SketchPoint[],
    floorY: number,
    options: DrawSyncOptions = {},
  ) {
    this.clearMeshes();
    for (const el of elements) {
      this.renderElement(el, floorY);
    }
    this.renderActivePreview(activePoints, floorY, options.previewPoint ?? null, options.activeTool ?? null);
    const activeSolid = useFeatureTreeStore.getState().activeSolidMesh;
    if (activeSolid && activeSolid.vertices && activeSolid.vertices.length > 0) {
      this.renderSolidMesh(activeSolid, floorY);
    }
    try {
      this.viewer.scene.render();
    } catch (err) {
      console.error('[DrawEngine] scene.render failed', err);
    }
  }

  destroy() {
    this.clearMeshes();
  }

  private renderSolidMesh(solid: any, floorY: number) {
    const scene = this.viewer.scene;
    
    // Map backend coordinate axes to Xeokit 3D coordinate system
    const positions = [];
    const N = solid.vertices.length / 3;
    for (let i = 0; i < N; i++) {
      const x = solid.vertices[3 * i];
      const y = solid.vertices[3 * i + 1];
      const z = solid.vertices[3 * i + 2];
      positions.push(x);
      positions.push(floorY + z);
      positions.push(y);
    }
    
    const geometry = new ReadableGeometry(scene, {
      primitive: "triangles",
      positions: positions,
      indices: solid.faces
    });
    
    const material = new PhongMaterial(scene, {
      diffuse: [0.1, 0.7, 0.9],
      opacity: 0.75,
      backfaces: true
    });
    this.materials.push(material);
    
    const mesh = new Mesh(scene, {
      id: `solid-feature-${Date.now()}-${Math.random()}`,
      geometry: geometry,
      material: material,
      pickable: true
    });
    
    this.meshes.set(mesh.id, mesh);
  }

  private clearMeshes() {
    const meshList = [...this.meshes.values()];
    this.meshes.clear();
    for (const m of meshList) {
      try {
        m.destroy();
      } catch {
        /* mesh may already be destroyed */
      }
    }
    const previewIds = [...this.previewIds];
    this.previewIds = [];
    for (const id of previewIds) {
      const obj = this.viewer.scene.objects[id];
      if (obj) {
        try {
          obj.destroy();
        } catch {
          /* ignore */
        }
      }
    }
    const mats = [...this.materials];
    this.materials = [];
    for (const mat of mats) {
      try {
        mat.destroy();
      } catch {
        /* ignore */
      }
    }
    // Geometries are destroyed with their meshes — do not destroy again (breaks xeokit render).
    this.ownedGeometries = [];
  }

  private createMaterial(cfg: ConstructorParameters<typeof PhongMaterial>[1]) {
    const mat = new PhongMaterial(this.viewer.scene, cfg);
    this.materials.push(mat);
    return mat;
  }

  private trackPolygonGeometry(geom: ReturnType<typeof buildPolygonFillGeometry>) {
    if (geom && isOwnedPolygonGeometry(geom)) {
      this.ownedGeometries.push(geom);
    }
    return geom;
  }

  private renderElement(el: SketchElement, floorY: number) {
    switch (el.kind) {
      case 'column':
        this.renderColumn(el, floorY);
        break;
      case 'slab':
      case 'rectangle':
      case 'polygon':
        this.renderAreaElement(el, floorY);
        break;
      case 'site-boundary':
        this.renderSiteBoundary(el, floorY);
        break;
      case 'circle':
        this.renderCircle(el, floorY);
        break;
      case 'arc':
        this.renderArc(el, floorY);
        break;
      case 'ellipse':
        this.renderEllipse(el, floorY);
        break;
      case 'hatch':
      case 'region':
      case 'boundary':
        this.renderAreaElement(el, floorY);
        break;
      case 'xline':
        this.renderXline(el, floorY);
        break;
      case 'spline':
      case 'revcloud':
        this.renderLineSegments(el, floorY, KIND_COLORS[el.kind]);
        break;
      case 'point':
        this.renderColumn(el, floorY);
        break;
      case 'donut':
        this.renderDonut(el, floorY);
        break;
      case 'wall':
        this.renderWallSegments(el, floorY);
        break;
      case 'pipe':
        this.renderPipeSegments(el, floorY);
        break;
      default:
        this.renderLineSegments(el, floorY, KIND_COLORS[el.kind]);
        break;
    }
  }

  private renderColumn(el: SketchElement, floorY: number) {
    if (el.points.length < 1) return;
    const p = el.points[0];
    const size = el.thickness ?? 0.4;
    const h = el.height ?? 3;
    const scene = this.viewer.scene;
    const mat = this.createMaterial({
      diffuse: KIND_COLORS.column,
      alpha: 0.92,
      backfaces: true,
    });
    const mesh = new Mesh(scene, {
      id: `${LAYER_ID}-${el.id}`,
      geometry: new ReadableGeometry(scene, buildBoxGeometry({ xSize: size, ySize: h, zSize: size })),
      material: mat,
      position: [p.x, floorY + h / 2, p.z],
      pickable: true,
    });
    this.meshes.set(el.id, mesh);
    this.renderVertexMarkers(el.points, floorY, KIND_COLORS.column, el.id);
  }

  private renderAreaElement(el: SketchElement, floorY: number) {
    if (el.points.length < 3) return;
    const color = KIND_COLORS[el.kind];
    const scene = this.viewer.scene;
    const thickness = el.thickness ?? (el.kind === 'slab' ? 0.15 : 0.05);
    const y = floorY + thickness / 2;
    const [cx, , cz] = polygonFillCenter(el.points);
    const fillGeom = this.trackPolygonGeometry(buildPolygonFillGeometry(scene, el.points));
    if (!fillGeom) return;

    const fillMat = this.createMaterial({
      diffuse: color,
      alpha: el.kind === 'slab' ? 0.55 : 0.42,
      backfaces: true,
    });
    const fill = new Mesh(scene, {
      id: `${LAYER_ID}-${el.id}-fill`,
      geometry: fillGeom,
      material: fillMat,
      position: [cx, y, cz],
      rotation: [-Math.PI / 2, 0, 0],
      pickable: true,
    });
    this.meshes.set(`${el.id}-fill`, fill);

    if (el.kind === 'slab') {
      const h = thickness;
      const loop = isClosedRing(el.points) ? el.points : [...el.points, el.points[0]];
      for (let i = 0; i < loop.length - 1; i++) {
        this.renderExtrudedSegment(
          loop[i],
          loop[i + 1],
          floorY,
          0.06,
          h,
          color,
          `${el.id}-skirt-${i}`,
        );
      }
    }

    this.renderClosedOutline(el.points, floorY, color, el.id, 0.12);
    const verts = isClosedRing(el.points) ? el.points.slice(0, -1) : el.points;
    this.renderVertexMarkers(verts, floorY, color, el.id);
  }

  private circlePoints(center: SketchPoint, edge: SketchPoint, segments = 48): SketchPoint[] {
    const r = Math.hypot(edge.x - center.x, edge.z - center.z) || 0.01;
    const pts: SketchPoint[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      pts.push({
        x: center.x + Math.cos(t) * r,
        y: center.y,
        z: center.z + Math.sin(t) * r,
      });
    }
    return pts;
  }

  private renderCircle(el: SketchElement, floorY: number) {
    if (el.points.length < 2) return;
    const loop = this.circlePoints(el.points[0], el.points[1]);
    this.renderAreaElement(
      { ...el, points: loop.slice(0, -1), kind: 'polygon', thickness: 0.03 },
      floorY,
    );
    this.renderClosedOutline(loop, floorY, KIND_COLORS.circle, el.id, 0.1);
  }

  private renderArc(el: SketchElement, floorY: number) {
    if (el.points.length < 3) return;
    this.renderOpenOutline(el.points, floorY, KIND_COLORS.arc, el.id, 0.12, false);
    this.renderVertexMarkers(el.points, floorY, KIND_COLORS.arc, el.id);
  }

  private renderEllipse(el: SketchElement, floorY: number) {
    if (el.points.length < 2) return;
    const [a, b] = el.points;
    const cx = (a.x + b.x) / 2;
    const cz = (a.z + b.z) / 2;
    const rx = Math.abs(b.x - a.x) / 2 || 0.01;
    const rz = Math.abs(b.z - a.z) / 2 || 0.01;
    const loop: SketchPoint[] = [];
    for (let i = 0; i <= 48; i++) {
      const t = (i / 48) * Math.PI * 2;
      loop.push({ x: cx + Math.cos(t) * rx, y: a.y, z: cz + Math.sin(t) * rz });
    }
    this.renderClosedOutline(loop, floorY, KIND_COLORS.ellipse, el.id, 0.1);
  }

  private renderXline(el: SketchElement, floorY: number) {
    if (el.points.length < 2) return;
    const [a, b] = el.points;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const scale = 500;
    const far: SketchPoint = {
      x: a.x + (dx / len) * scale,
      y: a.y,
      z: a.z + (dz / len) * scale,
    };
    const back: SketchPoint = {
      x: a.x - (dx / len) * scale,
      y: a.y,
      z: a.z - (dz / len) * scale,
    };
    this.renderThinSegment(back, far, floorY, KIND_COLORS.xline, `${el.id}-xl`, 0.06);
  }

  private renderDonut(el: SketchElement, floorY: number) {
    if (el.points.length < 2) return;
    const outer = this.circlePoints(el.points[0], el.points[1], 40);
    this.renderClosedOutline(outer, floorY, KIND_COLORS.donut, el.id, 0.14);
    const rIn = Math.hypot(el.points[1].x - el.points[0].x, el.points[1].z - el.points[0].z) * 0.5;
    const innerEdge: SketchPoint = {
      x: el.points[0].x + rIn * 0.5,
      y: el.points[0].y,
      z: el.points[0].z,
    };
    const inner = this.circlePoints(el.points[0], innerEdge, 32);
    this.renderClosedOutline(inner, floorY, KIND_COLORS.donut, `${el.id}-in`, 0.1);
  }

  private renderSiteBoundary(el: SketchElement, floorY: number) {
    const color = KIND_COLORS['site-boundary'];
    const loop = el.points.length >= 3 ? [...el.points, el.points[0]] : el.points;
    this.renderOpenOutline(loop, floorY, color, el.id, 0.14, true);
    const verts = isClosedRing(el.points) ? el.points.slice(0, -1) : el.points;
    this.renderVertexMarkers(verts, floorY, color, el.id);
  }

  private renderWallSegments(el: SketchElement, floorY: number) {
    const thick = el.thickness ?? 0.2;
    const h = el.height ?? 3;
    for (let i = 0; i < el.points.length - 1; i++) {
      this.renderExtrudedSegment(el.points[i], el.points[i + 1], floorY, thick, h, KIND_COLORS.wall, `${el.id}-${i}`);
    }
    this.renderVertexMarkers(el.points, floorY, KIND_COLORS.wall, el.id);
  }

  private renderPipeSegments(el: SketchElement, floorY: number) {
    const d = el.diameter ?? 0.15;
    for (let i = 0; i < el.points.length - 1; i++) {
      this.renderExtrudedSegment(el.points[i], el.points[i + 1], floorY, d, d * 0.85, KIND_COLORS.pipe, `${el.id}-${i}`);
    }
    this.renderVertexMarkers(el.points, floorY, KIND_COLORS.pipe, el.id);
  }

  private renderLineSegments(el: SketchElement, floorY: number, color: [number, number, number]) {
    for (let i = 0; i < el.points.length - 1; i++) {
      this.renderThinSegment(el.points[i], el.points[i + 1], floorY, color, `${el.id}-${i}`, 0.08);
    }
    this.renderVertexMarkers(el.points, floorY, color, el.id);
  }

  private renderExtrudedSegment(
    a: SketchPoint,
    b: SketchPoint,
    floorY: number,
    thick: number,
    h: number,
    color: [number, number, number],
    meshKey: string,
  ) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 0.01;
    const scene = this.viewer.scene;
    const mat = this.createMaterial({ diffuse: color, alpha: 0.88, backfaces: true });
    const mesh = new Mesh(scene, {
      id: `${LAYER_ID}-${meshKey}`,
      geometry: new ReadableGeometry(scene, buildBoxGeometry({ xSize: thick, ySize: h, zSize: len })),
      material: mat,
      position: [a.x + dx / 2, floorY + h / 2, a.z + dz / 2],
      rotation: [0, -Math.atan2(dx, dz), 0],
      pickable: true,
    });
    this.meshes.set(meshKey, mesh);
  }

  private renderThinSegment(
    a: SketchPoint,
    b: SketchPoint,
    floorY: number,
    color: [number, number, number],
    meshKey: string,
    thick: number,
  ) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 0.01;
    const scene = this.viewer.scene;
    const mat = this.createMaterial({ diffuse: color, alpha: 0.95, backfaces: true });
    const mesh = new Mesh(scene, {
      id: `${LAYER_ID}-${meshKey}`,
      geometry: new ReadableGeometry(scene, buildBoxGeometry({ xSize: thick, ySize: thick, zSize: len })),
      material: mat,
      position: [a.x + dx / 2, floorY + thick / 2 + 0.05, a.z + dz / 2],
      rotation: [0, -Math.atan2(dx, dz), 0],
      pickable: true,
    });
    this.meshes.set(meshKey, mesh);
  }

  private renderClosedOutline(
    points: SketchPoint[],
    floorY: number,
    color: [number, number, number],
    elId: string,
    thick: number,
  ) {
    const loop = isClosedRing(points) ? points : [...points, points[0]];
    this.renderOpenOutline(loop, floorY, color, elId, thick, false);
  }

  private renderOpenOutline(
    points: SketchPoint[],
    floorY: number,
    color: [number, number, number],
    elId: string,
    thick: number,
    dashedStyle: boolean,
  ) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 0.01;
      const scene = this.viewer.scene;
      const alpha = dashedStyle && i % 2 === 1 ? 0.35 : 0.95;
      const mat = this.createMaterial({ diffuse: color, alpha, backfaces: true });
      const mesh = new Mesh(scene, {
        id: `${LAYER_ID}-${elId}-edge-${i}`,
        geometry: new ReadableGeometry(scene, buildBoxGeometry({ xSize: thick, ySize: 0.08, zSize: len })),
        material: mat,
        position: [a.x + dx / 2, floorY + 0.08, a.z + dz / 2],
        rotation: [0, -Math.atan2(dx, dz), 0],
        pickable: false,
      });
      this.meshes.set(`${elId}-edge-${i}`, mesh);
    }
  }

  private renderVertexMarkers(
    points: SketchPoint[],
    floorY: number,
    color: [number, number, number],
    elId: string,
  ) {
    const scene = this.viewer.scene;
    const mat = this.createMaterial({ diffuse: color, alpha: 1, backfaces: true });
    points.forEach((p, i) => {
      const key = `${elId}-v-${i}`;
      const mesh = new Mesh(scene, {
        id: `${LAYER_ID}-${key}`,
        geometry: new ReadableGeometry(scene, buildBoxGeometry({ xSize: 0.22, ySize: 0.22, zSize: 0.22 })),
        material: mat,
        position: [p.x, floorY + 0.11, p.z],
        pickable: false,
      });
      this.meshes.set(key, mesh);
    });
  }

  private renderActivePreview(
    activePoints: SketchPoint[],
    floorY: number,
    previewPoint: SketchPoint | null,
    activeTool: DrawTool | null,
  ) {
    if (!activePoints.length && !previewPoint) return;

    const scene = this.viewer.scene;
    const previewMat = this.createMaterial({
      diffuse: [1, 0.88, 0.15],
      alpha: 0.75,
      backfaces: true,
    });

    let displayPoints = [...activePoints];
    if (previewPoint) displayPoints = [...displayPoints, previewPoint];

    if (activeTool === 'rectangle' && activePoints.length === 1 && previewPoint) {
      displayPoints = rectangleFromDiagonal(activePoints[0], previewPoint);
      this.renderPreviewPolygon(displayPoints, floorY, previewMat, true);
      return;
    }

    if (displayPoints.length >= 2) {
      for (let i = 0; i < displayPoints.length - 1; i++) {
        const a = displayPoints[i];
        const b = displayPoints[i + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.sqrt(dx * dx + dz * dz) || 0.01;
        const id = `${LAYER_ID}-preview-${i}`;
        const mesh = new Mesh(scene, {
          id,
          geometry: new ReadableGeometry(scene, buildBoxGeometry({ xSize: 0.12, ySize: 0.1, zSize: len })),
          material: previewMat,
          position: [a.x + dx / 2, floorY + 0.12, a.z + dz / 2],
          rotation: [0, -Math.atan2(dx, dz), 0],
          pickable: false,
        });
        this.previewIds.push(id);
        void mesh;
      }
    }

    if (
      previewPoint &&
      (activeTool === 'polygon' || activeTool === 'slab' || activeTool === 'site-boundary') &&
      activePoints.length >= 2
    ) {
      const closing = [...activePoints, previewPoint, activePoints[0]];
      this.renderPreviewPolygon(closing, floorY, previewMat, true);
    }

    for (const p of activePoints) {
      const id = `${LAYER_ID}-preview-pt-${p.x}-${p.z}`;
      const mesh = new Mesh(scene, {
        id,
        geometry: new ReadableGeometry(scene, buildBoxGeometry({ xSize: 0.24, ySize: 0.24, zSize: 0.24 })),
        material: previewMat,
        position: [p.x, floorY + 0.14, p.z],
        pickable: false,
      });
      this.previewIds.push(id);
      void mesh;
    }
  }

  private renderPreviewPolygon(
    points: SketchPoint[],
    floorY: number,
    mat: PhongMaterial,
    fill: boolean,
  ) {
    if (points.length < 3 || !fill) return;
    const scene = this.viewer.scene;
    const fillGeom = this.trackPolygonGeometry(buildPolygonFillGeometry(scene, points));
    if (!fillGeom) return;
    const [cx, , cz] = polygonFillCenter(points);
    const id = `${LAYER_ID}-preview-fill`;
    const mesh = new Mesh(scene, {
      id,
      geometry: fillGeom,
      material: mat,
      position: [cx, floorY + 0.04, cz],
      rotation: [-Math.PI / 2, 0, 0],
      pickable: false,
    });
    this.previewIds.push(id);
    void mesh;
  }

  pickFloor(canvasPos: number[], floorY: number): SketchPoint | null {
    const canvas = document.getElementById('bimCanvas') as HTMLCanvasElement | null;
    const cw = canvas?.clientWidth || 1;
    const ch = canvas?.clientHeight || 1;
    const cam = this.viewer.scene.camera;

    const planeHit = pickOnHorizontalPlane(canvasPos, cw, ch, cam.eye, cam.look, cam.up, floorY);
    if (planeHit) return planeHit;

    const hit = this.viewer.scene.pick({ canvasPos, pickSurface: true });
    if (hit?.worldPos) {
      const entityId = hit.entity?.id ? String(hit.entity.id) : '';
      if (entityId === SKETCH_FLOOR_PLANE_ID || entityId.startsWith('sketchWorkspace-')) {
        return { x: hit.worldPos[0], y: floorY, z: hit.worldPos[2] };
      }
      if (
        !entityId.startsWith('sketchLayer-') &&
        !entityId.startsWith('measure') &&
        !entityId.startsWith('geoOverlay')
      ) {
        return { x: hit.worldPos[0], y: floorY, z: hit.worldPos[2] };
      }
    }

    return null;
  }
}
