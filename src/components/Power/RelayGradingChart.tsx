import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../services/apiConfig';

const W = 520, H = 220;
const PAD = { top: 16, right: 30, bottom: 38, left: 58 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

const COLORS = ['#f97316', '#60a5fa', '#34d399', '#a78bfa', '#fb923c'];

interface RelayData {
  currents_a: number[];
  curves: { id: string; label: string; pickup_a: number; tms: number; times_s: (number | null)[] }[];
  grading_table: { id: string; M_at_fault: number; trip_time_s: number | string }[];
  fault_current_a: number;
  grading_ok: boolean;
  status: string;
}

interface RelaySpec {
  id: string;
  label: string;
  pickup_a: number;
  tms: number;
  curve: string;
}

interface Props {
  relays: RelaySpec[];
  fault_current_a: number;
}

export function RelayGradingChart({ relays, fault_current_a }: Props) {
  const [data, setData] = useState<RelayData | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!relays.length) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    fetch(`${API_BASE}/power/relay-grading`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relays, fault_current_a }),
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
    return () => ac.abort();
  }, [relays, fault_current_a]);

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">Building grading chart…</div>;
  if (!data || data.status !== 'ok') return null;

  const currents = data.currents_a;
  const t_max = 10, t_min = 0.05;
  const i_min = currents[0], i_max = currents[currents.length - 1];

  const sx = (I: number) => PAD.left + (Math.log10(I) - Math.log10(i_min)) / (Math.log10(i_max) - Math.log10(i_min)) * CW;
  const st = (t: number) => PAD.top + CH - (Math.log10(t) - Math.log10(t_min)) / (Math.log10(t_max) - Math.log10(t_min)) * CH;

  const faultX = fault_current_a >= i_min && fault_current_a <= i_max ? sx(fault_current_a) : null;

  return (
    <div className="space-y-2">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full rounded bg-gray-900/40">
        {/* Fault current vertical */}
        {faultX !== null && (
          <>
            <line x1={faultX} y1={PAD.top} x2={faultX} y2={PAD.top + CH} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5,3" />
            <text x={faultX + 3} y={PAD.top + 10} fontSize={8} fill="#ef4444">If = {(fault_current_a / 1000).toFixed(1)}kA</text>
          </>
        )}
        {/* TCC curves */}
        {data.curves.map((curve, ci) => {
          const color = COLORS[ci % COLORS.length];
          const pts: string[] = [];
          for (let i = 0; i < currents.length; i++) {
            const t = curve.times_s[i];
            if (t !== null && t > t_min && t < t_max && currents[i] >= i_min) {
              pts.push(`${sx(currents[i])},${st(t)}`);
            }
          }
          return (
            <g key={curve.id}>
              <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2} />
              {pts.length > 0 && (
                <text x={parseFloat(pts[0].split(',')[0]) + 2} y={parseFloat(pts[0].split(',')[1]) - 4}
                  fontSize={8} fill={color}>{curve.label || curve.id}</text>
              )}
            </g>
          );
        })}
        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + CH} stroke="#374151" />
        <line x1={PAD.left} y1={PAD.top + CH} x2={PAD.left + CW} y2={PAD.top + CH} stroke="#374151" />
        {[100, 300, 1000, 3000, 10000].filter(I => I >= i_min && I <= i_max).map((I, i) => (
          <text key={i} x={sx(I)} y={PAD.top + CH + 14} fontSize={8} fill="#9ca3af" textAnchor="middle">
            {I >= 1000 ? `${I / 1000}k` : I}
          </text>
        ))}
        {[0.1, 0.3, 1, 3, 10].filter(t => t >= t_min && t <= t_max).map((t, i) => (
          <text key={i} x={PAD.left - 4} y={st(t) + 4} fontSize={8} fill="#9ca3af" textAnchor="end">{t}</text>
        ))}
        <text x={PAD.left + CW / 2} y={H - 2} fontSize={9} fill="#6b7280" textAnchor="middle">Current (A)</text>
        <text x={10} y={PAD.top + CH / 2} fontSize={9} fill="#6b7280" textAnchor="middle" transform={`rotate(-90,10,${PAD.top + CH / 2})`}>Time (s)</text>
      </svg>

      <div className={`text-xs text-center font-bold py-1 rounded ${data.grading_ok ? 'text-green-400 bg-green-900/20' : 'text-red-400 bg-red-900/20'}`}>
        Grading {data.grading_ok ? 'OK ✓' : 'MARGIN INSUFFICIENT ✗'}
      </div>

      <div className="grid gap-1">
        {data.grading_table.map((row) => (
          <div key={row.id} className="flex justify-between text-xs bg-gray-800/40 rounded px-2 py-1">
            <span className="text-gray-400">{row.id}</span>
            <span className="text-gray-300">M = {row.M_at_fault}×</span>
            <span className="text-orange-400 font-mono">{row.trip_time_s} s</span>
          </div>
        ))}
      </div>
    </div>
  );
}
