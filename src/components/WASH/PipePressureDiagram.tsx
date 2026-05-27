import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../../services/apiConfig';

interface PressurePoint {
  distance_m: number;
  pressure_head_m: number;
  velocity_mps: number;
}

interface Summary {
  pipe_diameter_mm: number;
  velocity_mps: number;
  hf_total_m: number;
  head_at_source_m: number;
  material: string;
  C_value: number;
  L_m: number;
}

interface Props {
  flow_rate_lps?: number;
  pipe_length_m?: number;
  pipe_material?: string;
  max_velocity_mps?: number;
  min_pressure_m?: number;
}

const W = 520, H = 220;
const PAD = { top: 24, right: 60, bottom: 38, left: 52 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

export function PipePressureDiagram({
  flow_rate_lps = 25,
  pipe_length_m = 500,
  pipe_material = 'HDPE',
  max_velocity_mps = 1.5,
  min_pressure_m = 10,
}: Props) {
  const [points, setPoints] = useState<PressurePoint[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hover, setHover] = useState<PressurePoint | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);

    fetch(`${API_BASE}/wash/simulation/pipe-pressure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flow_rate_lps, pipe_length_m, pipe_material, max_velocity_mps, min_pressure_m }),
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 'ok') {
          setPoints(d.points as PressurePoint[]);
          setSummary(d.summary as Summary);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [flow_rate_lps, pipe_length_m, pipe_material, max_velocity_mps, min_pressure_m]);

  if (!points.length || !summary)
    return (
      <div className="h-[220px] flex items-center justify-center text-gray-500 text-xs">
        {loading ? 'Computing pressure profile…' : 'No data'}
      </div>
    );

  const maxH = summary.head_at_source_m * 1.05;
  const minH = Math.max(0, min_pressure_m * 0.5);

  const px = (d: number) => PAD.left + (d / summary.L_m) * PLOT_W;
  const py = (h: number) => PAD.top + ((maxH - h) / (maxH - minH)) * PLOT_H;

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.distance_m).toFixed(1)},${py(p.pressure_head_m).toFixed(1)}`)
    .join(' ');

  const areaPath =
    `M${px(0)},${py(minH)} ` +
    points.map((p) => `L${px(p.distance_m).toFixed(1)},${py(p.pressure_head_m).toFixed(1)}`).join(' ') +
    ` L${px(summary.L_m)},${py(minH)} Z`;

  // Minimum pressure marker line
  const minPy = py(min_pressure_m);

  // Pipe drawing at bottom of chart
  const PIPE_Y = H - PAD.bottom + 10;
  const pipeColor = pipe_material === 'HDPE' ? '#065f46' : pipe_material === 'PVC' ? '#1e3a5f' : '#3f3f46';

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map((f) => {
    const v = minH + (maxH - minH) * f;
    return { v, y: py(v), label: v.toFixed(0) };
  });

  // X-axis ticks
  const xTicks = [0, 0.25, 0.5, 0.75, 1.0].map((f) => ({
    d: f * summary.L_m,
    x: px(f * summary.L_m),
    label: `${(f * summary.L_m).toFixed(0)}`,
  }));

  return (
    <div className="space-y-2">
      <svg
        width={W}
        height={H}
        className="w-full max-w-full"
        viewBox={`0 0 ${W} ${H}`}
        style={{ background: '#111827', borderRadius: 6 }}
      >
        {/* Grid */}
        {yTicks.map((t) => (
          <line key={t.v} x1={PAD.left} x2={W - PAD.right} y1={t.y} y2={t.y} stroke="#1f2937" strokeWidth={0.6} />
        ))}
        {xTicks.map((t) => (
          <line key={t.d} x1={t.x} x2={t.x} y1={PAD.top} y2={H - PAD.bottom} stroke="#1f2937" strokeWidth={0.5} />
        ))}

        {/* Hydraulic Grade Line fill */}
        <path d={areaPath} fill="#3b82f6" opacity={0.12} />
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth={2.2} />

        {/* Minimum pressure dashed line */}
        <line x1={PAD.left} x2={W - PAD.right} y1={minPy} y2={minPy} stroke="#ef4444" strokeWidth={1} strokeDasharray="4,3" />
        <text x={W - PAD.right + 3} y={minPy + 3} fill="#ef4444" fontSize={7}>min {min_pressure_m}m</text>

        {/* Pipe cross-section at bottom */}
        <rect x={PAD.left} y={PIPE_Y - 6} width={PLOT_W} height={12} rx={4} fill={pipeColor} stroke="#60a5fa" strokeWidth={1} />
        <text x={PAD.left + PLOT_W / 2} y={PIPE_Y + 4} fill="#93c5fd" fontSize={7} textAnchor="middle">
          DN{summary.pipe_diameter_mm} {summary.material} — C={summary.C_value}
        </text>

        {/* Flow arrow */}
        <defs>
          <marker id="flow-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="#60a5fa" />
          </marker>
        </defs>
        <line x1={PAD.left + 10} x2={PAD.left + PLOT_W - 10} y1={PIPE_Y} y2={PIPE_Y}
          stroke="#60a5fa" strokeWidth={1} markerEnd="url(#flow-arrow)" />

        {/* Y-axis labels */}
        {yTicks.map((t) => (
          <text key={t.v} x={PAD.left - 5} y={t.y + 3} fill="#6b7280" fontSize={7} textAnchor="end">{t.label}</text>
        ))}
        <text
          x={PAD.left - 38}
          y={PAD.top + PLOT_H / 2}
          fill="#6b7280"
          fontSize={7}
          textAnchor="middle"
          transform={`rotate(-90, ${PAD.left - 38}, ${PAD.top + PLOT_H / 2})`}
        >
          Pressure Head (m)
        </text>

        {/* X-axis labels */}
        {xTicks.map((t) => (
          <text key={t.d} x={t.x} y={H - PAD.bottom + 12} fill="#6b7280" fontSize={7} textAnchor="middle">{t.label}</text>
        ))}
        <text x={PAD.left + PLOT_W / 2} y={H - 2} fill="#6b7280" fontSize={7} textAnchor="middle">
          Distance (m)
        </text>

        {/* Source and delivery labels */}
        <text x={PAD.left + 2} y={py(summary.head_at_source_m) - 5} fill="#60a5fa" fontSize={7}>Source</text>
        <text x={W - PAD.right - 2} y={py(min_pressure_m) - 5} fill="#34d399" fontSize={7} textAnchor="end">Delivery</text>

        {/* Hover targets */}
        {points.map((p, i) => (
          <rect
            key={i}
            x={px(p.distance_m) - PLOT_W / (2 * points.length)}
            y={PAD.top}
            width={PLOT_W / points.length}
            height={PLOT_H}
            fill="transparent"
            onMouseEnter={() => setHover(p)}
            onMouseLeave={() => setHover(null)}
          />
        ))}

        {/* Hover dot + tooltip */}
        {hover && (
          <>
            <circle cx={px(hover.distance_m)} cy={py(hover.pressure_head_m)} r={3.5} fill="#3b82f6" stroke="#fff" strokeWidth={1.5} />
            <rect
              x={Math.min(px(hover.distance_m) + 6, W - PAD.right - 115)}
              y={py(hover.pressure_head_m) - 24}
              width={110}
              height={28}
              rx={3}
              fill="#1f2937"
              stroke="#374151"
            />
            <text x={Math.min(px(hover.distance_m) + 12, W - PAD.right - 109)} y={py(hover.pressure_head_m) - 12} fill="#e5e7eb" fontSize={7}>
              x = {hover.distance_m.toFixed(0)} m
            </text>
            <text x={Math.min(px(hover.distance_m) + 12, W - PAD.right - 109)} y={py(hover.pressure_head_m)} fill="#3b82f6" fontSize={7}>
              H = {hover.pressure_head_m.toFixed(1)} m  v={hover.velocity_mps.toFixed(2)} m/s
            </text>
          </>
        )}
      </svg>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-1 text-[10px]">
        {[
          { label: 'Pipe DN', val: `DN${summary.pipe_diameter_mm}`, color: 'text-blue-400' },
          { label: 'Velocity', val: `${summary.velocity_mps.toFixed(2)} m/s`, color: summary.velocity_mps > max_velocity_mps ? 'text-red-400' : 'text-green-400' },
          { label: 'Head Loss', val: `${summary.hf_total_m.toFixed(2)} m`, color: 'text-yellow-400' },
          { label: 'H at Source', val: `${summary.head_at_source_m.toFixed(1)} m`, color: 'text-cyan-400' },
        ].map((c) => (
          <div key={c.label} className="bg-gray-800 rounded px-2 py-1 text-center">
            <div className="text-gray-500">{c.label}</div>
            <div className={`font-mono font-semibold ${c.color}`}>{c.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
