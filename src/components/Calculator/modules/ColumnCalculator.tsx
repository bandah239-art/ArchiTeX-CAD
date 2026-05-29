import { useState } from 'react';
import type { CalculatorFormProps } from '../CalculatorTypes';
import { NumField, SelectField } from '../FormElements';
import { API_BASE } from '../../../services/apiConfig';

interface ColResult {
  status: string;
  summary: Record<string, number | string>;
  steps: { step_number: number; title: string; formula: string; substitution: string; result: string; unit: string; reference: string; status: string }[];
  warnings: string[];
  errors: string[];
}

const CONCRETE_GRADES = [
  { value: '25', label: 'C25 — fcu 25 MPa' },
  { value: '30', label: 'C30 — fcu 30 MPa' },
  { value: '35', label: 'C35 — fcu 35 MPa' },
  { value: '40', label: 'C40 — fcu 40 MPa' },
];

const STEEL_GRADES = [
  { value: '460', label: 'Y-bars — fy 460 MPa (High Yield)' },
  { value: '250', label: 'R-bars — fy 250 MPa (Mild Steel)' },
];

const BAR_DIAS = [
  { value: '12', label: 'Y12' },
  { value: '16', label: 'Y16' },
  { value: '20', label: 'Y20' },
  { value: '25', label: 'Y25' },
  { value: '32', label: 'Y32' },
];

const LINK_DIAS = [
  { value: '6', label: 'R6' },
  { value: '8', label: 'R8' },
  { value: '10', label: 'R10' },
];

const LE_FACTORS = [
  { value: '0.7', label: '0.7 — Both ends fixed' },
  { value: '0.85', label: '0.85 — Fixed/pinned' },
  { value: '1.0', label: '1.0 — Both ends pinned' },
  { value: '1.2', label: '1.2 — Unbraced / partially fixed' },
  { value: '2.0', label: '2.0 — Cantilever (one end free)' },
];

const FIRE_PERIODS = [
  { value: '0.5', label: '0.5 h' },
  { value: '1.0', label: '1 h (standard)' },
  { value: '1.5', label: '1.5 h' },
  { value: '2.0', label: '2 h' },
  { value: '3.0', label: '3 h' },
  { value: '4.0', label: '4 h' },
];

function Row({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex justify-between border-b border-infra-accent/20 py-0.5">
      <span className="text-gray-400 text-xs">{label}</span>
      <span className={`font-mono text-xs ${highlight ? 'text-infra-highlight font-bold' : 'text-white'}`}>{value}</span>
    </div>
  );
}

