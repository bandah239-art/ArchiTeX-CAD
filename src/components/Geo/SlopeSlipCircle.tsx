import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../../services/apiConfig';

interface SliceRect {
  x_left: number;
  x_right: number;
  y_top: number;
  y_bottom: number;
}

interface SlipCircle {
  cx: number;
  cy: number;
  radius: number;
}

interface Summary {
  fos: number;
  fos_color: string;
  safe: boolean;
  height_m: number;
  slope_angle_deg: number;
  cohesion_kpa: number;
  friction_angle_deg: number;
  unit_weight_knm3: number;
}

interface ApiResponse {
  status: string;
  slope_polygon: [number, number][];
  slip_circle: SlipCircle | null;
  slices: SliceRect[];
  x_toe: number;
  H: number;
  W_ext: number;
  summary: Summary;
}

interface Props {
  slope_height_m?: number;
  slope_angle_degrees?: number;
  cohesion_kpa?: number;
  friction_angle_degrees?: number;
  unit_weight_knm3?: number;
}

const SVG_W = 520, SVG_H = 260;
const PAD = { top: 14, right: 20, bottom: 36, left: 40 };
const PLOT_W = SVG_W - PAD.left - PAD.right;
const PLOT_H = SVG_H - PAD.top - PAD.bottom;

