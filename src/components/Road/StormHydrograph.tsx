import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../services/apiConfig';

const W = 520, H = 200;
const PAD = { top: 14, right: 20, bottom: 34, left: 56 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

interface HydroData {
  time_hr: number[];
  flow_m3s: number[];
  Q_peak_m3s: number;
  Tp_hr: number;
  Tb_hr: number;
  runoff_volume_m3: number;
  C: number;
  I: number;
  A_ha: number;
}

interface Props {
  catchment_area_ha: number; runoff_coefficient: number;
  rainfall_intensity_mm_hr: number; duration_hours: number;
}

export function StormHydrograph({ catchment_area_ha, runoff_coefficient, rainfall_intensity_mm_hr, duration_hours }: Props) {
  const [data, setData] = useState<HydroData | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    fetch(`${API_BASE}/road/simulation/stormwater-hydrograph`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catchment_area_ha, runoff_coefficient, rainfall_intensity_mm_hr, duration_hours }),
      signal: ac.signal,
    }).then((r) => r.json()).then((d) => { setData(d as HydroData); setLoading(false); }).catch(() => setLoading(false));
    return () => ac.abort();
  }, [catchment_area_ha, runoff_coefficient, rainfall_intensity_mm_hr, duration_hours]);

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">Calculating hydrograph…</div>;
  if (!data) return null;

  const ts = data.time_hr, qs = data.flow_m3s;
  const t_max = ts[ts.length - 1];
  const q_max = data.Q_peak_m3s * 1.15;

  const sx = (t: number) => PAD.left + (t / t_max) * CW;
  const sq = (q: number) => PAD.top + CH - (q / q_max) * CH;

  const poly = ts.map((t, i) => `${sx(t)},${sq(qs[i])}`).join(' ');
  const fill = `${sx(ts[0])},${sq(0)} ` + ts.map((t, i) => `${sx(t)},${sq(qs[i])}`).join(' ') + ` ${sx(ts[ts.length - 1])},${sq(0)}`;
  const peakX = sx(data.Tp_hr), peakY = sq(data.Q_peak_m3s);

  return (
    <div className="space-y-2">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full rounded bg-gray-900/40">
        <polygon points={fill} fill="rgba(56,189,248,0.2)" />
        <polyline points={poly} fill="none" stroke="#38bdf8" strokeWidth={2.5} />
        {/* Peak marker */}
        <line x1={peakX} y1={PAD.top} x2={peakX} y2={peakY} stroke="#f59e0b" strokeWidth={1} strokeDasharray="3,2" />
        <circle cx={peakX} cy={peakY} r={4} fill="#f59e0b" />
        <text x={peakX + 4} y={peakY - 4} fontSize={8} fill="#f59e0b">Q={data.Q_peak_m3s.toFixed(2)}m³/s</text>
        {/* Base time marker */}
        <line x1={sx(data.Tb_hr)} y1={PAD.top} x2={sx(data.Tb_hr)} y2={PAD.top + CH} stroke="#6b7280" strokeWidth={1} strokeDasharray="2,3" />
        <text x={sx(data.Tb_hr) - 2} y={PAD.top + CH + 13} fontSize={8} fill="#6b7280" textAnchor="end">Tb={data.Tb_hr.toFixed(1)}h</text>
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + CH} stroke="#374151" />
        <line x1={PAD.left} y1={PAD.top + CH} x2={PAD.left + CW} y2={PAD.top + CH} stroke="#374151" />
        {([0, q_max / 2, q_max] as number[]).map((q, i) => (
          <text key={i} x={PAD.left - 4} y={sq(q) + 4} fontSize={9} fill="#9ca3af" textAnchor="end">{q.toFixed(2)}</text>
        ))}
        {([0, t_max / 2, t_max] as number[]).map((t, i) => (
          <text key={i} x={sx(t)} y={PAD.top + CH + 13} fontSize={9} fill="#9ca3af" textAnchor="middle">{t.toFixed(1)}</text>
        ))}
        <text x={PAD.left + CW / 2} y={H - 2} fontSize={9} fill="#6b7280" textAnchor="middle">Time (hours)</text>
        <text x={10} y={PAD.top + CH / 2} fontSize={9} fill="#6b7280" textAnchor="middle" transform={`rotate(-90,10,${PAD.top + CH / 2})`}>Flow (m³/s)</text>
      </svg>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <HGCard label="Q Peak" value={`${data.Q_peak_m3s.toFixed(2)} m³/s`} />
        <HGCard label="Time to Peak" value={`${data.Tp_hr.toFixed(2)} hr`} />
        <HGCard label="Runoff Volume" value={`${(data.runoff_volume_m3 / 1000).toFixed(1)} Mm³`} />
        <HGCard label="Catchment" value={`${data.A_ha} ha, C=${data.C}`} />
      </div>
    </div>
  );
}

function HGCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded p-2 text-center bg-gray-800/60">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className="font-bold text-xs text-sky-400">{value}</div>
    </div>
  );
}
