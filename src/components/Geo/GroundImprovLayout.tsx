import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../services/apiConfig';

const W = 520, H = 240;

interface GIData {
  area_ratio: number;
  n_columns_total: number;
  improvement_factor: number;
  column_positions: [number, number][];
  column_diameter_m: number;
  column_spacing_m: number;
  pattern: string;
  depth_m: number;
  grid_size_m: number;
}

interface Props {
  column_diameter_m: number; column_spacing_m: number;
  depth_m: number; pattern: string; area_to_improve_m2: number;
}

export function GroundImprovLayout({ column_diameter_m, column_spacing_m, depth_m, pattern, area_to_improve_m2 }: Props) {
  const [data, setData] = useState<GIData | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    fetch(`${API_BASE}/geo/simulation/ground-improvement-layout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ column_diameter_m, column_spacing_m, depth_m, pattern, area_to_improve_m2 }),
      signal: ac.signal,
    }).then((r) => r.json()).then((d) => { setData(d as GIData); setLoading(false); }).catch(() => setLoading(false));
    return () => ac.abort();
  }, [column_diameter_m, column_spacing_m, depth_m, pattern, area_to_improve_m2]);

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">Generating column layout…</div>;
  if (!data) return null;

  // Plan view: left half (0..260) + elevation: right half (270..520)
  const PLAN_X = 10, PLAN_Y = 20, PLAN_SIZE = 230;
  const gs = data.grid_size_m;
  const scale = PLAN_SIZE / gs;
  const r_px = (data.column_diameter_m / 2) * scale;

  const ELEV_X = 280, ELEV_W = 220, ELEV_Y = 20, ELEV_H = H - 40;
  const col_h_px = (data.depth_m / (data.depth_m + 2)) * ELEV_H;

  return (
    <div className="space-y-2">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full rounded bg-gray-900/40">
        {/* Plan view title */}
        <text x={PLAN_X + PLAN_SIZE / 2} y={14} fontSize={9} fill="#9ca3af" textAnchor="middle">Plan View (display grid)</text>
        {/* Plan boundary */}
        <rect x={PLAN_X} y={PLAN_Y} width={PLAN_SIZE} height={PLAN_SIZE} fill="rgba(120,100,60,0.15)" stroke="#6b7280" strokeWidth={1} rx={2} />
        {/* Columns */}
        {data.column_positions.map(([cx, cy], i) => (
          <circle key={i}
            cx={PLAN_X + cx * scale}
            cy={PLAN_Y + cy * scale}
            r={Math.max(r_px, 3)}
            fill="rgba(251,146,60,0.7)" stroke="#f97316" strokeWidth={0.8}
          />
        ))}
        {/* Spacing dimension */}
        {data.column_positions.length >= 2 && (
          <line x1={PLAN_X + data.column_positions[0][0] * scale} y1={PLAN_Y + data.column_positions[0][1] * scale}
            x2={PLAN_X + data.column_positions[1][0] * scale} y2={PLAN_Y + data.column_positions[1][1] * scale}
            stroke="#f59e0b" strokeWidth={0.8} strokeDasharray="3,2" />
        )}

        {/* Divider */}
        <line x1={265} y1={10} x2={265} y2={H - 10} stroke="#374151" strokeDasharray="4,3" />

        {/* Elevation: show 3 columns side by side */}
        <text x={ELEV_X + ELEV_W / 2} y={14} fontSize={9} fill="#9ca3af" textAnchor="middle">Elevation View</text>
        {/* Ground surface */}
        <line x1={ELEV_X} y1={ELEV_Y + 20} x2={ELEV_X + ELEV_W} y2={ELEV_Y + 20} stroke="#92400e" strokeWidth={2} />
        {/* Soil background */}
        <rect x={ELEV_X} y={ELEV_Y + 20} width={ELEV_W} height={ELEV_H - 20} fill="rgba(120,80,40,0.2)" />
        {/* 3 stone columns */}
        {[0.2, 0.5, 0.8].map((f, i) => {
          const cx = ELEV_X + f * ELEV_W;
          const cw = Math.max(r_px * 2, 8);
          return (
            <g key={i}>
              <rect x={cx - cw / 2} y={ELEV_Y + 20} width={cw} height={col_h_px} fill="rgba(251,146,60,0.6)" stroke="#f97316" strokeWidth={1} />
              {/* Depth label on first column */}
              {i === 1 && (
                <>
                  <line x1={cx + cw / 2 + 4} y1={ELEV_Y + 20} x2={cx + cw / 2 + 4} y2={ELEV_Y + 20 + col_h_px} stroke="#f59e0b" strokeWidth={1} />
                  <text x={cx + cw / 2 + 8} y={ELEV_Y + 20 + col_h_px / 2 + 4} fontSize={8} fill="#f59e0b">{data.depth_m}m</text>
                </>
              )}
            </g>
          );
        })}
        {/* Spacing label */}
        <text x={ELEV_X + ELEV_W / 2} y={ELEV_Y + ELEV_H + 14} fontSize={8} fill="#9ca3af" textAnchor="middle">Spacing = {data.column_spacing_m}m | D = {data.column_diameter_m}m</text>
      </svg>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <GICard label="Columns" value={`${data.n_columns_total}`} />
        <GICard label="Area Ratio" value={`${(data.area_ratio * 100).toFixed(1)}%`} />
        <GICard label="Imprv. Factor" value={`${data.improvement_factor.toFixed(2)}×`} />
        <GICard label="Pattern" value={data.pattern.charAt(0).toUpperCase() + data.pattern.slice(1)} />
      </div>
    </div>
  );
}

function GICard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded p-2 text-center bg-gray-800/60">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className="font-bold text-sm text-orange-400">{value}</div>
    </div>
  );
}
