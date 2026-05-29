import { useState } from 'react';
import { NumField, SelectField } from '../FormElements';
import { API_BASE } from '../../../services/apiConfig';

interface FireResult {
  fire_check: { status: string; message: string; req_cover: number; req_dimension: number };
  anchorage_tension_mm: number;
  anchorage_compression_mm: number;
  lap_tension_mm: number;
  lap_compression_mm: number;
}

const SECTION_TYPES = [
  { value: 'beam',   label: 'Beam' },
  { value: 'slab',   label: 'Slab' },
  { value: 'column', label: 'Column' },
];
const FIRE_PERIODS = [
  { value: '0.5', label: '0.5 h' },
  { value: '1.0', label: '1.0 h' },
  { value: '1.5', label: '1.5 h' },
  { value: '2.0', label: '2.0 h' },
  { value: '3.0', label: '3.0 h' },
  { value: '4.0', label: '4.0 h' },
];
const SUPPORT_CONDITIONS = [
  { value: 'simply_supported', label: 'Simply Supported' },
  { value: 'continuous',       label: 'Continuous' },
];
const ZONES = [
  { value: 'tension',     label: 'Tension Zone' },
  { value: 'compression', label: 'Compression Zone' },
];

function Badge({ status }: { status: string }) {
  const cls = status === 'pass'
    ? 'bg-green-900/30 border-green-700/50 text-green-300'
    : 'bg-red-900/30 border-red-700/50 text-red-300';
  return <span className={`px-2 py-0.5 rounded border text-xs font-bold uppercase ${cls}`}>{status}</span>;
}

export function FireAnchorageCalculator() {
  const [checkType, setCheckType] = useState('beam');
  const [firePeriod, setFirePeriod] = useState('1.0');
  const [support, setSupport] = useState('simply_supported');
  const [cover, setCover] = useState(30);
  const [bMm, setBMm] = useState(250);
  const [hMm, setHMm] = useState(450);
  const [barDia, setBarDia] = useState(16);
  const [fyMpa, setFyMpa] = useState(460);
  const [fcuMpa, setFcuMpa] = useState(25);
  const [zone, setZone] = useState('tension');
  const [result, setResult] = useState<FireResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function compute() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/structural/fire-anchorage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          check_type: checkType,
          cover_mm: cover,
          b_mm: bMm,
          h_mm: hMm,
          fire_period_hours: Number(firePeriod),
          support_condition: support,
          bar_dia_mm: barDia,
          fy_mpa: fyMpa,
          fcu_mpa: fcuMpa,
          zone,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const fc = result?.fire_check;

  return (
    <div className="flex flex-col space-y-4 bg-infra-bg/50 p-4 border border-infra-accent/30 rounded-lg">
      <div className="flex justify-between items-center">
        <h3 className="text-infra-highlight font-bold uppercase text-sm tracking-wider">Fire Resistance & Anchorage</h3>
        <span className="text-xs px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/40">BS 8110</span>
      </div>

      {/* Section type */}
      <div className="flex gap-1">
        {SECTION_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setCheckType(t.value)}
            className={`flex-1 py-1 text-xs font-semibold rounded border transition-colors ${
              checkType === t.value
                ? 'border-infra-highlight bg-infra-highlight/20 text-infra-highlight'
                : 'border-infra-accent/30 text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Fire period */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Fire Period</label>
        <div className="flex gap-1 flex-wrap">
          {FIRE_PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setFirePeriod(p.value)}
              className={`px-2 py-1 text-xs rounded border transition-colors ${
                firePeriod === p.value
                  ? 'border-orange-500 bg-orange-900/30 text-orange-300'
                  : 'border-infra-accent/30 text-gray-500 hover:text-gray-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dimensions */}
      <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
        <h4 className="text-xs font-bold text-white mb-2">Section Dimensions</h4>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Cover (mm)" value={cover} onChange={setCover} />
          <NumField label={checkType === 'slab' ? 'Thickness h (mm)' : 'Width b (mm)'} value={bMm} onChange={setBMm} />
          {checkType !== 'slab' && (
            <NumField label="Depth/Height h (mm)" value={hMm} onChange={setHMm} />
          )}
        </div>
        {checkType !== 'column' && (
          <div className="mt-3">
            <SelectField label="Support Condition" value={support} options={SUPPORT_CONDITIONS} onChange={setSupport} />
          </div>
        )}
      </div>

      {/* Anchorage inputs */}
      <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
        <h4 className="text-xs font-bold text-white mb-2">Anchorage & Lap Lengths</h4>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Bar dia φ (mm)" value={barDia} onChange={setBarDia} />
          <NumField label="fy (MPa)" value={fyMpa} onChange={setFyMpa} />
          <NumField label="fcu (MPa)" value={fcuMpa} onChange={setFcuMpa} />
          <SelectField label="Steel Zone" value={zone} options={ZONES} onChange={setZone} />
        </div>
      </div>

      <button
        type="button"
        onClick={compute}
        disabled={loading}
        className="w-full py-2 bg-infra-highlight text-white text-xs font-bold rounded uppercase tracking-wider hover:bg-infra-highlight/80 disabled:opacity-50"
      >
        {loading ? 'CHECKING...' : 'CHECK FIRE RESISTANCE & ANCHORAGE'}
      </button>

      {error && <div className="p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">{error}</div>}

      {result && fc && (
        <div className="space-y-3">
          {/* Fire check result */}
          <div className={`p-3 rounded border ${fc.status === 'pass' ? 'bg-green-900/20 border-green-700/40' : 'bg-red-900/20 border-red-700/40'}`}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-white">Fire Resistance Check</span>
              <Badge status={fc.status} />
            </div>
            <p className="text-xs text-gray-300">{fc.message}</p>
            <div className="flex gap-4 mt-2 text-xs text-gray-400">
              <span>Req. cover: <span className="text-white">{fc.req_cover} mm</span></span>
              <span>Req. {checkType === 'beam' ? 'width' : checkType === 'slab' ? 'thickness' : 'min dim'}: <span className="text-white">{fc.req_dimension} mm</span></span>
            </div>
          </div>

          {/* Anchorage lengths */}
          <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20 space-y-1.5">
            <h4 className="text-xs font-bold text-white mb-2">Anchorage & Lap Lengths (BS 8110 §3.12.8)</h4>
            {[
              { label: 'Anchorage — Tension', val: result.anchorage_tension_mm },
              { label: 'Anchorage — Compression', val: result.anchorage_compression_mm },
              { label: 'Lap — Tension (×1.4)', val: result.lap_tension_mm },
              { label: 'Lap — Compression', val: result.lap_compression_mm },
            ].map(({ label, val }) => (
              <div key={label} className="flex justify-between border-b border-infra-accent/20 pb-1">
                <span className="text-gray-400 text-xs">{label}</span>
                <span className="font-mono text-xs text-infra-highlight font-bold">{Math.ceil(val)} mm</span>
              </div>
            ))}
            <p className="text-[10px] text-gray-500 mt-1 italic">Round up to nearest 25 mm in practice. Min 300 mm always applies.</p>
          </div>
        </div>
      )}
    </div>
  );
}
