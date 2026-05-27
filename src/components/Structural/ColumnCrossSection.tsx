import { useCalculationStore } from '../../store/calculationStore';

const W = 200, H = 200;
const MARGIN = 18;

function parseBarProvision(bp: string): { n: number; dia: number } {
  const m = bp.match(/^(\d+)\s*H(\d+)/);
  return m ? { n: parseInt(m[1]), dia: parseInt(m[2]) } : { n: 4, dia: 16 };
}

function barRingPositions(n: number, x0: number, y0: number, x1: number, y1: number): [number, number][] {
  if (n <= 4) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

  const bLen = x1 - x0;
  const hLen = y1 - y0;
  const perim = 2 * (bLen + hLen);
  const step = perim / n;
  const positions: [number, number][] = [];

  for (let i = 0; i < n; i++) {
    const dist = i * step;
    let x: number, y: number;
    if (dist < bLen) {
      x = x0 + dist; y = y0;
    } else if (dist < bLen + hLen) {
      x = x1; y = y0 + (dist - bLen);
    } else if (dist < 2 * bLen + hLen) {
      x = x1 - (dist - bLen - hLen); y = y1;
    } else {
      x = x0; y = y1 - (dist - 2 * bLen - hLen);
    }
    positions.push([x, y]);
  }
  return positions;
}

export function ColumnCrossSection({ b_mm, h_mm }: { b_mm: number; h_mm: number }) {
  const activeModule = useCalculationStore((s) => s.activeModule);
  const currentResults = useCalculationStore((s) => s.currentResults);

  if (activeModule !== 'column' || !currentResults?.summary) return null;

  const s = currentResults.summary as Record<string, unknown>;
  const cover = 40; // mm nominal cover

  const { n, dia } = parseBarProvision(String(s.bar_provision ?? '4 H16'));
  const provided = Number(s.steel_provided_mm2 ?? 0);
  const rho = provided > 0 ? (provided / (b_mm * h_mm)) * 100 : 0;
  const passes = String(s.structural_design ?? '').includes('PASS');
  const linkSpacing = Number(s.link_spacing_mm ?? 200);
  const linkSize = String(s.link_size ?? 'H8');

  const maxW = W - 2 * MARGIN;
  const maxH = H - 2 * MARGIN;
  const scale = Math.min(maxW / b_mm, maxH / h_mm);
  const bPx = b_mm * scale;
  const hPx = h_mm * scale;
  const coverPx = cover * scale;
  const barR = Math.max(3.5, (dia / 2) * scale * 0.85);

  const cx = W / 2, cy = H / 2;
  const x0 = cx - bPx / 2, y0 = cy - hPx / 2;
  const x1 = cx + bPx / 2, y1 = cy + hPx / 2;

  const ix0 = x0 + coverPx, iy0 = y0 + coverPx;
  const ix1 = x1 - coverPx, iy1 = y1 - coverPx;

  const bars = barRingPositions(n, ix0, iy0, ix1, iy1);

  return (
    <div className="mt-3 pt-3 border-t border-gray-700/50 space-y-2">
      <div className="text-xs text-gray-400 font-medium tracking-wide">Cross-Section</div>
      <div className="flex items-center gap-3">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0 rounded bg-gray-900/50">
          {/* Concrete */}
          <rect x={x0} y={y0} width={bPx} height={hPx} fill="#374151" stroke="#6b7280" strokeWidth={1.5} />
          {/* Cover dashed */}
          <rect x={ix0} y={iy0} width={ix1 - ix0} height={iy1 - iy0}
            fill="none" stroke="#6b7280" strokeWidth={0.7} strokeDasharray="3,2" />
          {/* Stirrup */}
          <rect x={ix0} y={iy0} width={ix1 - ix0} height={iy1 - iy0}
            fill="none" stroke="#fbbf24" strokeWidth={1.5} />
          {/* Rebar */}
          {bars.map(([bx, by], i) => (
            <g key={i}>
              <circle cx={bx} cy={by} r={barR} fill="#111827" stroke="#f97316" strokeWidth={1.2} />
              <circle cx={bx} cy={by} r={barR * 0.45} fill="#f97316" opacity={0.8} />
            </g>
          ))}
          {/* Dimension: width */}
          <line x1={x0} y1={y0 - 6} x2={x1} y2={y0 - 6} stroke="#6b7280" strokeWidth={0.8} />
          <line x1={x0} y1={y0 - 9} x2={x0} y2={y0 - 3} stroke="#6b7280" strokeWidth={0.8} />
          <line x1={x1} y1={y0 - 9} x2={x1} y2={y0 - 3} stroke="#6b7280" strokeWidth={0.8} />
          <text x={cx} y={y0 - 8} fontSize={8} fill="#9ca3af" textAnchor="middle">b = {b_mm}</text>
          {/* Dimension: depth */}
          <line x1={x0 - 6} y1={y0} x2={x0 - 6} y2={y1} stroke="#6b7280" strokeWidth={0.8} />
          <line x1={x0 - 9} y1={y0} x2={x0 - 3} y2={y0} stroke="#6b7280" strokeWidth={0.8} />
          <line x1={x0 - 9} y1={y1} x2={x0 - 3} y2={y1} stroke="#6b7280" strokeWidth={0.8} />
          <text x={x0 - 8} y={cy} fontSize={8} fill="#9ca3af" textAnchor="middle"
            transform={`rotate(-90,${x0 - 8},${cy})`}>h = {h_mm}</text>
        </svg>

        <div className="flex-1 space-y-1.5">
          <CSRow label="Bars" value={String(s.bar_provision ?? '-')} />
          <CSRow label="ρ" value={`${rho.toFixed(2)}%`} />
          <CSRow label="Links" value={`${linkSize} @ ${linkSpacing} mm`} />
          <CSRow label="Cover" value="40 mm" />
          <CSRow label="λ" value={`${s.slenderness_lambda ?? '-'}`} />
          <CSRow label="Type" value={String(s.column_type ?? '-')} />
          <div className={`text-center text-xs font-bold py-1 rounded mt-1 ${
            passes ? 'bg-green-900/30 text-green-400 border border-green-700/40'
                   : 'bg-red-900/30 text-red-400 border border-red-700/40'
          }`}>
            {passes ? 'PASS ✓' : 'FAIL ✗'}
          </div>
        </div>
      </div>
    </div>
  );
}

function CSRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200 font-mono text-right">{value}</span>
    </div>
  );
}
