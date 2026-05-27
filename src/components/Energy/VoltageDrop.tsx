import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../services/apiConfig';

const W = 520, H = 200;
const PAD = { top: 16, right: 24, bottom: 36, left: 52 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

interface VoltageDropData {
  x_m: number[];
  voltage_v: number[];
  v_source: number;
  v_end: number;
  vd_actual_v: number;
  vd_actual_pct: number;
  max_vd_pct: number;
  csa_required_mm2: number;
  csa_selected_mm2: number;
  material: string;
  passes: boolean;
}

interface Props {
  cable_length_m: number;
  load_current_amps: number;
  system_voltage: number;
  cable_material: string;
  max_voltage_drop_percent: number;
}

export function VoltageDrop({ cable_length_m, load_current_amps, system_voltage, cable_material, max_voltage_drop_percent }: Props) {
  const [data, setData] = useState<VoltageDropData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    fetch(`${API_BASE}/energy/simulation/voltage-drop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cable_length_m, load_current_amps, system_voltage, cable_material, max_voltage_drop_percent }),
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((d) => { setData(d as VoltageDropData); setLoading(false); })
      .catch(() => setLoading(false));
    return () => ac.abort();
  }, [cable_length_m, load_current_amps, system_voltage, cable_material, max_voltage_drop_percent]);

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">Calculating voltage profile…</div>;
  if (!data) return null;

  const xs = data.x_m;
  const vs = data.voltage_v;
  const v_min = Math.min(...vs) - 2;
  const v_max = data.v_source + 2;
  const L = xs[xs.length - 1];

  const sx = (x: number) => PAD.left + (x / L) * CW;
  const sv = (v: number) => PAD.top + CH - ((v - v_min) / (v_max - v_min)) * CH;

  const poly = xs.map((x, i) => `${sx(x)},${sv(vs[i])}`).join(' ');
  const fill = `${sx(xs[0])},${sv(v_min)} ` + xs.map((x, i) => `${sx(x)},${sv(vs[i])}`).join(' ') + ` ${sx(xs[xs.length - 1])},${sv(v_min)}`;
  const v_limit = data.v_source * (1 - data.max_vd_pct / 100);
  const limitY = sv(v_limit);

  const hov = hoverIdx !== null ? { x: xs[hoverIdx], v: vs[hoverIdx] } : null;

  return (
    <div className="space-y-2">
      <svg
        width={W} height={H} viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded bg-gray-900/40"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = (e.clientX - rect.left) / rect.width * W;
          const idx = Math.round(((px - PAD.left) / CW) * (xs.length - 1));
          setHoverIdx(Math.max(0, Math.min(xs.length - 1, idx)));
        }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <polygon points={fill} fill="rgba(251,146,60,0.15)" />
        <line x1={PAD.left} y1={limitY} x2={W - PAD.right} y2={limitY} stroke="#ef4444" strokeWidth={1} strokeDasharray="4,3" />
        <text x={W - PAD.right + 2} y={limitY + 4} fontSize={9} fill="#ef4444">limit</text>
        <polyline points={poly} fill="none" stroke="#f97316" strokeWidth={2} />
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + CH} stroke="#374151" />
        <line x1={PAD.left} y1={PAD.top + CH} x2={PAD.left + CW} y2={PAD.top + CH} stroke="#374151" />
        {([v_min + 2, (v_min + v_max) / 2, v_max - 2] as number[]).map((v, i) => (
          <text key={i} x={PAD.left - 4} y={sv(v) + 4} fontSize={9} fill="#9ca3af" textAnchor="end">{Math.round(v)}</text>
        ))}
        {([0, L / 2, L] as number[]).map((x, i) => (
          <text key={i} x={sx(x)} y={PAD.top + CH + 14} fontSize={9} fill="#9ca3af" textAnchor="middle">{Math.round(x)}m</text>
        ))}
        <text x={PAD.left + CW / 2} y={H - 2} fontSize={9} fill="#6b7280" textAnchor="middle">Distance along cable</text>
        {hov && (
          <>
            <line x1={sx(hov.x)} y1={PAD.top} x2={sx(hov.x)} y2={PAD.top + CH} stroke="#f97316" strokeWidth={1} strokeDasharray="3,2" opacity={0.6} />
            <circle cx={sx(hov.x)} cy={sv(hov.v)} r={3} fill="#f97316" />
            <rect x={sx(hov.x) + 4} y={sv(hov.v) - 18} width={88} height={16} rx={3} fill="#111827" opacity={0.9} />
            <text x={sx(hov.x) + 8} y={sv(hov.v) - 6} fontSize={9} fill="#f97316">
              {Math.round(hov.x)}m → {hov.v.toFixed(1)} V
            </text>
          </>
        )}
      </svg>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <VDCard label="Selected CSA" value={`${data.csa_selected_mm2} mm²`} sub={data.material} />
        <VDCard label="Voltage Drop" value={`${data.vd_actual_pct}%`} sub={`${data.vd_actual_v.toFixed(2)} V`} alert={!data.passes} />
        <VDCard label="End Voltage" value={`${data.v_end.toFixed(1)} V`} sub={data.passes ? 'PASS ✓' : 'FAIL ✗'} alert={!data.passes} />
      </div>
    </div>
  );
}

function VDCard({ label, value, sub, alert }: { label: string; value: string; sub: string; alert?: boolean }) {
  return (
    <div className={`rounded p-2 text-center ${alert ? 'bg-red-900/30 border border-red-500/40' : 'bg-gray-800/60'}`}>
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className={`font-bold text-sm ${alert ? 'text-red-400' : 'text-orange-400'}`}>{value}</div>
      <div className="text-[10px] text-gray-500">{sub}</div>
    </div>
  );
}
