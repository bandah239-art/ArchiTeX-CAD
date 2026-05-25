import type { Viewer } from '@xeokit/xeokit-sdk';
import { Mesh, PhongMaterial, buildBoxGeometry, buildPlaneGeometry, ReadableGeometry } from '@xeokit/xeokit-sdk';
import { useDrawStore } from '../store/drawStore';
import { useGeoStore } from '../store/geoStore';
import { useViewerStore } from '../store/viewerStore';
import {
  buildOverlayData,
  type ContourLine,
  type ElevationGrid,
  type FloodGrid,
  type GeoOverlayInput,
  type SiteBounds,
} from './geoOverlayUtils';

const LAYER = 'geoOverlay';

type SceneMesh = { destroy: () => void };

function elevationColor(elev: number, min: number, max: number): [number, number, number] {
  const t = max > min ? (elev - min) / (max - min) : 0.5;
  return [0.15 + t * 0.35, 0.55 - t * 0.15, 0.25 + t * 0.1];
}

export class GeoOverlayEngine {
  private viewer: Viewer;
  private meshes: SceneMesh[] = [];

  constructor(viewer: Viewer) {
    this.viewer = viewer;
  }

  sync(input: GeoOverlayInput) {
    this.clear();
    const { bounds, contours, grid, flood } = buildOverlayData(input);

    if (grid) this.renderTerrainHeatmap(grid, bounds);
    if (contours.length) this.renderContours(contours);
    if (flood) this.renderFlood(flood, bounds);

    this.viewer.scene.render();
  }

  clear() {
    for (const m of this.meshes) m.destroy();
    this.meshes = [];
  }

  destroy() {
    this.clear();
  }

  private renderTerrainHeatmap(grid: ElevationGrid, bounds: SiteBounds) {
    const scene = this.viewer.scene;
    const flat = grid.values.flat();
    const min = Math.min(...flat);
    const max = Math.max(...flat);
    const mean = flat.reduce((a, b) => a + b, 0) / flat.length;

    const mat = new PhongMaterial(scene, {
      diffuse: elevationColor(mean, min, max),
      alpha: 0.22,
      backfaces: true,
    });

    const mesh = new Mesh(scene, {
      id: `${LAYER}-terrain-base`,
      geometry: new ReadableGeometry(scene, buildPlaneGeometry({ xSize: bounds.spanX, zSize: bounds.spanZ })),
      material: mat,
      position: [bounds.centerX, bounds.floorY + 0.02, bounds.centerZ],
      rotation: [-Math.PI / 2, 0, 0],
      pickable: false,
    });
    this.meshes.push(mesh);
  }

  private renderContours(contours: ContourLine[]) {
    const scene = this.viewer.scene;
    let segIdx = 0;

    for (const line of contours) {
      const mat = new PhongMaterial(scene, {
        diffuse: [0.95, 0.75, 0.15],
        alpha: 0.9,
        backfaces: true,
      });

      for (let i = 0; i + 1 < line.points.length; i += 2) {
        const a = line.points[i];
        const b = line.points[i + 1];
        if (!b) continue;

        const dx = b[0] - a[0];
        const dz = b[2] - a[2];
        const len = Math.sqrt(dx * dx + dz * dz) || 0.01;

        const mesh = new Mesh(scene, {
          id: `${LAYER}-contour-${segIdx++}`,
          geometry: new ReadableGeometry(scene, buildBoxGeometry({ xSize: 0.06, ySize: 0.04, zSize: len })),
          material: mat,
          position: [a[0] + dx / 2, a[1], a[2] + dz / 2],
          rotation: [0, -Math.atan2(dx, dz), 0],
          pickable: false,
        });
        this.meshes.push(mesh);
      }
    }
  }

  private renderFlood(flood: FloodGrid, bounds: SiteBounds) {
    const scene = this.viewer.scene;
    const rows = flood.depths.length;
    const cols = flood.depths[0]?.length ?? 0;
    let cellIdx = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const depth = flood.depths[r][c];
        if (depth < 0.02) continue;

        const x = flood.originX + (c + 0.5) * flood.cellSizeM;
        const z = flood.originZ + (r + 0.5) * flood.cellSizeM;
        if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) continue;

        const alpha = Math.min(0.65, 0.25 + depth * 0.35);
        const mat = new PhongMaterial(scene, {
          diffuse: [0.15, 0.45, 0.95],
          alpha,
          backfaces: true,
        });

        const mesh = new Mesh(scene, {
          id: `${LAYER}-flood-${cellIdx++}`,
          geometry: new ReadableGeometry(scene, buildBoxGeometry({
            xSize: flood.cellSizeM * 0.92,
            ySize: Math.max(depth, 0.05),
            zSize: flood.cellSizeM * 0.92,
          })),
          material: mat,
          position: [x, bounds.floorY + depth / 2, z],
          pickable: false,
        });
        this.meshes.push(mesh);
      }
    }
  }
}

/** Push latest geo store data into the viewer overlay layer. */
export function syncGeoOverlaysToViewer(
  terrain: Record<string, unknown> | null,
  flood: Record<string, unknown> | null,
  opts?: { floorY?: number; platformAreaM2?: number; showContours?: boolean; showFlood?: boolean; showTerrain?: boolean },
) {
  const vc = useViewerStore.getState().viewerControls;
  if (!vc?.syncGeoOverlays) return;
  const floorY = opts?.floorY ?? useDrawStore.getState().floorElevation;
  const platformAreaM2 = opts?.platformAreaM2 ?? useGeoStore.getState().platformAreaM2;
  vc.syncGeoOverlays({
    terrain,
    flood,
    floorY,
    platformAreaM2,
    showContours: opts?.showContours,
    showFlood: opts?.showFlood,
    showTerrain: opts?.showTerrain,
  });
}

export type { GeoOverlayInput };
