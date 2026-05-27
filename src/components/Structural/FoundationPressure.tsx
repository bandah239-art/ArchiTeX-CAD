import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../../services/apiConfig';

interface Summary {
  q_max_kpa: number;
  q_min_kpa: number;
  q_avg_kpa: number;
  ex_m: number;
  ey_m: number;
  tension_zone: boolean;
  within_kern: boolean;
  B_m: number;
  L_m: number;
}

interface Props {
  B_m?: number;
  L_m?: number;
  P_kn?: number;
  Mx_knm?: number;
  My_knm?: number;
}

const SVG_W = 520, SVG_H = 280;
// Left: pressure heat map  |  Right: legend + summary
const MAP_X = 50, MAP_Y = 28;
const MAP_W = 240, MAP_H = 200;
const LEG_X = 310;

function pressureToColor(q: number, qMin: number, qMax: number): string {
  if (qMax === qMin) return '#3b82f6';
  if (q < 0) return '#7f1d1d';  // tension zone: dark red
  const t = (q - Math.max(qMin, 0)) / (qMax - Math.max(qMin, 0));
  const tc = Math.min(Math.max(t, 0), 1);
  // blue → cyan → green → yellow → red
  if (tc < 0.25) {
    const f = tc / 0.25;
    return `rgb(${Math.round(59 + f * (6 - 59))},${Math.round(130 + f * (182 - 130))},${Math.round(246 + f * (212 - 246))})`;
  } else if (tc < 0.5) {
    const f = (tc - 0.25) / 0.25;
    return `rgb(${Math.round(6 + f * (16 - 6))},${Math.round(182 + f * (185 - 182))},${Math.round(212 + f * (129 - 212))})`;
  } else if (tc < 0.75) {
    const f = (tc - 0.5) / 0.25;
    return `rgb(${Math.round(16 + f * (234 - 16))},${Math.round(185 + f * (179 - 185))},${Math.round(129 + f * (8 - 129))})`;
  } else {
    const f = (tc - 0.75) / 0.25;
    return `rgb(${Math.round(234 + f * (239 - 234))},${Math.round(179 + f * (68 - 179))},${Math.round(8 + f * (68 - 8))})`;
  }
}