export function ColumnCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  const [result, setResult] = useState<ColResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function compute() {
    setLoading(true);
    setError(null);
    try {
      const body = {
        design_code: 'BS8110',
        height: Number(inputs.height ?? 4),
        width: Number(inputs.width ?? 300),
        depth: Number(inputs.depth ?? 300),
        axial_load: Number(inputs.axial_load ?? 850),
        moment_major: Number(inputs.moment_major ?? 45),
        moment_minor: Number(inputs.moment_minor ?? 20),
        le_factor: Number(inputs.le_factor ?? 0.85),
        cover_mm: Number(inputs.cover_mm ?? 30),
        bar_dia_mm: Number(inputs.bar_dia_mm ?? 20),
        n_bars: Math.round(Number(inputs.n_bars ?? 4)),
        link_dia_mm: Number(inputs.link_dia_mm ?? 8),
        link_spacing_mm: Number(inputs.link_spacing_mm ?? 200),
        fcu_mpa: Number(inputs.fcu ?? 25),
        fy_mpa: Number(inputs.fy ?? 460),
        fire_period_hours: Number(inputs.fire_period_hours ?? 1.0),
        country: 'Zambia',
      };
      const res = await fetch(`${API_BASE}/calculate/column`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const s = result?.summary;

  return (
    <div className="flex flex-col space-y-4 bg-infra-bg/50 p-4 border border-infra-accent/30 rounded-lg">
      <div className="flex justify-between items-center">
        <h3 className="text-infra-highlight font-bold uppercase text-sm tracking-wider">RC Column Design</h3>
        <span className="text-xs px-2 py-0.5 rounded bg-infra-highlight/25 text-infra-highlight border border-infra-highlight/40">BS 8110</span>
      </div>

      <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
        <h4 className="text-xs font-bold text-white mb-2">Geometry & Loading</h4>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Height (m)" value={inputs.height ?? 4} onChange={(v) => onInputChange('height', v)} />
          <SelectField label="Eff. Length Factor" value={String(inputs.le_factor ?? 0.85)} options={LE_FACTORS} onChange={(v) => onInputChange('le_factor', Number(v))} />
          <NumField label="Width b (mm)" value={inputs.width ?? 300} onChange={(v) => onInputChange('width', v)} />
          <NumField label="Depth h (mm)" value={inputs.depth ?? 300} onChange={(v) => onInputChange('depth', v)} />
          <NumField label="Axial Load N (kN)" value={inputs.axial_load ?? 850} onChange={(v) => onInputChange('axial_load', v)} />
          <NumField label="Moment Major Mx (kNm)" value={inputs.moment_major ?? 45} onChange={(v) => onInputChange('moment_major', v)} />
          <NumField label="Moment Minor My (kNm)" value={inputs.moment_minor ?? 20} onChange={(v) => onInputChange('moment_minor', v)} />
        </div>
      </div>

      <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
        <h4 className="text-xs font-bold text-white mb-2">Reinforcement Detail</h4>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Cover (mm)" value={inputs.cover_mm ?? 30} onChange={(v) => onInputChange('cover_mm', v)} />
          <SelectField label="Main Bar Diameter" value={String(inputs.bar_dia_mm ?? 20)} options={BAR_DIAS} onChange={(v) => onInputChange('bar_dia_mm', Number(v))} />
          <NumField label="Number of Bars" value={inputs.n_bars ?? 4} onChange={(v) => onInputChange('n_bars', Math.round(v))} />
          <SelectField label="Link Diameter" value={String(inputs.link_dia_mm ?? 8)} options={LINK_DIAS} onChange={(v) => onInputChange('link_dia_mm', Number(v))} />
          <NumField label="Link Spacing (mm)" value={inputs.link_spacing_mm ?? 200} onChange={(v) => onInputChange('link_spacing_mm', v)} />
        </div>
      </div>

      <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
        <h4 className="text-xs font-bold text-white mb-2">Materials & Fire</h4>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Concrete Grade fcu" value={String(inputs.fcu ?? 25)} options={CONCRETE_GRADES} onChange={(v) => onInputChange('fcu', Number(v))} />
          <SelectField label="Steel Grade fy" value={String(inputs.fy ?? 460)} options={STEEL_GRADES} onChange={(v) => onInputChange('fy', Number(v))} />
          <SelectField label="Fire Resistance Period" value={String(inputs.fire_period_hours ?? 1.0)} options={FIRE_PERIODS} onChange={(v) => onInputChange('fire_period_hours', Number(v))} />
        </div>
      </div>

      <button
        type="button"
        onClick={compute}
        disabled={loading}
        className="w-full py-2 bg-infra-highlight text-white text-xs font-bold rounded uppercase tracking-wider hover:bg-infra-highlight/80 disabled:opacity-50"
      >
        {loading ? 'COMPUTING...' : 'CHECK COLUMN — BS 8110'}
      </button>

      {error && <div className="p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">{error}</div>}

      {result && s && (
        <>
          <div className={`p-3 rounded border text-center font-bold text-sm ${result.status === 'pass' ? 'bg-green-900/30 border-green-700/50 text-green-400' : 'bg-red-900/30 border-red-700/50 text-red-400'}`}>
            {result.status === 'pass' ? '✓ PASS' : '✗ FAIL'} — {s.structural_design}
          </div>

          <div className="grid grid-cols-2 gap-1">
            <Row label="Column type" value={String(s.column_type ?? '—')} />
            <Row label="Slenderness λx / λy" value={`${Number(s.slenderness_x ?? 0).toFixed(1)} / ${Number(s.slenderness_y ?? 0).toFixed(1)}`} />
            <Row label="Min eccentricity (mm)" value={Number(s.emin_mm ?? 0).toFixed(1)} />
            <Row label="Asc required (mm²)" value={Number(s.asc_mm2 ?? 0).toFixed(0)} highlight />
            <Row label="Asc min / max (mm²)" value={`${Number(s.asc_min_mm2 ?? 0).toFixed(0)} / ${Number(s.asc_max_mm2 ?? 0).toFixed(0)}`} />
            <Row label="Steel % ρ" value={`${Number(s.rho_pct ?? 0).toFixed(2)} %`} />
            <Row label="Axial capacity NRd (kN)" value={Number(s.axial_capacity_kn ?? 0).toFixed(1)} />
            <Row label="Axial utilisation" value={`${(Number(s.axial_utilisation ?? 0) * 100).toFixed(1)} %`} highlight />
            <Row label="β biaxial (Table 3.22)" value={Number(s.beta_biaxial ?? 0).toFixed(2)} />
            <Row label="Equiv. moment M' (kNm)" value={Number(s.equivalent_moment_knm ?? 0).toFixed(1)} />
            <Row label="Moment utilisation" value={`${(Number(s.moment_utilisation ?? 0) * 100).toFixed(1)} %`} />
            <Row label="Overall utilisation" value={`${(Number(s.overall_utilisation ?? 0) * 100).toFixed(1)} %`} highlight />
            <Row label="Links φ / spacing" value={`R${Number(s.link_dia_mm ?? 0).toFixed(0)} @ ${Number(s.link_spacing_mm ?? 0).toFixed(0)} mm`} />
            <Row label="Max link spacing (mm)" value={Number(s.max_link_spacing_mm ?? 0).toFixed(0)} />
            <Row label="Fire resistance" value={String(s.fire_resistance ?? '—').toUpperCase()} />
            <Row label="Anchorage compression (mm)" value={Number(s.anchorage_compression_mm ?? 0).toFixed(0)} />
            <Row label="Total cost (ZMW)" value={`ZMW ${Number(s.total_cost_zmw ?? 0).toLocaleString()}`} highlight />
          </div>

          {result.warnings.length > 0 && (
            <div className="space-y-1">
              {result.warnings.map((w, i) => (
                <div key={i} className="p-2 bg-yellow-900/20 border border-yellow-700/40 rounded text-xs text-yellow-300">⚠ {w}</div>
              ))}
            </div>
          )}

          <details className="text-xs">
            <summary className="cursor-pointer text-gray-400 hover:text-infra-highlight py-1">Show calculation steps ({result.steps.length})</summary>
            <div className="mt-2 space-y-2">
              {result.steps.map((step) => (
                <div key={step.step_number} className={`border rounded p-2 space-y-0.5 ${step.status === 'fail' ? 'border-red-700/50' : step.status === 'warn' ? 'border-yellow-700/40' : 'border-infra-accent/20'}`}>
                  <div className="text-infra-highlight font-bold">{step.step_number}. {step.title}</div>
                  <div className="text-gray-500 font-mono">{step.formula}</div>
                  <div className="text-gray-400">{step.substitution}</div>
                  <div className="text-white">{step.result} <span className="text-gray-500">{step.unit}</span></div>
                  <div className="text-gray-600">{step.reference}</div>
                </div>
              ))}
            </div>
          </details>
        </>
      )}
    </div>
  );
}
