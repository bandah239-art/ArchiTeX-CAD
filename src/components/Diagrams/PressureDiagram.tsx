import { useMemo } from 'react';

export interface PressureDiagramProps {
  data: {
    type?: 'triangular' | 'trapezoidal' | 'uniform' | 'contour' | 'arrows' | 'foundation_bearing' | 'bridge_pier';
    points?: { x?: number; y?: number; depth_m?: number; pressure?: number; pressure_kpa?: number; zone?: string }[] | number[][];
    labels?: string[];
    water_level_m?: number;
    wall_height_m?: number;
    pier_width_m?: number;
    footprint?: { B?: number; L?: number };
    foundation?: { B?: number; L?: number };
  } | null | undefined;
}

export function PressureDiagram({ data }: PressureDiagramProps) {
  if (!data) return null;

  const w = 500;
  const h = 320;

  const downloadSvg = () => {
    const svgEl = document.getElementById('pressure-diagram-svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pressure-diagram-${data.type || 'generic'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Standardize points format
  const pts = useMemo(() => {
    const raw = data.points ?? [];
    return raw.map((p: any) => {
      if (Array.isArray(p)) {
        return { depth_m: Number(p[0]), pressure: Number(p[1]) };
      }
      return {
        x: p.x != null ? Number(p.x) : undefined,
        y: p.y != null ? Number(p.y) : undefined,
        depth_m: p.depth_m != null ? Number(p.depth_m) : p.y != null ? Number(p.y) : 0,
        pressure: p.pressure != null ? Number(p.pressure) : p.pressure_kpa != null ? Number(p.pressure_kpa) : 0,
        zone: p.zone != null ? String(p.zone) : undefined,
      };
    });
  }, [data.points]);

  const labels = data.labels ?? [];
  const type = data.type || 'triangular';

  // --- RENDER FUNCTIONS FOR EACH TYPE ---
  
  const renderTriangular = () => {
    const wallX = 120;
    const topY = 40;
    const botY = 260;
    const wallH = botY - topY;
    const maxP = Math.max(...pts.map((p) => p.pressure ?? 0), 10);
    const scale = 200 / maxP;

    // Draw horizontal pressure arrows
    const arrows = Array.from({ length: 6 }).map((_, i) => {
      const pct = i / 5;
      const y = topY + pct * wallH;
      const pVal = pct * maxP;
      const len = pVal * scale;
      if (len < 5) return null;
      return (
        <g key={i}>
          <line x1={wallX} y1={y} x2={wallX + len} y2={y} stroke="#0284c7" strokeWidth={1.5} />
          <polygon points={`${wallX},${y} ${wallX+6},${y-3} ${wallX+6},${y+3}`} fill="#0284c7" />
        </g>
      );
    });

    // Resultant force location (h/3 from base)
    const resY = botY - wallH / 3;
    const resLen = 90;

    return (
      <>
        <text x={w / 2} y={20} textAnchor="middle" fill="#94a3b8" fontSize={11} fontWeight="bold">
          LATERAL PRESSURE PROFILE (TRIANGULAR)
        </text>

        {/* Soil/Retention Wall */}
        <line x1={wallX} y1={topY} x2={wallX} y2={botY} stroke="#cbd5e1" strokeWidth={5} />
        <line x1={wallX} y1={botY} x2={w - 50} y2={botY} stroke="#475569" strokeWidth={1.5} />
        
        {/* Pressure profile boundary */}
        <polygon
          points={`${wallX},${topY} ${wallX},${botY} ${wallX + maxP * scale},${botY}`}
          fill="#38bdf8"
          fillOpacity={0.2}
          stroke="#0ea5e9"
          strokeWidth={1.5}
        />

        {arrows}

        {/* Resultant force arrow */}
        <g>
          <line x1={wallX - resLen} y1={resY} x2={wallX} y2={resY} stroke="#ef4444" strokeWidth={3} />
          <polygon points={`${wallX},${resY} ${wallX-8},${resY-5} ${wallX-8},${resY+5}`} fill="#ef4444" />
          <text x={wallX - resLen + 5} y={resY - 6} fill="#ef4444" fontSize={9} fontWeight="bold">
            Resultant R (at H/3)
          </text>
        </g>

        {/* Labels */}
        <text x={wallX - 10} y={topY + 4} textAnchor="end" fill="#94a3b8" fontSize={9}>
          p = 0 (Top)
        </text>
        <text x={wallX + maxP * scale + 10} y={botY + 12} textAnchor="start" fill="#38bdf8" fontSize={9} fontWeight="bold">
          p_max = {maxP.toFixed(1)} kPa (Base)
        </text>
      </>
    );
  };

  const renderTrapezoidal = () => {
    const wallX = 120;
    const topY = 40;
    const botY = 260;
    const wallH = botY - topY;
    const pressures = pts.map((p) => p.pressure ?? 0);
    const pMin = pressures[0] ?? 15.0;
    const pMax = pressures[pressures.length - 1] ?? 45.0;
    
    const maxVal = Math.max(pMin, pMax, 1);
    const scale = 180 / maxVal;
    
    const lenTop = pMin * scale;
    const lenBot = pMax * scale;

    const arrows = Array.from({ length: 6 }).map((_, i) => {
      const pct = i / 5;
      const y = topY + pct * wallH;
      const pVal = pMin + pct * (pMax - pMin);
      const len = pVal * scale;
      return (
        <g key={i}>
          <line x1={wallX} y1={y} x2={wallX + len} y2={y} stroke="#0284c7" strokeWidth={1.5} />
          <polygon points={`${wallX},${y} ${wallX+6},${y-3} ${wallX+6},${y+3}`} fill="#0284c7" />
        </g>
      );
    });

    return (
      <>
        <text x={w / 2} y={20} textAnchor="middle" fill="#94a3b8" fontSize={11} fontWeight="bold">
          LATERAL PRESSURE PROFILE (TRAPEZOIDAL)
        </text>

        <line x1={wallX} y1={topY} x2={wallX} y2={botY} stroke="#cbd5e1" strokeWidth={5} />
        <line x1={wallX} y1={botY} x2={w - 50} y2={botY} stroke="#475569" strokeWidth={1.5} />

        <polygon
          points={`${wallX},${topY} ${wallX + lenTop},${topY} ${wallX + lenBot},${botY} ${wallX},${botY}`}
          fill="#38bdf8"
          fillOpacity={0.2}
          stroke="#0ea5e9"
          strokeWidth={1.5}
        />

        {arrows}

        <text x={wallX + lenTop + 10} y={topY + 4} fill="#cbd5e1" fontSize={9}>
          p_min = {pMin.toFixed(1)} kPa
        </text>
        <text x={wallX + lenBot + 10} y={botY + 4} fill="#cbd5e1" fontSize={9} fontWeight="bold">
          p_max = {pMax.toFixed(1)} kPa
        </text>
      </>
    );
  };

  const renderFoundationBearing = () => {
    const cx = w / 2;
    const fY = 80;
    const fW = 160;
    const fH = 30;
    const pressures = pts.map((p) => p.pressure ?? 0);
    const qMin = pressures[0] ?? 110.0;
    const qMax = pressures[pressures.length - 1] ?? 145.0;

    const maxVal = Math.max(qMin, qMax, 1);
    const scale = 50 / maxVal;

    const pressY = fY + fH;
    const dTopL = `${cx - fW/2},${pressY}`;
    const dTopR = `${cx + fW/2},${pressY}`;
    const dBotR = `${cx + fW/2},${pressY + qMax * scale}`;
    const dBotL = `${cx - fW/2},${pressY + qMin * scale}`;

    return (
      <>
        <text x={w / 2} y={20} textAnchor="middle" fill="#94a3b8" fontSize={11} fontWeight="bold">
          FOUNDATION BEARING PRESSURE
        </text>

        {/* Ground level */}
        <line x1={50} y1={fY} x2={w - 50} y2={fY} stroke="#64748b" strokeWidth={1.5} strokeDasharray="3 3" />
        
        {/* Footing block */}
        <rect x={cx - fW/2} y={fY} width={fW} height={fH} fill="#475569" stroke="#cbd5e1" strokeWidth={2} />
        
        {/* Column stub */}
        <rect x={cx - 15} y={fY - 40} width={30} height={40} fill="#64748b" stroke="#cbd5e1" strokeWidth={1.5} />
        
        {/* Vertical loads arrow */}
        <g>
          <line x1={cx} y1={fY - 55} x2={cx} y2={fY - 40} stroke="#ef4444" strokeWidth={2.5} />
          <polygon points={`${cx},${fY - 40} ${cx-4},${fY-46} ${cx+4},${fY-46}`} fill="#ef4444" />
          <text x={cx + 8} y={fY - 45} fill="#ef4444" fontSize={9} fontWeight="bold">
            P
          </text>
        </g>

        {/* Bearing pressure block */}
        <polygon
          points={`${dTopL} ${dTopR} ${dBotR} ${dBotL}`}
          fill="#38bdf8"
          fillOpacity={0.2}
          stroke="#0ea5e9"
          strokeWidth={1.5}
        />

        {/* Pressure grid lines */}
        {Array.from({ length: 9 }).map((_, i) => {
          const x = cx - fW/2 + (i / 8) * fW;
          const pct = i / 8;
          const qVal = qMin + pct * (qMax - qMin);
          const y2 = pressY + qVal * scale;
          return (
            <g key={i}>
              <line x1={x} y1={pressY} x2={x} y2={y2} stroke="#0ea5e9" strokeWidth={1} strokeDasharray="2 2" />
              <polygon points={`${x},${y2} ${x-2},${y2-4} ${x+2},${y2-4}`} fill="#0ea5e9" />
            </g>
          );
        })}

        <text x={cx - fW/2 - 10} y={pressY + (qMin*scale)/2} textAnchor="end" fill="#cbd5e1" fontSize={9}>
          q_min = {qMin.toFixed(1)} kPa
        </text>
        <text x={cx + fW/2 + 10} y={pressY + (qMax*scale)/2} textAnchor="start" fill="#cbd5e1" fontSize={9} fontWeight="bold">
          q_max = {qMax.toFixed(1)} kPa
        </text>

        {/* Footing width text */}
        <text x={cx} y={fY + 18} textAnchor="middle" fill="#f1f5f9" fontSize={8}>
          Width B
        </text>
      </>
    );
  };

  const renderBridgePier = () => {
    const cx = w / 2;
    const pierW = 50;
    const topY = 40;
    const botY = 260;
    const waterY = 120;
    
    // Hydrostatic triangle
    const hydroXMax = cx + pierW/2 + 60;

    // Hydrodynamic addition (rectangular/parabolic combination)
    const dynXMax = hydroXMax + 40;

    return (
      <>
        <text x={w / 2} y={20} textAnchor="middle" fill="#94a3b8" fontSize={11} fontWeight="bold">
          BRIDGE PIER HYDROSTATIC & HYDRODYNAMIC PRESSURE
        </text>

        {/* Water fill (light blue background) */}
        <rect x={50} y={waterY} width={w - 100} height={botY - waterY} fill="#e0f2fe" fillOpacity={0.4} />
        
        {/* Water Surface Line */}
        <line x1={50} y1={waterY} x2={w - 50} y2={waterY} stroke="#0284c7" strokeWidth={1.5} strokeDasharray="4 3" />
        <text x={60} y={waterY - 5} fill="#0284c7" fontSize={9}>
          Water Level
        </text>

        {/* Pier elevation */}
        <rect x={cx - pierW/2} y={topY} width={pierW} height={botY - topY} fill="#475569" stroke="#cbd5e1" strokeWidth={2} />
        
        {/* Foundation line */}
        <line x1={50} y1={botY} x2={w - 50} y2={botY} stroke="#94a3b8" strokeWidth={3} />

        {/* Hydrostatic Pressure (Triangle) */}
        <polygon
          points={`${cx + pierW/2},${waterY} ${cx + pierW/2},${botY} ${hydroXMax},${botY}`}
          fill="#38bdf8"
          fillOpacity={0.3}
          stroke="#0284c7"
          strokeWidth={1.5}
        />
        <text x={hydroXMax + 5} y={botY - 5} fill="#0284c7" fontSize={8}>
          Hydrostatic (p_h)
        </text>

        {/* Hydrodynamic Pressure Addition (offset) */}
        <polygon
          points={`${hydroXMax},${waterY} ${hydroXMax},${botY} ${dynXMax},${botY} ${dynXMax},${waterY}`}
          fill="#f97316"
          fillOpacity={0.2}
          stroke="#ea580c"
          strokeWidth={1.5}
          strokeDasharray="2 1"
        />
        <text x={dynXMax + 5} y={waterY + 15} fill="#ea580c" fontSize={8}>
          Hydrodynamic (+p_d)
        </text>

        {/* Total resultant force arrow */}
        <g>
          <line x1={cx - pierW/2 - 60} y1={botY - 50} x2={cx - pierW/2} y2={botY - 50} stroke="#ef4444" strokeWidth={2.5} />
          <polygon points={`${cx - pierW/2},${botY - 50} ${cx-pierW/2-6},${botY-54} ${cx-pierW/2-6},${botY-46}`} fill="#ef4444" />
          <text x={cx - pierW/2 - 70} y={botY - 55} fill="#ef4444" fontSize={9} fontWeight="bold">
            Total Force F_d
          </text>
        </g>

        {/* Base moment text */}
        <text x={cx} y={botY + 20} textAnchor="middle" fill="#f87171" fontSize={10} fontWeight="bold">
          Base Moment M_base = {Number(labels[0]?.split('=')[1]?.split(' ')[0] || 0).toFixed(1)} kNm
        </text>
      </>
    );
  };

  const renderContourOrArrows = () => {
    // Fallback for general lists
    return (
      <>
        <text x={w / 2} y={20} textAnchor="middle" fill="#94a3b8" fontSize={11} fontWeight="bold">
          PRESSURE DATA DISPLAY
        </text>
        {pts.map((p, i) => {
          const y = 60 + i * 20;
          if (y > h - 40) return null;
          return (
            <text key={i} x={80} y={y} fill="#f1f5f9" fontSize={9}>
              Depth: {p.depth_m?.toFixed(2)} m — Pressure: {p.pressure?.toFixed(1)} kPa
            </text>
          );
        })}
      </>
    );
  };

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-700/50 rounded-xl p-4 text-slate-200 space-y-3">
      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
        <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider">
          Pressure Distribution Diagram
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
          id="pressure-diagram-svg"
          viewBox={`0 0 ${w} ${h}`}
          className="w-full h-auto max-w-[500px]"
        >
          {type === 'triangular' && renderTriangular()}
          {type === 'trapezoidal' && renderTrapezoidal()}
          {(type === 'foundation_bearing' || type === 'uniform') && renderFoundationBearing()}
          {type === 'bridge_pier' && renderBridgePier()}
          {type !== 'triangular' && type !== 'trapezoidal' && type !== 'foundation_bearing' && type !== 'uniform' && type !== 'bridge_pier' && renderContourOrArrows()}
          
          {/* Legend / Info */}
          {labels.slice(1).map((lb, i) => (
            <text key={i} x={20} y={h - 30 - i * 14} fill="#86efac" fontSize={9}>
              {lb}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
