import type { PressureDiagramData } from '../../../services/pressureAPI';

interface PressureDiagramProps {
  data: PressureDiagramData | null | undefined;
}

type Pt = { x?: number; y?: number; pressure?: number; depth_m?: number; pressure_kpa?: number; zone?: string };

function normPoints(raw: Record<string, unknown>[]): Pt[] {
  return raw.map((p) => {
    if (Array.isArray(p)) {
      const depth = Number(p[0]);
      const isMm = depth > 3;
      return { depth_m: isMm ? depth / 1000 : depth, pressure: Number(p[1]) };
    }
    return {
      x: p.x != null ? Number(p.x) : undefined,
      y: p.y != null ? Number(p.y) : undefined,
      depth_m: p.depth_m != null ? Number(p.depth_m) : p.y != null ? Number(p.y) : undefined,
      pressure:
        p.pressure != null
          ? Number(p.pressure)
          : p.pressure_kpa != null
            ? Number(p.pressure_kpa)
            : undefined,
      zone: p.zone != null ? String(p.zone) : undefined,
    };
  });
}

function ContourBulbDiagram({
  pts,
  labels,
  footprint,
}: {
  pts: Pt[];
  labels: string[];
  footprint?: { B?: number; L?: number };
}) {
  const w = 300;
  const h = 220;
  const depths = pts.map((p) => p.depth_m ?? 0);
  const pressures = pts.map((p) => p.pressure ?? 0);
  const maxD = Math.max(...depths, 0.01);
  const maxP = Math.max(...pressures, 1);
  const surfY = 36;
  const baseY = h - 36;
  const footW = 80;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-md bg-infra-darker/60 rounded border border-infra-accent/30">
      <text x={w / 2} y={12} textAnchor="middle" fill="#94a3b8" fontSize={10}>
        Stress bulb / layer pressures
      </text>
      <rect x={(w - footW) / 2} y={surfY} width={footW} height={14} fill="#64748b" stroke="#94a3b8" />
      <text x={(w - footW) / 2} y={surfY - 4} fill="#94a3b8" fontSize={8}>
        Foundation / surface
      </text>
      {pts.map((p, i) => {
        const d = p.depth_m ?? 0;
        const y = surfY + 18 + (d / maxD) * (baseY - surfY - 18);
        const barW = ((p.pressure ?? 0) / maxP) * 90;
        const t = (p.pressure ?? 0) / maxP;
        const fill = `rgb(${Math.round(239 * t)}, ${Math.round(68 * (1 - t))}, ${Math.round(68 + 180 * (1 - t))})`;
        return (
          <g key={i}>
            <line x1={48} y1={y} x2={w - 48} y2={y} stroke="#334155" strokeDasharray="2 2" />
            <rect x={w - 48 - barW} y={y - 4} width={barW} height={8} fill={fill} fillOpacity={0.7} />
            <text x={8} y={y + 3} fill="#64748b" fontSize={8}>
              {d.toFixed(2)} m
            </text>
            <text x={w - 42} y={y + 3} fill="#e2e8f0" fontSize={8}>
              {(p.pressure ?? 0).toFixed(0)}
            </text>
          </g>
        );
      })}
      <text x={w - 8} y={surfY + 30} fill="#64748b" fontSize={8} textAnchor="end">
        kPa →
      </text>
      {labels.map((lb, i) => (
        <text key={i} x={8} y={h - 24 - i * 11} fill="#86efac" fontSize={9}>
          {lb}
        </text>
      ))}
      {footprint && (
        <text x={8} y={h - 8} fill="#64748b" fontSize={9}>
          B={footprint.B} m · L={footprint.L} m
        </text>
      )}
    </svg>
  );
}

