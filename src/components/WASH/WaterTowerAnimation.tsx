import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../../services/apiConfig';

interface HourData {
  hour: number;
  demand_m3: number;
  inflow_m3: number;
  tank_level_m3: number;
  tank_pct: number;
  overflow_m3: number;
  shortfall_m3: number;
  pump_on: boolean;
}

interface Summary {
  daily_demand_m3: number;
  total_inflow_m3: number;
  overflow_m3: number;
  shortfall_m3: number;
  tank_capacity_m3: number;
  pump_flow_m3h: number;
  adequacy: string;
}

interface Props {
  daily_demand_m3?: number;
  tank_capacity_m3?: number;
  pump_flow_m3h?: number;
  pump_start_hour?: number;
  pump_hours?: number;
}

const SVG_W = 520, SVG_H = 290;
const CHART_X = 190, CHART_W = SVG_W - CHART_X - 18;
const CHART_TOP = 24, CHART_BOT = 36;
const CHART_H = SVG_H - CHART_TOP - CHART_BOT;

// Tower geometry constants
const TC_X = 90, TC_Y = 30;   // tank top-centre x, tank top y
const TANK_W = 70, TANK_H = 100;
const LEG_Y_TOP = TC_Y + TANK_H;
const LEG_Y_BOT = TC_Y + TANK_H + 100;
const PUMP_Y = LEG_Y_BOT + 18;

function waterColor(pct: number): string {
  if (pct > 60) return '#3b82f6';
  if (pct > 30) return '#06b6d4';
  if (pct > 10) return '#f59e0b';
  return '#ef4444';
}

