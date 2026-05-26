import { useEffect, useState } from 'react';
import { API_BASE } from '../../services/apiConfig';

interface CurvePoint { flow_m3s: number; power_kw: number; }

interface CurveSummary {
  rated_power_kw: number;
  rated_flow_m3s: number;
  net_head_m: number;
  efficiency_pct: number;
  turbine_type: string;
  specific_speed: number;
}

interface Props {
  net_head_m: number;
  max_flow_m3s: number;
  system_efficiency?: number;
}

const W = 520;
const H = 200;
const PAD = { top: 14, right: 20, bottom: 36, left: 52 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

export function HydroPowerCurve({ net_head_m, max_flow_m3s, system_efficiency = 0.85 }: Props) {
  const [curve, setCurve] = useState<CurvePoint[]>([]);
  const [summary, setSummary] = useState<CurveSummary | null>(null);
  const [turbineColor, setTurbineColor] = useState('#3b82f6');
  const [loading, setLoading] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/energy/simulation/hydro-curve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ net_head_m, max_flow_m3s, system_efficiency, points: 40 }),
    })
      .then((r) => r.json())
      .then((res) => {
        setCurve(res.curve ?? []);
        setSummary(res.summary ?? null);
        setTurbineColor(res.turbine_color ?? '#3b82f6');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [net_head_m, max_flow_m3s, system_efficiency]);

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">Building Q-P curve…</div>;
  if (!curve.length) return null;

  const maxPow = Math.max(...curve.map((p) => p.power_kw), 1);
  const maxFlow = max_flow_m3s;

  const sx = (q: number) => PAD.left + (q / maxFlow) * CW;
  const sy = (p: number) => PAD.top + CH - (p / maxPow) * CH;

  const pts = curve.map((p): [number, number] => [sx(p.flow_m3s), sy(p.power_kw)]);
  const area = pts.length > 0
    ? `M ${sx(0)},${sy(0)} ${pts.map(([x, y]) => `L ${x},${y}`).join(' ')} L ${sx(maxFlow)},${sy(0)} Z`
    : '';

  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map((f) => Math.round(f * maxPow));
  const xTicks = [0, 0.25, 0.5, 0.75, 1.0].map((f) => +(f * maxFlow).toFixed(2));

  const hPt = hoverIdx !== null ? curve[hoverIdx] : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-300">
          Hydro Q–P Curve
          {summary && <span className="ml-2 text-[10px] text-gray-500">· {summary.turbine_type}</span>}
        </span>
        {hPt && (
          <span className="text-[10px] text-gray-400">
            Q={hPt.flow_m3s} m³/s → P={hPt.power_kw} kW
          </span>
        )}
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto"
          onMouseLeave={() => setHoverIdx(null)}>

          {/* Grid lines */}
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} y1={sy(t)} x2={W - PAD.right} y2={sy(t)}
                stroke="#374151" strokeWidth="0.5" strokeDasharray="3,3" />
              <text x={PAD.left - 4} y={sy(t) + 3} textAnchor="end"
                className="fill-gray-500" fontSize="8">{t >= 1000 ? `${(t / 1000).toFixed(1)}M` : t}</text>
            </g>
          ))}
          {xTicks.map((t) => (
            <g key={t}>
              <line x1={sx(t)} y1={PAD.top} x2={sx(t)} y2={H - PAD.bottom}
                stroke="#374151" strokeWidth="0.5" strokeDasharray="3,3" />
              <text x={sx(t)} y={H - PAD.bottom + 14} textAnchor="middle"
                className="fill-gray-500" fontSize="8">{t}</text>
            </g>
          ))}

          {/* Y-axis label */}
          <text transform={`translate(10,${PAD.top + CH / 2}) rotate(-90)`}
            textAnchor="middle" className="fill-gray-500" fontSize="8">Power (kW)</text>
          <text x={PAD.left + CW / 2} y={H - 4} textAnchor="middle"
            className="fill-gray-500" fontSize="8">Flow Q (m³/s)</text>

          {/* Area fill */}
          <path d={area} fill={turbineColor} fillOpacity="0.15" />

          {/* Curve line */}
          <polyline
            points={pts.map(([x, y]) => `${x},${y}`).join(' ')}
            fill="none" stroke={turbineColor} strokeWidth="2.5" strokeLinejoin="round" />

          {/* Rated point marker */}
          {summary && (
            <>
              <line x1={sx(summary.rated_flow_m3s)} y1={PAD.top}
                x2={sx(summary.rated_flow_m3s)} y2={sy(0)}
                stroke={turbineColor} strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
              <circle cx={sx(summary.rated_flow_m3s)} cy={sy(summary.rated_power_kw)}
                r="5" fill={turbineColor} stroke="white" strokeWidth="1.5" />
              <text x={sx(summary.rated_flow_m3s) + 6} y={sy(summary.rated_power_kw) - 4}
                className="fill-white" fontSize="8" fontWeight="bold">
                {summary.rated_power_kw} kW
              </text>
            </>
          )}

          {/* Hover line */}
          {hoverIdx !== null && hPt && (
            <>
              <line x1={sx(hPt.flow_m3s)} y1={PAD.top} x2={sx(hPt.flow_m3s)} y2={H - PAD.bottom}
                stroke="#6366f1" strokeWidth="1" strokeDasharray="2,2" />
              <circle cx={sx(hPt.flow_m3s)} cy={sy(hPt.power_kw)} r="4" fill="#6366f1" />
            </>
          )}

          {/* Invisible hover targets */}
          {curve.map((p, i) => (
            <rect key={i}
              x={sx(p.flow_m3s) - CW / curve.length / 2}
              y={PAD.top} width={CW / curve.length} height={CH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)} />
          ))}

          {/* Axes */}
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom}
            stroke="#6b7280" strokeWidth="1" />
          <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom}
            stroke="#6b7280" strokeWidth="1" />
        </svg>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          {[
            { label: 'Rated power', val: `${summary.rated_power_kw} kW`, bold: true },
            { label: 'Turbine type', val: summary.turbine_type },
            { label: 'Net head', val: `${summary.net_head_m} m` },
            { label: 'Specific speed Ns', val: summary.specific_speed.toString() },
            { label: 'Efficiency', val: `${summary.efficiency_pct}%` },
            { label: 'Rated flow', val: `${summary.rated_flow_m3s} m³/s` },
          ].map(({ label, val, bold }) => (
            <div key={label} className="flex justify-between bg-gray-800/60 rounded px-2 py-1">
              <span className="text-gray-500">{label}</span>
              <span className={bold ? 'text-blue-300 font-semibold' : 'text-gray-200'}>{val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
