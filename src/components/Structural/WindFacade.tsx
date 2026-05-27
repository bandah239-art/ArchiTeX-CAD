import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../services/apiConfig';

const W = 520, H = 240;
const PAD = { top: 14, right: 20, bottom: 34, left: 52 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

interface WindData {
  z_m: number[];
  p_windward_kpa: number[];
  p_leeward_kpa: number;
  peak_windward_kpa: number;
  base_shear_kn: number;
  exposure_category: string;
}

interface Props {
  basic_wind_speed: number; building_height: number;
  building_width: number; building_length: number; exposure_category: string;
}

export function WindFacade({ basic_wind_speed, building_height, building_width, building_length, exposure_category }: Props) {
  const [data, setData] = useState<WindData | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    fetch(`${API_BASE}/structural/simulation/wind-facade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ basic_wind_speed, building_height, building_width, building_length, exposure_category }),
      signal: ac.signal,
    }).then((r) => r.json()).then((d) => { setData(d as WindData); setLoading(false); }).catch(() => setLoading(false));
    return () => ac.abort();
  }, [basic_wind_speed, building_height, building_width, building_length, exposure_category]);

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">Calculating wind pressures…</div>;
  if (!data) return null;

  const zs = data.z_m, ps = data.p_windward_kpa;
  const H_bld = zs[zs.length - 1];
  const p_max = Math.max(...ps) * 1.2;

  // Building occupies centre; arrows on left (windward) and right (leeward) sides
  const BLDG_X = 160, BLDG_W = 100;
  const CHART_X = BLDG_X + BLDG_W + 20;
  const CHART_W = W - CHART_X - PAD.right;

  const sz = (z: number) => PAD.top + CH - (z / H_bld) * CH;
  const sp = (p: number) => CHART_X + (p / p_max) * CHART_W;

  const windPoly = zs.map((z, i) => `${sp(ps[i])},${sz(z)}`).join(' ');
  const windFill = `${CHART_X},${sz(0)} ` + zs.map((z, i) => `${sp(ps[i])},${sz(z)}`).join(' ') + ` ${CHART_X},${sz(H_bld)}`;

  const leeLen = (data.p_leeward_kpa / p_max) * 36;

  return (
    <div className="space-y-2">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full rounded bg-gray-900/40">
        {/* Building rectangle */}
        <rect x={BLDG_X} y={sz(H_bld)} width={BLDG_W} height={CH} fill="rgba(55,65,81,0.8)" stroke="#6b7280" strokeWidth={1.5} />
        <text x={BLDG_X + BLDG_W / 2} y={sz(H_bld / 2)} fontSize={9} fill="#9ca3af" textAnchor="middle">Building</text>
        {/* Wind direction arrow */}
        <text x={PAD.left} y={sz(H_bld * 0.6)} fontSize={10} fill="#60a5fa">WIND →</text>
        {/* Windward pressure fill */}
        <polygon points={windFill} fill="rgba(96,165,250,0.2)" />
        <polyline points={windPoly} fill="none" stroke="#60a5fa" strokeWidth={2} />
        {/* Windward arrows (horizontal, pointing right toward building) */}
        {zs.filter((_, i) => i % 3 === 0).map((z, i) => {
          const arrowLen = (ps[i * 3] / p_max) * 36;
          return (
            <line key={i} x1={BLDG_X} y1={sz(z)} x2={BLDG_X - arrowLen} y2={sz(z)} stroke="#60a5fa" strokeWidth={1.5} markerEnd="url(#arrowB)" />
          );
        })}
        {/* Leeward (suction) uniform arrows */}
        {[0.2, 0.4, 0.6, 0.8].map((f, i) => (
          <line key={i} x1={BLDG_X + BLDG_W} y1={sz(H_bld * f)} x2={BLDG_X + BLDG_W + leeLen} y2={sz(H_bld * f)} stroke="#f97316" strokeWidth={1.5} />
        ))}
        <text x={BLDG_X + BLDG_W + leeLen + 2} y={sz(H_bld * 0.5) + 4} fontSize={8} fill="#f97316">suction</text>
        {/* Axes */}
        <line x1={CHART_X} y1={PAD.top} x2={CHART_X} y2={PAD.top + CH} stroke="#374151" />
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + CH} stroke="#374151" />
        <line x1={PAD.left} y1={PAD.top + CH} x2={PAD.left + CW} y2={PAD.top + CH} stroke="#374151" />
        {([0, H_bld / 2, H_bld] as number[]).map((z, i) => (
          <text key={i} x={PAD.left - 4} y={sz(z) + 4} fontSize={9} fill="#9ca3af" textAnchor="end">{z.toFixed(0)}</text>
        ))}
        {([0, p_max / 2, p_max] as number[]).map((p, i) => (
          <text key={i} x={sp(p)} y={PAD.top + CH + 13} fontSize={8} fill="#9ca3af" textAnchor="middle">{p.toFixed(2)}</text>
        ))}
        <text x={CHART_X + CHART_W / 2} y={H - 2} fontSize={9} fill="#6b7280" textAnchor="middle">Windward pressure (kPa)</text>
        <text x={10} y={PAD.top + CH / 2} fontSize={9} fill="#6b7280" textAnchor="middle" transform={`rotate(-90,10,${PAD.top + CH / 2})`}>Height (m)</text>
      </svg>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <WFCard label="Peak Windward" value={`${data.peak_windward_kpa.toFixed(3)} kPa`} />
        <WFCard label="Leeward Suction" value={`${data.p_leeward_kpa.toFixed(3)} kPa`} />
        <WFCard label="Base Shear" value={`${data.base_shear_kn.toFixed(1)} kN`} />
        <WFCard label="Exposure" value={`Cat. ${data.exposure_category}`} />
      </div>
    </div>
  );
}

function WFCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded p-2 text-center bg-gray-800/60">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className="font-bold text-sm text-sky-400">{value}</div>
    </div>
  );
}
