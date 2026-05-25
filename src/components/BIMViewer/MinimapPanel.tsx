import { useEffect, useRef } from 'react';
import type { Viewer } from '@xeokit/xeokit-sdk';
import { useViewerStore } from '../../store/viewerStore';
import { useDrawStore } from '../../store/drawStore';
import { MinimapEngine } from '../../services/minimapEngine';

interface MinimapPanelProps {
  viewer: Viewer | null;
}

export function MinimapPanel({ viewer }: MinimapPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<MinimapEngine | null>(null);
  const { viewerControls, minimapVisible } = useViewerStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !viewer || !minimapVisible) return;

    const engine = new MinimapEngine(
      canvas,
      viewer,
      () => useViewerStore.getState().viewerControls,
      () => {
        const el = useDrawStore.getState().elements.find((e) => e.kind === 'site-boundary');
        if (!el || el.points.length < 3) return null;
        return { points: el.points.map((p) => ({ x: p.x, z: p.z })) };
      },
    );
    engineRef.current = engine;
    engine.bind();

    const tick = () => engine.render();
    const id = window.setInterval(tick, 500);

    return () => {
      window.clearInterval(id);
      engine.destroy();
      engineRef.current = null;
    };
  }, [viewer, minimapVisible, viewerControls]);

  if (!minimapVisible) return null;

  return (
    <canvas
      ref={canvasRef}
      id="minimapCanvas"
      className="absolute bottom-3 left-3 w-44 h-36 rounded-md border border-sky-500/30 pointer-events-auto cursor-crosshair shadow-lg"
      style={{ zIndex: 12, background: 'rgba(8,12,24,0.92)' }}
      title="Click to pan camera target"
    />
  );
}
