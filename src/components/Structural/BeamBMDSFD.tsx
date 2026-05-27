import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../../services/apiConfig';

interface BeamPoint {
  x: number;
  shear_kn: number;
  moment_knm: number;
  deflection_mm: number;
}

interface Reaction {
  label: string;
  value: number;
  unit: string;
}

interface Summary {
  support: string;
  span_m: number;
  udl_kn_m: number;
  M_max_knm: number;
  V_max_kn: number;
  delta_max_mm: number;
  EI_kn_m2: number;
}

interface Props {
  span_m?: number;
  udl_kn_m?: number;
  support?: string;
  fck_mpa?: number;
  width_mm?: number;
  depth_mm?: number;
}

const W = 520;
// Three stacked panels: SFD | BMD | Deflection
const PANEL_H = 68;
const PAD_L = 48, PAD_R = 18, PAD_TOP = 18, GAP = 22;
const PLOT_W = W - PAD_L - PAD_R;
const TOTAL_H = PAD_TOP + 3 * PANEL_H + 2 * GAP + 38; // 38 for bottom axis + beam label

const P_SFD_TOP = PAD_TOP;
const P_BMD_TOP = P_SFD_TOP + PANEL_H + GAP;
const P_DEF_TOP = P_BMD_TOP + PANEL_H + GAP;

function panelScaleY(val: number, lo: number, hi: number, pTop: number, pH: number): number {
  if (hi === lo) return pTop + pH / 2;
  return pTop + pH - ((val - lo) / (hi - lo)) * pH;
}

function zeroY(lo: number, hi: number, pTop: number, pH: number): number {
  return panelScaleY(0, lo, hi, pTop, pH);
}

function dataPath(
  pts: BeamPoint[],
  get: (p: BeamPoint) => number,
  lo: number,
  hi: number,
  pTop: number,
  pH: number,
  spanM: number
): string {
  return pts
    .map((p, i) => {
      const sx = PAD_L + (p.x / spanM) * PLOT_W;
      const sy = panelScaleY(get(p), lo, hi, pTop, pH);
      return `${i === 0 ? 'M' : 'L'}${sx.toFixed(1)},${sy.toFixed(1)}`;
    })
    .join(' ');
}

function areaPath(
  pts: BeamPoint[],
  get: (p: BeamPoint) => number,
  lo: number,
  hi: number,
  pTop: number,
  pH: number,
  spanM: number
): string {
  const z = zeroY(lo, hi, pTop, pH);
  const body = pts
    .map((p) => {
      const sx = PAD_L + (p.x / spanM) * PLOT_W;
      const sy = panelScaleY(get(p), lo, hi, pTop, pH);
      return `L${sx.toFixed(1)},${sy.toFixed(1)}`;
    })
    .join(' ');
  return `M${PAD_L},${z.toFixed(1)} ${body} L${(PAD_L + PLOT_W).toFixed(1)},${z.toFixed(1)} Z`;
}

const SUPPORT_LABELS: Record<string, string> = {
  simply_supported: 'Simply Supported',
  cantilever: 'Cantilever (Fixed-Free)',
  fixed_fixed: 'Fixed-Fixed',
};