function WindArrowsDiagram({
  zones,
  labels,
  qp,
}: {
  zones: { name: string; pressure: number }[];
  labels: string[];
  qp: number;
}) {
  const w = 300;
  const h = 200;
  const cx = w / 2;
  const cy = h / 2;
  const bw = 70;
  const bh = 50;

  const zonePos: Record<string, { x: number; y: number; dx: number; dy: number }> = {
    windward: { x: cx - bw / 2 - 28, y: cy, dx: -1, dy: 0 },
    leeward: { x: cx + bw / 2 + 28, y: cy, dx: 1, dy: 0 },
    side: { x: cx, y: cy - bh / 2 - 22, dx: 0, dy: -1 },
    roof_flat: { x: cx, y: cy + bh / 2 + 22, dx: 0, dy: 1 },
  };

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-md bg-infra-darker/60 rounded border border-infra-accent/30">
      <text x={w / 2} y={12} textAnchor="middle" fill="#94a3b8" fontSize={10}>
        Wind pressure zones (EC1)
      </text>
      <rect x={cx - bw / 2} y={cy - bh / 2} width={bw} height={bh} fill="#475569" stroke="#94a3b8" strokeWidth={1.5} />
      {zones.map((z) => {
        const pos = zonePos[z.name] ?? { x: cx, y: cy, dx: 0, dy: -1 };
        const inward = z.pressure < 0;
        const len = 14 + Math.min(40, Math.abs(z.pressure) * 8);
        const x2 = pos.x + pos.dx * len * (inward ? 1 : -1);
        const y2 = pos.y + pos.dy * len * (inward ? 1 : -1);
        return (
          <g key={z.name}>
            <line x1={pos.x} y1={pos.y} x2={x2} y2={y2} stroke={z.pressure >= 0 ? '#38bdf8' : '#f97316'} strokeWidth={2} />
            <text x={pos.x + pos.dx * (len + 12) * (inward ? 1 : -1)} y={pos.y + 4} fill="#cbd5e1" fontSize={7} textAnchor="middle">
              {z.name} {z.pressure.toFixed(1)}
            </text>
          </g>
        );
      })}
      <text x={w / 2} y={h - 8} textAnchor="middle" fill="#fbbf24" fontSize={9}>
        qp ≈ {qp.toFixed(2)} kN/m² {labels[0] ? `· ${labels[0]}` : ''}
      </text>
    </svg>
  );
}

