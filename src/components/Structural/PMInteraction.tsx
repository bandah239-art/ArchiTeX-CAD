import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../services/apiConfig';

const W = 520, H = 280;
const PAD = { top: 20, right: 30, bottom: 40, left: 60 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

interface PMData {
  n_kn: number[];
  m_knm: number[];
  design_n_kn: number;
  design_m_knm: number;
  N_max_kn: number;
  within_envelope: boolean;
  rho_pct: number;
}

interface Props {
  width_mm: number; depth_mm: number; fck_mpa: number; fyk_mpa: number;
  axial_load_kn: number; moment_major_knm: number;
}

export function PMInteraction({ width_mm, depth_mm, fck_mpa, fyk_mpa, axial_load_kn, moment_major_knm }: Props) {
  const [data, setData] = useState<PMData | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    fetch(`${API_BASE}/structural/simulation/pm-interaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ width_mm, depth_mm, fck_mpa, fyk_mpa, axial_load_kn, moment_major_knm }),
      signal: ac.signal,
    }).then((r) => r.json()).then((d) => { setData(d as PMData); setLoading(false); }).catch(() => setLoading(false));
    return () => ac.abort();
  }, [width_mm, depth_mm, fck_mpa, fyk_mpa, axial_load_kn, moment_major_knm]);

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">Building P-M interaction diagram…</div>;
  if (!data) return null;

  const ns = data.n_kn, ms = data.m_knm;
  const n_min = Math.min(...ns) * 1.1;
  const n_max = Math.max(...ns) * 1.05;
  const m_max = Math.max(...ms) * 1.15;

  const sx = (m: number) => PAD.left + (m / m_max) * CW;
  const sn = (n: number) => PAD.top + CH - ((n - n_min) / (n_max - n_min)) * CH;

  // Build closed polygon: curve + mirror on M<0 side (symmetric section)
  const fwd = ns.map((n, i) => `${sx(ms[i])},${sn(n)}`).join(' ');
  const rev = [...ns].reverse().map((n, i) => `${sx(-[...ms].reverse()[i])},${sn(n)}`).join(' ');
  const envelope = fwd + ' ' + rev;

  const zeroM = sx(0), zeroN = sn(0);
  const dX = sx(data.design_m_knm), dY = sn(data.design_n_kn);
  const dotColor = data.within_envelope ? '#10b981' : '#ef4444';

  return (
    <div className="space-y-2">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full rounded bg-gray-900/40">
        {/* Envelope fill */}
        <polygon points={envelope} fill="rgba(99,102,241,0.12)" stroke="#6366f1" strokeWidth={1.5} />
        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + CH} stroke="#374151" />
        <line x1={zeroM} y1={PAD.top} x2={zeroM} y2={PAD.top + CH} stroke="#374151" strokeDasharray="2,3" opacity={0.4} />
        <line x1={PAD.left} y1={zeroN} x2={PAD.left + CW} y2={zeroN} stroke="#374151" strokeDasharray="2,3" opacity={0.4} />
        <line x1={PAD.left} y1={PAD.top + CH} x2={PAD.left + CW} y2={PAD.top + CH} stroke="#374151" />
        {/* Design point crosshairs */}
        <line x1={PAD.left} y1={dY} x2={dX} y2={dY} stroke={dotColor} strokeWidth={1} strokeDasharray="3,2" opacity={0.7} />
        <line x1={dX} y1={PAD.top + CH} x2={dX} y2={dY} stroke={dotColor} strokeWidth={1} strokeDasharray="3,2" opacity={0.7} />
        <circle cx={dX} cy={dY} r={5} fill={dotColor} />
        {/* Labels */}
        {([-data.N_max_kn * 0.5, 0, data.N_max_kn * 0.5, data.N_max_kn] as number[]).map((n, i) => (
          <text key={i} x={PAD.left - 4} y={sn(n) + 4} fontSize={8} fill="#9ca3af" textAnchor="end">{Math.round(n)}</text>
        ))}
        {([0, m_max / 2, m_max] as number[]).map((m, i) => (
          <text key={i} x={sx(m)} y={PAD.top + CH + 13} fontSize={8} fill="#9ca3af" textAnchor="middle">{Math.round(m)}</text>
        ))}
        <text x={PAD.left + CW / 2} y={H - 2} fontSize={9} fill="#6b7280" textAnchor="middle">Moment M (kNm)</text>
        <text x={10} y={PAD.top + CH / 2} fontSize={9} fill="#6b7280" textAnchor="middle" transform={`rotate(-90,10,${PAD.top + CH / 2})`}>Axial N (kN)</text>
        <text x={PAD.left + 4} y={PAD.top + 12} fontSize={8} fill="#6366f1">EC2 P-M Envelope (ρ={data.rho_pct}%)</text>
        <text x={dX + 7} y={dY - 4} fontSize={8} fill={dotColor}>NEd,MEd</text>
      </svg>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <PMCard label="NEd" value={`${data.design_n_kn} kN`} color="indigo" />
        <PMCard label="MEd" value={`${data.design_m_knm} kNm`} color="indigo" />
        <PMCard label="N max" value={`${data.N_max_kn.toFixed(0)} kN`} color="gray" />
        <PMCard label="Status" value={data.within_envelope ? 'PASS ✓' : 'FAIL ✗'} color={data.within_envelope ? 'green' : 'red'} />
      </div>
    </div>
  );
}

function PMCard({ label, value, color }: { label: string; value: string; color: string }) {
  const cols: Record<string, string> = { indigo: 'text-indigo-400', gray: 'text-gray-300', green: 'text-green-400', red: 'text-red-400' };
  return (
    <div className="rounded p-2 text-center bg-gray-800/60">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className={`font-bold text-sm ${cols[color] ?? 'text-white'}`}>{value}</div>
    </div>
  );
}
