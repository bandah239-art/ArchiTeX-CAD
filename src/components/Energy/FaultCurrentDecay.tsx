import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../services/apiConfig';

const W = 520, H = 220;
const PAD = { top: 16, right: 36, bottom: 36, left: 56 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

interface FaultData {
  time_s: number[];
  i_ac_ka: number[];
  i_dc_ka: number[];
  i_total_ka: number[];
  I_dd_ka: number;
  I_d_ka: number;
  I_ss_ka: number;
  V_phase_v: number;
  T_dc_s: number;
}

interface Props {
  generator_kva: number;
  generator_voltage_v: number;
  generator_subtransient_reactance_pu: number;
  cable_length_m: number;
  cable_resistance_ohm_km: number;
  cable_reactance_ohm_km: number;
}

export function FaultCurrentDecay({
  generator_kva, generator_voltage_v, generator_subtransient_reactance_pu,
  cable_length_m, cable_resistance_ohm_km, cable_reactance_ohm_km,
}: Props) {
  const [data, setData] = useState<FaultData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    fetch(`${API_BASE}/energy/simulation/fault-current-decay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generator_kva, generator_voltage_v, generator_subtransient_reactance_pu,
        cable_length_m, cable_resistance_ohm_km, cable_reactance_ohm_km,
      }),
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((d) => { setData(d as FaultData); setLoading(false); })
      .catch(() => setLoading(false));
    return () => ac.abort();
  }, [generator_kva, generator_voltage_v, generator_subtransient_reactance_pu, cable_length_m, cable_resistance_ohm_km, cable_reactance_ohm_km]);

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">Calculating fault current decay…</div>;
  if (!data) return null;

  const ts = data.time_s;
  const allI = [...data.i_ac_ka, ...data.i_total_ka];
  const i_max = Math.max(...allI) * 1.1;
  const t_max = ts[ts.length - 1];

  const sx = (t: number) => PAD.left + (t / t_max) * CW;
  const si = (i: number) => PAD.top + CH - (i / i_max) * CH;

  const acPoly = ts.map((t, k) => `${sx(t)},${si(data.i_ac_ka[k])}`).join(' ');
  const totPoly = ts.map((t, k) => `${sx(t)},${si(data.i_total_ka[k])}`).join(' ');

  const markers = [
    { val: data.I_dd_ka, color: '#ef4444', label: "I''" },
    { val: data.I_d_ka,  color: '#f59e0b', label: "I'"  },
    { val: data.I_ss_ka, color: '#10b981', label: 'Iss' },
  ];

  const hov = hoverIdx !== null ? { t: ts[hoverIdx], ac: data.i_ac_ka[hoverIdx], tot: data.i_total_ka[hoverIdx] } : null;

  return (
    <div className="space-y-2">
      <svg
        width={W} height={H} viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded bg-gray-900/40"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = (e.clientX - rect.left) / rect.width * W;
          const idx = Math.round(((px - PAD.left) / CW) * (ts.length - 1));
          setHoverIdx(Math.max(0, Math.min(ts.length - 1, idx)));
        }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Horizontal level markers */}
        {markers.map(({ val, color, label }) => (
          <g key={label}>
            <line x1={PAD.left} y1={si(val)} x2={PAD.left + CW} y2={si(val)} stroke={color} strokeWidth={1} strokeDasharray="4,3" opacity={0.6} />
            <text x={PAD.left + CW + 2} y={si(val) + 4} fontSize={8} fill={color}>{label}</text>
          </g>
        ))}
        {/* Asymmetric total */}
        <polyline points={totPoly} fill="none" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3,2" opacity={0.7} />
        {/* AC symmetrical envelope */}
        <polyline points={acPoly} fill="none" stroke="#60a5fa" strokeWidth={2.5} />
        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + CH} stroke="#374151" />
        <line x1={PAD.left} y1={PAD.top + CH} x2={PAD.left + CW} y2={PAD.top + CH} stroke="#374151" />
        {([0, i_max / 2, i_max] as number[]).map((v, i) => (
          <text key={i} x={PAD.left - 4} y={si(v) + 4} fontSize={9} fill="#9ca3af" textAnchor="end">{v.toFixed(2)}</text>
        ))}
        {([0, 0.5, 1, 1.5, 2, 2.5, 3] as number[]).map((t, i) => (
          <text key={i} x={sx(t)} y={PAD.top + CH + 14} fontSize={9} fill="#9ca3af" textAnchor="middle">{t}</text>
        ))}
        <text x={PAD.left + CW / 2} y={H - 2} fontSize={9} fill="#6b7280" textAnchor="middle">Time after fault (s)</text>
        <text x={12} y={PAD.top + CH / 2} fontSize={9} fill="#6b7280" textAnchor="middle" transform={`rotate(-90,12,${PAD.top + CH / 2})`}>kA</text>
        {/* Legend */}
        <line x1={PAD.left + 4} y1={PAD.top + 8} x2={PAD.left + 24} y2={PAD.top + 8} stroke="#60a5fa" strokeWidth={2.5} />
        <text x={PAD.left + 28} y={PAD.top + 12} fontSize={8} fill="#60a5fa">AC sym.</text>
        <line x1={PAD.left + 80} y1={PAD.top + 8} x2={PAD.left + 100} y2={PAD.top + 8} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3,2" />
        <text x={PAD.left + 104} y={PAD.top + 12} fontSize={8} fill="#ef4444">Asymmetric</text>
        {/* Hover crosshair */}
        {hov && (
          <>
            <line x1={sx(hov.t)} y1={PAD.top} x2={sx(hov.t)} y2={PAD.top + CH} stroke="#60a5fa" strokeWidth={1} strokeDasharray="3,2" opacity={0.5} />
            <circle cx={sx(hov.t)} cy={si(hov.ac)} r={3} fill="#60a5fa" />
            <rect x={sx(hov.t) + 4} y={si(hov.ac) - 30} width={116} height={30} rx={3} fill="#111827" opacity={0.9} />
            <text x={sx(hov.t) + 8} y={si(hov.ac) - 16} fontSize={9} fill="#60a5fa">{hov.t.toFixed(2)}s AC: {hov.ac.toFixed(3)} kA</text>
            <text x={sx(hov.t) + 8} y={si(hov.ac) - 4} fontSize={9} fill="#ef4444">  Total: {hov.tot.toFixed(3)} kA</text>
          </>
        )}
      </svg>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <FCCard label="Subtransient I''" value={`${data.I_dd_ka} kA`} sub="t = 0⁺" color="red" />
        <FCCard label="Transient I'" value={`${data.I_d_ka} kA`} sub="~1 s" color="amber" />
        <FCCard label="Steady-state Iss" value={`${data.I_ss_ka} kA`} sub="t → ∞" color="green" />
      </div>
    </div>
  );
}

function FCCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const cols: Record<string, string> = { red: 'text-red-400', amber: 'text-amber-400', green: 'text-green-400' };
  return (
    <div className="rounded p-2 text-center bg-gray-800/60">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className={`font-bold text-sm ${cols[color] ?? 'text-white'}`}>{value}</div>
      <div className="text-[10px] text-gray-500">{sub}</div>
    </div>
  );
}
