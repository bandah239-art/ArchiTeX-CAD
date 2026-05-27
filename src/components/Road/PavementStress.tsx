import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../services/apiConfig';

const W = 520, H = 260;
const PAD = { top: 14, right: 120, bottom: 34, left: 56 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

interface PavData {
  depth_m: number[];
  sigma_z_kpa: number[];
  layer_boundaries: { ac_mm: number; base_mm: number; subbase_mm: number };
  sigma_at_surface_kpa: number;
  sigma_at_300mm_kpa: number;
  sigma_at_600mm_kpa: number;
}

interface Props {
  cbr_subgrade: number; traffic_count: number; heavy_vehicle_pct: number;
  design_life: number; road_class: string;
}

export function PavementStress({ cbr_subgrade, traffic_count, heavy_vehicle_pct, design_life, road_class }: Props) {
  const [data, setData] = useState<PavData | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    fetch(`${API_BASE}/road/simulation/pavement-stress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cbr_subgrade, traffic_count, heavy_vehicle_pct, design_life, road_class }),
      signal: ac.signal,
    }).then((r) => r.json()).then((d) => { setData(d as PavData); setLoading(false); }).catch(() => setLoading(false));
    return () => ac.abort();
  }, [cbr_subgrade, traffic_count, heavy_vehicle_pct, design_life, road_class]);

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">Calculating pavement stress…</div>;
  if (!data) return null;

  const ds = data.depth_m, ss = data.sigma_z_kpa;
  const D_MAX = ds[ds.length - 1];
  const S_MAX = Math.max(...ss) * 1.1;

  const sd = (d: number) => PAD.top + (d / D_MAX) * CH;
  const ss2 = (s: number) => PAD.left + (s / S_MAX) * CW;

  const poly = ds.map((d, i) => `${ss2(ss[i])},${sd(d)}`).join(' ');
  const fill = `${ss2(0)},${sd(0)} ` + ds.map((d, i) => `${ss2(ss[i])},${sd(d)}`).join(' ') + ` ${ss2(0)},${sd(D_MAX)}`;

  const lb = data.layer_boundaries;
  const layers = [
    { label: 'AC', top: 0, bot: lb.ac_mm / 1000, color: 'rgba(30,30,30,0.6)' },
    { label: 'Base', top: lb.ac_mm / 1000, bot: (lb.ac_mm + lb.base_mm) / 1000, color: 'rgba(100,85,60,0.4)' },
    { label: 'Subbase', top: (lb.ac_mm + lb.base_mm) / 1000, bot: (lb.ac_mm + lb.base_mm + lb.subbase_mm) / 1000, color: 'rgba(140,120,80,0.3)' },
    { label: 'Subgrade', top: (lb.ac_mm + lb.base_mm + lb.subbase_mm) / 1000, bot: D_MAX, color: 'rgba(100,70,40,0.2)' },
  ];

  return (
    <div className="space-y-2">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full rounded bg-gray-900/40">
        {/* Layer bands */}
        {layers.map((l, i) => (
          <g key={i}>
            <rect x={PAD.left} y={sd(l.top)} width={CW} height={sd(l.bot) - sd(l.top)} fill={l.color} />
            <text x={PAD.left + CW + 4} y={(sd(l.top) + sd(l.bot)) / 2 + 4} fontSize={8} fill="#9ca3af">{l.label}</text>
          </g>
        ))}
        <polygon points={fill} fill="rgba(251,191,36,0.2)" />
        <polyline points={poly} fill="none" stroke="#fbbf24" strokeWidth={2.5} />
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + CH} stroke="#4b5563" />
        <line x1={PAD.left} y1={PAD.top + CH} x2={PAD.left + CW} y2={PAD.top + CH} stroke="#4b5563" />
        {([0, D_MAX / 2, D_MAX] as number[]).map((d, i) => (
          <text key={i} x={PAD.left - 4} y={sd(d) + 4} fontSize={9} fill="#9ca3af" textAnchor="end">{d.toFixed(2)}</text>
        ))}
        {([0, S_MAX / 2, S_MAX] as number[]).map((s, i) => (
          <text key={i} x={ss2(s)} y={PAD.top + CH + 13} fontSize={8} fill="#9ca3af" textAnchor="middle">{Math.round(s)}</text>
        ))}
        <text x={PAD.left + CW / 2} y={H - 2} fontSize={9} fill="#6b7280" textAnchor="middle">Vertical stress σz (kPa)</text>
        <text x={10} y={PAD.top + CH / 2} fontSize={9} fill="#6b7280" textAnchor="middle" transform={`rotate(-90,10,${PAD.top + CH / 2})`}>Depth (m)</text>
      </svg>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <PSCard label="Surface (0mm)" value={`${data.sigma_at_surface_kpa.toFixed(0)} kPa`} />
        <PSCard label="Base (300mm)" value={`${data.sigma_at_300mm_kpa.toFixed(0)} kPa`} />
        <PSCard label="Subgrade (600mm)" value={`${data.sigma_at_600mm_kpa.toFixed(0)} kPa`} />
      </div>
    </div>
  );
}

function PSCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded p-2 text-center bg-gray-800/60">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className="font-bold text-sm text-amber-400">{value}</div>
    </div>
  );
}
