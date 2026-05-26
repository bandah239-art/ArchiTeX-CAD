import { useMemo } from 'react';

interface StructuralDiagramProps {
  inputs: {
    span: number;
    support_condition?: string;
    dead_load: number;
    imposed_load: number;
    depth?: number;
    width?: number;
  };
  summary: Record<string, string | number | boolean>;
}

export function StructuralDiagram({ inputs, summary }: StructuralDiagramProps) {
  const L = inputs.span || 6.0;
  const support = inputs.support_condition || 'simply_supported';
  const gk = inputs.dead_load || 15.0;
  const qk = inputs.imposed_load || 10.0;
  const wu = 1.35 * gk + 1.5 * qk;

  // Maximum values from calculation
  const maxM = Number(summary.ultimate_moment_knm) || (wu * L * L) / 8;
  const maxV = Number(summary.shear_force_kn) || (wu * L) / 2;
  const spanDepthRatio = Number(summary.span_depth_ratio);

  // Generate plot points for diagrams
  const { bmdPoints, sfdPoints, deflPoints, maxDeflX } = useMemo(() => {
    const steps = 100;
    const bPoints: [number, number][] = [];
    const sPoints: [number, number][] = [];
    const dPoints: [number, number][] = [];

    let tempMaxDefl = 0;
    let tempMaxDeflX = 0;

    for (let i = 0; i <= steps; i++) {
      const pct = i / steps;
      const x = pct * L;
      let M = 0;
      let V = 0;
      let defl = 0; // Relative deflection coefficient

      if (support === 'cantilever') {
        // Cantilever (fixed left, free right)
        M = -0.5 * wu * Math.pow(L - x, 2);
        V = wu * (L - x);
        // y(x) = (wu * x^2) / (24 * E * I) * (6*L^2 - 4*L*x + x^2)
        defl = (Math.pow(x, 2) * (6 * L * L - 4 * L * x + x * x)) / Math.pow(L, 4);
      } else if (support === 'continuous_end') {
        // Continuous end span
        M = 0.5 * wu * x * (L - x) - 0.1 * wu * L * x;
        V = wu * (0.6 * L - x);
        defl = (x * (L - x) * (5 * L * L - 4 * x * x)) / Math.pow(L, 4);
      } else if (support === 'continuous_internal') {
        // Continuous internal span
        M = 0.5 * wu * x * (L - x) - 0.0833 * wu * L * L;
        V = wu * (0.5 * L - x);
        defl = Math.sin((Math.PI * x) / L) * 0.4;
      } else {
        // Simply supported
        M = 0.5 * wu * x * (L - x);
        V = wu * (0.5 * L - x);
        defl = 16 * Math.pow(pct, 2) * Math.pow(1 - pct, 2);
      }

      bPoints.push([x, M]);
      sPoints.push([x, V]);
      dPoints.push([x, defl]);

      if (Math.abs(defl) > Math.abs(tempMaxDefl)) {
        tempMaxDefl = defl;
        tempMaxDeflX = x;
      }
    }

    return {
      bmdPoints: bPoints,
      sfdPoints: sPoints,
      deflPoints: dPoints,
      maxDeflX: tempMaxDeflX,
    };
  }, [L, support, wu]);

  const downloadSvg = () => {
    const svgEl = document.getElementById('structural-diagram-svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beam-diagram-${support}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // SVG dimensions
  const width = 600;
  const height = 480;
  const beamY = 60;
  const bmdY = 180;
  const sfdY = 320;
  const deflY = 430;
  const plotW = 460;
  const marginL = 70;

  const getScreenX = (x: number) => marginL + (x / L) * plotW;

  // UDL loads visualization
  const loadArrows = Array.from({ length: 11 }).map((_, i) => {
    const x = getScreenX((i / 10) * L);
    return (
      <g key={i}>
        <line x1={x} y1={beamY - 20} x2={x} y2={beamY} stroke="#f59e0b" strokeWidth={1} />
        <polygon points={`${x},${beamY} ${x-3},${beamY-6} ${x+3},${beamY-6}`} fill="#f59e0b" />
      </g>
    );
  });

  // Plot pathways
  const bmdPath = useMemo(() => {
    const maxVal = Math.max(...bmdPoints.map(([_, m]) => Math.abs(m)), 1);
    const scale = 40 / maxVal;
    return bmdPoints
      .map(([x, m], i) => {
        const sx = getScreenX(x);
        const sy = bmdY + m * scale;
        return `${i === 0 ? 'M' : 'L'} ${sx} ${sy}`;
      })
      .join(' ');
  }, [bmdPoints]);

  const bmdFill = `${bmdPath} L ${getScreenX(L)} ${bmdY} L ${getScreenX(0)} ${bmdY} Z`;

  const sfdPath = useMemo(() => {
    const maxVal = Math.max(...sfdPoints.map(([_, v]) => Math.abs(v)), 1);
    const scale = 35 / maxVal;
    return sfdPoints
      .map(([x, v], i) => {
        const sx = getScreenX(x);
        const sy = sfdY - v * scale;
        return `${i === 0 ? 'M' : 'L'} ${sx} ${sy}`;
      })
      .join(' ');
  }, [sfdPoints]);

  const sfdPolygons = useMemo(() => {
    const maxVal = Math.max(...sfdPoints.map(([_, v]) => Math.abs(v)), 1);
    const scale = 35 / maxVal;
    const polys: { points: string; fill: string }[] = [];
    let currentPoly: [number, number][] = [];
    let currentSign = 0;

    sfdPoints.forEach(([x, v]) => {
      const sign = Math.sign(v);
      if (sign !== currentSign && currentSign !== 0) {
        // Complete current polygon
        const pStr = currentPoly
          .map(([px, py]) => `${getScreenX(px)},${sfdY - py * scale}`)
          .concat([`${getScreenX(x)},${sfdY}`, `${getScreenX(currentPoly[0][0])},${sfdY}`])
          .join(' ');
        polys.push({ points: pStr, fill: currentSign > 0 ? '#10b981' : '#ef4444' });
        currentPoly = [];
      }
      currentSign = sign;
      currentPoly.push([x, v]);
    });

    if (currentPoly.length) {
      const pStr = currentPoly
        .map(([px, py]) => `${getScreenX(px)},${sfdY - py * scale}`)
        .concat([`${getScreenX(L)},${sfdY}`, `${getScreenX(currentPoly[0][0])},${sfdY}`])
        .join(' ');
      polys.push({ points: pStr, fill: currentSign >= 0 ? '#10b981' : '#ef4444' });
    }

    return polys;
  }, [sfdPoints, L]);

  const deflPath = useMemo(() => {
    return deflPoints
      .map(([x, d]) => {
        const sx = getScreenX(x);
        const sy = deflY + d * 25; // Exaggerate scale
        return `${sx},${sy}`;
      })
      .join(' ');
  }, [deflPoints]);

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-700/50 rounded-xl p-4 text-slate-200 space-y-3">
      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
        <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider">
          Beam Diagrams (BMD & SFD)
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
          id="structural-diagram-svg"
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-w-[560px]"
        >
          {/* Support Symbols */}
          {support === 'cantilever' ? (
            // Fixed support on left
            <g>
              <line x1={getScreenX(0)} y1={beamY - 15} x2={getScreenX(0)} y2={beamY + 15} stroke="#cbd5e1" strokeWidth={3} />
              <line x1={getScreenX(0) - 4} y1={beamY - 12} x2={getScreenX(0)} y2={beamY - 8} stroke="#cbd5e1" strokeWidth={1} />
              <line x1={getScreenX(0) - 4} y1={beamY - 4} x2={getScreenX(0)} y2={beamY} stroke="#cbd5e1" strokeWidth={1} />
              <line x1={getScreenX(0) - 4} y1={beamY + 4} x2={getScreenX(0)} y2={beamY + 8} stroke="#cbd5e1" strokeWidth={1} />
            </g>
          ) : (
            // Pin supports
            <>
              <polygon
                points={`${getScreenX(0)},${beamY} ${getScreenX(0)-6},${beamY+12} ${getScreenX(0)+6},${beamY+12}`}
                fill="#94a3b8"
                stroke="#64748b"
                strokeWidth={1}
              />
              {support !== 'simply_supported' ? (
                // Continuous internal supports
                <polygon
                  points={`${getScreenX(L)},${beamY} ${getScreenX(L)-6},${beamY+12} ${getScreenX(L)+6},${beamY+12}`}
                  fill="#94a3b8"
                  stroke="#64748b"
                  strokeWidth={1}
                />
              ) : (
                // Roller support on right
                <g>
                  <polygon
                    points={`${getScreenX(L)},${beamY} ${getScreenX(L)-6},${beamY+10} ${getScreenX(L)+6},${beamY+10}`}
                    fill="#94a3b8"
                    stroke="#64748b"
                    strokeWidth={1}
                  />
                  <line x1={getScreenX(L)-8} y1={beamY+12} x2={getScreenX(L)+8} y2={beamY+12} stroke="#94a3b8" strokeWidth={1.5} />
                </g>
              )}
            </>
          )}

          {/* UDL Line */}
          <line
            x1={getScreenX(0)}
            y1={beamY - 20}
            x2={getScreenX(L)}
            y2={beamY - 20}
            stroke="#f59e0b"
            strokeWidth={1.5}
          />
          {loadArrows}
          <text x={getScreenX(L/2)} y={beamY - 25} textAnchor="middle" fill="#f59e0b" fontSize={9} fontWeight="bold">
            wu = {wu.toFixed(2)} kN/m
          </text>

          {/* Beam Line */}
          <line
            x1={getScreenX(0)}
            y1={beamY}
            x2={getScreenX(L)}
            y2={beamY}
            stroke="#cbd5e1"
            strokeWidth={4}
          />
          <text x={getScreenX(0) - 10} y={beamY + 4} fill="#94a3b8" fontSize={9} textAnchor="end">
            x=0
          </text>
          <text x={getScreenX(L) + 10} y={beamY + 4} fill="#94a3b8" fontSize={9} textAnchor="start">
            x={L}m
          </text>

          {/* --- BENDING MOMENT DIAGRAM --- */}
          <text x={marginL - 10} y={bmdY - 30} fill="#cbd5e1" fontSize={10} fontWeight="bold" textAnchor="end">
            BMD (kNm)
          </text>
          <line x1={getScreenX(0)} y1={bmdY} x2={getScreenX(L)} y2={bmdY} stroke="#475569" strokeWidth={1} />
          
          <path d={bmdFill} fill="#3b82f6" fillOpacity={0.25} />
          <path d={bmdPath} fill="none" stroke="#3b82f6" strokeWidth={2} />

          {/* BMD Max Label */}
          {support === 'cantilever' ? (
            <text x={getScreenX(0) + 10} y={bmdY + 30} fill="#60a5fa" fontSize={9} fontWeight="bold">
              M_max = {maxM.toFixed(1)} kNm
            </text>
          ) : (
            <text x={getScreenX(L/2)} y={bmdY + 50} textAnchor="middle" fill="#60a5fa" fontSize={9} fontWeight="bold">
              M_max = {maxM.toFixed(1)} kNm
            </text>
          )}

          {/* --- SHEAR FORCE DIAGRAM --- */}
          <text x={marginL - 10} y={sfdY - 30} fill="#cbd5e1" fontSize={10} fontWeight="bold" textAnchor="end">
            SFD (kN)
          </text>
          <line x1={getScreenX(0)} y1={sfdY} x2={getScreenX(L)} y2={sfdY} stroke="#475569" strokeWidth={1} />

          {sfdPolygons.map((poly, idx) => (
            <polygon key={idx} points={poly.points} fill={poly.fill} fillOpacity={0.25} />
          ))}
          <path d={sfdPath} fill="none" stroke="#10b981" strokeWidth={2} />

          {/* SFD Labels */}
          <text x={getScreenX(0) + 6} y={sfdY - 20} fill="#34d399" fontSize={8} fontWeight="bold">
            +{maxV.toFixed(1)} kN
          </text>
          <text x={getScreenX(L) - 6} y={sfdY + 20} textAnchor="end" fill="#f87171" fontSize={8} fontWeight="bold">
            -{maxV.toFixed(1)} kN
          </text>

          {/* --- DEFLECTION DIAGRAM --- */}
          <text x={marginL - 10} y={deflY - 15} fill="#cbd5e1" fontSize={10} fontWeight="bold" textAnchor="end">
            Deflection
          </text>
          <line x1={getScreenX(0)} y1={deflY} x2={getScreenX(L)} y2={deflY} stroke="#475569" strokeWidth={1} />
          <polyline points={deflPath} fill="none" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="3 2" />

          {/* Max deflection indicator */}
          {support === 'cantilever' ? (
            <text x={getScreenX(L)} y={deflY + 35} textAnchor="end" fill="#fbbf24" fontSize={8} fontWeight="bold">
              Max deflection at free end
              {Number.isFinite(spanDepthRatio) ? ` · L/d ≈ ${spanDepthRatio.toFixed(0)}` : ''}
            </text>
          ) : (
            <text x={getScreenX(maxDeflX)} y={deflY + 20} textAnchor="middle" fill="#fbbf24" fontSize={8} fontWeight="bold">
              Max deflection (midspan)
              {Number.isFinite(spanDepthRatio) ? ` · L/d ≈ ${spanDepthRatio.toFixed(0)}` : ''}
            </text>
          )}
        </svg>
      </div>
      <div className="text-[10px] text-gray-500 italic text-center">
        Diagram shapes are scaled representations based on EC2 calculations.
      </div>
    </div>
  );
}
