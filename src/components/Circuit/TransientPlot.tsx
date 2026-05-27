import { API_BASE } from '../../services/apiConfig';
import { useState, useEffect, useRef } from 'react';

const W = 520, H = 200;
const PAD = { top: 14, right: 24, bottom: 36, left: 52 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

const NODE_COLORS = ['#34d399', '#60a5fa', '#f97316', '#a78bfa', '#fb923c'];

interface TransientData {
  time_s: number[];
  voltages: Record<string, number[]>;
  status: string;
}

interface Props {
  components: object[];
  t_stop: number;
  dt: number;
  output_nodes: string[];
}

export function TransientPlot({ components, t_stop, dt, output_nodes }: Props) {
  const [data, setData] = useState<TransientData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!components.length) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    fetch(`${API_BASE}/circuit/transient`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ components, t_stop, dt, output_nodes }),
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
    return () => ac.abort();
  }, [components, t_stop, dt, output_nodes]);

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">Running transient…</div>;
  if (!data || data.status !== 'ok') return null;

  const ts = data.time_s;
  const allV = Object.values(data.voltages).flat();
  const v_min = Math.min(...allV, 0) - 0.1;
  const v_max = Math.max(...allV, 0) + 0.1;
  const t_max = ts[ts.length - 1];

  const sx = (t: number) => PAD.left + (t / t_max) * CW;
  const sv = (v: number) => PAD.top + CH - ((v - v_min) / (v_max - v_min)) * CH;

  const hov = hoverIdx !== null ? { t: ts[hoverIdx] } : null;

  return (
    <div className="space-y-1">
      <svg
        width={W} height={H} viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded bg-gray-900/40"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = (e.clientX - rect.left) / rect.width * W;
          const idx = Math.round(((px - PAD.left) / CW) * (ts.length - 1));
          setHoverIdx(Math.max(0, Math.min(ts.length - 1, idx)));
        }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <line x1={PAD.left} y1={sv(0)} x2={PAD.left + CW} y2={sv(0)} stroke="#374151" strokeWidth={0.8} />
        {Object.entries(data.voltages).map(([nd, vals], ci) => {
          const color = NODE_COLORS[ci % NODE_COLORS.length];
          const poly = ts.map((t, i) => `${sx(t)},${sv(vals[i])}`).join(' ');
          return <polyline key={nd} points={poly} fill="none" stroke={color} strokeWidth={1.8} />;
        })}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + CH} stroke="#374151" />
        <line x1={PAD.left} y1={PAD.top + CH} x2={PAD.left + CW} y2={PAD.top + CH} stroke="#374151" />
        {[v_min + 0.1, (v_min + v_max) / 2, v_max - 0.1].map((v, i) => (
          <text key={i} x={PAD.left - 4} y={sv(v) + 4} fontSize={9} fill="#9ca3af" textAnchor="end">{v.toFixed(1)}</text>
        ))}
        {[0, t_max / 2, t_max].map((t, i) => {
          const label = t >= 0.001 ? `${(t * 1000).toFixed(1)}ms` : `${(t * 1e6).toFixed(0)}µs`;
          return <text key={i} x={sx(t)} y={PAD.top + CH + 14} fontSize={9} fill="#9ca3af" textAnchor="middle">{label}</text>;
        })}
        <text x={PAD.left + CW / 2} y={H - 2} fontSize={9} fill="#6b7280" textAnchor="middle">Time</text>
        <text x={12} y={PAD.top + CH / 2} fontSize={9} fill="#6b7280" textAnchor="middle" transform={`rotate(-90,12,${PAD.top + CH / 2})`}>V</text>
        {/* Legend */}
        {Object.keys(data.voltages).map((nd, ci) => (
          <text key={nd} x={PAD.left + 8 + ci * 56} y={PAD.top + 10} fontSize={8} fill={NODE_COLORS[ci % NODE_COLORS.length]}>
            V({nd})
          </text>
        ))}
        {hov && (
          <line x1={sx(hov.t)} y1={PAD.top} x2={sx(hov.t)} y2={PAD.top + CH}
            stroke="#9ca3af" strokeWidth={1} strokeDasharray="3,2" opacity={0.5} />
        )}
      </svg>
    </div>
  );
}
