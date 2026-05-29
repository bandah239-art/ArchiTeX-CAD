import { useState } from 'react';
import type { CalculatorFormProps } from '../CalculatorTypes';
import { NumField, SelectField } from '../FormElements';
import { API_BASE } from '../../../services/apiConfig';

interface BeamResult {
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
  { value: '10', label: 'Y10' },
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
  { value: '12', label: 'Y12' },
];

const SUPPORTS = [
  { value: 'simply_supported', label: 'Simply Supported' },
  { value: 'continuous', label: 'Continuous' },
  { value: 'cantilever', label: 'Cantilever' },
];

const FIRE_PERIODS = [
  { value: '0.5', label: '0.5 h (30 min)' },
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

export function BeamCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  const [result, setResult] = useState<BeamResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function compute() {
    setLoading(true);
    setError(null);
    try {
      const body = {
        design_code: 'BS8110',
        span: Number(inputs.span ?? 6),
        dead_load: Number(inputs.dead_load ?? 15),
        live_load: Number(inputs.live_load ?? 10),
        width: Number(inputs.width ?? 300),
        depth: Number(inputs.depth ?? 500),
        support_condition: String(inputs.support_condition ?? 'simply_supported'),
        cover_mm: Number(inputs.cover_mm ?? 30),
        bar_dia_mm: Number(inputs.bar_dia_mm ?? 16),
        n_bars_tension: Math.round(Number(inputs.n_bars_tension ?? 3)),
        n_bars_compression: Math.round(Number(inputs.n_bars_compression ?? 2)),
        link_dia_mm: Number(inputs.link_dia_mm ?? 8),
        link_spacing_mm: Number(inputs.link_spacing_mm ?? 175),
        fcu_mpa: Number(inputs.fcu ?? 25),
        fy_mpa: Number(inputs.fy ?? 460),
        fire_period_hours: Number(inputs.fire_period_hours ?? 1.0),
        country: 'Zambia',
      };
      const res = await fetch(`${API_BASE}/calculate/beam`, {
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
        <h3 className="text-infra-highlight font-bold uppercase text-sm tracking-wider">RC Beam Design</h3>
        <span className="text-xs px-2 py-0.5 rounded bg-infra-highlight/25 text-infra-highlight border border-infra-highlight/40">BS 8110</span>
      </div>

      <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
        <h4 className="text-xs font-bold text-white mb-2">Geometry & Loading</h4>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Span (m)" value={inputs.span ?? 6} onChange={(v) => onInputChange('span', v)} warnLow={1} warnHigh={20} warnMsg="Typical beam span 1–20 m" />
          <SelectField label="Support Condition" value={String(inputs.support_condition ?? 'simply_supported')} options={SUPPORTS} onChange={(v) => onInputChange('support_condition', v)} />
          <NumField label="Dead Load Gk (kN/m)" value={inputs.dead_load ?? 15} onChange={(v) => onInputChange('dead_load', v)} warnLow={0.5} warnHigh={100} warnMsg="Unusually high dead load — check units (kN/m, not kN/m²)" />
          <NumField label="Imposed Load Qk (kN/m)" value={inputs.live_load ?? 10} onChange={(v) => onInputChange('live_load', v)} warnLow={0} warnHigh={60} warnMsg="Unusually high imposed load — check units" />
          <NumField label="Width b (mm)" value={inputs.width ?? 300} onChange={(v) => onInputChange('width', v)} warnLow={150} warnHigh={750} warnMsg="Typical beam width 150–750 mm" />
          <NumField label="Total Depth h (mm)" value={inputs.depth ?? 500} onChange={(v) => onInputChange('depth', v)} warnLow={150} warnHigh={1500} warnMsg="Typical beam depth 150–1500 mm" />
        </div>
      </div>

      <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
        <h4 className="text-xs font-bold text-white mb-2">Reinforcement Detail</h4>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Cover (mm)" value={inputs.cover_mm ?? 30} onChange={(v) => onInputChange('cover_mm', v)} warnLow={20} warnHigh={75} warnMsg="BS 8110 cover: 20–75 mm typical" />
          <SelectField label="Main Bar Diameter" value={String(inputs.bar_dia_mm ?? 16)} options={BAR_DIAS} onChange={(v) => onInputChange('bar_dia_mm', Number(v))} />
          <NumField label="Tension Bars (n)" value={inputs.n_bars_tension ?? 3} onChange={(v) => onInputChange('n_bars_tension', Math.round(v))} warnLow={1} warnHigh={10} warnMsg="More than 10 bars is unusual — verify spacing" />
          <NumField label="Compression Bars (n)" value={inputs.n_bars_compression ?? 2} onChange={(v) => onInputChange('n_bars_compression', Math.round(v))} warnLow={0} warnHigh={8} warnMsg="More than 8 compression bars is unusual" />
          <SelectField label="Link Diameter" value={String(inputs.link_dia_mm ?? 8)} options={LINK_DIAS} onChange={(v) => onInputChange('link_dia_mm', Number(v))} />
          <NumField label="Link Spacing (mm)" value={inputs.link_spacing_mm ?? 175} onChange={(v) => onInputChange('link_spacing_mm', v)} warnLow={75} warnHigh={300} warnMsg="BS 8110: link spacing ≤ 0.75d and ≤ 300 mm" />
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
        {loading ? 'COMPUTING...' : 'CHECK BEAM — BS 8110'}
      </button>

      {error && <div className="p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">{error}</div>}

      {result && s && (
        <>
          <div className={`p-3 rounded border text-center font-bold text-sm ${result.status === 'pass' ? 'bg-green-900/30 border-green-700/50 text-green-400' : 'bg-red-900/30 border-red-700/50 text-red-400'}`}>
            {result.status === 'pass' ? '✓ PASS' : '✗ FAIL'} — {s.structural_design}
          </div>

          <div className="grid grid-cols-2 gap-1">
            <Row label="Effective depth d (mm)" value={Number(s.effective_depth_mm ?? 0).toFixed(0)} />
            <Row label="K factor" value={Number(s.k_factor ?? 0).toFixed(4)} />
            <Row label="As required (mm²)" value={Number(s.steel_required_mm2 ?? 0).toFixed(0)} />
            <Row label="As provided (mm²)" value={Number(s.steel_provided_mm2 ?? 0).toFixed(0)} highlight />
            <Row label="As min / max (mm²)" value={`${Number(s.steel_min_mm2 ?? 0).toFixed(0)} / ${Number(s.steel_max_mm2 ?? 0).toFixed(0)}`} />
            <Row label="Moment capacity (kNm)" value={Number(s.moment_capacity_knm ?? 0).toFixed(1)} />
            <Row label="Shear v / vc (MPa)" value={`${Number(s.shear_stress_mpa ?? 0).toFixed(3)} / ${Number(s.concrete_shear_capacity_mpa ?? 0).toFixed(3)}`} />
            <Row label="Link requirement" value={String(s.link_requirement ?? '—')} />
            <Row label="Asv/sv req / prov" value={`${Number(s.asv_sv_required ?? 0).toFixed(3)} / ${Number(s.asv_sv_provided ?? 0).toFixed(3)}`} />
            <Row label="Span/d actual / limit" value={`${Number(s.actual_span_d ?? 0).toFixed(1)} / ${Number(s.allowable_span_d ?? 0).toFixed(1)}`} highlight />
            <Row label="Long-term defl / limit (mm)" value={`${Number(s.long_term_deflection_mm ?? 0).toFixed(1)} / ${Number(s.deflection_limit_mm ?? 0).toFixed(1)}`} />
            <Row label="Fire resistance" value={String(s.fire_resistance ?? '—').toUpperCase()} />
            <Row label="Anchorage tension (mm)" value={Number(s.anchorage_tension_mm ?? 0).toFixed(0)} />
            <Row label="Lap tension (mm)" value={Number(s.lap_tension_mm ?? 0).toFixed(0)} />
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
