import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../services/apiConfig';

const W = 520, H = 190;
const PAD = { top: 14, right: 20, bottom: 34, left: 60 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

interface ESALData {
  year: number[];
  cumulative_esal_millions: number[];
  annual_base_esal: number;
  design_esal_millions: number;
  design_life_yrs: number;
}

interface Props {
  aadt: number; growth_rate_pct: number; design_life_yrs: number;
  truck_pct: number; bus_pct: number; vdf_truck: number; vdf_bus: number;
  directional_split: number; lane_factor: number;
}

export function ESALGrowth({ aadt, growth_rate_pct, design_life_yrs, truck_pct, bus_pct, vdf_truck, vdf_bus, directional_split, lane_factor }: Props) {
  const [data, setData] = useState<ESALData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    fetch(`${API_BASE}/road/simulation/esal-growth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aadt, growth_rate_pct, design_life_yrs, truck_pct, bus_pct, vdf_truck, vdf_bus, directional_split, lane_factor }),
      signal: ac.signal,
    }).then((r) => r.json()).then((d) => { setData(d as ESALData); setLoading(false); }).catch(() => setLoading(false));
    return () => ac.abort();
  }, [aadt, growth_rate_pct, design_life_yrs, truck_pct, bus_pct, vdf_truck, vdf_bus, directional_split, lane_factor]);

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">Calculating ESAL growth…</div>;
  if (!data) return null;

  const ys = data.year, es = data.cumulative_esal_millions;
  const e_max = Math.max(...es) * 1.1;
  const y_max = ys[ys.length - 1];

  const sx = (y: number) => PAD.left + ((y - 1) / (y_max - 1)) * CW;
  const se = (e: number) => PAD.top + CH - (e / e_max) * CH;

  const poly = ys.map((y, i) => `${sx(y)},${se(es[i])}`).join(' ');
  const fill = `${sx(ys[0])},${se(0)} ` + ys.map((y, i) => `${sx(y)},${se(es[i])}`).join(' ') + ` ${sx(ys[ys.length - 1])},${se(0)}`;
  const hov = hoverIdx !== null ? { y: ys[hoverIdx], e: es[hoverIdx] } : null;

  return (
    <div className="space-y-2">
      <svg
        width={W} height={H} viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded bg-gray-900/40"
        onMouseMove={(ev) => {
          const rect = ev.currentTarget.getBoundingClientRect();
          const px = (ev.clientX - rect.left) / rect.width * W;
          setHoverIdx(Math.max(0, Math.min(ys.length - 1, Math.round(((px - PAD.left) / CW) * (ys.length - 1)))));
        }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <polygon points={fill} fill="rgba(251,146,60,0.15)" />
        <polyline points={poly} fill="none" stroke="#fb923c" strokeWidth={2} />
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + CH} stroke="#374151" />
        <line x1={PAD.left} y1={PAD.top + CH} x2={PAD.left + CW} y2={PAD.top + CH} stroke="#374151" />
        {([0, e_max / 2, e_max] as number[]).map((e, i) => (
          <text key={i} x={PAD.left - 4} y={se(e) + 4} fontSize={9} fill="#9ca3af" textAnchor="end">{e.toFixed(1)}</text>
        ))}
        {([1, Math.round(y_max / 2), y_max] as number[]).map((y, i) => (
          <text key={i} x={sx(y)} y={PAD.top + CH + 13} fontSize={9} fill="#9ca3af" textAnchor="middle">{y}</text>
        ))}
        <text x={PAD.left + CW / 2} y={H - 2} fontSize={9} fill="#6b7280" textAnchor="middle">Year</text>
        <text x={10} y={PAD.top + CH / 2} fontSize={9} fill="#6b7280" textAnchor="middle" transform={`rotate(-90,10,${PAD.top + CH / 2})`}>Cumul. ESAL (M)</text>
        {hov && (
          <>
            <line x1={sx(hov.y)} y1={PAD.top} x2={sx(hov.y)} y2={PAD.top + CH} stroke="#fb923c" strokeWidth={1} strokeDasharray="3,2" opacity={0.5} />
            <circle cx={sx(hov.y)} cy={se(hov.e)} r={3} fill="#fb923c" />
            <rect x={sx(hov.y) + 4} y={se(hov.e) - 18} width={96} height={16} rx={3} fill="#111827" opacity={0.9} />
            <text x={sx(hov.y) + 8} y={se(hov.e) - 6} fontSize={9} fill="#fb923c">Yr {hov.y}: {hov.e.toFixed(2)}M ESALs</text>
          </>
        )}
      </svg>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <EGCard label="Design ESAL" value={`${data.design_esal_millions.toFixed(2)}M`} />
        <EGCard label="Annual Base" value={`${(data.annual_base_esal / 1000).toFixed(1)}k`} />
        <EGCard label="Design Life" value={`${data.design_life_yrs} years`} />
      </div>
    </div>
  );
}

function EGCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded p-2 text-center bg-gray-800/60">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className="font-bold text-sm text-orange-400">{value}</div>
    </div>
  );
}
