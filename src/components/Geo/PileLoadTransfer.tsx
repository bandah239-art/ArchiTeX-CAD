import { useEffect, useRef, useState } from 'react';

interface Node {
  depth_m: number;
  load_kn: number;
  cumulative_skin_kn: number;
}

interface Summary {
  Q_skin_kn: number;
  Q_tip_kn: number;
  Q_ult_kn: number;
  unit_skin_friction_kpa: number;
  perimeter_m: number;
  area_tip_m2: number;
  diameter_m: number;
  length_m: number;
  applied_load_kn: number;
}

interface Props {
  pile_diameter_m?: number;
  pile_length_m?: number;
  soil_cohesion_kpa?: number;
  adhesion_factor?: number;
  nc?: number;
  applied_load_kn?: number;
}

const SVG_W = 520, SVG_H = 300;
// Left panel: pile cross-section  |  Right panel: load-transfer chart
const PILE_X = 30, PILE_W_SVG = 140;
const CHART_X = 190, CHART_W = SVG_W - CHART_X - 20;
const PAD_TOP = 24, PAD_BOT = 30;
const PLOT_H = SVG_H - PAD_TOP - PAD_BOT;

export function PileLoadTransfer({
  pile_diameter_m = 0.6,
  pile_length_m = 20,
  soil_cohesion_kpa = 50,
  adhesion_factor = 0.5,
  nc = 9,
  applied_load_kn = 800,
}: Props) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hover, setHover] = useState<Node | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);

    fetch('http://localhost:8000/geo/simulation/pile-load-transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pile_diameter_m, pile_length_m, soil_cohesion_kpa, adhesion_factor, nc, applied_load_kn }),
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 'ok') {
          setNodes(d.nodes as Node[]);
          setSummary(d.summary as Summary);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pile_diameter_m, pile_length_m, soil_cohesion_kpa, adhesion_factor, nc, applied_load_kn]);

  if (!nodes.length || !summary)
    return (
      <div className="h-[300px] flex items-center justify-center text-gray-500 text-xs">
        {loading ? 'Computing pile load transfer…' : 'No data'}
      </div>
    );

  const maxLoad = applied_load_kn;
  const maxDepth = pile_length_m;

  // Pile cross-section drawing
  const pileRectX = PILE_X + 30;
  const pileRectW = 50;
  const pileTop = PAD_TOP;
  const pileBot = PAD_TOP + PLOT_H;
  const pilePixH = pileBot - pileTop;

  // Chart coordinate functions
  const cx = (load: number) => CHART_X + (load / maxLoad) * CHART_W;
  const cy = (depth: number) => PAD_TOP + (depth / maxDepth) * PLOT_H;

  // Load-transfer line (load in pile vs depth)
  const linePath = nodes
    .map((n, i) => `${i === 0 ? 'M' : 'L'}${cx(n.load_kn).toFixed(1)},${cy(n.depth_m).toFixed(1)}`)
    .join(' ');

  // Area fill left of line (representing load carried by pile)
  const areaPath =
    `M${cx(0)},${cy(0)} ` +
    nodes.map((n) => `L${cx(n.load_kn).toFixed(1)},${cy(n.depth_m).toFixed(1)}`).join(' ') +
    ` L${cx(0)},${cy(maxDepth)} Z`;

  // Skin friction arrows along pile (every 5 nodes)
  const arrowNodes = nodes.filter((_, i) => i % 5 === 2 && i > 0);

  // X-axis ticks
  const xTicks = [0, 0.25, 0.5, 0.75, 1.0].map((f) => ({
    load: f * maxLoad,
    x: cx(f * maxLoad),
    label: `${Math.round(f * maxLoad)}`,
  }));

  // Y-axis depth ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map((f) => ({
    d: f * maxDepth,
    y: cy(f * maxDepth),
    label: `${(f * maxDepth).toFixed(0)}`,
  }));

  return (
    <div className="space-y-2">
      <svg
        width={SVG_W}
        height={SVG_H}
        className="w-full max-w-full"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ background: '#111827', borderRadius: 6 }}
      >
        {/* ── Left: Pile cross-section ── */}
        {/* Soil hatching background */}
        <rect x={PILE_X} y={pileTop} width={PILE_W_SVG} height={pilePixH} fill="#1c1a0e" rx={2} />
        {Array.from({ length: 10 }).map((_, i) => {
          const yy = pileTop + (pilePixH * i) / 10;
          return (
            <line key={i} x1={PILE_X} x2={PILE_X + PILE_W_SVG} y1={yy} y2={yy + 12} stroke="#3b2800" strokeWidth={0.7} />
          );
        })}

        {/* Pile body */}
        <rect x={pileRectX} y={pileTop} width={pileRectW} height={pilePixH - 8} fill="#1e3a5f" stroke="#3b82f6" strokeWidth={1.5} />

        {/* Pile tip (trapezoid) */}
        <polygon
          points={`${pileRectX},${pileBot - 8} ${pileRectX + pileRectW},${pileBot - 8} ${pileRectX + pileRectW / 2},${pileBot + 6}`}
          fill="#1e3a5f"
          stroke="#3b82f6"
          strokeWidth={1.5}
        />

        {/* Skin friction arrows */}
        {arrowNodes.map((n, i) => {
          const arrowY = cy(n.depth_m);
          const arrowLen = 14;
          return (
            <g key={i}>
              <line x1={pileRectX - arrowLen} x2={pileRectX - 2} y1={arrowY} y2={arrowY} stroke="#f59e0b" strokeWidth={1} />
              <polygon points={`${pileRectX - 2},${arrowY} ${pileRectX - 7},${arrowY - 3} ${pileRectX - 7},${arrowY + 3}`} fill="#f59e0b" />
              <line x1={pileRectX + pileRectW + 2} x2={pileRectX + pileRectW + arrowLen} y1={arrowY} y2={arrowY} stroke="#f59e0b" strokeWidth={1} />
              <polygon points={`${pileRectX + pileRectW + 2},${arrowY} ${pileRectX + pileRectW + 7},${arrowY - 3} ${pileRectX + pileRectW + 7},${arrowY + 3}`} fill="#f59e0b" />
            </g>
          );
        })}

        {/* End bearing arrow at tip */}
        <line
          x1={pileRectX + pileRectW / 2}
          x2={pileRectX + pileRectW / 2}
          y1={pileBot + 6}
          y2={pileBot + 20}
          stroke="#10b981"
          strokeWidth={2}
        />
        <polygon
          points={`${pileRectX + pileRectW / 2},${pileBot + 20} ${pileRectX + pileRectW / 2 - 5},${pileBot + 14} ${pileRectX + pileRectW / 2 + 5},${pileBot + 14}`}
          fill="#10b981"
        />

        {/* Pile label */}
        <text x={pileRectX + pileRectW / 2} y={pileTop - 6} fill="#60a5fa" fontSize={8} textAnchor="middle">
          D={pile_diameter_m}m  L={pile_length_m}m
        </text>

        {/* Legend */}
        <line x1={PILE_X} x2={PILE_X + 10} y1={pileBot + 20} y2={pileBot + 20} stroke="#f59e0b" strokeWidth={1.5} />
        <text x={PILE_X + 13} y={pileBot + 23} fill="#f59e0b" fontSize={7}>Skin friction</text>
        <line x1={PILE_X + 65} x2={PILE_X + 75} y1={pileBot + 20} y2={pileBot + 20} stroke="#10b981" strokeWidth={1.5} />
        <text x={PILE_X + 78} y={pileBot + 23} fill="#10b981" fontSize={7}>End bearing</text>

        {/* ── Right: Load-transfer chart ── */}
        {/* Grid */}
        {yTicks.map((t) => (
          <line key={t.d} x1={CHART_X} x2={CHART_X + CHART_W} y1={t.y} y2={t.y} stroke="#374151" strokeWidth={0.5} />
        ))}
        {xTicks.map((t) => (
          <line key={t.load} x1={t.x} x2={t.x} y1={PAD_TOP} y2={PAD_TOP + PLOT_H} stroke="#374151" strokeWidth={0.5} />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="#3b82f6" opacity={0.15} />

        {/* Load line */}
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth={2} />

        {/* X-axis (load) labels */}
        {xTicks.map((t) => (
          <text key={t.load} x={t.x} y={PAD_TOP + PLOT_H + 12} fill="#9ca3af" fontSize={7} textAnchor="middle">
            {t.label}
          </text>
        ))}
        <text x={CHART_X + CHART_W / 2} y={SVG_H - 4} fill="#6b7280" fontSize={7} textAnchor="middle">
          Load in Pile (kN)
        </text>

        {/* Y-axis (depth) labels */}
        {yTicks.map((t) => (
          <text key={t.d} x={CHART_X - 5} y={t.y + 3} fill="#9ca3af" fontSize={7} textAnchor="end">
            {t.label}
          </text>
        ))}
        <text
          x={CHART_X - 28}
          y={PAD_TOP + PLOT_H / 2}
          fill="#6b7280"
          fontSize={7}
          textAnchor="middle"
          transform={`rotate(-90, ${CHART_X - 28}, ${PAD_TOP + PLOT_H / 2})`}
        >
          Depth (m)
        </text>

        {/* Hover targets */}
        {nodes.map((n, i) => (
          <rect
            key={i}
            x={CHART_X}
            y={cy(n.depth_m) - PLOT_H / (2 * nodes.length)}
            width={CHART_W}
            height={PLOT_H / nodes.length}
            fill="transparent"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(null)}
          />
        ))}

        {/* Hover crosshair */}
        {hover && (
          <>
            <circle cx={cx(hover.load_kn)} cy={cy(hover.depth_m)} r={4} fill="#3b82f6" stroke="#fff" strokeWidth={1.5} />
            <line x1={CHART_X} x2={cx(hover.load_kn)} y1={cy(hover.depth_m)} y2={cy(hover.depth_m)} stroke="#374151" strokeWidth={0.8} strokeDasharray="3,2" />
            <rect
              x={Math.min(cx(hover.load_kn) + 6, CHART_X + CHART_W - 115)}
              y={cy(hover.depth_m) - 24}
              width={110}
              height={28}
              rx={3}
              fill="#1f2937"
              stroke="#374151"
            />
            <text x={Math.min(cx(hover.load_kn) + 12, CHART_X + CHART_W - 109)} y={cy(hover.depth_m) - 12} fill="#e5e7eb" fontSize={8}>
              z = {hover.depth_m.toFixed(1)} m
            </text>
            <text x={Math.min(cx(hover.load_kn) + 12, CHART_X + CHART_W - 109)} y={cy(hover.depth_m)} fill="#3b82f6" fontSize={8}>
              Q = {hover.load_kn.toFixed(0)} kN  skin={hover.cumulative_skin_kn.toFixed(0)} kN
            </text>
          </>
        )}
      </svg>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-1 text-[10px]">
        {[
          { label: 'Q_skin', val: `${summary.Q_skin_kn.toFixed(0)} kN`, color: 'text-yellow-400' },
          { label: 'Q_tip', val: `${summary.Q_tip_kn.toFixed(0)} kN`, color: 'text-green-400' },
          { label: 'Q_ult', val: `${summary.Q_ult_kn.toFixed(0)} kN`, color: 'text-blue-400' },
          { label: 'qs (unit)', val: `${summary.unit_skin_friction_kpa.toFixed(1)} kPa`, color: 'text-orange-400' },
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
