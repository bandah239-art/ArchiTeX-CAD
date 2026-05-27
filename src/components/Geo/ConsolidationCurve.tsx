import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../../services/apiConfig';

interface CurvePoint {
  time_years: number;
  U_pct: number;
  settlement_mm: number;
}

interface Summary {
  total_settlement_mm: number;
  t50_years: number;
  t90_years: number;
  t99_years: number;
  drainage_path_m: number;
  cv_m2_yr: number;
}

interface Props {
  clay_thickness_m?: number;
  drainage?: string;
  cv_m2_yr?: number;
  cc?: number;
  e0?: number;
  sigma0_kpa?: number;
  delta_sigma_kpa?: number;
}

const W = 520, H = 210;
const PAD = { top: 16, right: 20, bottom: 40, left: 52 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

export function ConsolidationCurve({
  clay_thickness_m = 5,
  drainage = 'double',
  cv_m2_yr = 1.5,
  cc = 0.25,
  e0 = 0.8,
  sigma0_kpa = 100,
  delta_sigma_kpa = 50,
}: Props) {
  const [curve, setCurve] = useState<CurvePoint[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);

    fetch(`${API_BASE}/geo/simulation/consolidation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clay_thickness_m, drainage, cv_m2_yr, cc, e0, sigma0_kpa, delta_sigma_kpa }),
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 'ok') {
          setCurve(d.curve as CurvePoint[]);
          setSummary(d.summary as Summary);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clay_thickness_m, drainage, cv_m2_yr, cc, e0, sigma0_kpa, delta_sigma_kpa]);

  if (!curve.length || !summary)
    return (
      <div className="h-[210px] flex items-center justify-center text-gray-500 text-xs">
        {loading ? 'Loading consolidation curve…' : 'No data'}
      </div>
    );

  const maxT = summary.t99_years;
  const maxS = summary.total_settlement_mm;

  const sx = (t: number) => PAD.left + (t / maxT) * PLOT_W;
  const sy = (s: number) => PAD.top + (s / maxS) * PLOT_H; // settlement grows downward

  // Settlement line path
  const linePath = curve
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.time_years).toFixed(1)},${sy(p.settlement_mm).toFixed(1)}`)
    .join(' ');

  // Area fill
  const areaPath =
    `M${sx(0)},${sy(0)} ` +
    curve.map((p) => `L${sx(p.time_years).toFixed(1)},${sy(p.settlement_mm).toFixed(1)}`).join(' ') +
    ` L${sx(maxT)},${sy(maxS)} L${sx(0)},${sy(maxS)} Z`;

  // t50 and t90 x positions
  const x50 = sx(summary.t50_years);
  const x90 = sx(summary.t90_years);

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map((f) => ({
    val: f * maxS,
    y: sy(f * maxS),
    label: `${(f * maxS).toFixed(0)}`,
  }));

  // X-axis ticks (5 ticks)
  const xTicks = [0, 0.25, 0.5, 0.75, 1.0].map((f) => ({
    t: f * maxT,
    x: sx(f * maxT),
    label: (f * maxT).toFixed(f === 0 ? 0 : 1),
  }));

  const hovered = hoverIdx !== null ? curve[hoverIdx] : null;

  return (
    <div className="space-y-2">
      <svg
        width={W}
        height={H}
        className="w-full max-w-full"
        viewBox={`0 0 ${W} ${H}`}
        style={{ background: '#111827', borderRadius: 6 }}
      >
        {/* Grid lines */}
        {yTicks.map((t) => (
          <line key={t.val} x1={PAD.left} x2={W - PAD.right} y1={t.y} y2={t.y} stroke="#374151" strokeWidth={0.5} />
        ))}
        {xTicks.map((t) => (
          <line key={t.t} x1={t.x} x2={t.x} y1={PAD.top} y2={H - PAD.bottom} stroke="#374151" strokeWidth={0.5} />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="#3b82f6" opacity={0.12} />

        {/* Settlement line */}
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" />

        {/* t50 marker */}
        <line x1={x50} x2={x50} y1={PAD.top} y2={H - PAD.bottom} stroke="#f59e0b" strokeWidth={1} strokeDasharray="4,3" />
        <text x={x50 + 3} y={PAD.top + 10} fill="#f59e0b" fontSize={8}>t₅₀</text>

        {/* t90 marker */}
        <line x1={x90} x2={x90} y1={PAD.top} y2={H - PAD.bottom} stroke="#10b981" strokeWidth={1} strokeDasharray="4,3" />
        <text x={x90 + 3} y={PAD.top + 10} fill="#10b981" fontSize={8}>t₉₀</text>

        {/* Y-axis labels */}
        {yTicks.map((t) => (
          <text key={t.val} x={PAD.left - 6} y={t.y + 3} fill="#9ca3af" fontSize={8} textAnchor="end">
            {t.label}
          </text>
        ))}

        {/* X-axis labels */}
        {xTicks.map((t) => (
          <text key={t.t} x={t.x} y={H - PAD.bottom + 12} fill="#9ca3af" fontSize={8} textAnchor="middle">
            {t.label}
          </text>
        ))}

        {/* Axis labels */}
        <text x={PAD.left - 40} y={PAD.top + PLOT_H / 2} fill="#6b7280" fontSize={8} textAnchor="middle"
          transform={`rotate(-90, ${PAD.left - 40}, ${PAD.top + PLOT_H / 2})`}>
          Settlement (mm)
        </text>
        <text x={PAD.left + PLOT_W / 2} y={H - 4} fill="#6b7280" fontSize={8} textAnchor="middle">
          Time (years)
        </text>

        {/* Hover targets */}
        {curve.map((p, i) => (
          <rect
            key={i}
            x={sx(p.time_years) - PLOT_W / (2 * curve.length)}
            y={PAD.top}
            width={PLOT_W / curve.length}
            height={PLOT_H}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          />
        ))}

        {/* Hover dot */}
        {hovered && (
          <circle cx={sx(hovered.time_years)} cy={sy(hovered.settlement_mm)} r={4} fill="#3b82f6" stroke="#fff" strokeWidth={1.5} />
        )}

        {/* Hover tooltip */}
        {hovered && (
          <g>
            <rect
              x={Math.min(sx(hovered.time_years) + 8, W - 120)}
              y={sy(hovered.settlement_mm) - 22}
              width={112}
              height={30}
              rx={3}
              fill="#1f2937"
              stroke="#374151"
            />
            <text x={Math.min(sx(hovered.time_years) + 14, W - 114)} y={sy(hovered.settlement_mm) - 10} fill="#e5e7eb" fontSize={8}>
              t = {hovered.time_years.toFixed(2)} yr
            </text>
            <text x={Math.min(sx(hovered.time_years) + 14, W - 114)} y={sy(hovered.settlement_mm) + 2} fill="#3b82f6" fontSize={8}>
              s = {hovered.settlement_mm.toFixed(1)} mm  (U={hovered.U_pct.toFixed(0)}%)
            </text>
          </g>
        )}
      </svg>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-1 text-[10px]">
        {[
          { label: 'Total Settlement', val: `${summary.total_settlement_mm.toFixed(1)} mm`, color: 'text-blue-400' },
          { label: 't₅₀', val: `${summary.t50_years.toFixed(2)} yr`, color: 'text-yellow-400' },
          { label: 't₉₀', val: `${summary.t90_years.toFixed(2)} yr`, color: 'text-green-400' },
          { label: 'Hdr', val: `${summary.drainage_path_m.toFixed(2)} m`, color: 'text-gray-300' },
        ].map((c) => (
          <div key={c.label} className="bg-gray-800 rounded px-2 py-1 text-center">
            <div className="text-gray-500">{c.label}</div>
            <div className={`font-mono font-semibold ${c.color}`}>{c.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
