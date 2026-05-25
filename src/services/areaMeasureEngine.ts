import type { Viewer } from '@xeokit/xeokit-sdk';

import { Mesh, PhongMaterial, buildBoxGeometry, ReadableGeometry } from '@xeokit/xeokit-sdk';

import type { SketchPoint } from '../store/drawStore';

import { geometryExtensionsAPI } from './geometryExtensionsAPI';

import { buildPolygonFillGeometry, isOwnedPolygonGeometry, polygonFillCenter } from './sketchPolygonMesh';



const LAYER = 'measureArea';



type SceneMesh = { destroy: () => void };

type SceneMaterial = { destroy: () => void };



function polygonArea2d(pts: SketchPoint[]): number {

  if (pts.length < 3) return 0;

  let area = 0;

  for (let i = 0; i < pts.length; i++) {

    const j = (i + 1) % pts.length;

    area += pts[i].x * pts[j].z - pts[j].x * pts[i].z;

  }

  return Math.abs(area / 2);

}



function polylineLength(pts: SketchPoint[]): number {

  let len = 0;

  for (let i = 1; i < pts.length; i++) {

    const dx = pts[i].x - pts[i - 1].x;

    const dz = pts[i].z - pts[i - 1].z;

    len += Math.sqrt(dx * dx + dz * dz);

  }

  return len;

}



export interface AreaMeasureComputed {

  areaM2: number;

  perimeterM: number;

  pointCount: number;

  source: 'client' | 'server';

}



export class AreaMeasureEngine {

  private viewer: Viewer;

  private meshes: SceneMesh[] = [];

  private materials: SceneMaterial[] = [];

  private ownedGeometries: SceneMesh[] = [];

  private completed: SketchPoint[][] = [];



  constructor(viewer: Viewer) {

    this.viewer = viewer;

  }



  destroy() {

    this.clear();

  }



  clear() {

    for (const m of this.meshes) {
      try {
        m.destroy();
      } catch {
        /* ignore */
      }
    }

    this.meshes = [];

    for (const mat of this.materials) {
      try {
        mat.destroy();
      } catch {
        /* ignore */
      }
    }

    this.materials = [];

    this.ownedGeometries = [];

    this.completed = [];

  }



  resetSession() {

    this.clear();

    this.viewer.scene.render();

  }



  sync(activePoints: SketchPoint[], floorY: number) {

    for (const m of this.meshes) {
      try {
        m.destroy();
      } catch {
        /* ignore */
      }
    }

    this.meshes = [];

    for (const mat of this.materials) {
      try {
        mat.destroy();
      } catch {
        /* ignore */
      }
    }

    this.materials = [];

    this.ownedGeometries = [];

    for (const poly of this.completed) {

      this.renderPolygon(poly, floorY, [0.2, 0.85, 0.55], 0.35);

    }

    if (activePoints.length >= 1) {

      this.renderPolygon(activePoints, floorY, [0.95, 0.75, 0.1], 0.45, true);

    }

    try {
      this.viewer.scene.render();
    } catch (err) {
      console.error('[AreaMeasureEngine] scene.render failed', err);
    }

  }



  pushCompleted(points: SketchPoint[]) {

    if (points.length >= 3) {

      this.completed.push(points.map((p) => ({ ...p })));

    }

  }



  async computeArea(points: SketchPoint[]): Promise<AreaMeasureComputed> {

    const verts: [number, number][] = points.map((p) => [p.x, p.z]);

    let areaM2 = polygonArea2d(points);

    let source: 'client' | 'server' = 'client';



    if (verts.length >= 3) {

      try {

        const r = await geometryExtensionsAPI.polygonArea(verts);

        if (Number.isFinite(r.area) && r.area > 0) {

          areaM2 = r.area;

          source = 'server';

        }

      } catch {

        /* client fallback */

      }

    }



    const closed = [...points, points[0]];

    return {

      areaM2,

      perimeterM: polylineLength(closed),

      pointCount: points.length,

      source,

    };

  }



  private createMaterial(cfg: ConstructorParameters<typeof PhongMaterial>[1]) {

    const mat = new PhongMaterial(this.viewer.scene, cfg);

    this.materials.push(mat);

    return mat;

  }



  private renderPolygon(

    points: SketchPoint[],

    floorY: number,

    color: [number, number, number],

    alpha: number,

    preview = false,

  ) {

    const scene = this.viewer.scene;



    if (points.length >= 3) {

      const fillGeom = buildPolygonFillGeometry(scene, points);

      if (fillGeom) {

        if (isOwnedPolygonGeometry(fillGeom)) {
          this.ownedGeometries.push(fillGeom);
        }

        const [cx, , cz] = polygonFillCenter(points);

        const mat = this.createMaterial({ diffuse: color, alpha, backfaces: true });

        const mesh = new Mesh(scene, {

          id: `${LAYER}-fill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,

          geometry: fillGeom,

          material: mat,

          position: [cx, floorY + 0.03, cz],

          rotation: [-Math.PI / 2, 0, 0],

          pickable: false,

        });

        this.meshes.push(mesh);

      }

    }



    const edgeMat = this.createMaterial({

      diffuse: color,

      alpha: Math.min(1, alpha + 0.35),

      backfaces: true,

    });



    const loop = preview && points.length >= 2 ? points : [...points, points[0]];

    for (let i = 0; i < loop.length - 1; i++) {

      const a = loop[i];

      const b = loop[i + 1];

      const dx = b.x - a.x;

      const dz = b.z - a.z;

      const len = Math.sqrt(dx * dx + dz * dz) || 0.01;

      const mesh = new Mesh(scene, {

        id: `${LAYER}-edge-${Date.now()}-${i}`,

        geometry: new ReadableGeometry(scene, buildBoxGeometry({ xSize: 0.1, ySize: 0.06, zSize: len })),

        material: edgeMat,

        position: [a.x + dx / 2, floorY + 0.06, a.z + dz / 2],

        rotation: [0, -Math.atan2(dx, dz), 0],

        pickable: false,

      });

      this.meshes.push(mesh);

    }



    for (const p of points) {

      const marker = new Mesh(scene, {

        id: `${LAYER}-pt-${Date.now()}-${p.x}`,

        geometry: new ReadableGeometry(scene, buildBoxGeometry({ xSize: 0.18, ySize: 0.18, zSize: 0.18 })),

        material: edgeMat,

        position: [p.x, floorY + 0.09, p.z],

        pickable: false,

      });

      this.meshes.push(marker);

    }

  }

}