export function SlopeSlipCircle({
  slope_height_m = 10,
  slope_angle_degrees = 30,
  cohesion_kpa = 20,
  friction_angle_degrees = 25,
  unit_weight_knm3 = 18,
}: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);

    fetch(`${API_BASE}/geo/simulation/slope-slip-circle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slope_height_m,
        slope_angle_degrees,
        cohesion_kpa,
        friction_angle_degrees,
        unit_weight_knm3,
      }),
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((d: ApiResponse) => { if (d.status === 'ok') setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slope_height_m, slope_angle_degrees, cohesion_kpa, friction_angle_degrees, unit_weight_knm3]);

  if (!data)
    return (
      <div className="h-[260px] flex items-center justify-center text-gray-500 text-xs">
        {loading ? 'Searching for critical slip surface…' : 'No data'}
      </div>
    );

  const { slope_polygon, slip_circle, slices, H, W_ext, summary } = data;
  const x_toe = data.x_toe;

  // World bounds
  const wx_min = -W_ext;
  const wx_max = x_toe + W_ext;
  const wy_min = -0.08 * H;
  const wy_max = H * 1.05;

  // If circle goes higher, expand wy_max
  const circ_top = slip_circle ? slip_circle.cy + slip_circle.radius : wy_max;
  const world_top = Math.max(wy_max, circ_top + 0.1 * H);

  const wx = (x: number) => PAD.left + ((x - wx_min) / (wx_max - wx_min)) * PLOT_W;
  const wy = (y: number) => PAD.top + ((world_top - y) / (world_top - wy_min)) * PLOT_H;

  // Slope polygon path (closed)
  const polyPts = slope_polygon.map(([x, y]) => `${wx(x).toFixed(1)},${wy(y).toFixed(1)}`).join(' ');
  // Ground fill (close the shape below)
  const groundPath =
    `M${wx(wx_min).toFixed(1)},${wy(H).toFixed(1)} ` +
    `L${wx(0).toFixed(1)},${wy(H).toFixed(1)} ` +
    `L${wx(x_toe).toFixed(1)},${wy(0).toFixed(1)} ` +
    `L${wx(wx_max).toFixed(1)},${wy(0).toFixed(1)} ` +
    `L${wx(wx_max).toFixed(1)},${wy(wy_min).toFixed(1)} ` +
    `L${wx(wx_min).toFixed(1)},${wy(wy_min).toFixed(1)} Z`;

  // Slip circle SVG arc
  let arcPath = '';
  if (slip_circle) {
    const { cx, cy, radius } = slip_circle;
    const scaleX = PLOT_W / (wx_max - wx_min);
    const scaleY = PLOT_H / (world_top - wy_min);
    // Use average scale for radius (roughly equal x/y scales)
    const rx = radius * scaleX;
    const ry = radius * scaleY;

    // Arc from left entry to right exit (large arc sweeping below centre)
    // entry: left edge of circle at y = H level
    const disc_top = radius ** 2 - (H - cy) ** 2;
    const disc_bot = radius ** 2 - cy ** 2;
    const x_entry = disc_top >= 0 ? cx - Math.sqrt(disc_top) : cx - radius;
    const x_exit = disc_bot >= 0 ? cx + Math.sqrt(disc_bot) : cx + radius;

    const entryX = wx(Math.max(x_entry, wx_min));
    const entryY = wy(disc_top >= 0 ? H : cy);
    const exitX = wx(Math.min(x_exit, wx_max));
    const exitY = wy(disc_bot >= 0 ? 0 : cy);

    // SVG arc: rx ry x-rot large-arc-flag sweep-flag x y
    arcPath = `M${entryX.toFixed(1)},${entryY.toFixed(1)} A${rx.toFixed(1)},${ry.toFixed(1)} 0 0,1 ${exitX.toFixed(1)},${exitY.toFixed(1)}`;
  }

  const fosColor = summary.fos_color === 'green' ? '#10b981' : summary.fos_color === 'yellow' ? '#f59e0b' : '#ef4444';
  const sliceColor = 'rgba(251,191,36,0.25)';
  const sliceBorder = '#fbbf24';

  return (
    <div className="space-y-2">
      <svg
        width={SVG_W}
        height={SVG_H}
        className="w-full max-w-full"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ background: '#111827', borderRadius: 6 }}
      >
        {/* Ground fill */}
        <path d={groundPath} fill="#1d2d1a" />

        {/* Slope surface outline */}
        <polyline points={polyPts} fill="none" stroke="#4ade80" strokeWidth={1.5} />

        {/* Slices */}
        {slices.map((s, i) => (
          <rect
            key={i}
            x={wx(s.x_left)}
            y={wy(s.y_top)}
            width={Math.abs(wx(s.x_right) - wx(s.x_left))}
            height={Math.abs(wy(s.y_bottom) - wy(s.y_top))}
            fill={sliceColor}
            stroke={sliceBorder}
            strokeWidth={0.8}
          />
        ))}

        {/* Critical slip arc */}
        {arcPath && (
          <path d={arcPath} fill="none" stroke={fosColor} strokeWidth={2} strokeDasharray="6,3" />
        )}

        {/* Circle centre marker */}
        {slip_circle && (
          <>
            <circle cx={wx(slip_circle.cx)} cy={wy(slip_circle.cy)} r={3} fill={fosColor} opacity={0.7} />
            <line x1={wx(slip_circle.cx) - 6} x2={wx(slip_circle.cx) + 6} y1={wy(slip_circle.cy)} y2={wy(slip_circle.cy)} stroke={fosColor} strokeWidth={1} />
            <line x1={wx(slip_circle.cx)} x2={wx(slip_circle.cx)} y1={wy(slip_circle.cy) - 6} y2={wy(slip_circle.cy) + 6} stroke={fosColor} strokeWidth={1} />
          </>
        )}

        {/* FOS label */}
        <rect x={SVG_W - 90} y={PAD.top} width={72} height={36} rx={4} fill="#111827" stroke={fosColor} strokeWidth={1} />
        <text x={SVG_W - 54} y={PAD.top + 13} fill="#9ca3af" fontSize={9} textAnchor="middle">FOS</text>
        <text x={SVG_W - 54} y={PAD.top + 28} fill={fosColor} fontSize={14} fontWeight="bold" textAnchor="middle">
          {summary.fos.toFixed(3)}
        </text>

        {/* Dimension: H arrow */}
        <line x1={wx(wx_min) + 8} x2={wx(wx_min) + 8} y1={wy(0)} y2={wy(H)} stroke="#6b7280" strokeWidth={1} markerEnd="url(#arr)" />
        <text x={wx(wx_min) + 12} y={(wy(0) + wy(H)) / 2} fill="#6b7280" fontSize={8}>H={H}m</text>

        {/* Scale bar */}
        <line x1={PAD.left} x2={PAD.left + PLOT_W * 0.2} y1={SVG_H - PAD.bottom + 18} y2={SVG_H - PAD.bottom + 18} stroke="#6b7280" strokeWidth={1.5} />
        <text x={PAD.left + PLOT_W * 0.1} y={SVG_H - PAD.bottom + 28} fill="#6b7280" fontSize={7} textAnchor="middle">
          {((wx_max - wx_min) * 0.2).toFixed(1)} m
        </text>
      </svg>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-1 text-[10px]">
        {[
          { label: 'FOS', val: summary.fos.toFixed(3), color: `text-[${fosColor}]` },
          { label: 'Height', val: `${summary.height_m} m`, color: 'text-gray-300' },
          { label: "c'", val: `${summary.cohesion_kpa} kPa`, color: 'text-orange-400' },
          { label: "φ'", val: `${summary.friction_angle_deg}°`, color: 'text-yellow-400' },
        ].map((c) => (
          <div key={c.label} className="bg-gray-800 rounded px-2 py-1 text-center">
            <div className="text-gray-500">{c.label}</div>
            <div
              className="font-mono font-semibold"
              style={{ color: c.label === 'FOS' ? fosColor : undefined }}
            >
              {c.val}
            </div>
          </div>
        ))}
      </div>

      <div
        className="text-[10px] px-2 py-1 rounded text-center font-semibold"
        style={{ background: summary.safe ? '#052e16' : '#450a0a', color: fosColor }}
      >
        {summary.safe ? `STABLE — FOS ${summary.fos.toFixed(3)} ≥ 1.3` : `UNSTABLE — FOS ${summary.fos.toFixed(3)} < 1.3 — REDESIGN REQUIRED`}
      </div>
    </div>
  );
}
