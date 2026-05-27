import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../services/apiConfig';

const W = 520, H = 200;
const PAD = { top: 14, right: 20, bottom: 34, left: 60 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

interface LFGData {
  year: number[];
  lfg_m3_yr: number[];
  peak_lfg_m3_yr: number;
  power_kw: number;
  landfill_area_ha: number;
  total_waste_t: number;
  annual_waste_t: number;
  peak_year: number;
}

interface Props {
  population: number; waste_generation_kg_capita_day: number;
  design_life_years: number; compacted_waste_density_kg_m3: number;
}

export function LandfillGas({ population, waste_generation_kg_capita_day, design_life_years, compacted_waste_density_kg_m3 }: Props) {
  const [data, setData] = useState<LFGData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    fetch(`${API_BASE}/env/simulation/landfill-gas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ population, waste_generation_kg_capita_day, design_life_years, compacted_waste_density_kg_m3 }),
      signal: ac.signal,
    }).then((r) => r.json()).then((d) => { setData(d as LFGData); setLoading(false); }).catch(() => setLoading(false));
    return () => ac.abort();
  }, [population, waste_generation_kg_capita_day, design_life_years, compacted_waste_density_kg_m3]);

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">Calculating landfill gas…</div>;
  if (!data) return null;

  const ys = data.year, gs = data.lfg_m3_yr;
  const y_max_v = ys[ys.length - 1];
  const g_max = Math.max(...gs) * 1.1;

  const sx = (y: number) => PAD.left + ((y - ys[0]) / (y_max_v - ys[0])) * CW;
  const sg = (g: number) => PAD.top + CH - (g / g_max) * CH;

  const poly = ys.map((y, i) => `${sx(y)},${sg(gs[i])}`).join(' ');
  const fill = `${sx(ys[0])},${sg(0)} ` + ys.map((y, i) => `${sx(y)},${sg(gs[i])}`).join(' ') + ` ${sx(ys[ys.length - 1])},${sg(0)}`;

  // Closure line (end of design life)
  const closeX = sx(design_life_years);
  const peakX = sx(data.peak_year), peakY = sg(data.peak_lfg_m3_yr);
  const hov = hoverIdx !== null ? { y: ys[hoverIdx], g: gs[hoverIdx] } : null;

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
        {/* Closure shading */}
        <rect x={PAD.left} y={PAD.top} width={closeX - PAD.left} height={CH} fill="rgba(74,222,128,0.05)" />
        <line x1={closeX} y1={PAD.top} x2={closeX} y2={PAD.top + CH} stroke="#6b7280" strokeWidth={1} strokeDasharray="3,2" />
        <text x={closeX + 2} y={PAD.top + 10} fontSize={8} fill="#6b7280">Closure yr {design_life_years}</text>
        <polygon points={fill} fill="rgba(74,222,128,0.15)" />
        <polyline points={poly} fill="none" stroke="#4ade80" strokeWidth={2} />
        {/* Peak */}
        <circle cx={peakX} cy={peakY} r={4} fill="#f59e0b" />
        <text x={peakX + 5} y={peakY - 3} fontSize={8} fill="#f59e0b">Peak yr {data.peak_year}</text>
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + CH} stroke="#374151" />
        <line x1={PAD.left} y1={PAD.top + CH} x2={PAD.left + CW} y2={PAD.top + CH} stroke="#374151" />
        {([0, g_max / 2, g_max] as number[]).map((g, i) => (
          <text key={i} x={PAD.left - 4} y={sg(g) + 4} fontSize={8} fill="#9ca3af" textAnchor="end">{(g / 1000).toFixed(0)}k</text>
        ))}
        {([ys[0], Math.round((ys[0] + y_max_v) / 2), y_max_v] as number[]).map((y, i) => (
          <text key={i} x={sx(y)} y={PAD.top + CH + 13} fontSize={9} fill="#9ca3af" textAnchor="middle">{y}</text>
        ))}
        <text x={PAD.left + CW / 2} y={H - 2} fontSize={9} fill="#6b7280" textAnchor="middle">Year</text>
        <text x={10} y={PAD.top + CH / 2} fontSize={9} fill="#6b7280" textAnchor="middle" transform={`rotate(-90,10,${PAD.top + CH / 2})`}>LFG (m³/yr)</text>
        {hov && (
          <>
            <line x1={sx(hov.y)} y1={PAD.top} x2={sx(hov.y)} y2={PAD.top + CH} stroke="#4ade80" strokeWidth={1} strokeDasharray="3,2" opacity={0.5} />
            <circle cx={sx(hov.y)} cy={sg(hov.g)} r={3} fill="#4ade80" />
            <rect x={sx(hov.y) + 4} y={sg(hov.g) - 18} width={100} height={16} rx={3} fill="#111827" opacity={0.9} />
            <text x={sx(hov.y) + 8} y={sg(hov.g) - 6} fontSize={9} fill="#4ade80">Yr {hov.y}: {(hov.g / 1000).toFixed(1)}k m³</text>
          </>
        )}
      </svg>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <LGCard label="Peak LFG" value={`${(data.peak_lfg_m3_yr / 1000).toFixed(0)}k m³/yr`} />
        <LGCard label="Power" value={`${data.power_kw.toFixed(0)} kW`} />
        <LGCard label="Area" value={`${data.landfill_area_ha.toFixed(1)} ha`} />
        <LGCard label="Total Waste" value={`${(data.total_waste_t / 1000).toFixed(0)}k t`} />
      </div>
    </div>
  );
}

function LGCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded p-2 text-center bg-gray-800/60">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className="font-bold text-sm text-green-400">{value}</div>
    </div>
  );
}
