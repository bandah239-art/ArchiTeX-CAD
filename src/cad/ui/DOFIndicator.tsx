import { useEffect, useState, useRef } from 'react';
import { useViewerStore } from '../../store/viewerStore';
import { useDrawStore } from '../../store/drawStore';
import { useSketchConstraintStore } from '../../store/sketchConstraintStore';

export function DOFIndicator() {
  const { viewerControls } = useViewerStore();
  const { elements, floorElevation } = useDrawStore();
  const { dofAnalysis } = useSketchConstraintStore();
  const [positions, setPositions] = useState<{ id: string; x: number; y: number; dof: number }[]>([]);

  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    if (!viewerControls?.viewer) return;
    const camera = viewerControls.viewer.camera as any;
    const canvas = document.getElementById('bimCanvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    const updateProjectedPositions = () => {
      const newPos = elements.map(el => {
        // Calculate 2D center point of the element
        let wx = 0;
        let wz = 0;
        if (el.kind === 'circle' && el.points.length >= 1) {
          wx = el.points[0].x;
          wz = el.points[0].z;
        } else if (el.kind === 'arc' && el.points.length >= 1) {
          wx = el.points[0].x;
          wz = el.points[0].z;
        } else if (el.kind === 'point' && el.points.length >= 1) {
          wx = el.points[0].x;
          wz = el.points[0].z;
        } else if (el.points.length >= 2) {
          wx = (el.points[0].x + el.points[el.points.length - 1].x) / 2;
          wz = (el.points[0].z + el.points[el.points.length - 1].z) / 2;
        }

        const worldPos = [wx, floorElevation, wz];
        const screenPos = [0, 0, 0];
        camera.project(worldPos, screenPos);

        const dof = dofAnalysis?.perEntity.get(el.id) ?? (el.kind === 'point' ? 2 : 4);

        return {
          id: el.id,
          x: screenPos[0],
          y: screenPos[1],
          dof
        };
      });

      setPositions(newPos);
      requestRef.current = requestAnimationFrame(updateProjectedPositions);
    };

    requestRef.current = requestAnimationFrame(updateProjectedPositions);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [viewerControls, elements, floorElevation, dofAnalysis]);

  if (!viewerControls || positions.length === 0) return null;

  return (
    <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
      {positions.map((pos) => {
        let badgeColor = 'bg-amber-500 text-white';
        let badgeContent = pos.dof.toString();

        if (pos.dof === 0) {
          badgeColor = 'bg-emerald-500 text-white';
          badgeContent = '🔒';
        } else if (pos.dof < 0) {
          badgeColor = 'bg-red-500 text-white font-bold';
          badgeContent = '✕';
        }

        // Render relative to the parent container of the canvas
        return (
          <div
            key={pos.id}
            className={`absolute flex items-center justify-center w-5 h-5 rounded-full text-[10px] shadow-lg border border-slate-900 pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 cursor-default font-semibold ${badgeColor}`}
            style={{
              left: pos.x,
              top: pos.y,
            }}
            title={`Entity ${pos.id}: ${pos.dof} degrees of freedom`}
          >
            {badgeContent}
          </div>
        );
      })}
    </div>
  );
}
