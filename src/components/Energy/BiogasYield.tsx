import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../services/apiConfig';

const W = 520, H = 200;
const PAD = { top: 16, right: 24, bottom: 36, left: 52 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

interface BiogasData {
  temp_c: number[];
  biogas_m3_d: number[];
  design_temp_c: number;
  design_biogas_m3_d: number;
  design_gas_energy_kwh_d: number;
  daily_waste_kg: number;
  vs_total_kg_d: number;
  digester_vol_m3: number;
  hrt_days: number;
  temp_efficiency_pct: number;
}

interface Props {
  cattle_count: number;
  poultry_count: number;
  human_count: number;
  temperature_c: number;
}

export function BiogasYield({ cattle_count, poultry_count, human_count, temperature_c }: Props) {
  const [data, setData] = useState<BiogasData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    fetch(`${API_BASE}/energy/simulation/biogas-yield`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cattle_count, poultry_count, human_count, temperature_c }),
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((d) => { setData(d as BiogasData); setLoading(false); })
      .catch(() => setLoading(false));
    return () => ac.abort();
  }, [cattle_count, poultry_count, human_count, temperature_c]);

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">Calculating biogas yield curve…</div>;
  if (!data) return null;

  const temps = data.temp_c;
  const yields = data.biogas_m3_d;
  const y_max = Math.max(...yields) * 1.1;
  const t_min = temps[0], t_max_v = temps[temps.length - 1];

  const sx = (t: number) => PAD.left + ((t - t_min) / (t_max_v - t_min)) * CW;
  const sy = (y: number) => PAD.top + CH - (y / y_max) * CH;

  const poly = temps.map((t, i) => `${sx(t)},${sy(yields[i])}`).join(' ');
  const fill = `${sx(temps[0])},${sy(0)} ` + temps.map((t, i) => `${sx(t)},${sy(yields[i])}`).join(' ') + ` ${sx(temps[temps.length - 1])},${sy(0)}`;
  const designX = sx(data.design_temp_c);
  const hov = hoverIdx !== null ? { t: temps[hoverIdx], y: yields[hoverIdx] } : null;

  return (
    <div className="space-y-2">
      <svg
        width={W} height={H} viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded bg-gray-900/40"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = (e.clientX - rect.left) / rect.width * W;
          const idx = Math.round(((px - PAD.left) / CW) * (temps.length - 1));
          setHoverIdx(Math.max(0, Math.min(temps.length - 1, idx)));
        }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Mesophilic range band */}
        <rect x={sx(25)} y={PAD.top} width={sx(40) - sx(25)} height={CH} fill="rgba(34,197,94,0.07)" />
        <text x={(sx(25) + sx(40)) / 2} y={PAD.top + 10} fontSize={8} fill="#4ade80" textAnchor="middle" opacity={0.7}>Mesophilic</text>
        <polygon points={fill} fill="rgba(34,197,94,0.12)" />
        {/* Design temperature marker */}
        <line x1={designX} y1={PAD.top} x2={designX} y2={PAD.top + CH} stroke="#f97316" strokeWidth={1.5} strokeDasharray="4,3" />
        <text x={designX + 3} y={PAD.top + 12} fontSize={8} fill="#f97316">{data.design_temp_c}°C</text>
        <polyline points={poly} fill="none" stroke="#22c55e" strokeWidth={2} />
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + CH} stroke="#374151" />
        <line x1={PAD.left} y1={PAD.top + CH} x2={PAD.left + CW} y2={PAD.top + CH} stroke="#374151" />
        {([0, y_max / 2, y_max] as number[]).map((y, i) => (
          <text key={i} x={PAD.left - 4} y={sy(y) + 4} fontSize={9} fill="#9ca3af" textAnchor="end">{y.toFixed(1)}</text>
        ))}
        {([5, 15, 25, 35, 45, 55, 65] as number[]).map((t, i) => (
          <text key={i} x={sx(t)} y={PAD.top + CH + 14} fontSize={8} fill="#9ca3af" textAnchor="middle">{t}</text>
        ))}
        <text x={PAD.left + CW / 2} y={H - 2} fontSize={9} fill="#6b7280" textAnchor="middle">Temperature (°C)</text>
        <text x={12} y={PAD.top + CH / 2} fontSize={9} fill="#6b7280" textAnchor="middle" transform={`rotate(-90,12,${PAD.top + CH / 2})`}>m³/day</text>
        {hov && (
          <>
            <line x1={sx(hov.t)} y1={PAD.top} x2={sx(hov.t)} y2={PAD.top + CH} stroke="#22c55e" strokeWidth={1} strokeDasharray="3,2" opacity={0.6} />
            <circle cx={sx(hov.t)} cy={sy(hov.y)} r={3} fill="#22c55e" />
            <rect x={sx(hov.t) + 4} y={sy(hov.y) - 18} width={100} height={16} rx={3} fill="#111827" opacity={0.9} />
            <text x={sx(hov.t) + 8} y={sy(hov.y) - 6} fontSize={9} fill="#22c55e">
              {hov.t}°C → {hov.y.toFixed(2)} m³/d
            </text>
          </>
        )}
      </svg>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <BGCard label="Daily Biogas" value={`${data.design_biogas_m3_d} m³`} sub={`at ${data.design_temp_c}°C`} />
        <BGCard label="Energy Yield" value={`${data.design_gas_energy_kwh_d.toFixed(1)} kWh`} sub="per day" />
        <BGCard label="Digester Vol" value={`${data.digester_vol_m3} m³`} sub={`HRT ${data.hrt_days}d`} />
        <BGCard label="Temp Efficiency" value={`${data.temp_efficiency_pct}%`} sub="of optimum" />
      </div>
    </div>
  );
}

function BGCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded p-2 text-center bg-gray-800/60">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className="font-bold text-sm text-green-400">{value}</div>
      <div className="text-[10px] text-gray-500">{sub}</div>
    </div>
  );
}
