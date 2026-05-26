import { useEffect, useRef } from 'react';

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

export function MeshViewer({
  nodes,
  elements,
  displacements,
  scale = 100, // Disp scale
}: {
  nodes: Node[];
  elements: Element[];
  displacements?: Displacement[];
  scale?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Auto-center bounds
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
    const transformY = (y: number) => canvas.height - pad - (y - minY) * scaleFactor; // flip Y

    // Draw undeformed elements (gray)
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

    // Draw deformed elements (green) if displacements exist
    if (displacements && displacements.length > 0) {
      ctx.strokeStyle = '#10b981'; // infra-highlight
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
  }, [nodes, elements, displacements, scale]);

  return (
    <div className="border border-infra-accent/30 rounded p-2 bg-infra-darker">
      <h3 className="text-xs text-gray-400 mb-2 font-bold uppercase">FEA Mesh Viewer</h3>
      <canvas ref={canvasRef} width={600} height={400} className="w-full h-auto bg-black rounded" />
    </div>
  );
}
