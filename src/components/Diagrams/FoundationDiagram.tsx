interface FoundationDiagramProps {
  inputs: {
    foundation_width: number;
    foundation_length: number;
    foundation_depth: number;
    foundation_depth_concrete: number;
    column_width: number;
    column_load: number;
    moment_x: number;
    soil_bearing: number;
  };
  summary: {
    ultimate_bearing_kpa?: number;
    applied_bearing_kpa?: number;
    foundation_design?: string;
  };
}

export function FoundationDiagram({ inputs, summary: _summary }: FoundationDiagramProps) {
  const B = inputs.foundation_width || 1.2;
  const L = inputs.foundation_length || 1.0;
  const df = inputs.foundation_depth || 1.2;
  const tf = inputs.foundation_depth_concrete || 400; // mm
  const colW = inputs.column_width || 300; // mm
  const P = inputs.column_load || 800; // kN
  const M = inputs.moment_x || 0; // kNm

  // Allowable bearing capacity
  const qAllow = inputs.soil_bearing || 150;
  
  // Calculate bearing pressures q_max and q_min
  const area = B * L;
  const z_mod = (B * B * L) / 6; // elastic section modulus
  const q_axial = P / area;
  const q_moment = M / z_mod;
  const qMax = q_axial + q_moment;
  const qMin = Math.max(0, q_axial - q_moment);
  const e = P > 0 ? M / P : 0;

  const w = 500;
  const h = 320;

  const downloadSvg = () => {
    const svgEl = document.getElementById('foundation-diagram-svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `foundation-diagram-${B}x${L}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // SVG Coordinates
  const cx = w / 2;
  const groundY = 60;
  const footingH = (tf / 1000) * 80; // Scale concrete depth
  const footingY = groundY + (df * 60) - footingH;
  const footingW = B * 120;
  
  const colY = footingY - 60;
  const colWidth = (colW / 1000) * 120;

  const pressY = footingY + footingH;
  const maxVal = Math.max(qMax, qAllow, 1);
  const scale = 50 / maxVal;

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-700/50 rounded-xl p-4 text-slate-200 space-y-3">
      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
        <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider">
          Foundation Sketch & Bearing Pressure
        </h4>
        <button
          type="button"
          onClick={downloadSvg}
          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] transition-colors"
        >
          Download SVG
        </button>
      </div>

      <div className="w-full flex justify-center bg-slate-950/40 p-2 rounded-lg border border-slate-900">
        <svg
          id="foundation-diagram-svg"
          viewBox={`0 0 ${w} ${h}`}
          className="w-full h-auto max-w-[500px]"
        >
          <text x={w / 2} y={20} textAnchor="middle" fill="#94a3b8" fontSize={11} fontWeight="bold">
            PAD FOUNDATION DESIGN & SOIL PRESSURE
          </text>

          {/* Ground Line */}
          <line x1={40} y1={groundY} x2={w - 40} y2={groundY} stroke="#854d0e" strokeWidth={2} />
          <text x={50} y={groundY - 6} fill="#854d0e" fontSize={8} fontWeight="bold">Ground Level</text>

          {/* Soil Fill hatching */}
          <rect x={40} y={groundY} width={w - 80} height={footingY + footingH - groundY} fill="#78350f" fillOpacity={0.1} />

          {/* Concrete Footing Block */}
          <rect
            x={cx - footingW / 2}
            y={footingY}
            width={footingW}
            height={footingH}
            fill="#475569"
            stroke="#cbd5e1"
            strokeWidth={1.5}
          />
          <text x={cx} y={footingY + footingH / 2 + 3} textAnchor="middle" fill="#cbd5e1" fontSize={8}>
            Concrete Footing ({tf}mm)
          </text>

          {/* Column */}
          <rect
            x={cx - colWidth / 2}
            y={colY}
            width={colWidth}
            height={footingY - colY}
            fill="#64748b"
            stroke="#cbd5e1"
            strokeWidth={1.5}
          />

          {/* Load Arrow */}
          <g>
            <line x1={cx} y1={colY - 30} x2={cx} y2={colY - 5} stroke="#ef4444" strokeWidth={2.5} />
            <polygon points={`${cx},${colY - 5} ${cx-4},${colY-11} ${cx+4},${colY-11}`} fill="#ef4444" />
            <text x={cx + 8} y={colY - 20} fill="#ef4444" fontSize={9} fontWeight="bold">
              P = {P.toFixed(0)} kN
            </text>
          </g>

          {/* Moment Arrow */}
          {M > 0 && (
            <g>
              <path
                d={`M ${cx - 20} ${colY - 15} A 25 25 0 0 1 ${cx + 20} ${colY - 15}`}
                fill="none"
                stroke="#ea580c"
                strokeWidth={2}
                markerEnd="url(#arrow)"
              />
              <text x={cx + 26} y={colY - 15} fill="#ea580c" fontSize={8} fontWeight="bold">
                M = {M.toFixed(1)} kNm
              </text>
            </g>
          )}

          {/* Bearing Pressure profile polygon */}
          <polygon
            points={`
              ${cx - footingW / 2},${pressY}
              ${cx + footingW / 2},${pressY}
              ${cx + footingW / 2},${pressY + qMax * scale}
              ${cx - footingW / 2},${pressY + qMin * scale}
            `}
            fill="#38bdf8"
            fillOpacity={0.2}
            stroke="#0ea5e9"
            strokeWidth={1.5}
          />

          {/* Pressure grid arrows */}
          {Array.from({ length: 7 }).map((_, i) => {
            const x = cx - footingW / 2 + (i / 6) * footingW;
            const pct = i / 6;
            const qVal = qMin + pct * (qMax - qMin);
            const yEnd = pressY + qVal * scale;
            if (yEnd - pressY < 3) return null;
            return (
              <g key={i}>
                <line x1={x} y1={pressY} x2={x} y2={yEnd} stroke="#0ea5e9" strokeWidth={1} />
                <polygon points={`${x},${yEnd} ${x-2},${yEnd-4} ${x+2},${yEnd-4}`} fill="#0ea5e9" />
              </g>
            );
          })}

          {/* Allowable capacity line */}
          <line
            x1={cx - footingW / 2 - 10}
            y1={pressY + qAllow * scale}
            x2={cx + footingW / 2 + 10}
            y2={pressY + qAllow * scale}
            stroke="#10b981"
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
          <text x={cx + footingW / 2 + 15} y={pressY + qAllow * scale + 3} fill="#10b981" fontSize={8} fontWeight="bold">
            q_allow = {qAllow.toFixed(0)} kPa
          </text>

          {/* Pressure values labels */}
          <text x={cx - footingW / 2 - 8} y={pressY + (qMin * scale) / 2 + 3} textAnchor="end" fill="#cbd5e1" fontSize={8}>
            q_min = {qMin.toFixed(1)} kPa
          </text>
          <text x={cx + footingW / 2 + 8} y={pressY + (qMax * scale) / 2 + 3} textAnchor="start" fill="#cbd5e1" fontSize={8} fontWeight="bold">
            q_max = {qMax.toFixed(1)} kPa
          </text>

          {/* Dimensions */}
          <text x={cx} y={footingY - 5} textAnchor="middle" fill="#cbd5e1" fontSize={8}>
            B = {B.toFixed(2)}m × L = {L.toFixed(2)}m
          </text>
          <text x={45} y={footingY + 15} fill="#64748b" fontSize={8}>
            Depth D_f = {df.toFixed(2)}m
          </text>

          {/* Resultant indicator */}
          {M > 0 && P > 0 && (
            <g>
              <line x1={cx + e * 120} y1={pressY} x2={cx + e * 120} y2={pressY + 20} stroke="#ef4444" strokeWidth={1} strokeDasharray="2 2" />
              <circle cx={cx + e * 120} cy={pressY} r={2} fill="#ef4444" />
              <text x={cx + e * 120 + 4} y={pressY + 12} fill="#ef4444" fontSize={7}>e = {(e * 1000).toFixed(0)}mm</text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
