interface SoilProfileDiagramProps {
  inputs: {
    spt_n: number;
    effective_stress_kpa?: number;
    pga_g?: number;
    rod_length_m?: number;
    borehole_diam_mm?: number;
  };
  summary: {
    n60: number;
    n1_60: number;
    site_class: string;
    class_description: string;
    liquefaction_fs: number;
    liquefiable: boolean;
  };
}

export function SoilProfileDiagram({ inputs, summary }: SoilProfileDiagramProps) {
  const spt = inputs.spt_n || 15;
  const n60 = summary.n60 || spt;
  const siteClass = summary.site_class || 'D';
  const desc = summary.class_description || 'Stiff soil profile';

  const w = 500;
  const h = 320;

  const downloadSvg = () => {
    const svgEl = document.getElementById('soil-profile-svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soil-profile-class-${siteClass}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Define layers based on site class
  const layers = (() => {
    if (siteClass === 'C') {
      return [
        { name: 'Sandy Clay / Top Soil', thickness: 2.0, color: '#a16207', spt: 12 },
        { name: 'Dense Gravelly Sand', thickness: 8.0, color: '#ca8a04', spt: 32 },
        { name: 'Soft Weathered Rock', thickness: 15.0, color: '#64748b', spt: 65 },
      ];
    } else if (siteClass === 'E') {
      return [
        { name: 'Very Soft Organic Silt', thickness: 4.0, color: '#451a03', spt: 4 },
        { name: 'Loose Clayey Sand', thickness: 10.0, color: '#78350f', spt: 9 },
        { name: 'Medium Dense Silty Sand', thickness: 12.0, color: '#b45309', spt: 18 },
      ];
    } else {
      // Default: Site Class D
      return [
        { name: 'Medium Clay / Silt', thickness: 3.0, color: '#854d0e', spt: 8 },
        { name: 'Stiff Clay Layer', thickness: 9.0, color: '#a16207', spt: 16 },
        { name: 'Dense Coarse Sand', thickness: 10.0, color: '#ca8a04', spt: 28 },
      ];
    }
  })();

  const totalThickness = layers.reduce((s, l) => s + l.thickness, 0);

  // SVG Positions
  const startX = 60;
  const profileW = 260;
  const topY = 40;
  const bottomY = 260;
  const totalH = bottomY - topY;
  const sptX = startX + profileW + 50;

  let currentY = topY;

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-700/50 rounded-xl p-4 text-slate-200 space-y-3">
      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
        <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider">
          Geotechnical Soil Profile
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
          id="soil-profile-svg"
          viewBox={`0 0 ${w} ${h}`}
          className="w-full h-auto max-w-[500px]"
        >
          <text x={w / 2} y={20} textAnchor="middle" fill="#94a3b8" fontSize={11} fontWeight="bold">
            SITE SOIL PROFILE (CLASS {siteClass})
          </text>

          {/* Draw layers */}
          {layers.map((layer, idx) => {
            const layerH = (layer.thickness / totalThickness) * totalH;
            const drawY = currentY;
            currentY += layerH;

            return (
              <g key={idx}>
                {/* Layer block */}
                <rect
                  x={startX}
                  y={drawY}
                  width={profileW}
                  height={layerH}
                  fill={layer.color}
                  fillOpacity={0.65}
                  stroke="#1e293b"
                  strokeWidth={1}
                />
                {/* Layer name tag */}
                <text
                  x={startX + 10}
                  y={drawY + layerH / 2 + 3}
                  fill="#f1f5f9"
                  fontSize={9}
                  fontWeight="bold"
                >
                  {layer.name} ({layer.thickness.toFixed(1)}m)
                </text>

                {/* SPT plotting points */}
                <circle cx={sptX + (layer.spt / 70) * 100} cy={drawY + layerH / 2} r={3} fill="#fbbf24" />
                <text x={sptX + (layer.spt / 70) * 100 + 8} y={drawY + layerH / 2 + 3} fill="#cbd5e1" fontSize={8}>
                  N={layer.spt}
                </text>
              </g>
            );
          })}

          {/* SPT plot background axis */}
          <line x1={sptX} y1={topY} x2={sptX} y2={bottomY} stroke="#475569" strokeWidth={1} />
          <line x1={sptX + 100} y1={topY} x2={sptX + 100} y2={bottomY} stroke="#475569" strokeWidth={1} strokeDasharray="2 2" />
          <text x={sptX} y={bottomY + 12} fill="#64748b" fontSize={8} textAnchor="middle">N=0</text>
          <text x={sptX + 100} y={bottomY + 12} fill="#64748b" fontSize={8} textAnchor="middle">N=70</text>
          <text x={sptX + 50} y={topY - 8} fill="#94a3b8" fontSize={8} textAnchor="middle" fontWeight="bold">SPT N profile</text>

          {/* Water Table Line (Dashed blue) */}
          <g>
            const wtY = topY + (1.5 / totalThickness) * totalH;
            <line x1={startX - 15} y1={topY + 35} x2={startX + profileW + 15} y2={topY + 35} stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="4 3" />
            <polygon points={`${startX - 5},${topY + 35} ${startX-9},${topY + 30} ${startX-1},${topY + 30}`} fill="#38bdf8" />
            <text x={startX + 10} y={topY + 31} fill="#38bdf8" fontSize={8} fontWeight="bold">Water Table (GWT)</text>
          </g>

          {/* Foundation Depth marker */}
          <g>
            const fdY = topY + (1.2 / totalThickness) * totalH;
            <line x1={startX} y1={topY + 28} x2={startX + 80} y2={topY + 28} stroke="#ef4444" strokeWidth={2} />
            <rect x={startX + 20} y={topY + 18} width={40} height={10} fill="#ef4444" fillOpacity={0.2} stroke="#ef4444" strokeWidth={0.5} />
            <text x={startX + 23} y={topY + 26} fill="#ef4444" fontSize={7} fontWeight="bold">FOUNDING LEVEL (1.2m)</text>
          </g>

          {/* Bearing capacity indicator */}
          <rect x={20} y={bottomY + 25} width={w - 40} height={30} fill="#1e293b" stroke="#334155" strokeWidth={1} rx={4} />
          <text x={w/2} y={bottomY + 43} textAnchor="middle" fill="#86efac" fontSize={9} fontWeight="bold">
            Site Class: {siteClass} ({desc}) | Corrected N60: {n60.toFixed(1)} blows/300mm
          </text>
        </svg>
      </div>
    </div>
  );
}
