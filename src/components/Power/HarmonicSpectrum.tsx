import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../services/apiConfig';

const W = 520, H = 200;
const PAD = { top: 16, right: 24, bottom: 36, left: 52 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

interface HarmonicData {
  harmonic_orders: number[];
  harmonic_voltages_pct: number[];
  iec_limits_pct: number[];
  thd_v_pct: number;
  thd_i_pct: number;
  violations: number[];
  fundamental_voltage_v: number;
  fundamental_current_a: number;
  status: string;
}

interface Props {
  system_voltage_v: number;
  load_kva: number;
  system_impedance_ohm: number;
  cable_r_ohm: number;
  cable_x_ohm: number;
  fund_freq_hz?: number;
}

export function HarmonicSpectrum({ system_voltage_v, load_kva, system_impedance_ohm, cable_r_ohm, cable_x_ohm, fund_freq_hz = 50 }: Props) {
  const [data, setData] = useState<HarmonicData | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    fetch(`${API_BASE}/power/harmonics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system_voltage_v, load_kva, system_impedance_ohm, cable_r_ohm, cable_x_ohm, fund_freq_hz }),
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
    return () => ac.abort();
  }, [system_voltage_v, load_kva, system_impedance_ohm, cable_r_ohm, cable_x_ohm, fund_freq_hz]);

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">Calculating harmonic spectrum…</div>;
  if (!data || data.status !== 'ok') return null;

  const orders = data.harmonic_orders.slice(1); // exclude fundamental (h=1)
  const pcts = data.harmonic_voltages_pct.slice(1);
  const limits = data.iec_limits_pct.slice(1);
  const n = orders.length;
  const barW = CW / n;
  const v_max = Math.max(...pcts, ...limits) * 1.15;

  const sx = (i: number) => PAD.left + i * barW + barW / 2;
  const sh = (v: number) => PAD.top + CH - (v / v_max) * CH;

  return (
    <div className="space-y-2">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full rounded bg-gray-900/40">
        {/* IEC limit step line */}
        {orders.map((h, i) => {
          const lim = limits[i];
          const x0 = PAD.left + i * barW;
          const x1 = x0 + barW;
          const y = sh(lim);
          return <line key={h} x1={x0} y1={y} x2={x1} y2={y} stroke="#ef4444" strokeWidth={1} opacity={0.7} />;
        })}
        {/* Bars */}
        {orders.map((h, i) => {
          const v = pcts[i];
          const violated = data.violations.includes(h);
          const x = PAD.left + i * barW + 1;
          const bw = barW - 2;
          const bh = (v / v_max) * CH;
          const by = PAD.top + CH - bh;
          return (
            <rect key={h} x={x} y={by} width={bw} height={bh}
              fill={violated ? '#ef4444' : '#6366f1'} opacity={0.8} />
          );
        })}
        {/* X axis labels (odd harmonics) */}
        {orders.map((h, i) => (
          h % 2 !== 0 || h <= 6 ? (
            <text key={h} x={sx(i)} y={PAD.top + CH + 13} fontSize={8} fill="#9ca3af" textAnchor="middle">{h}</text>
          ) : null
        ))}
        {[0, v_max / 2, v_max].map((v, i) => (
          <text key={i} x={PAD.left - 4} y={sh(v) + 4} fontSize={9} fill="#9ca3af" textAnchor="end">{v.toFixed(1)}</text>
        ))}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + CH} stroke="#374151" />
        <line x1={PAD.left} y1={PAD.top + CH} x2={PAD.left + CW} y2={PAD.top + CH} stroke="#374151" />
        <text x={PAD.left + CW / 2} y={H - 2} fontSize={9} fill="#6b7280" textAnchor="middle">Harmonic Order</text>
        <text x={12} y={PAD.top + CH / 2} fontSize={9} fill="#6b7280" textAnchor="middle" transform={`rotate(-90,12,${PAD.top + CH / 2})`}>Vh (%)</text>
        {/* IEC limit legend */}
        <line x1={W - 100} y1={PAD.top + 8} x2={W - 80} y2={PAD.top + 8} stroke="#ef4444" strokeWidth={1} />
        <text x={W - 78} y={PAD.top + 12} fontSize={8} fill="#ef4444">IEC 61000-2-2 limit</text>
        <rect x={W - 100} y={PAD.top + 18} width={10} height={8} fill="#6366f1" opacity={0.8} />
        <text x={W - 88} y={PAD.top + 26} fontSize={8} fill="#6366f1">Vh (% V1)</text>
      </svg>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <HSCard label="THD-V" value={`${data.thd_v_pct.toFixed(2)}%`} alert={data.thd_v_pct > 5} />
        <HSCard label="THD-I" value={`${data.thd_i_pct.toFixed(2)}%`} alert={data.thd_i_pct > 8} />
        <HSCard label="Violations" value={data.violations.length === 0 ? 'None ✓' : `H${data.violations.join(', H')}`} alert={data.violations.length > 0} />
      </div>
    </div>
  );
}

function HSCard({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`rounded p-2 text-center ${alert ? 'bg-red-900/30 border border-red-700/40' : 'bg-gray-800/60'}`}>
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className={`font-bold text-sm ${alert ? 'text-red-400' : 'text-indigo-400'}`}>{value}</div>
    </div>
  );
}
