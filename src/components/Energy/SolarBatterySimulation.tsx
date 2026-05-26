import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../../services/apiConfig';

interface HourPoint {
  hour: number;
  solar_kw: number;
  load_kw: number;
  battery_soc_pct: number;
  grid_import_kw: number;
  grid_export_kw: number;
}

interface SimSummary {
  total_solar_kwh: number;
  total_load_kwh: number;
  grid_import_kwh: number;
  grid_export_kwh: number;
  solar_fraction_pct: number;
  final_soc_pct: number;
}

interface Props {
  installed_kwp: number;
  battery_kwh: number;
  daily_load_kwh: number;
  ghi_kwh_m2_day?: number;
  dod_pct?: number;
}

const W = 520;
const H = 200;
const PAD = { top: 14, right: 16, bottom: 32, left: 44 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

function scaleX(hour: number) {
  return PAD.left + (hour / 23) * CW;
}
function scaleY(val: number, max: number) {
  return PAD.top + CH - (val / max) * CH;
}

function polyline(pts: [number, number][]) {
  return pts.map(([x, y]) => `${x},${y}`).join(' ');
}

export function SolarBatterySimulation({ installed_kwp, battery_kwh, daily_load_kwh, ghi_kwh_m2_day = 5.8, dod_pct = 80 }: Props) {
  const [data, setData] = useState<HourPoint[]>([]);
  const [summary, setSummary] = useState<SimSummary | null>(null);
  const [playHead, setPlayHead] = useState(23);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/energy/simulation/solar-battery-day`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installed_kwp, battery_kwh, daily_load_kwh, ghi_kwh_m2_day, dod_pct }),
    })
      .then((r) => r.json())
      .then((res) => {
        setData(res.hourly ?? []);
        setSummary(res.summary ?? null);
        setPlayHead(23);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [installed_kwp, battery_kwh, daily_load_kwh, ghi_kwh_m2_day, dod_pct]);

  useEffect(() => {
    if (playing) {
      setPlayHead(0);
      timerRef.current = setInterval(() => {
        setPlayHead((h) => {
          if (h >= 23) { setPlaying(false); return 23; }
          return h + 1;
        });
      }, 180);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing]);

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">Running simulation…</div>;
  if (!data.length) return null;

  const visible = data.slice(0, playHead + 1);
  const maxKw = Math.max(...data.map((d) => Math.max(d.solar_kw, d.load_kw, d.grid_import_kw)), 1);

  const solarPts = visible.map((d): [number, number] => [scaleX(d.hour), scaleY(d.solar_kw, maxKw)]);
  const loadPts  = visible.map((d): [number, number] => [scaleX(d.hour), scaleY(d.load_kw, maxKw)]);
  const socPts   = visible.map((d): [number, number] => [scaleX(d.hour), scaleY(d.battery_soc_pct, 100)]);
  const importPts = visible.map((d): [number, number] => [scaleX(d.hour), scaleY(d.grid_import_kw, maxKw)]);

  // Fill area under solar line
  const solarArea = solarPts.length > 0
    ? `M ${scaleX(0)},${scaleY(0, maxKw)} ${polyline(solarPts)} L ${scaleX(visible[visible.length - 1].hour)},${scaleY(0, maxKw)} Z`
    : '';

  // Y-axis ticks
  const yTicks = [0, 25, 50, 75, 100];

  const hour = data[playHead];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-300">24-Hour Solar + Battery Simulation</span>
        <div className="flex gap-2">
          <button
            onClick={() => { setPlaying(!playing); if (!playing) setPlayHead(0); }}
            className="px-3 py-1 text-[10px] rounded bg-yellow-600/30 text-yellow-300 hover:bg-yellow-600/50 border border-yellow-600/40"
          >
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
          <button
            onClick={() => { setPlaying(false); setPlayHead(23); }}
            className="px-2 py-1 text-[10px] rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
          >
            ↺
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          {/* Grid lines */}
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} y1={scaleY(t, 100)} x2={W - PAD.right} y2={scaleY(t, 100)}
                stroke="#374151" strokeWidth="0.5" strokeDasharray="3,3" />
              <text x={PAD.left - 4} y={scaleY(t, 100) + 3} textAnchor="end"
                className="fill-gray-500" fontSize="8">{t}</text>
            </g>
          ))}

          {/* Hour labels */}
          {[0, 6, 12, 18, 23].map((h) => (
            <text key={h} x={scaleX(h)} y={H - PAD.bottom + 14} textAnchor="middle"
              className="fill-gray-500" fontSize="8">{h}h</text>
          ))}

          {/* Sunrise/sunset bands */}
          <rect x={scaleX(6)} y={PAD.top} width={scaleX(18) - scaleX(6)} height={CH}
            fill="#fbbf24" fillOpacity="0.04" />

          {/* Solar area fill */}
          {solarArea && <path d={solarArea} fill="#fbbf24" fillOpacity="0.15" />}

          {/* SOC area (background) */}
          {socPts.length > 1 && (
            <polyline points={polyline(socPts)} fill="none" stroke="#10b981" strokeWidth="1.5"
              strokeDasharray="4,2" opacity="0.7" />
          )}

          {/* Grid import */}
          {importPts.length > 1 && (
            <polyline points={polyline(importPts)} fill="none" stroke="#ef4444" strokeWidth="1"
              opacity="0.6" strokeDasharray="2,3" />
          )}

          {/* Solar line */}
          {solarPts.length > 1 && (
            <polyline points={polyline(solarPts)} fill="none" stroke="#fbbf24" strokeWidth="2" />
          )}

          {/* Load line */}
          {loadPts.length > 1 && (
            <polyline points={polyline(loadPts)} fill="none" stroke="#f87171" strokeWidth="2" />
          )}

          {/* Playhead */}
          <line x1={scaleX(playHead)} y1={PAD.top} x2={scaleX(playHead)} y2={H - PAD.bottom}
            stroke="#6366f1" strokeWidth="1" strokeDasharray="2,2" />

          {/* Axis */}
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom}
            stroke="#6b7280" strokeWidth="1" />
          <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom}
            stroke="#6b7280" strokeWidth="1" />
        </svg>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-[10px] flex-wrap">
        {[
          { color: '#fbbf24', label: 'Solar (kW)' },
          { color: '#f87171', label: 'Load (kW)' },
          { color: '#10b981', label: 'Battery SOC (%)' },
          { color: '#ef4444', label: 'Grid import (kW)', dashed: true },
        ].map(({ color, label, dashed }) => (
          <span key={label} className="flex items-center gap-1 text-gray-400">
            <svg width="20" height="6">
              <line x1="0" y1="3" x2="20" y2="3" stroke={color} strokeWidth="2"
                strokeDasharray={dashed ? '3,2' : undefined} />
            </svg>
            {label}
          </span>
        ))}
      </div>

      {/* Live readout */}
      {hour && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: `Hour ${hour.hour}:00`, val: `${hour.solar_kw} kW`, color: 'text-yellow-400' },
            { label: 'Load', val: `${hour.load_kw} kW`, color: 'text-red-400' },
            { label: 'Battery SOC', val: `${hour.battery_soc_pct}%`, color: 'text-green-400' },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-gray-800 rounded p-2 text-center">
              <div className="text-[9px] text-gray-500">{label}</div>
              <div className={`text-xs font-bold ${color}`}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          {[
            { label: 'Solar yield', val: `${summary.total_solar_kwh} kWh` },
            { label: 'Solar fraction', val: `${summary.solar_fraction_pct}%`, highlight: true },
            { label: 'Grid import', val: `${summary.grid_import_kwh} kWh` },
            { label: 'Grid export', val: `${summary.grid_export_kwh} kWh` },
          ].map(({ label, val, highlight }) => (
            <div key={label} className="flex justify-between bg-gray-800/60 rounded px-2 py-1">
              <span className="text-gray-500">{label}</span>
              <span className={highlight ? 'text-green-400 font-semibold' : 'text-gray-200'}>{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Scrubber */}
      <input type="range" min={0} max={23} value={playHead}
        onChange={(e) => { setPlaying(false); setPlayHead(Number(e.target.value)); }}
        className="w-full accent-yellow-500" />
      <div className="text-center text-[9px] text-gray-600">Drag to scrub · Hour {playHead}:00</div>
    </div>
  );
}
