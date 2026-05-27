import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../services/apiConfig';

const W = 520, H = 200;
const PAD = { top: 14, right: 20, bottom: 34, left: 52 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

interface SMData {
  day: number[];
  soil_moisture_mm: number[];
  irrigation_events_days: number[];
  daily_etc_mm: number;
  gross_irr_mm_event: number;
  irrigation_interval_days: number;
  FC: number;
  PWP: number;
}

interface Props {
  crop_area_ha: number; crop_coefficient_kc: number;
  reference_evapotranspiration_mm_day: number; irrigation_efficiency: number;
}

export function SoilMoisture({ crop_area_ha, crop_coefficient_kc, reference_evapotranspiration_mm_day, irrigation_efficiency }: Props) {
  const [data, setData] = useState<SMData | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    fetch(`${API_BASE}/env/simulation/soil-moisture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crop_area_ha, crop_coefficient_kc, reference_evapotranspiration_mm_day, irrigation_efficiency }),
      signal: ac.signal,
    }).then((r) => r.json()).then((d) => { setData(d as SMData); setLoading(false); }).catch(() => setLoading(false));
    return () => ac.abort();
  }, [crop_area_ha, crop_coefficient_kc, reference_evapotranspiration_mm_day, irrigation_efficiency]);

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">Calculating soil moisture balance…</div>;
  if (!data) return null;

  const ds = data.day, ms = data.soil_moisture_mm;
  const d_max = ds[ds.length - 1];
  const m_max = data.FC * 1.05;

  const sx = (d: number) => PAD.left + (d / d_max) * CW;
  const sm = (m: number) => PAD.top + CH - (m / m_max) * CH;

  const poly = ds.map((d, i) => `${sx(d)},${sm(ms[i])}`).join(' ');
  const fcY = sm(data.FC), pwpY = sm(data.PWP);
  const rawY = sm(data.FC - (data.FC - data.PWP) * 0.5);

  return (
    <div className="space-y-2">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full rounded bg-gray-900/40">
        {/* FC zone fill */}
        <rect x={PAD.left} y={rawY} width={CW} height={fcY - rawY} fill="rgba(56,189,248,0.1)" />
        {/* FC line */}
        <line x1={PAD.left} y1={fcY} x2={PAD.left + CW} y2={fcY} stroke="#38bdf8" strokeWidth={1} strokeDasharray="4,3" />
        <text x={PAD.left + CW + 2} y={fcY + 4} fontSize={8} fill="#38bdf8">FC</text>
        {/* RAW threshold */}
        <line x1={PAD.left} y1={rawY} x2={PAD.left + CW} y2={rawY} stroke="#f59e0b" strokeWidth={1} strokeDasharray="4,3" />
        <text x={PAD.left + CW + 2} y={rawY + 4} fontSize={8} fill="#f59e0b">RAW</text>
        {/* PWP line */}
        <line x1={PAD.left} y1={pwpY} x2={PAD.left + CW} y2={pwpY} stroke="#ef4444" strokeWidth={1} strokeDasharray="4,3" />
        <text x={PAD.left + CW + 2} y={pwpY + 4} fontSize={8} fill="#ef4444">PWP</text>
        {/* Irrigation event markers */}
        {data.irrigation_events_days.map((d, i) => (
          <line key={i} x1={sx(d)} y1={PAD.top} x2={sx(d)} y2={PAD.top + CH} stroke="#38bdf8" strokeWidth={1.5} opacity={0.5} />
        ))}
        {/* Soil moisture curve */}
        <polyline points={poly} fill="none" stroke="#22d3ee" strokeWidth={2} />
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + CH} stroke="#374151" />
        <line x1={PAD.left} y1={PAD.top + CH} x2={PAD.left + CW} y2={PAD.top + CH} stroke="#374151" />
        {([0, data.FC / 2, data.FC] as number[]).map((m, i) => (
          <text key={i} x={PAD.left - 4} y={sm(m) + 4} fontSize={9} fill="#9ca3af" textAnchor="end">{Math.round(m)}</text>
        ))}
        {([0, Math.round(d_max / 2), d_max] as number[]).map((d, i) => (
          <text key={i} x={sx(d)} y={PAD.top + CH + 13} fontSize={9} fill="#9ca3af" textAnchor="middle">{d}</text>
        ))}
        <text x={PAD.left + CW / 2} y={H - 2} fontSize={9} fill="#6b7280" textAnchor="middle">Day</text>
        <text x={10} y={PAD.top + CH / 2} fontSize={9} fill="#6b7280" textAnchor="middle" transform={`rotate(-90,10,${PAD.top + CH / 2})`}>mm</text>
      </svg>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <SoilCard label="Daily ETc" value={`${data.daily_etc_mm.toFixed(1)} mm`} />
        <SoilCard label="Irr. Volume" value={`${data.gross_irr_mm_event.toFixed(1)} mm`} />
        <SoilCard label="Irr. Interval" value={`${data.irrigation_interval_days.toFixed(0)} days`} />
        <SoilCard label="Events (60d)" value={`${data.irrigation_events_days.length}`} />
      </div>
    </div>
  );
}

function SoilCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded p-2 text-center bg-gray-800/60">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className="font-bold text-sm text-cyan-400">{value}</div>
    </div>
  );
}
