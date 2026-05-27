import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../services/apiConfig';

const W = 520, H = 230;
const PAD = { top: 16, right: 24, bottom: 36, left: 52 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

interface CatenaryData {
  x_m: number[];
  y_cold_m: number[];
  y_hot_m: number[];
  sag_cold_m: number;
  sag_hot_m: number;
  attachment_height_m: number;
  clearance_hot_m: number;
  required_clearance_m: number;
  H_N: number;
  passes: boolean;
  temperature_c: number;
}

interface Props {
  span_length_m: number;
  conductor_weight_kg_m: number;
  max_tension_kg: number;
  ground_clearance_m: number;
  temperature_c: number;
}

export function CatenaryProfile({ span_length_m, conductor_weight_kg_m, max_tension_kg, ground_clearance_m, temperature_c }: Props) {
  const [data, setData] = useState<CatenaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    fetch(`${API_BASE}/energy/simulation/catenary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ span_length_m, conductor_weight_kg_m, max_tension_kg, ground_clearance_m, temperature_c }),
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((d) => { setData(d as CatenaryData); setLoading(false); })
      .catch(() => setLoading(false));
    return () => ac.abort();
  }, [span_length_m, conductor_weight_kg_m, max_tension_kg, ground_clearance_m, temperature_c]);

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">Calculating catenary profile…</div>;
  if (!data) return null;

  const xs = data.x_m;
  const allY = [...data.y_cold_m, ...data.y_hot_m, 0];
  const y_min = Math.max(0, Math.min(...allY) - 1);
  const y_max = Math.max(...allY) + 1;
  const L = xs[xs.length - 1];

  const sx = (x: number) => PAD.left + (x / L) * CW;
  const sy = (y: number) => PAD.top + CH - ((y - y_min) / (y_max - y_min)) * CH;

  const coldPoly = xs.map((x, i) => `${sx(x)},${sy(data.y_cold_m[i])}`).join(' ');
  const hotPoly = xs.map((x, i) => `${sx(x)},${sy(data.y_hot_m[i])}`).join(' ');

  const gcY = sy(data.required_clearance_m);
  const groundY = sy(0);
  const attachY = sy(data.attachment_height_m);

  return (
    <div className="space-y-2">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full rounded bg-gray-900/40">
        {/* Ground fill */}
        <rect x={PAD.left} y={groundY} width={CW} height={H - groundY - 4} fill="rgba(78,52,18,0.35)" />
        {/* Ground clearance limit */}
        <line x1={PAD.left} y1={gcY} x2={PAD.left + CW} y2={gcY} stroke="#ef4444" strokeWidth={1} strokeDasharray="4,3" />
        <text x={PAD.left + 4} y={gcY - 3} fontSize={8} fill="#ef4444">min clearance {data.required_clearance_m.toFixed(1)}m</text>
        {/* Tower poles */}
        <line x1={sx(0)} y1={attachY} x2={sx(0)} y2={groundY} stroke="#9ca3af" strokeWidth={4} strokeLinecap="round" />
        <line x1={sx(L)} y1={attachY} x2={sx(L)} y2={groundY} stroke="#9ca3af" strokeWidth={4} strokeLinecap="round" />
        {/* Cross arm */}
        <line x1={sx(0) - 8} y1={attachY} x2={sx(0) + 8} y2={attachY} stroke="#9ca3af" strokeWidth={2} />
        <line x1={sx(L) - 8} y1={attachY} x2={sx(L) + 8} y2={attachY} stroke="#9ca3af" strokeWidth={2} />
        {/* Cold profile (20°C) */}
        <polyline points={coldPoly} fill="none" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="6,3" />
        {/* Hot profile */}
        <polyline points={hotPoly} fill="none" stroke="#f97316" strokeWidth={2.5} />
        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + CH} stroke="#374151" />
        <line x1={PAD.left} y1={PAD.top + CH} x2={PAD.left + CW} y2={PAD.top + CH} stroke="#374151" />
        {([0, data.required_clearance_m, data.attachment_height_m] as number[]).map((y, i) => (
          <text key={i} x={PAD.left - 4} y={sy(y) + 4} fontSize={9} fill="#9ca3af" textAnchor="end">{y.toFixed(1)}</text>
        ))}
        {([0, L / 2, L] as number[]).map((x, i) => (
          <text key={i} x={sx(x)} y={PAD.top + CH + 14} fontSize={9} fill="#9ca3af" textAnchor="middle">{Math.round(x)}m</text>
        ))}
        <text x={PAD.left + CW / 2} y={H - 2} fontSize={9} fill="#6b7280" textAnchor="middle">Distance along span</text>
        {/* Legend */}
        <line x1={W - 130} y1={PAD.top + 8} x2={W - 110} y2={PAD.top + 8} stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="6,3" />
        <text x={W - 108} y={PAD.top + 12} fontSize={8} fill="#60a5fa">20°C</text>
        <line x1={W - 130} y1={PAD.top + 20} x2={W - 110} y2={PAD.top + 20} stroke="#f97316" strokeWidth={2.5} />
        <text x={W - 108} y={PAD.top + 24} fontSize={8} fill="#f97316">{data.temperature_c}°C</text>
      </svg>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <CatCard label="Sag @ 20°C" value={`${data.sag_cold_m.toFixed(2)} m`} color="blue" />
        <CatCard label={`Sag @ ${data.temperature_c}°C`} value={`${data.sag_hot_m.toFixed(2)} m`} color="orange" />
        <CatCard label="Tower Height" value={`${data.attachment_height_m.toFixed(2)} m`} color="gray" />
        <CatCard label="Hot Clearance" value={`${data.clearance_hot_m.toFixed(2)} m`} color={data.passes ? 'green' : 'red'} sub={data.passes ? 'PASS ✓' : 'FAIL ✗'} />
      </div>
    </div>
  );
}

function CatCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  const cols: Record<string, string> = {
    blue: 'text-blue-400', orange: 'text-orange-400', gray: 'text-gray-300', green: 'text-green-400', red: 'text-red-400',
  };
  return (
    <div className="rounded p-2 text-center bg-gray-800/60">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className={`font-bold text-sm ${cols[color] ?? 'text-white'}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-500">{sub}</div>}
    </div>
  );
}