export function BeamBMDSFD({
  span_m = 6,
  udl_kn_m = 25,
  support = 'simply_supported',
  fck_mpa = 30,
  width_mm = 300,
  depth_mm = 500,
}: Props) {
  const [points, setPoints] = useState<BeamPoint[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);

    fetch(`${API_BASE}/structural/simulation/beam-bmd-sfd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ span_m, udl_kn_m, support, fck_mpa, width_mm, depth_mm }),
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 'ok') {
          setPoints(d.points as BeamPoint[]);
          setReactions(d.reactions as Reaction[]);
          setSummary(d.summary as Summary);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [span_m, udl_kn_m, support, fck_mpa, width_mm, depth_mm]);

  if (!points.length || !summary)
    return (
      <div style={{ height: TOTAL_H }} className="flex items-center justify-center text-gray-500 text-xs">
        {loading ? 'Computing BMD / SFD…' : 'No data'}
      </div>
    );

  // Data ranges
  const shears = points.map((p) => p.shear_kn);
  const moments = points.map((p) => p.moment_knm);
  const defs = points.map((p) => p.deflection_mm);

  const sLo = Math.min(...shears), sHi = Math.max(...shears);
  const mLo = Math.min(...moments), mHi = Math.max(...moments);
  // Deflection: always ≥ 0, draw downward (positive = down)
  const dLo = 0, dHi = Math.max(...defs, 0.001);

  const sZero = zeroY(sLo, sHi, P_SFD_TOP, PANEL_H);
  const mZero = zeroY(mLo, mHi, P_BMD_TOP, PANEL_H);
  const dZero = P_DEF_TOP; // deflection zero at top of panel

  // Beam diagram at bottom
  const BEAM_Y = P_DEF_TOP + PANEL_H + 8;
  const BEAM_H = 10;

  // Hover interpolation
  let hoverPt: BeamPoint | null = null;
  if (hoverX !== null) {
    const xi = hoverX;
    const frac = xi / span_m;
    const idx = Math.round(frac * (points.length - 1));
    hoverPt = points[Math.max(0, Math.min(idx, points.length - 1))];
  }

  const hoverSvgX = hoverPt ? PAD_L + (hoverPt.x / span_m) * PLOT_W : null;

  return (
    <div className="space-y-2">
      <svg
        width={W}
        height={TOTAL_H}
        className="w-full max-w-full"
        viewBox={`0 0 ${W} ${TOTAL_H}`}
        style={{ background: '#111827', borderRadius: 6 }}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const svgX = ((e.clientX - rect.left) / rect.width) * W;
          const dataX = ((svgX - PAD_L) / PLOT_W) * span_m;
          if (dataX >= 0 && dataX <= span_m) setHoverX(dataX);
          else setHoverX(null);
        }}
        onMouseLeave={() => setHoverX(null)}
      >
        {/* ── Panel backgrounds and labels ── */}
        {[
          { top: P_SFD_TOP, label: 'SFD (kN)', color: '#f59e0b' },
          { top: P_BMD_TOP, label: 'BMD (kNm)', color: '#3b82f6' },
          { top: P_DEF_TOP, label: 'δ (mm)', color: '#a855f7' },
        ].map(({ top, label, color }) => (
          <g key={label}>
            <rect x={PAD_L} y={top} width={PLOT_W} height={PANEL_H} fill="#0d1117" rx={2} />
            <text x={PAD_L - 4} y={top + PANEL_H / 2 + 3} fill={color} fontSize={7} textAnchor="end">{label}</text>
          </g>
        ))}

        {/* ── SFD ── */}
        <path d={areaPath(points, (p) => p.shear_kn, sLo, sHi, P_SFD_TOP, PANEL_H, span_m)} fill="#f59e0b" opacity={0.2} />
        <path d={dataPath(points, (p) => p.shear_kn, sLo, sHi, P_SFD_TOP, PANEL_H, span_m)} fill="none" stroke="#f59e0b" strokeWidth={1.8} />
        <line x1={PAD_L} x2={PAD_L + PLOT_W} y1={sZero} y2={sZero} stroke="#374151" strokeWidth={0.6} />
        {/* SFD axis labels */}
        <text x={PAD_L - 3} y={P_SFD_TOP + 8} fill="#6b7280" fontSize={6} textAnchor="end">{sHi.toFixed(0)}</text>
        <text x={PAD_L - 3} y={P_SFD_TOP + PANEL_H} fill="#6b7280" fontSize={6} textAnchor="end">{sLo.toFixed(0)}</text>

        {/* ── BMD ── */}
        <path d={areaPath(points, (p) => p.moment_knm, mLo, mHi, P_BMD_TOP, PANEL_H, span_m)} fill="#3b82f6" opacity={0.2} />
        <path d={dataPath(points, (p) => p.moment_knm, mLo, mHi, P_BMD_TOP, PANEL_H, span_m)} fill="none" stroke="#3b82f6" strokeWidth={1.8} />
        <line x1={PAD_L} x2={PAD_L + PLOT_W} y1={mZero} y2={mZero} stroke="#374151" strokeWidth={0.6} />
        <text x={PAD_L - 3} y={P_BMD_TOP + 8} fill="#6b7280" fontSize={6} textAnchor="end">{mHi.toFixed(0)}</text>
        <text x={PAD_L - 3} y={P_BMD_TOP + PANEL_H} fill="#6b7280" fontSize={6} textAnchor="end">{mLo.toFixed(0)}</text>

        {/* ── Deflection ── */}
        <path d={areaPath(points, (p) => -p.deflection_mm, -dHi, -dLo, P_DEF_TOP, PANEL_H, span_m)} fill="#a855f7" opacity={0.15} />
        <path d={dataPath(points, (p) => -p.deflection_mm, -dHi, -dLo, P_DEF_TOP, PANEL_H, span_m)} fill="none" stroke="#a855f7" strokeWidth={1.8} />
        <line x1={PAD_L} x2={PAD_L + PLOT_W} y1={dZero} y2={dZero} stroke="#374151" strokeWidth={0.6} />
        <text x={PAD_L - 3} y={P_DEF_TOP + PANEL_H} fill="#6b7280" fontSize={6} textAnchor="end">{(-dHi).toFixed(1)}</text>

        {/* ── Beam cross-section at bottom ── */}
        <rect x={PAD_L} y={BEAM_Y} width={PLOT_W} height={BEAM_H} fill="#1e3a5f" stroke="#3b82f6" strokeWidth={1} />
        {/* UDL arrows */}
        {Array.from({ length: 9 }).map((_, i) => {
          const bx = PAD_L + PLOT_W * (i + 0.5) / 9;
          return (
            <line key={i} x1={bx} x2={bx} y1={BEAM_Y - 8} y2={BEAM_Y - 1} stroke="#f59e0b" strokeWidth={1}
              markerEnd="url(#udl-arrow)" />
          );
        })}
        <defs>
          <marker id="udl-arrow" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
            <polygon points="0 0, 4 2, 0 4" fill="#f59e0b" />
          </marker>
        </defs>
        {/* Support symbols */}
        {support !== 'cantilever' && (
          // Simply supported or fixed-fixed: pin/roller at both ends
          <>
            <polygon points={`${PAD_L},${BEAM_Y + BEAM_H} ${PAD_L - 7},${BEAM_Y + BEAM_H + 9} ${PAD_L + 7},${BEAM_Y + BEAM_H + 9}`} fill="#4ade80" />
            <polygon points={`${PAD_L + PLOT_W},${BEAM_Y + BEAM_H} ${PAD_L + PLOT_W - 7},${BEAM_Y + BEAM_H + 9} ${PAD_L + PLOT_W + 7},${BEAM_Y + BEAM_H + 9}`} fill={support === 'fixed_fixed' ? '#4ade80' : '#6b7280'} />
          </>
        )}
        {support === 'cantilever' && (
          // Fixed wall at left
          <rect x={PAD_L - 8} y={BEAM_Y - 4} width={8} height={BEAM_H + 8} fill="#4ade80" />
        )}

        {/* Span label */}
        <text x={PAD_L + PLOT_W / 2} y={BEAM_Y + BEAM_H + 22} fill="#6b7280" fontSize={8} textAnchor="middle">
          L = {span_m} m — {SUPPORT_LABELS[support] ?? support} — w = {udl_kn_m} kN/m
        </text>

        {/* ── Hover crosshair ── */}
        {hoverSvgX !== null && hoverPt && (
          <>
            <line x1={hoverSvgX} x2={hoverSvgX} y1={P_SFD_TOP} y2={P_DEF_TOP + PANEL_H} stroke="#fbbf24" strokeWidth={0.8} strokeDasharray="3,2" />
            {/* SFD dot */}
            <circle cx={hoverSvgX} cy={panelScaleY(hoverPt.shear_kn, sLo, sHi, P_SFD_TOP, PANEL_H)} r={3} fill="#f59e0b" />
            {/* BMD dot */}
            <circle cx={hoverSvgX} cy={panelScaleY(hoverPt.moment_knm, mLo, mHi, P_BMD_TOP, PANEL_H)} r={3} fill="#3b82f6" />
            {/* DEF dot */}
            <circle cx={hoverSvgX} cy={panelScaleY(-hoverPt.deflection_mm, -dHi, -dLo, P_DEF_TOP, PANEL_H)} r={3} fill="#a855f7" />
            {/* Tooltip */}
            <rect
              x={Math.min(hoverSvgX + 6, W - 130)}
              y={P_SFD_TOP + 2}
              width={122}
              height={44}
              rx={3}
              fill="#1f2937"
              stroke="#374151"
            />
            <text x={Math.min(hoverSvgX + 11, W - 125)} y={P_SFD_TOP + 13} fill="#e5e7eb" fontSize={7}>x = {hoverPt.x.toFixed(2)} m</text>
            <text x={Math.min(hoverSvgX + 11, W - 125)} y={P_SFD_TOP + 23} fill="#f59e0b" fontSize={7}>V = {hoverPt.shear_kn.toFixed(1)} kN</text>
            <text x={Math.min(hoverSvgX + 11, W - 125)} y={P_SFD_TOP + 33} fill="#3b82f6" fontSize={7}>M = {hoverPt.moment_knm.toFixed(1)} kNm</text>
            <text x={Math.min(hoverSvgX + 11, W - 125)} y={P_SFD_TOP + 43} fill="#a855f7" fontSize={7}>δ = {hoverPt.deflection_mm.toFixed(2)} mm</text>
          </>
        )}
      </svg>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-1 text-[10px]">
        {[
          { label: 'M_max', val: `${summary.M_max_knm.toFixed(1)} kNm`, color: 'text-blue-400' },
          { label: 'V_max', val: `${summary.V_max_kn.toFixed(1)} kN`, color: 'text-yellow-400' },
          { label: 'δ_max', val: `${summary.delta_max_mm.toFixed(2)} mm`, color: 'text-purple-400' },
          { label: 'EI', val: `${(summary.EI_kn_m2 / 1000).toFixed(0)} MN·m²`, color: 'text-gray-300' },
        ].map((c) => (
          <div key={c.label} className="bg-gray-800 rounded px-2 py-1 text-center">
            <div className="text-gray-500">{c.label}</div>
            <div className={`font-mono font-semibold ${c.color}`}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* Reactions */}
      {reactions.length > 0 && (
        <div className="flex gap-2 flex-wrap text-[10px]">
          {reactions.map((r) => (
            <span key={r.label} className="bg-gray-800 rounded px-2 py-1 text-gray-300">
              <span className="text-gray-500">{r.label}: </span>
              <span className="font-mono text-green-400">{r.value.toFixed(1)} {r.unit}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
