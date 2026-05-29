import { useState } from 'react';
import type { CalculatorFormProps } from '../CalculatorTypes';
import { NumField, SelectField } from '../FormElements';
import { API_BASE } from '../../../services/apiConfig';

interface SlabResult {
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
  { value: '8', label: 'Y8' },
  { value: '10', label: 'Y10' },
  { value: '12', label: 'Y12' },
  { value: '16', label: 'Y16' },
];

const SLAB_TYPES = [
  { value: 'one_way', label: 'One-Way Slab' },
  { value: 'two_way', label: 'Two-Way (Simply Supp.)' },
  { value: 'two_way_restrained', label: 'Two-Way (Restrained)' },
];

const SUPPORTS = [
  { value: 'simply_supported', label: 'Simply Supported' },
  { value: 'continuous', label: 'Continuous' },
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

export function SlabCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  const [result, setResult] = useState<SlabResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slabType = String(inputs.slab_type ?? 'one_way');
  const isTwoWay = slabType !== 'one_way';

  async function compute() {
    setLoading(true);
    setError(null);
    const lx = Number(inputs.span_lx ?? 4);
    try {
      const body = {
        design_code: 'BS8110',
        slab_type: slabType,
        span_lx: lx,
        span_ly: isTwoWay ? Number(inputs.span_ly ?? 5) : lx,
        dead_load: Number(inputs.dead_load ?? 5),
        live_load: Number(inputs.live_load ?? 3),
        depth: Number(inputs.depth ?? 175),
        support_condition: String(inputs.support_condition ?? 'simply_supported'),
        cover_mm: Number(inputs.cover_mm ?? 25),
        bar_dia_mm: Number(inputs.bar_dia_mm ?? 10),
        fcu_mpa: Number(inputs.fcu ?? 25),
        fy_mpa: Number(inputs.fy ?? 460),
        fire_period_hours: Number(inputs.fire_period_hours ?? 1.0),
        country: 'Zambia',
      };
      const res = await fetch(`${API_BASE}/calculate/slab`, {
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
        <h3 className="text-infra-highlight font-bold uppercase text-sm tracking-wider">RC Slab Design</h3>
        <span className="text-xs px-2 py-0.5 rounded bg-infra-highlight/25 text-infra-highlight border border-infra-highlight/40">BS 8110</span>
      </div>

      <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
        <h4 className="text-xs font-bold text-white mb-2">Geometry & Loading</h4>
        <div className="space-y-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Slab Type</label>
            <div className="flex gap-1">
              {SLAB_TYPES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onInputChange('slab_type', opt.value)}
                  className={`flex-1 py-1.5 text-xs rounded transition-colors ${slabType === opt.value ? 'bg-infra-highlight text-white' : 'bg-infra-accent/30 text-gray-400 hover:bg-infra-accent/50'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <NumField label="Short Span lx (m)" value={inputs.span_lx ?? 4} onChange={(v) => onInputChange('span_lx', v)} />
          {isTwoWay && <NumField label="Long Span ly (m)" value={inputs.span_ly ?? 5} onChange={(v) => onInputChange('span_ly', v)} />}
          <NumField label="Dead Load Gk (kN/m²)" value={inputs.dead_load ?? 5} onChange={(v) => onInputChange('dead_load', v)} />
          <NumField label="Imposed Load Qk (kN/m²)" value={inputs.live_load ?? 3} onChange={(v) => onInputChange('live_load', v)} />
          <NumField label="Slab Depth h (mm)" value={inputs.depth ?? 175} onChange={(v) => onInputChange('depth', v)} />
          <SelectField label="Support Condition" value={String(inputs.support_condition ?? 'simply_supported')} options={SUPPORTS} onChange={(v) => onInputChange('support_condition', v)} />
        </div>
      </div>

      <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
        <h4 className="text-xs font-bold text-white mb-2">Reinforcement & Materials</h4>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Cover (mm)" value={inputs.cover_mm ?? 25} onChange={(v) => onInputChange('cover_mm', v)} />
          <SelectField label="Bar Diameter" value={String(inputs.bar_dia_mm ?? 10)} options={BAR_DIAS} onChange={(v) => onInputChange('bar_dia_mm', Number(v))} />
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
        {loading ? 'COMPUTING...' : 'CHECK SLAB — BS 8110'}
      </button>

      {error && <div className="p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">{error}</div>}

      {result && s && (
        <>
          <div className={`p-3 rounded border text-center font-bold text-sm ${result.status === 'pass' ? 'bg-green-900/30 border-green-700/50 text-green-400' : 'bg-red-900/30 border-red-700/50 text-red-400'}`}>
            {result.status === 'pass' ? '✓ PASS' : '✗ FAIL'} — {s.structural_design}
          </div>

          <div className="grid grid-cols-2 gap-1">
            <Row label="Design load n (kN/m²)" value={Number(s.design_load_knm2 ?? 0).toFixed(2)} />
            <Row label="Span ratio ly/lx" value={Number(s.span_ratio ?? 0).toFixed(2)} />
            <Row label="Moment short span (kNm)" value={Number(s.moment_short_span_knm ?? 0).toFixed(1)} />
            <Row label="Moment long span (kNm)" value={Number(s.moment_long_span_knm ?? 0).toFixed(1)} />
            <Row label="Hogging short span (kNm)" value={Number(s.hogging_short_span_knm ?? 0).toFixed(1)} />
            <Row label="As-x required (mm²/m)" value={Number(s.steel_required_x_mm2 ?? 0).toFixed(0)} highlight />
            <Row label="As-y required (mm²/m)" value={Number(s.steel_required_y_mm2 ?? 0).toFixed(0)} />
            <Row label="Provision x / y" value={`${s.provision_short_span ?? '—'} / ${s.provision_long_span ?? '—'}`} />
            <Row label="Shear v / vc (MPa)" value={`${Number(s.shear_stress_mpa ?? 0).toFixed(3)} / ${Number(s.concrete_shear_cap_mpa ?? 0).toFixed(3)}`} />
            <Row label="Span/d actual / limit" value={`${Number(s.actual_span_d ?? 0).toFixed(1)} / ${Number(s.allowable_span_d ?? 0).toFixed(1)}`} highlight />
            <Row label="Long-term defl / limit (mm)" value={`${Number(s.long_term_deflection_mm ?? 0).toFixed(1)} / ${Number(s.deflection_limit_mm ?? 0).toFixed(1)}`} />
            <Row label="Fire resistance" value={String(s.fire_resistance ?? '—').toUpperCase()} />
            <Row label="Anchorage (mm)" value={Number(s.anchorage_mm ?? 0).toFixed(0)} />
            <Row label="Lap length (mm)" value={Number(s.lap_length_mm ?? 0).toFixed(0)} />
            <Row label="Cost/m² (ZMW)" value={`ZMW ${Number(s.cost_per_m2_zmw ?? 0).toLocaleString()}`} highlight />
            <Row label="Total cost (ZMW)" value={`ZMW ${Number(s.total_cost_zmw ?? 0).toLocaleString()}`} />
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