export function FoundationPressure({
  B_m = 2,
  L_m = 2,
  P_kn = 800,
  Mx_knm = 0,
  My_knm = 0,
}: Props) {
  const [grid, setGrid] = useState<number[][]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hoverCell, setHoverCell] = useState<{ i: number; j: number; q: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [n, setN] = useState(12);

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);

    fetch(`${API_BASE}/structural/simulation/foundation-pressure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ B_m, L_m, P_kn, Mx_knm, My_knm }),
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 'ok') {
          setGrid(d.grid as number[][]);
          setSummary(d.summary as Summary);
          setN(d.n as number);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [B_m, L_m, P_kn, Mx_knm, My_knm]);

  if (!grid.length || !summary)
    return (
      <div className="h-[280px] flex items-center justify-center text-gray-500 text-xs">
        {loading ? 'Computing foundation pressure distribution…' : 'No data'}
      </div>
    );

  const cellW = MAP_W / n;
  const cellH = MAP_H / n;

  // Colour scale legend
  const LEG_H = MAP_H;
  const LEG_W = 14;
  const LEG_STEPS = 20;

  return (
    <div className="space-y-2">
      <svg
        width={SVG_W}
        height={SVG_H}
        className="w-full max-w-full"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ background: '#111827', borderRadius: 6 }}
      >
        {/* ── Heat map ── */}
        {grid.map((row, j) =>
          row.map((q, i) => (
            <rect
              key={`${i}-${j}`}
              x={MAP_X + i * cellW}
              y={MAP_Y + j * cellH}
              width={cellW + 0.5}
              height={cellH + 0.5}
              fill={pressureToColor(q, summary.q_min_kpa, summary.q_max_kpa)}
              onMouseEnter={() => setHoverCell({ i, j, q })}
              onMouseLeave={() => setHoverCell(null)}
            />
          ))
        )}

        {/* Foundation outline */}
        <rect x={MAP_X} y={MAP_Y} width={MAP_W} height={MAP_H} fill="none" stroke="#6b7280" strokeWidth={1.5} />

        {/* Column symbol (circle at centre) */}
        <circle cx={MAP_X + MAP_W / 2} cy={MAP_Y + MAP_H / 2} r={8} fill="none" stroke="#fff" strokeWidth={1.5} />
        <line x1={MAP_X + MAP_W / 2 - 6} x2={MAP_X + MAP_W / 2 + 6} y1={MAP_Y + MAP_H / 2} y2={MAP_Y + MAP_H / 2} stroke="#fff" strokeWidth={1} />
        <line x1={MAP_X + MAP_W / 2} x2={MAP_X + MAP_W / 2} y1={MAP_Y + MAP_H / 2 - 6} y2={MAP_Y + MAP_H / 2 + 6} stroke="#fff" strokeWidth={1} />

        {/* Kern boundary (dashed) */}
        <rect
          x={MAP_X + MAP_W / 6}
          y={MAP_Y + MAP_H / 6}
          width={MAP_W * 2 / 3}
          height={MAP_H * 2 / 3}
          fill="none"
          stroke="#fbbf24"
          strokeWidth={0.8}
          strokeDasharray="4,3"
        />
        <text x={MAP_X + MAP_W / 6 + 3} y={MAP_Y + MAP_H / 6 - 3} fill="#fbbf24" fontSize={6}>kern</text>

        {/* Dimension labels */}
        <text x={MAP_X + MAP_W / 2} y={MAP_Y - 8} fill="#9ca3af" fontSize={8} textAnchor="middle">B = {B_m} m</text>
        <text
          x={MAP_X - 12}
          y={MAP_Y + MAP_H / 2}
          fill="#9ca3af"
          fontSize={8}
          textAnchor="middle"
          transform={`rotate(-90, ${MAP_X - 12}, ${MAP_Y + MAP_H / 2})`}
        >
          L = {L_m} m
        </text>

        {/* Hover tooltip */}
        {hoverCell && (
          <>
            <rect x={MAP_X + hoverCell.i * cellW} y={MAP_Y + hoverCell.j * cellH} width={cellW} height={cellH} fill="none" stroke="#fff" strokeWidth={1} />
            <rect
              x={Math.min(MAP_X + (hoverCell.i + 1) * cellW + 4, SVG_W - 90)}
              y={MAP_Y + hoverCell.j * cellH}
              width={84}
              height={20}
              rx={3}
              fill="#1f2937"
              stroke="#374151"
            />
            <text
              x={Math.min(MAP_X + (hoverCell.i + 1) * cellW + 10, SVG_W - 84)}
              y={MAP_Y + hoverCell.j * cellH + 13}
              fill="#e5e7eb"
              fontSize={7}
            >
              q = {hoverCell.q.toFixed(1)} kPa
            </text>
          </>
        )}

        {/* ── Colour scale legend ── */}
        {Array.from({ length: LEG_STEPS }).map((_, k) => {
          const t = k / (LEG_STEPS - 1);
          const q = summary.q_min_kpa + t * (summary.q_max_kpa - summary.q_min_kpa);
          const y = MAP_Y + MAP_H - (k + 1) * (LEG_H / LEG_STEPS);
          return (
            <rect key={k} x={LEG_X} y={y} width={LEG_W} height={LEG_H / LEG_STEPS + 1}
              fill={pressureToColor(q, summary.q_min_kpa, summary.q_max_kpa)} />
          );
        })}
        <rect x={LEG_X} y={MAP_Y} width={LEG_W} height={LEG_H} fill="none" stroke="#374151" strokeWidth={0.8} />
        <text x={LEG_X + LEG_W + 3} y={MAP_Y + 6} fill="#9ca3af" fontSize={6}>{summary.q_max_kpa.toFixed(0)} kPa</text>
        <text x={LEG_X + LEG_W + 3} y={MAP_Y + MAP_H} fill="#9ca3af" fontSize={6}>{summary.q_min_kpa.toFixed(0)} kPa</text>

        {/* Summary box */}
        <rect x={LEG_X + LEG_W + 3} y={MAP_Y + 20} width={135} height={90} rx={4} fill="#0d1117" stroke="#1f2937" />
        {[
          { label: 'q_avg', val: `${summary.q_avg_kpa.toFixed(0)} kPa` },
          { label: 'q_max', val: `${summary.q_max_kpa.toFixed(0)} kPa` },
          { label: 'q_min', val: `${summary.q_min_kpa.toFixed(0)} kPa` },
          { label: 'e_x', val: `${summary.ex_m.toFixed(3)} m` },
          { label: 'e_y', val: `${summary.ey_m.toFixed(3)} m` },
        ].map((item, idx) => (
          <g key={item.label}>
            <text x={LEG_X + LEG_W + 10} y={MAP_Y + 34 + idx * 15} fill="#6b7280" fontSize={7}>{item.label}</text>
            <text x={LEG_X + LEG_W + 70} y={MAP_Y + 34 + idx * 15} fill="#e5e7eb" fontSize={7} textAnchor="end">{item.val}</text>
          </g>
        ))}

        {/* Status */}
        <rect x={LEG_X + LEG_W + 3} y={MAP_Y + 118} width={135} height={18} rx={3}
          fill={summary.within_kern ? '#052e16' : '#450a0a'} />
        <text x={LEG_X + LEG_W + 70} y={MAP_Y + 130} fill={summary.within_kern ? '#4ade80' : '#f87171'} fontSize={7} textAnchor="middle">
          {summary.within_kern ? 'Load within kern ✓' : 'Load outside kern — tension!'}
        </text>

        {summary.tension_zone && (
          <>
            <rect x={LEG_X + LEG_W + 3} y={MAP_Y + 140} width={135} height={14} rx={3} fill="#7f1d1d" />
            <text x={LEG_X + LEG_W + 70} y={MAP_Y + 150} fill="#fca5a5" fontSize={6} textAnchor="middle">
              Tension zone present — check uplift
            </text>
          </>
        )}
      </svg>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-1 text-[10px]">
        {[
          { label: 'q_max', val: `${summary.q_max_kpa.toFixed(0)} kPa`, color: 'text-red-400' },
          { label: 'q_min', val: `${summary.q_min_kpa.toFixed(0)} kPa`, color: summary.q_min_kpa < 0 ? 'text-red-400' : 'text-blue-400' },
          { label: 'e_x / B/6', val: `${summary.ex_m.toFixed(3)} / ${(B_m / 6).toFixed(3)}`, color: summary.within_kern ? 'text-green-400' : 'text-red-400' },
          { label: 'Tension Zone', val: summary.tension_zone ? 'YES' : 'NO', color: summary.tension_zone ? 'text-red-400' : 'text-green-400' },
        ].map((c) => (
          <div key={c.label} className="bg-gray-800 rounded px-2 py-1 text-center">
            <div className="text-gray-500 truncate">{c.label}</div>
            <div className={`font-mono font-semibold ${c.color}`}>{c.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
