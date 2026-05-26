import { useEffect, useState } from 'react';
import { API_BASE } from '../../services/apiConfig';

interface Props {
  rotor_diameter_m: number;
  ct?: number;
  k?: number;
  grid_x_diameters?: number;
  grid_y_diameters?: number;
}

interface WakeData {
  grid: number[][];
  x_diameters: number[];
  y_diameters: number[];
  metadata: { nx: number; ny: number };
}

function velocityToColor(v: number): string {
  // 0.5–1.0: blue → cyan → green → yellow → red
  const t = Math.max(0, Math.min(1, (v - 0.5) / 0.5));
  if (t < 0.25) {
    const s = t / 0.25;
    return `rgb(${Math.round(59 + s * 0)},${Math.round(130 + s * 69)},${Math.round(246 - s * 46)})`;
  } else if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    return `rgb(${Math.round(59 + s * 17)},${Math.round(199 - s * 57)},${Math.round(200 - s * 122)})`;
  } else if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    return `rgb(${Math.round(76 + s * 179)},${Math.round(142 + s * 57)},${Math.round(78 - s * 38)})`;
  } else {
    const s = (t - 0.75) / 0.25;
    return `rgb(${Math.round(255)},${Math.round(199 - s * 199)},${Math.round(40 - s * 40)})`;
  }
}

const MAP_W = 520;
const MAP_H = 180;

export function WindWakeMap({ rotor_diameter_m, ct = 0.8, k = 0.075, grid_x_diameters = 12, grid_y_diameters = 5 }: Props) {
  const [data, setData] = useState<WakeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number; v: number } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/energy/simulation/wind-wake-map`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rotor_diameter_m, ct, k, grid_x_diameters, grid_y_diameters, resolution: 40 }),
    })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [rotor_diameter_m, ct, k, grid_x_diameters, grid_y_diameters]);

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">Computing wake field…</div>;
  if (!data) return null;

  const { grid, x_diameters, y_diameters, metadata } = data;
  const { ny, nx } = metadata;
  const cellW = MAP_W / nx;
  const cellH = MAP_H / ny;

  // Rotor disc position (x=0 in the grid → column 0)
  const rotorX = 0;
  const rotorCY = MAP_H / 2;
  const rotorHalfPx = (MAP_H / 2) * (1 / grid_y_diameters);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-300">Wind Wake Velocity Map (Jensen Model)</span>
        {hover && (
          <span className="text-[10px] text-gray-400">
            x={hover.x}D · y={hover.y}D · v={Math.round(hover.v * 100)}%
          </span>
        )}
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
        <svg width={MAP_W} height={MAP_H} viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="w-full h-auto"
          onMouseLeave={() => setHover(null)}>
          {/* Heat map cells */}
          {grid.map((row, yi) =>
            row.map((v, xi) => (
              <rect key={`${xi}-${yi}`}
                x={xi * cellW} y={yi * cellH}
                width={cellW + 0.5} height={cellH + 0.5}
                fill={velocityToColor(v)}
                opacity={0.85}
                onMouseEnter={() => setHover({
                  x: Math.round(x_diameters[xi] * 10) / 10,
                  y: Math.round(y_diameters[yi] * 10) / 10,
                  v,
                })}
              />
            ))
          )}

          {/* Turbine disc */}
          <line x1={rotorX + cellW * 0.5} y1={rotorCY - rotorHalfPx}
            x2={rotorX + cellW * 0.5} y2={rotorCY + rotorHalfPx}
            stroke="white" strokeWidth="3" strokeLinecap="round" />
          <circle cx={rotorX + cellW * 0.5} cy={rotorCY} r="3" fill="white" />

          {/* Wind direction arrow */}
          <defs>
            <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
            </marker>
          </defs>
          <line x1="8" y1={rotorCY} x2={cellW * 0.3} y2={rotorCY}
            stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />

          {/* X-axis labels */}
          {[0, Math.floor(nx / 4), Math.floor(nx / 2), Math.floor(3 * nx / 4), nx - 1].map((xi) => (
            <text key={xi} x={xi * cellW + cellW / 2} y={MAP_H - 3}
              textAnchor="middle" className="fill-gray-400" fontSize="7">
              {x_diameters[xi]}D
            </text>
          ))}

          {/* Wake boundary indicator lines */}
          <line x1={0} y1={rotorCY - rotorHalfPx} x2={MAP_W} y2={rotorCY - rotorHalfPx * (1 + grid_x_diameters * k)}
            stroke="white" strokeWidth="0.5" strokeDasharray="4,4" opacity="0.3" />
          <line x1={0} y1={rotorCY + rotorHalfPx} x2={MAP_W} y2={rotorCY + rotorHalfPx * (1 + grid_x_diameters * k)}
            stroke="white" strokeWidth="0.5" strokeDasharray="4,4" opacity="0.3" />
        </svg>
      </div>

      {/* Colour scale */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-gray-500">50%</span>
        <div className="flex-1 h-2 rounded overflow-hidden" style={{
          background: 'linear-gradient(to right, rgb(59,130,246), rgb(6,182,212), rgb(76,199,78), rgb(255,199,40), rgb(255,0,0))'
        }} />
        <span className="text-[9px] text-gray-500">100%</span>
        <span className="text-[9px] text-gray-400 ml-1">wind speed</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[10px]">
        {[
          { label: 'Rotor Ø', val: `${rotor_diameter_m} m` },
          { label: 'Thrust Ct', val: ct.toFixed(2) },
          { label: 'Wake decay k', val: k.toFixed(3) },
        ].map(({ label, val }) => (
          <div key={label} className="flex justify-between bg-gray-800/60 rounded px-2 py-1">
            <span className="text-gray-500">{label}</span>
            <span className="text-gray-200">{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