export function PressureDiagram({ data }: PressureDiagramProps) {
  if (!data) return null;

  const w = 300;
  const h = 220;
  const pts = normPoints((data.points ?? []) as Record<string, unknown>[]);
  const labels = data.labels ?? [];
  const foundation = (data as PressureDiagramData & { foundation?: { B?: number; L?: number } }).foundation;
  const footprint = (data as { footprint?: { B?: number; L?: number } }).footprint ?? foundation;
  const wallH = Number((data as { wall_height_m?: number }).wall_height_m ?? pts[pts.length - 1]?.y ?? 5);
  const waterLevel = Number((data as { water_level_m?: number }).water_level_m ?? 0);
  const pierW = Number((data as { pier_width_m?: number }).pier_width_m ?? 1.5);

  if (data.type === 'contour' && pts.some((p) => (p.depth_m ?? 0) >= 0 && (p.pressure ?? 0) > 0)) {
    return <ContourBulbDiagram pts={pts} labels={labels} footprint={footprint} />;
  }

  if (data.type === 'arrows') {
    const zones = pts
      .map((p) => ({
        name: p.zone ?? 'zone',
        pressure: Number((p as { pressure_kpa?: number }).pressure_kpa ?? p.pressure ?? 0),
      }))
      .filter((z) => z.name !== 'zone');
    const qp = zones.length ? Math.max(...zones.map((z) => Math.abs(z.pressure))) : 0;
    if (zones.length) {
      return <WindArrowsDiagram zones={zones} labels={labels} qp={qp} />;
    }
  }

  if (data.type === 'trapezoidal' || data.type === 'uniform') {
    const pressures = pts.map((p) => p.pressure ?? 0);
    const qMin = Math.min(...pressures, 0);
    const qMax = Math.max(...pressures, 1);
    const bw = 130;
    const footY = 55;
    const blockH = 28;
    const scale = 50 / Math.max(qMax, 1);

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-md bg-infra-darker/60 rounded border border-infra-accent/30">
        <text x={w / 2} y={14} textAnchor="middle" fill="#94a3b8" fontSize={10}>
          Bearing pressure — {data.type}
        </text>
        <rect x={(w - bw) / 2} y={footY} width={bw} height={blockH} fill="#64748b" stroke="#cbd5e1" strokeWidth={1} />
        <polygon
          fill="#0ea5e9"
          fillOpacity={0.45}
          stroke="#38bdf8"
          strokeWidth={1}
          points={[
            `${(w - bw) / 2},${footY + blockH}`,
            `${(w + bw) / 2},${footY + blockH}`,
            `${(w + bw) / 2 + qMax * scale},${footY + blockH + 18}`,
            `${(w - bw) / 2 - qMin * scale * 0.3},${footY + blockH + 18}`,
          ].join(' ')}
        />
        {labels.map((lb, i) => (
          <text key={i} x={8} y={110 + i * 13} fill="#e2e8f0" fontSize={9}>
            {lb}
          </text>
        ))}
        {foundation && (
          <text x={8} y={h - 8} fill="#64748b" fontSize={9}>
            Footing B={foundation.B} m · L={foundation.L} m
          </text>
        )}
      </svg>
    );
  }

  if (data.type === 'triangular' && waterLevel > 0) {
    const pierX = w / 2;
    const baseY = h - 28;
    const topY = 36;
    const maxP = Math.max(...pts.map((p) => p.pressure ?? 0), 1);
    const wlY = topY + (baseY - topY) * 0.15;

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-md bg-infra-darker/60 rounded border border-infra-accent/30">
        <text x={w / 2} y={12} textAnchor="middle" fill="#94a3b8" fontSize={10}>
          Pier hydrostatic
        </text>
        <line x1={0} y1={wlY} x2={w} y2={wlY} stroke="#38bdf8" strokeDasharray="4 3" strokeWidth={1} />
        <text x={6} y={wlY - 4} fill="#38bdf8" fontSize={8}>
          Water level
        </text>
        <rect x={pierX - pierW * 8} y={wlY} width={pierW * 16} height={baseY - wlY} fill="#475569" stroke="#94a3b8" />
        {pts.map((p, i) => {
          const depth = p.depth_m ?? p.y ?? 0;
          const y = baseY - (depth / Math.max(waterLevel, 0.01)) * (baseY - wlY);
          const len = ((p.pressure ?? 0) / maxP) * 70;
          return (
            <line
              key={i}
              x1={pierX + pierW * 8 + 4}
              y1={y}
              x2={pierX + pierW * 8 + 4 + len}
              y2={y}
              stroke="#f97316"
              strokeWidth={2}
            />
          );
        })}
        {labels.map((lb, i) => (
          <text key={i} x={8} y={160 + i * 12} fill="#e2e8f0" fontSize={9}>
            {lb}
          </text>
        ))}
      </svg>
    );
  }

  if (data.type === 'triangular') {
    const wallX = 48;
    const baseY = h - 30;
    const maxP = Math.max(...pts.map((p) => p.pressure ?? 0), 1);

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-md bg-infra-darker/60 rounded border border-infra-accent/30">
        <text x={w / 2} y={12} textAnchor="middle" fill="#94a3b8" fontSize={10}>
          Lateral earth pressure
        </text>
        <line x1={wallX} y1={24} x2={wallX} y2={baseY} stroke="#94a3b8" strokeWidth={2} />
        {pts.map((p, i) => {
          const depth = p.depth_m ?? p.y ?? 0;
          const y = baseY - (depth / Math.max(wallH, 0.01)) * (baseY - 40);
          const len = ((p.pressure ?? 0) / maxP) * 85;
          return (
            <g key={i}>
              <line x1={wallX} y1={y} x2={wallX + len} y2={y} stroke="#38bdf8" strokeWidth={2} />
            </g>
          );
        })}
        {labels.map((lb, i) => (
          <text key={i} x={8} y={150 + i * 12} fill="#86efac" fontSize={9}>
            {lb}
          </text>
        ))}
      </svg>
    );
  }

  return (
    <div className="p-3 text-xs text-gray-400 bg-infra-darker/60 rounded border border-infra-accent/30">
      <div className="font-semibold text-gray-300 mb-1">Pressure diagram ({data.type})</div>
      {labels.map((lb, i) => (
        <div key={i}>{lb}</div>
      ))}
    </div>
  );
}
