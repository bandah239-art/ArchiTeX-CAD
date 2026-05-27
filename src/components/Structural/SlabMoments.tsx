import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../services/apiConfig';

const W = 520, H = 190;
const PAD = { top: 14, right: 20, bottom: 34, left: 52 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

interface SlabData {
  x_m: number[];
  deflection_mm: number[];
  Msx_knm: number;
  Msy_knm: number;
  M_support_x_knm: number;
  max_deflection_mm: number;
  span_limit_mm: number;
  passes_deflection: boolean;
  n_design: number;
}

interface Props {
  span_lx_m: number; span_ly_m: number;
  dead_load_kn_m2: number; live_load_kn_m2: number;
  depth_mm: number; fck_mpa: number; fyk_mpa: number;
  slab_type: string; support_condition: string;
}

export function SlabMoments({ span_lx_m, span_ly_m, dead_load_kn_m2, live_load_kn_m2, depth_mm, fck_mpa, fyk_mpa, slab_type, support_condition }: Props) {
  const [data, setData] = useState<SlabData | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    fetch(`${API_BASE}/structural/simulation/slab-moments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ span_lx_m, span_ly_m, dead_load_kn_m2, live_load_kn_m2, depth_mm, fck_mpa, fyk_mpa, slab_type, support_condition }),
      signal: ac.signal,
    }).then((r) => r.json()).then((d) => { setData(d as SlabData); setLoading(false); }).catch(() => setLoading(false));
    return () => ac.abort();
  }, [span_lx_m, span_ly_m, dead_load_kn_m2, live_load_kn_m2, depth_mm, fck_mpa, fyk_mpa, slab_type, support_condition]);

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">Calculating slab moments…</div>;
  if (!data) return null;

  const xs = data.x_m;
  const ds = data.deflection_mm;
  const d_max = Math.max(...ds.map(Math.abs), data.span_limit_mm * 0.5) * 1.15;
  const L = xs[xs.length - 1];
  const sx = (x: number) => PAD.left + (x / L) * CW;
  const sd = (d: number) => PAD.top + (d / d_max) * CH;

  const zero_y = PAD.top;
  const poly = xs.map((x, i) => `${sx(x)},${sd(Math.abs(ds[i]))}`).join(' ');
  const fill = `${sx(xs[0])},${zero_y} ` + xs.map((x, i) => `${sx(x)},${sd(Math.abs(ds[i]))}`).join(' ') + ` ${sx(xs[xs.length - 1])},${zero_y}`;
  const limitY = sd(data.span_limit_mm);

  return (
    <div className="space-y-2">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full rounded bg-gray-900/40">
        <polygon points={fill} fill="rgba(139,92,246,0.15)" />
        <line x1={PAD.left} y1={limitY} x2={PAD.left + CW} y2={limitY} stroke="#ef4444" strokeWidth={1} strokeDasharray="4,3" />
        <text x={PAD.left + CW + 2} y={limitY + 4} fontSize={8} fill="#ef4444">L/250</text>
        <polyline points={poly} fill="none" stroke="#a78bfa" strokeWidth={2} />
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + CH} stroke="#374151" />
        <line x1={PAD.left} y1={PAD.top + CH} x2={PAD.left + CW} y2={PAD.top + CH} stroke="#374151" />
        {([0, d_max / 2, d_max] as number[]).map((v, i) => (
          <text key={i} x={PAD.left - 4} y={sd(v) + 4} fontSize={9} fill="#9ca3af" textAnchor="end">{v.toFixed(1)}</text>
        ))}
        {([0, L / 2, L] as number[]).map((x, i) => (
          <text key={i} x={sx(x)} y={PAD.top + CH + 14} fontSize={9} fill="#9ca3af" textAnchor="middle">{x.toFixed(1)}m</text>
        ))}
        <text x={PAD.left + CW / 2} y={H - 2} fontSize={9} fill="#6b7280" textAnchor="middle">Span lx — Deflection (mm, downward)</text>
        <text x={10} y={PAD.top + CH / 2} fontSize={9} fill="#6b7280" textAnchor="middle" transform={`rotate(-90,10,${PAD.top + CH / 2})`}>mm</text>
      </svg>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <SMCard label="M short span" value={`${data.Msx_knm.toFixed(1)} kNm/m`} color="violet" />
        <SMCard label="M long span" value={`${data.Msy_knm.toFixed(1)} kNm/m`} color="violet" />
        <SMCard label="Support M" value={`${Math.abs(data.M_support_x_knm).toFixed(1)} kNm/m`} color="amber" />
        <SMCard label="Max Deflection" value={`${data.max_deflection_mm.toFixed(2)} mm`} color={data.passes_deflection ? 'green' : 'red'} sub={data.passes_deflection ? 'PASS' : 'FAIL'} />
      </div>
    </div>
  );
}

function SMCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  const cols: Record<string, string> = { violet: 'text-violet-400', amber: 'text-amber-400', green: 'text-green-400', red: 'text-red-400' };
  return (
    <div className="rounded p-2 text-center bg-gray-800/60">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className={`font-bold text-xs ${cols[color] ?? 'text-white'}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-500">{sub}</div>}
    </div>
  );
}
