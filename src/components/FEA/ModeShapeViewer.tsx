import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../../services/apiConfig';

interface NodeShape {
  node_id: number;
  ux: number;
  uy: number;
  rz: number;
}

interface Mode {
  mode: number;
  omega_rad_s: number;
  freq_hz: number;
  period_s: number;
  modal_mass_kg: number;
  participation_x: number;
  participation_y: number;
  effective_mass_x_kg: number;
  effective_mass_y_kg: number;
  mass_participation_x_pct: number;
  mass_participation_y_pct: number;
  shape: NodeShape[];
}

interface ModalResult {
  status: string;
  n_modes: number;
  modes: Mode[];
  total_mass_x_kg: number;
  total_mass_y_kg: number;
  cumulative_mass_participation_x_pct: number;
}

interface Node { id: number; x: number; y: number; }
interface Element { id: number; node_i: number; node_j: number; }

interface ModeShapeViewerProps {
  inputs: Record<string, unknown>;
}

const CANVAS_W = 520;
const CANVAS_H = 300;
const PAD = 40;

function worldToCanvas(
  wx: number, wy: number,
  minX: number, maxX: number, minY: number, maxY: number,
): [number, number] {
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const scaleX = (CANVAS_W - 2 * PAD) / rangeX;
  const scaleY = (CANVAS_H - 2 * PAD) / rangeY;
  const scale = Math.min(scaleX, scaleY);
  const cx = PAD + (wx - minX) * scale;
  const cy = CANVAS_H - PAD - (wy - minY) * scale;
  return [cx, cy];
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  nodes: Node[],
  elements: Element[],
  shapeNodes: NodeShape[] | null,
  amplitude: number,
  minX: number, maxX: number, minY: number, maxY: number,
) {
  const toCanvas = (wx: number, wy: number) =>
    worldToCanvas(wx, wy, minX, maxX, minY, maxY);

  // Undeformed frame
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  for (const el of elements) {
    const ni = nodes.find((n) => n.id === el.node_i)!;
    const nj = nodes.find((n) => n.id === el.node_j)!;
    const [x1, y1] = toCanvas(ni.x, ni.y);
    const [x2, y2] = toCanvas(nj.x, nj.y);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  if (!shapeNodes) return;

  // Build deformed node positions
  const deformed: Record<number, { x: number; y: number }> = {};
  for (const nd of nodes) {
    const shape = shapeNodes.find((s) => s.node_id === nd.id);
    if (shape) {
      deformed[nd.id] = { x: nd.x + shape.ux * amplitude, y: nd.y + shape.uy * amplitude };
    } else {
      deformed[nd.id] = { x: nd.x, y: nd.y };
    }
  }

  // Deformed frame
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  for (const el of elements) {
    const di = deformed[el.node_i];
    const dj = deformed[el.node_j];
    const [x1, y1] = toCanvas(di.x, di.y);
    const [x2, y2] = toCanvas(dj.x, dj.y);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Nodes
  for (const nd of nodes) {
    const d = deformed[nd.id];
    const [cx, cy] = toCanvas(d.x, d.y);
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

export function ModeShapeViewer({ inputs }: ModeShapeViewerProps) {
  const [result, setResult] = useState<ModalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState(0);
  const [animT, setAnimT] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  async function runModal() {
    setLoading(true);
    setError(null);
    try {
      const body = {
        height: Number(inputs.height ?? 4),
        span: Number(inputs.span ?? 6),
        support_type: inputs.support_type ?? 'fixed',
        E: Number(inputs.E ?? 2e11),
        A: Number(inputs.A ?? 0.01),
        I: Number(inputs.I ?? 1e-5),
        rho: Number(inputs.rho ?? 7850),
        n_modes: 6,
      };
      const res = await fetch(`${API_BASE}/fea/modal-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: ModalResult = await res.json();
      setResult(data);
      setSelectedMode(0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  // Animation loop
  useEffect(() => {
    let t = 0;
    function tick() {
      t += 0.04;
      setAnimT(t);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Draw on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const height = Number(inputs.height ?? 4);
    const span = Number(inputs.span ?? 6);
    const nodes: Node[] = [
      { id: 1, x: 0, y: 0 }, { id: 2, x: 0, y: height },
      { id: 3, x: span, y: height }, { id: 4, x: span, y: 0 },
    ];
    const elements: Element[] = [
      { id: 1, node_i: 1, node_j: 2 }, { id: 2, node_i: 2, node_j: 3 },
      { id: 3, node_i: 3, node_j: 4 },
    ];

    // Compute bounds with deformation headroom
    const mode = result?.modes[selectedMode] ?? null;
    let maxDisp = 0;
    if (mode) {
      for (const s of mode.shape) {
        maxDisp = Math.max(maxDisp, Math.abs(s.ux), Math.abs(s.uy));
      }
    }
    const amplitude = maxDisp > 1e-10
      ? (Math.min(height, span) * 0.35) / maxDisp * Math.sin(animT)
      : 0;

    const margin = Math.min(height, span) * 0.5;
    drawFrame(
      ctx, nodes, elements,
      mode ? mode.shape : null,
      amplitude,
      -margin, span + margin, -margin, height + margin,
    );

    // Labels
    if (mode) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px monospace';
      ctx.fillText(
        `Mode ${mode.mode}  f = ${mode.freq_hz} Hz  T = ${mode.period_s} s`,
        PAD, 20,
      );
    }
  }, [result, selectedMode, animT, inputs]);

  return (
    <div className="flex flex-col space-y-3 mt-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-infra-highlight font-bold uppercase tracking-wider">Modal Analysis</span>
        <button
          type="button"
          onClick={runModal}
          disabled={loading}
          className="px-3 py-1 bg-infra-highlight text-white text-xs font-bold rounded uppercase tracking-wider hover:bg-infra-highlight/80 disabled:opacity-50"
        >
          {loading ? 'COMPUTING...' : 'RUN MODAL'}
        </button>
      </div>

      {error && (
        <div className="p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">
          {error}
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="w-full rounded border border-infra-accent/30"
        style={{ imageRendering: 'pixelated' }}
      />

      {result && (
        <>
          {/* Mode selector */}
          <div className="flex flex-wrap gap-1">
            {result.modes.map((m, i) => (
              <button
                key={m.mode}
                type="button"
                onClick={() => setSelectedMode(i)}
                className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                  selectedMode === i
                    ? 'bg-infra-highlight text-white border-infra-highlight'
                    : 'border-infra-accent/40 text-gray-400 hover:border-infra-highlight/50'
                }`}
              >
                Mode {m.mode}
              </button>
            ))}
          </div>

          {/* Participation table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-infra-accent/30 text-gray-400">
                  <th className="py-1 pr-3 text-left">Mode</th>
                  <th className="py-1 pr-3 text-right">f (Hz)</th>
                  <th className="py-1 pr-3 text-right">T (s)</th>
                  <th className="py-1 pr-3 text-right">Γx</th>
                  <th className="py-1 pr-3 text-right">Γy</th>
                  <th className="py-1 pr-3 text-right">MPF-x (%)</th>
                  <th className="py-1 text-right">MPF-y (%)</th>
                </tr>
              </thead>
              <tbody>
                {result.modes.map((m, i) => (
                  <tr
                    key={m.mode}
                    onClick={() => setSelectedMode(i)}
                    className={`border-b border-infra-accent/20 cursor-pointer transition-colors ${
                      selectedMode === i ? 'text-infra-highlight bg-infra-highlight/10' : 'text-gray-300 hover:bg-infra-accent/10'
                    }`}
                  >
                    <td className="py-1 pr-3">{m.mode}</td>
                    <td className="py-1 pr-3 text-right font-mono">{m.freq_hz.toFixed(3)}</td>
                    <td className="py-1 pr-3 text-right font-mono">
                      {isFinite(m.period_s) ? m.period_s.toFixed(3) : '∞'}
                    </td>
                    <td className="py-1 pr-3 text-right font-mono">{m.participation_x.toFixed(3)}</td>
                    <td className="py-1 pr-3 text-right font-mono">{m.participation_y.toFixed(3)}</td>
                    <td className="py-1 pr-3 text-right font-mono">{m.mass_participation_x_pct.toFixed(1)}</td>
                    <td className="py-1 text-right font-mono">{m.mass_participation_y_pct.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-gray-500">
            Cumulative X mass participation: {result.cumulative_mass_participation_x_pct.toFixed(1)}% &nbsp;|&nbsp;
            Total mass: {(result.total_mass_x_kg / 1000).toFixed(2)} t
          </div>
        </>
      )}
    </div>
  );
}
