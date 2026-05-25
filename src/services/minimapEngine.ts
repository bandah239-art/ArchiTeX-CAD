import type { Viewer } from '@xeokit/xeokit-sdk';
import type { ViewerControls } from './viewerControls';

export interface MinimapBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface MinimapSitePoly {
  points: { x: number; z: number }[];
}

export class MinimapEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private viewer: Viewer;
  private getControls: () => ViewerControls | null;
  private getSiteBoundary: () => MinimapSitePoly | null;
  private bound = false;
  private cameraHandler: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    viewer: Viewer,
    getControls: () => ViewerControls | null,
    getSiteBoundary: () => MinimapSitePoly | null,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.viewer = viewer;
    this.getControls = getControls;
    this.getSiteBoundary = getSiteBoundary;
  }

  bind() {
    if (this.bound) return;
    this.bound = true;

    this.cameraHandler = () => this.render();
    this.viewer.camera.on('matrix', this.cameraHandler);

    this.resizeObserver = new ResizeObserver(() => this.render());
    this.resizeObserver.observe(this.canvas);

    this.canvas.addEventListener('click', this.onClick);
    this.render();
  }

  destroy() {
    this.resizeObserver?.disconnect();
    this.canvas.removeEventListener('click', this.onClick);
    this.cameraHandler = null;
    this.bound = false;
  }

  private onClick = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const bounds = this.worldBounds();
    if (!bounds) return;

    const { scale, offsetX, offsetY } = this.viewTransform(bounds, rect.width, rect.height);
    const worldX = (px - offsetX) / scale + bounds.minX;
    const worldZ = (py - offsetY) / scale + bounds.minZ;

    const cam = this.viewer.scene.camera;
    const lookY = cam.look[1];
    this.getControls()?.flyToWorldPoint([worldX, lookY, worldZ]);
    this.render();
  };

  render() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(rect.width, 1);
    const h = Math.max(rect.height, 1);
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bounds = this.worldBounds();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(8, 12, 24, 0.92)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    if (!bounds) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
      ctx.font = '10px system-ui,sans-serif';
      ctx.fillText('Minimap', 8, 16);
      return;
    }

    const { scale, offsetX, offsetY } = this.viewTransform(bounds, w, h);

    const toCanvas = (x: number, z: number) => ({
      x: offsetX + (x - bounds.minX) * scale,
      y: offsetY + (z - bounds.minZ) * scale,
    });

    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    const bl = toCanvas(bounds.minX, bounds.minZ);
    const tr = toCanvas(bounds.maxX, bounds.maxZ);
    ctx.fillRect(bl.x, bl.y, tr.x - bl.x, tr.y - bl.y);

    const site = this.getSiteBoundary();
    if (site && site.points.length >= 3) {
      ctx.beginPath();
      site.points.forEach((p, i) => {
        const c = toCanvas(p.x, p.z);
        if (i === 0) ctx.moveTo(c.x, c.y);
        else ctx.lineTo(c.x, c.y);
      });
      ctx.closePath();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    const cam = this.viewer.scene.camera;
    const eye = toCanvas(cam.eye[0], cam.eye[2]);
    const look = toCanvas(cam.look[0], cam.look[2]);

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(eye.x, eye.y);
    ctx.lineTo(look.x, look.y);
    ctx.stroke();

    ctx.fillStyle = 'rgba(248, 113, 113, 0.95)';
    ctx.beginPath();
    ctx.arc(look.x, look.y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(96, 165, 250, 0.7)';
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(bl.x, bl.y, tr.x - bl.x, tr.y - bl.y);
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
    ctx.font = '9px system-ui,sans-serif';
    ctx.fillText('MINIMAP · click to pan', 6, h - 6);
  }

  private worldBounds(): MinimapBounds | null {
    try {
      const ids = Object.keys(this.viewer.scene.objects).filter(
        (id) => !id.startsWith('measure') && !id.startsWith('geoOverlay') && !id.startsWith('sketchLayer-preview'),
      );
      if (!ids.length) return null;
      const aabb = this.viewer.scene.getAABB(ids);
      if (!aabb || aabb.length < 6) return null;
      const pad = Math.max((aabb[3] - aabb[0]) * 0.08, 2);
      return {
        minX: aabb[0] - pad,
        maxX: aabb[3] + pad,
        minZ: aabb[2] - pad,
        maxZ: aabb[5] + pad,
      };
    } catch {
      return null;
    }
  }

  private viewTransform(bounds: MinimapBounds, w: number, h: number) {
    const spanX = Math.max(bounds.maxX - bounds.minX, 1);
    const spanZ = Math.max(bounds.maxZ - bounds.minZ, 1);
    const pad = 10;
    const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanZ);
    const offsetX = (w - spanX * scale) / 2;
    const offsetY = (h - spanZ * scale) / 2;
    return { scale, offsetX, offsetY };
  }
}
