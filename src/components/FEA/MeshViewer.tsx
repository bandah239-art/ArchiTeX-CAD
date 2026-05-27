import { useEffect, useRef, useState } from 'react';

interface Node {
  id: number;
  x: number;
  y: number;
}

interface Element {
  id: number;
  node_i: number;
  node_j: number;
}

interface Displacement {
  node_id: number;
  ux: number;
  uy: number;
}

interface ElementResult {
  element_id: number;
  x_points: number[];
  moments: number[];
  shears: number[];
}

type Overlay = 'none' | 'bmd' | 'sfd';

export function MeshViewer({
  nodes,
  elements,
  displacements,
  elementResults,
  scale = 100,
}: {
  nodes: Node[];
  elements: Element[];
  displacements?: Displacement[];
  elementResults?: ElementResult[];
  scale?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [overlay, setOverlay] = useState<Overlay>('none');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const pad = 50;
    const width = canvas.width - pad * 2;
    const height = canvas.height - pad * 2;
    const modelW = Math.max(maxX - minX, 1);
    const modelH = Math.max(maxY - minY, 1);
    const scaleFactor = Math.min(width / modelW, height / modelH);

    const transformX = (x: number) => pad + (x - minX) * scaleFactor;
    const transformY = (y: number) => canvas.height - pad - (y - minY) * scaleFactor;

    // Undeformed mesh
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1;
    ctx.beginPath();
    elements.forEach((el) => {
      const n1 = nodes.find((n) => n.id === el.node_i);
      const n2 = nodes.find((n) => n.id === el.node_j);
      if (n1 && n2) {
        ctx.moveTo(transformX(n1.x), transformY(n1.y));
        ctx.lineTo(transformX(n2.x), transformY(n2.y));
      }
    });
    ctx.stroke();

    // Node dots
    nodes.forEach((n) => {
      ctx.beginPath();
      ctx.arc(transformX(n.x), transformY(n.y), 3, 0, Math.PI * 2);
      ctx.fillStyle = '#6b7280';
      ctx.fill();
    });

    // Deformed shape
    if (displacements && displacements.length > 0) {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      elements.forEach((el) => {
        const n1 = nodes.find((n) => n.id === el.node_i);
        const n2 = nodes.find((n) => n.id === el.node_j);
        const d1 = displacements.find((d) => d.node_id === el.node_i);
        const d2 = displacements.find((d) => d.node_id === el.node_j);
        if (n1 && n2 && d1 && d2) {
          ctx.moveTo(transformX(n1.x + d1.ux * scale), transformY(n1.y + d1.uy * scale));
          ctx.lineTo(transformX(n2.x + d2.ux * scale), transformY(n2.y + d2.uy * scale));
        }
      });
      ctx.stroke();
    }

    // BMD / SFD overlay
    if (overlay !== 'none' && elementResults && elementResults.length > 0) {
      const allVals = elementResults.flatMap((er) =>
        (overlay === 'bmd' ? er.moments : er.shears).map(Math.abs)
      );
      const maxVal = Math.max(...allVals, 1);
      const modelSize = Math.max(modelW, modelH);
      const diagScale = (modelSize * 0.28 * scaleFactor) / maxVal;

      const lineColor = overlay === 'bmd' ? '#fb923c' : '#60a5fa';
      const fillColor = overlay === 'bmd' ? 'rgba(251,146,60,0.13)' : 'rgba(96,165,250,0.13)';

      elements.forEach((el) => {
        const er = elementResults.find((r) => r.element_id === el.id);
        const n1 = nodes.find((n) => n.id === el.node_i);
        const n2 = nodes.find((n) => n.id === el.node_j);
        if (!er || !n1 || !n2) return;

        const vals = overlay === 'bmd' ? er.moments : er.shears;
        const structL = Math.sqrt((n2.x - n1.x) ** 2 + (n2.y - n1.y) ** 2);
        if (structL < 1e-6) return;

        const cx1 = transformX(n1.x), cy1 = transformY(n1.y);
        const cx2 = transformX(n2.x), cy2 = transformY(n2.y);
        const cLen = Math.sqrt((cx2 - cx1) ** 2 + (cy2 - cy1) ** 2);
        if (cLen < 1) return;

        // Canvas unit tangent and perpendicular normal
        const ctX = (cx2 - cx1) / cLen, ctY = (cy2 - cy1) / cLen;
        const cnX = -ctY, cnY = ctX;

        const outerPts: [number, number][] = er.x_points.map((xp, i) => {
          const t = xp / structL;
          const ptX = cx1 + t * (cx2 - cx1);
          const ptY = cy1 + t * (cy2 - cy1);
          return [ptX + cnX * vals[i] * diagScale, ptY + cnY * vals[i] * diagScale];
        });

        // Filled area
        ctx.beginPath();
        ctx.moveTo(cx1, cy1);
        outerPts.forEach(([px, py]) => ctx.lineTo(px, py));
        ctx.lineTo(cx2, cy2);
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();

        // Curve
        ctx.beginPath();
        outerPts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Baseline tick lines at ends
        ctx.beginPath();
        ctx.moveTo(cx1, cy1); ctx.lineTo(outerPts[0][0], outerPts[0][1]);
        ctx.moveTo(cx2, cy2); ctx.lineTo(outerPts[outerPts.length - 1][0], outerPts[outerPts.length - 1][1]);
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Peak label
        const maxIdx = vals.reduce((best, v, i) => (Math.abs(v) > Math.abs(vals[best]) ? i : best), 0);
        const [lx, ly] = outerPts[maxIdx];
        const label =
          overlay === 'bmd'
            ? `${(vals[maxIdx] / 1000).toFixed(1)} kNm`
            : `${(vals[maxIdx] / 1000).toFixed(1)} kN`;
        ctx.fillStyle = lineColor;
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, lx + cnX * 12, ly + cnY * 12);
      });
    }

    // Node IDs
    ctx.fillStyle = '#9ca3af';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    nodes.forEach((n) => {
      ctx.fillText(String(n.id), transformX(n.x) + 8, transformY(n.y) - 8);
    });
  }, [nodes, elements, displacements, elementResults, scale, overlay]);

  const hasResults = elementResults && elementResults.length > 0;

  return (
    <div className="border border-infra-accent/30 rounded p-2 bg-infra-darker">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xs text-gray-400 font-bold uppercase">FEA Mesh Viewer</h3>
        {hasResults && (
          <div className="flex gap-1">
            {(['none', 'bmd', 'sfd'] as Overlay[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setOverlay(mode)}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                  overlay === mode
                    ? mode === 'bmd'
                      ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                      : mode === 'sfd'
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                      : 'bg-gray-700 text-gray-200 border-gray-600'
                    : 'text-gray-500 border-gray-700 hover:text-gray-300 hover:border-gray-600'
                }`}
              >
                {mode === 'none' ? 'Mesh' : mode.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>
      <canvas ref={canvasRef} width={600} height={400} className="w-full h-auto bg-black rounded" />
      {hasResults && overlay !== 'none' && (
        <div className="mt-1 flex gap-3 text-[10px]">
          <span className={overlay === 'bmd' ? 'text-orange-400' : 'text-blue-400'}>
            {overlay === 'bmd' ? '● Bending Moment Diagram (kNm)' : '● Shear Force Diagram (kN)'}
          </span>
          <span className="text-gray-500">— dashed: undeformed  — solid green: deformed</span>
        </div>
      )}
    </div>
  );
}