export function WaterTowerAnimation({
  daily_demand_m3 = 25,
  tank_capacity_m3 = 12.5,
  pump_flow_m3h = 6,
  pump_start_hour = 6,
  pump_hours = 8,
}: Props) {
  const [hourly, setHourly] = useState<HourData[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hour, setHour] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setPlaying(false);
    setHour(0);

    fetch(`${API_BASE}/wash/simulation/water-tower-day`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ daily_demand_m3, tank_capacity_m3, pump_flow_m3h, pump_start_hour, pump_hours }),
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 'ok') {
          setHourly(d.hourly as HourData[]);
          setSummary(d.summary as Summary);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [daily_demand_m3, tank_capacity_m3, pump_flow_m3h, pump_start_hour, pump_hours]);

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => setHour((h) => (h + 1) % 24), 500);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing]);

  if (!hourly.length || !summary)
    return (
      <div className="h-[290px] flex items-center justify-center text-gray-500 text-xs">
        {loading ? 'Simulating 24-hour water tower cycle…' : 'No data'}
      </div>
    );

  const cur = hourly[hour];
  const fillH = (cur.tank_pct / 100) * TANK_H;
  const fillY = TC_Y + TANK_H - fillH;
  const wc = waterColor(cur.tank_pct);

  // Chart helpers
  const cx = (h: number) => CHART_X + (h / 23) * CHART_W;
  const cy = (pct: number) => CHART_TOP + ((100 - pct) / 100) * CHART_H;

  const levelPath = hourly
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${cx(p.hour).toFixed(1)},${cy(p.tank_pct).toFixed(1)}`)
    .join(' ');
  const areaPath =
    `M${cx(0)},${cy(0)} ` +
    hourly.map((p) => `L${cx(p.hour).toFixed(1)},${cy(p.tank_pct).toFixed(1)}`).join(' ') +
    ` L${cx(23)},${cy(0)} Z`;

  const safe = summary.adequacy === 'OK';

  return (
    <div className="space-y-2">
      <svg
        width={SVG_W}
        height={SVG_H}
        className="w-full max-w-full"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ background: '#111827', borderRadius: 6 }}
      >
        {/* ── Left: Tower diagram ── */}
        {/* Soil / ground line */}
        <line x1={20} x2={170} y1={LEG_Y_BOT} y2={LEG_Y_BOT} stroke="#4b5563" strokeWidth={1.5} />

        {/* Support legs */}
        <line x1={TC_X - 28} x2={TC_X - 15} y1={LEG_Y_TOP} y2={LEG_Y_BOT} stroke="#6b7280" strokeWidth={3} />
        <line x1={TC_X + 28} x2={TC_X + 15} y1={LEG_Y_TOP} y2={LEG_Y_BOT} stroke="#6b7280" strokeWidth={3} />
        {/* Cross brace */}
        <line x1={TC_X - 28} x2={TC_X + 28} y1={LEG_Y_TOP + 40} y2={LEG_Y_TOP + 40} stroke="#6b7280" strokeWidth={1.5} />
        {/* Vertical connecting rod from tank to legs */}
        <line x1={TC_X} x2={TC_X} y1={TC_Y + TANK_H} y2={LEG_Y_TOP} stroke="#6b7280" strokeWidth={2} />

        {/* Tank outline */}
        <rect x={TC_X - TANK_W / 2} y={TC_Y} width={TANK_W} height={TANK_H} fill="#1f2937" stroke="#374151" strokeWidth={1.5} rx={2} />

        {/* Water fill (clipped) */}
        <clipPath id="tank-clip">
          <rect x={TC_X - TANK_W / 2 + 1} y={TC_Y + 1} width={TANK_W - 2} height={TANK_H - 2} />
        </clipPath>
        <rect
          x={TC_X - TANK_W / 2 + 1}
          y={fillY}
          width={TANK_W - 2}
          height={fillH}
          fill={wc}
          opacity={0.8}
          clipPath="url(#tank-clip)"
        />
        {/* Water surface ripple */}
        {fillH > 4 && (
          <line x1={TC_X - TANK_W / 2 + 4} x2={TC_X + TANK_W / 2 - 4} y1={fillY} y2={fillY} stroke="#fff" strokeWidth={0.8} opacity={0.4} />
        )}

        {/* Tank cap */}
        <rect x={TC_X - TANK_W / 2 - 3} y={TC_Y - 4} width={TANK_W + 6} height={6} fill="#374151" rx={2} />

        {/* Pump box at base */}
        <rect x={TC_X - 20} y={PUMP_Y} width={40} height={20} rx={3}
          fill={cur.pump_on ? '#052e16' : '#1f2937'}
          stroke={cur.pump_on ? '#16a34a' : '#374151'}
          strokeWidth={1.5} />
        <text x={TC_X} y={PUMP_Y + 13} fill={cur.pump_on ? '#4ade80' : '#6b7280'} fontSize={7} textAnchor="middle">
          {cur.pump_on ? '⚡ PUMP ON' : 'PUMP OFF'}
        </text>

        {/* Pump flow pipe (if pump on) */}
        {cur.pump_on && (
          <line x1={TC_X} x2={TC_X} y1={PUMP_Y} y2={TC_Y + TANK_H + 2} stroke="#16a34a" strokeWidth={2} strokeDasharray="4,3" />
        )}

        {/* Tank % label */}
        <text x={TC_X} y={TC_Y - 8} fill={wc} fontSize={11} fontWeight="bold" textAnchor="middle">
          {cur.tank_pct.toFixed(0)}%
        </text>

        {/* Hour label */}
        <text x={TC_X} y={SVG_H - 8} fill="#9ca3af" fontSize={10} textAnchor="middle">
          {String(cur.hour).padStart(2, '0')}:00
        </text>

        {/* ── Right: 24h level chart ── */}
        {/* Grid */}
        {[0, 25, 50, 75, 100].map((pct) => (
          <g key={pct}>
            <line x1={CHART_X} x2={CHART_X + CHART_W} y1={cy(pct)} y2={cy(pct)} stroke="#1f2937" strokeWidth={pct === 0 || pct === 100 ? 1 : 0.5} />
            <text x={CHART_X - 4} y={cy(pct) + 3} fill="#6b7280" fontSize={7} textAnchor="end">{pct}%</text>
          </g>
        ))}

        {/* Pump-on shading */}
        {hourly.map((p) =>
          p.pump_on ? (
            <rect key={p.hour} x={cx(p.hour) - CHART_W / 46} y={CHART_TOP} width={CHART_W / 23} height={CHART_H} fill="#052e16" opacity={0.5} />
          ) : null
        )}

        {/* Area fill */}
        <path d={areaPath} fill="#3b82f6" opacity={0.1} />

        {/* Level line */}
        <path d={levelPath} fill="none" stroke="#3b82f6" strokeWidth={1.8} />

        {/* Critical 10% line */}
        <line x1={CHART_X} x2={CHART_X + CHART_W} y1={cy(10)} y2={cy(10)} stroke="#ef4444" strokeWidth={0.8} strokeDasharray="3,2" />
        <text x={CHART_X + CHART_W + 2} y={cy(10) + 3} fill="#ef4444" fontSize={6}>10%</text>

        {/* Current hour marker */}
        <line x1={cx(hour)} x2={cx(hour)} y1={CHART_TOP} y2={CHART_TOP + CHART_H} stroke="#fbbf24" strokeWidth={1} strokeDasharray="3,2" />
        <circle cx={cx(hour)} cy={cy(cur.tank_pct)} r={3} fill={wc} stroke="#fff" strokeWidth={1} />

        {/* X-axis labels */}
        {[0, 6, 12, 18, 23].map((h) => (
          <text key={h} x={cx(h)} y={SVG_H - CHART_BOT + 14} fill="#6b7280" fontSize={7} textAnchor="middle">{h}h</text>
        ))}

        {/* Chart title */}
        <text x={CHART_X + CHART_W / 2} y={CHART_TOP - 8} fill="#9ca3af" fontSize={8} textAnchor="middle">Tank Level (%) — 24 hr</text>
      </svg>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="px-3 py-1 text-[10px] rounded bg-blue-700/40 text-blue-200 border border-blue-500/40 hover:bg-blue-700/60"
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <input
          type="range" min={0} max={23} value={hour}
          onChange={(e) => { setPlaying(false); setHour(Number(e.target.value)); }}
          className="flex-1 h-1 accent-blue-500"
        />
        <span className="text-[10px] text-gray-400 w-10 text-right">{String(hour).padStart(2, '0')}:00</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-1 text-[10px]">
        {[
          { label: 'Daily Demand', val: `${summary.daily_demand_m3.toFixed(1)} m³`, color: 'text-blue-400' },
          { label: 'Overflow', val: `${summary.overflow_m3.toFixed(1)} m³`, color: 'text-cyan-400' },
          { label: 'Shortfall', val: `${summary.shortfall_m3.toFixed(1)} m³`, color: summary.shortfall_m3 > 0 ? 'text-red-400' : 'text-green-400' },
          { label: 'Status', val: summary.adequacy, color: safe ? 'text-green-400' : 'text-red-400' },
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
