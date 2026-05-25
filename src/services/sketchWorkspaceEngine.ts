import type { Viewer } from '@xeokit/xeokit-sdk';
import { Mesh, PhongMaterial, buildBoxGeometry, buildGridGeometry, buildPlaneGeometry, ReadableGeometry } from '@xeokit/xeokit-sdk';
import { SKETCH_FLOOR_PLANE_ID } from './sketchGeometry';

const PREFIX = 'sketchWorkspace';

export interface SketchWorkspaceConfig {
  floorY: number;
  centerX: number;
  centerZ: number;
  span: number;
  gridSnap: number;
  visible: boolean;
  /** When true, only the pickable floor plane is shown (area measure, etc.). */
  pickFloorOnly?: boolean;
}

type SceneMesh = { destroy: () => void };

export class SketchWorkspaceEngine {
  private viewer: Viewer;
  private meshes: SceneMesh[] = [];
  private visible = false;
  private config: SketchWorkspaceConfig | null = null;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
  }

  destroy() {
    this.clear();
  }

  sync(config: SketchWorkspaceConfig) {
    this.config = config;
    if (!config.visible) {
      this.clear();
      this.visible = false;
      return;
    }
    this.visible = true;
    this.rebuild(config);
  }

  private clear() {
    for (const m of this.meshes) m.destroy();
    this.meshes = [];
    const floor = this.viewer.scene.objects[SKETCH_FLOOR_PLANE_ID];
    if (floor) floor.destroy();
    for (const id of Object.keys(this.viewer.scene.objects)) {
      if (id.startsWith(`${PREFIX}-`) && id !== SKETCH_FLOOR_PLANE_ID) {
        this.viewer.scene.objects[id]?.destroy?.();
      }
    }
  }

  private rebuild(cfg: SketchWorkspaceConfig) {
    this.clear();
    const scene = this.viewer.scene;
    const size = Math.max(cfg.span * 2.5, 100);
    const divisions = Math.min(100, Math.max(12, Math.round(size / Math.max(cfg.gridSnap, 0.5))));

    // Nearly invisible — pick target only (avoids blue wash in plan / ortho view).
    const floorMat = new PhongMaterial(scene, {
      diffuse: [0.22, 0.28, 0.38],
      emissive: [0, 0, 0],
      alpha: 0.008,
      backfaces: true,
    });
    const floor = new Mesh(scene, {
      id: SKETCH_FLOOR_PLANE_ID,
      geometry: new ReadableGeometry(scene, buildPlaneGeometry({ xSize: size, zSize: size })),
      material: floorMat,
      position: [cfg.centerX, cfg.floorY + 0.01, cfg.centerZ],
      rotation: [-Math.PI / 2, 0, 0],
      pickable: true,
    });
    this.meshes.push(floor);

    if (cfg.pickFloorOnly) {
      this.viewer.scene.render();
      return;
    }

    const gridMat = new PhongMaterial(scene, {
      diffuse: [0.7, 0.78, 0.88],
      emissive: [0.45, 0.5, 0.58],
      alpha: 1,
      backfaces: true,
    });
    const grid = new Mesh(scene, {
      id: `${PREFIX}-grid`,
      geometry: new ReadableGeometry(scene, buildGridGeometry({ size, divisions })),
      material: gridMat,
      position: [cfg.centerX, cfg.floorY + 0.04, cfg.centerZ],
      pickable: false,
    });
    this.meshes.push(grid);

    const axisLen = Math.min(size * 0.5, 60);
    const axisY = cfg.floorY + 0.05;
    const xMat = new PhongMaterial(scene, {
      diffuse: [1, 0.35, 0.35],
      emissive: [0.6, 0.1, 0.1],
      alpha: 1,
      backfaces: true,
    });
    const zMat = new PhongMaterial(scene, {
      diffuse: [0.35, 0.55, 1],
      emissive: [0.1, 0.2, 0.55],
      alpha: 1,
      backfaces: true,
    });
    const originMat = new PhongMaterial(scene, {
      diffuse: [1, 0.9, 0.2],
      emissive: [0.5, 0.45, 0.05],
      alpha: 1,
      backfaces: true,
    });

    const axisX = new Mesh(scene, {
      id: `${PREFIX}-axisX`,
      geometry: new ReadableGeometry(scene, buildBoxGeometry({ xSize: axisLen, ySize: 0.12, zSize: 0.12 })),
      material: xMat,
      position: [cfg.centerX + axisLen / 2, axisY, cfg.centerZ],
      pickable: false,
    });
    const axisZ = new Mesh(scene, {
      id: `${PREFIX}-axisZ`,
      geometry: new ReadableGeometry(scene, buildBoxGeometry({ xSize: 0.12, ySize: 0.12, zSize: axisLen })),
      material: zMat,
      position: [cfg.centerX, axisY, cfg.centerZ + axisLen / 2],
      pickable: false,
    });
    const origin = new Mesh(scene, {
      id: `${PREFIX}-origin`,
      geometry: new ReadableGeometry(scene, buildBoxGeometry({ xSize: 0.5, ySize: 0.2, zSize: 0.5 })),
      material: originMat,
      position: [cfg.centerX, axisY + 0.06, cfg.centerZ],
      pickable: false,
    });
    this.meshes.push(axisX, axisZ, origin);

    this.viewer.scene.render();
  }

  isVisible() {
    return this.visible;
  }

  getConfig() {
    return this.config;
  }
}
