import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../services/apiConfig';

const W = 520, H = 240;
const PAD = { top: 14, right: 20, bottom: 34, left: 56 };

interface TankData {
  depth_m: number[];
  hoop_kn_m: number[];
  pressure_kpa: number[];
  max_hoop_kn_m: number;
  max_pressure_kpa: number;
  W_water_kn: number;
  OTR: number;
  sliding_passes: boolean;
  overturning_passes: boolean;
}

interface Props {
  height: number; radius: number; gamma_w: number;
  wind_force: number; mu: number; tank_weight: number;
}

export function TankHoopStress({ height, radius, gamma_w, wind_force, mu, tank_weight }: Props) {
  const [data, setData] = useState<TankData | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    fetch(`${API_BASE}/env/simulation/tank-hoop-stress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ height, radius, gamma_w, wind_force, mu, tank_weight }),
      signal: ac.signal,
    }).then((r) => r.json()).then((d) => { setData(d as TankData); setLoading(false); }).catch(() => setLoading(false));
    return () => ac.abort();
  }, [height, radius, gamma_w, wind_force, mu, tank_weight]);

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">Calculating hoop stress…</div>;
  if (!data) return null;

  const ds = data.depth_m, hs = data.hoop_kn_m;
  const D_MAX = ds[ds.length - 1];
  const H_MAX = Math.max(...hs) * 1.1;

  // Left: tank elevation sketch (0..220), Right: hoop stress chart (260..520)
  const TANK_X = 20, TANK_Y = 20;
  const TANK_W = 80, TANK_H = 160;
  const CHART_X = 260;
  const CW = W - CHART_X - PAD.right;
  const CH = H - PAD.top - PAD.bottom;

  const sd = (d: number) => PAD.top + (d / D_MAX) * CH;
  const sh = (h: number) => CHART_X + (h / H_MAX) * CW;

  const poly = ds.map((d, i) => `${sh(hs[i])},${sd(d)}`).join(' ');
  const fill = `${sh(0)},${sd(0)} ` + ds.map((d, i) => `${sh(hs[i])},${sd(d)}`).join(' ') + ` ${sh(0)},${sd(D_MAX)}`;

  // Water fill in tank
  const waterFill = TANK_H * 0.85;

  return (
    <div className="space-y-2">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full rounded bg-gray-900/40">
        {/* Tank elevation */}
        <rect x={TANK_X} y={TANK_Y} width={TANK_W} height={TANK_H} fill="rgba(55,65,81,0.8)" stroke="#6b7280" strokeWidth={2} />
        {/* Water */}
        <rect x={TANK_X + 2} y={TANK_Y + TANK_H - waterFill} width={TANK_W - 4} height={waterFill - 2} fill="rgba(56,189,248,0.4)" />
        {/* Free surface */}
        <line x1={TANK_X + 2} y1={TANK_Y + TANK_H - waterFill} x2={TANK_X + TANK_W - 2} y2={TANK_Y + TANK_H - waterFill} stroke="#38bdf8" strokeWidth={1} />
        {/* Depth arrows at 1/4, 1/2, 3/4 */}
        {[0.25, 0.5, 0.75].map((f, i) => {
          const arrowY = TANK_Y + TANK_H - waterFill + waterFill * f;
          const alen = hs[Math.floor(f * (hs.length - 1))] / H_MAX * 30;
          return (
            <g key={i}>
              <line x1={TANK_X + TANK_W} y1={arrowY} x2={TANK_X + TANK_W + alen} y2={arrowY} stroke="#f97316" strokeWidth={1.5} />
            </g>
          );
        })}
        {/* Wind arrow */}
        <text x={TANK_X - 30} y={TANK_Y + TANK_H / 2} fontSize={9} fill="#60a5fa">→ Wind</text>
        {/* Labels */}
        <text x={TANK_X + TANK_W / 2} y={TANK_Y - 4} fontSize={8} fill="#9ca3af" textAnchor="middle">H={height}m r={radius}m</text>
        {/* Divider */}
        <line x1={240} y1={10} x2={240} y2={H - 10} stroke="#374151" strokeDasharray="4,3" />
        {/* Hoop stress chart */}
        <polygon points={fill} fill="rgba(249,115,22,0.15)" />
        <polyline points={poly} fill="none" stroke="#f97316" strokeWidth={2.5} />
        <line x1={CHART_X} y1={PAD.top} x2={CHART_X} y2={PAD.top + CH} stroke="#374151" />
        <line x1={CHART_X} y1={PAD.top + CH} x2={CHART_X + CW} y2={PAD.top + CH} stroke="#374151" />
        {([0, D_MAX / 2, D_MAX] as number[]).map((d, i) => (
          <text key={i} x={CHART_X - 4} y={sd(d) + 4} fontSize={9} fill="#9ca3af" textAnchor="end">{d.toFixed(1)}</text>
        ))}
        {([0, H_MAX / 2, H_MAX] as number[]).map((h, i) => (
          <text key={i} x={sh(h)} y={PAD.top + CH + 13} fontSize={8} fill="#9ca3af" textAnchor="middle">{h.toFixed(0)}</text>
        ))}
        <text x={CHART_X + CW / 2} y={H - 2} fontSize={9} fill="#6b7280" textAnchor="middle">Hoop Force T (kN/m)</text>
        <text x={CHART_X - 36} y={PAD.top + CH / 2} fontSize={9} fill="#6b7280" textAnchor="middle" transform={`rotate(-90,${CHART_X - 36},${PAD.top + CH / 2})`}>Depth (m)</text>
      </svg>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <THCard label="Max Hoop T" value={`${data.max_hoop_kn_m.toFixed(1)} kN/m`} />
        <THCard label="Max Pressure" value={`${data.max_pressure_kpa.toFixed(1)} kPa`} />
        <THCard label="OTR" value={`${data.OTR.toFixed(2)}`} color={data.overturning_passes ? 'green' : 'red'} />
        <THCard label="Sliding" value={data.sliding_passes ? 'PASS ✓' : 'FAIL ✗'} color={data.sliding_passes ? 'green' : 'red'} />
      </div>
    </div>
  );
}

function THCard({ label, value, color }: { label: string; value: string; color?: string }) {
  const cols: Record<string, string> = { green: 'text-green-400', red: 'text-red-400' };
  return (
    <div className="rounded p-2 text-center bg-gray-800/60">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className={`font-bold text-sm ${color ? (cols[color] ?? 'text-orange-400') : 'text-orange-400'}`}>{value}</div>
    </div>
  );
}
