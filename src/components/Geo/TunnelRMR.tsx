import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../services/apiConfig';

const W = 520, H = 260;

interface RMRData {
  rmr_total: number;
  rock_class: string;
  rock_class_num: number;
  bolt_length_m: number;
  bolt_spacing_m: number;
  shotcrete_mm: number;
  stand_up_time: string;
  rqd_rating: number;
  ucs_rating: number;
  joint_spacing_rating: number;
  joint_condition_rating: number;
  groundwater_rating: number;
  ratings_labels: { label: string; value: number; max: number }[];
}

interface Props {
  rqd_percent: number; intact_rock_strength_mpa: number;
  joint_spacing_rating: number; joint_condition_rating: number; groundwater_rating: number;
}

export function TunnelRMR({ rqd_percent, intact_rock_strength_mpa, joint_spacing_rating, joint_condition_rating, groundwater_rating }: Props) {
  const [data, setData] = useState<RMRData | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    fetch(`${API_BASE}/geo/simulation/rmr-support`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rqd_percent, intact_rock_strength_mpa, joint_spacing_rating, joint_condition_rating, groundwater_rating }),
      signal: ac.signal,
    }).then((r) => r.json()).then((d) => { setData(d as RMRData); setLoading(false); }).catch(() => setLoading(false));
    return () => ac.abort();
  }, [rqd_percent, intact_rock_strength_mpa, joint_spacing_rating, joint_condition_rating, groundwater_rating]);

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">Calculating RMR support…</div>;
  if (!data) return null;

  const classColors: Record<number, string> = { 1: '#10b981', 2: '#22d3ee', 3: '#f59e0b', 4: '#f97316', 5: '#ef4444' };
  const barColor = classColors[data.rock_class_num] ?? '#6b7280';

  // Bar chart area: left half (0..260)
  const BAR_X = 10, BAR_W = 240;
  const ratings = data.ratings_labels ?? [];
  const barH = 22, barGap = 8;
  const totalBars = ratings.length;
  const chartH = totalBars * (barH + barGap);
  const BAR_Y = (H - chartH) / 2;

  // Tunnel cross-section: right half (270..520)
  const CX = 390, CY = 130, R = 60;
  const floorY = CY + R * 0.6;

  return (
    <div className="space-y-2">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full rounded bg-gray-900/40">
        {/* Bar chart */}
        {ratings.map((r, i) => {
          const bw = (r.value / r.max) * BAR_W;
          const y = BAR_Y + i * (barH + barGap);
          return (
            <g key={i}>
              <rect x={BAR_X} y={y} width={BAR_W} height={barH} fill="rgba(55,65,81,0.5)" rx={3} />
              <rect x={BAR_X} y={y} width={bw} height={barH} fill={barColor} opacity={0.7} rx={3} />
              <text x={BAR_X + 4} y={y + barH / 2 + 4} fontSize={9} fill="#e5e7eb">{r.label}</text>
              <text x={BAR_X + BAR_W - 4} y={y + barH / 2 + 4} fontSize={9} fill="#e5e7eb" textAnchor="end">{r.value}/{r.max}</text>
            </g>
          );
        })}
        {/* RMR total */}
        <text x={BAR_X} y={BAR_Y + totalBars * (barH + barGap) + 16} fontSize={11} fill={barColor} fontWeight="bold">
          RMR = {data.rmr_total} → Class {data.rock_class_num} ({data.rock_class})
        </text>

        {/* Divider */}
        <line x1={265} y1={10} x2={265} y2={H - 10} stroke="#374151" strokeDasharray="4,3" />

        {/* Tunnel horseshoe */}
        {/* Crown arc */}
        <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="rgba(30,30,30,0.8)" stroke="#6b7280" strokeWidth={2} />
        {/* Walls */}
        <line x1={CX - R} y1={CY} x2={CX - R} y2={floorY} stroke="#6b7280" strokeWidth={2} />
        <line x1={CX + R} y1={CY} x2={CX + R} y2={floorY} stroke="#6b7280" strokeWidth={2} />
        {/* Floor */}
        <line x1={CX - R} y1={floorY} x2={CX + R} y2={floorY} stroke="#6b7280" strokeWidth={2} />
        {/* Rock mass hatching */}
        {[-1, 0, 1].map((di) => (
          <g key={di}>
            <line x1={CX - R - 20} y1={CY - 20 + di * 20} x2={CX - R} y2={CY - 20 + di * 20} stroke="#374151" strokeWidth={1} />
            <line x1={CX + R} y1={CY - 20 + di * 20} x2={CX + R + 20} y2={CY - 20 + di * 20} stroke="#374151" strokeWidth={1} />
          </g>
        ))}
        {/* Shotcrete layer */}
        {data.shotcrete_mm > 0 && (
          <path d={`M ${CX - R + 6} ${CY + 3} A ${R - 8} ${R - 8} 0 0 1 ${CX + R - 6} ${CY + 3}`}
            fill="none" stroke="#f59e0b" strokeWidth={3} opacity={0.6} />
        )}
        {/* Rock bolts */}
        {data.bolt_length_m > 0 && [-45, 0, 45].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const bx = CX - R * Math.cos(rad + Math.PI / 2);
          const by = CY - R * Math.sin(rad + Math.PI / 2);
          const scale = 30;
          return (
            <line key={i} x1={bx} y1={by}
              x2={bx - Math.cos(rad + Math.PI / 2) * scale}
              y2={by - Math.sin(rad + Math.PI / 2) * scale}
              stroke="#60a5fa" strokeWidth={2} />
          );
        })}
        {/* Labels */}
        <text x={CX} y={floorY + 20} fontSize={8} fill="#9ca3af" textAnchor="middle">Bolt L={data.bolt_length_m}m @ {data.bolt_spacing_m}m</text>
        <text x={CX} y={floorY + 32} fontSize={8} fill="#9ca3af" textAnchor="middle">Shotcrete: {data.shotcrete_mm}mm</text>
        <text x={CX} y={floorY + 44} fontSize={8} fill="#6b7280" textAnchor="middle">Stand-up: {data.stand_up_time}</text>
      </svg>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <RMRCard label="RMR Total" value={`${data.rmr_total}/100`} color={barColor} />
        <RMRCard label="Bolt Length" value={`${data.bolt_length_m} m`} color="#60a5fa" />
        <RMRCard label="Shotcrete" value={`${data.shotcrete_mm} mm`} color="#f59e0b" />
        <RMRCard label="Stand-up" value={data.stand_up_time} color="#9ca3af" />
      </div>
    </div>
  );
}

function RMRCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded p-2 text-center bg-gray-800/60">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className="font-bold text-xs" style={{ color }}>{value}</div>
    </div>
  );
}
