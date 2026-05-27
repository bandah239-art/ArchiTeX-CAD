import { useState } from 'react';
import { API_BASE } from '../../../services/apiConfig';

interface CrackWidthCalculatorProps {
  inputs: Record<string, unknown>;
  onInputChange: (key: string, value: unknown) => void;
}

interface CrackResult {
  status: string;
  summary: Record<string, number | string | boolean>;
  steps: { step_number: number; title: string; formula: string; substitution: string; result: string; unit: string; reference: string }[];
  warnings: string[];
}

function Field({ label, value, onChange, step, unit }: {
  label: string; value: unknown; onChange: (v: number) => void; step?: number; unit?: string;
}) {
  return (
    <div className="flex flex-col space-y-0.5">
      <label className="text-gray-400 text-xs font-semibold">{label}{unit ? <span className="text-gray-500 ml-1">({unit})</span> : ''}</label>
      <input
        type="number"
        step={step ?? 'any'}
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white text-xs focus:outline-none focus:border-infra-highlight/60"
      />
    </div>
  );
}

function Select({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col space-y-0.5">
      <label className="text-gray-400 text-xs font-semibold">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white text-xs focus:outline-none focus:border-infra-highlight/60"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`flex justify-between border-b border-infra-accent/20 py-0.5 ${highlight ? 'text-infra-highlight' : ''}`}>
      <span className="text-gray-400 text-xs">{label}</span>
      <span className={`font-mono text-xs ${highlight ? 'text-infra-highlight font-bold' : 'text-white'}`}>{value}</span>
    </div>
  );
}

export function CrackWidthCalculator({ inputs, onInputChange }: CrackWidthCalculatorProps) {
  const [result, setResult] = useState<CrackResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function compute() {
    setLoading(true);
    setError(null);
    try {
      const body = {
        b_mm: Number(inputs.b_mm ?? 300),
        h_mm: Number(inputs.h_mm ?? 500),
        cover_mm: Number(inputs.cover_mm ?? 35),
        bar_dia_mm: Number(inputs.bar_dia_mm ?? 16),
        n_bars: Number(inputs.n_bars ?? 3),
        fck_mpa: Number(inputs.fck_mpa ?? 30),
        fyk_mpa: Number(inputs.fyk_mpa ?? 500),
        Es_gpa: Number(inputs.Es_gpa ?? 200),
        M_knm: Number(inputs.M_knm ?? 80),
        N_kn: Number(inputs.N_kn ?? 0),
        wk_limit_mm: Number(inputs.wk_limit_mm ?? 0.3),
        bond_condition: String(inputs.bond_condition ?? 'good'),
      };
      const res = await fetch(`${API_BASE}/structural/crack-width`, {
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
  const wk = s ? Number(s.wk_mm) : null;
  const limit = s ? Number(s.wk_limit_mm) : null;
  const util = s ? Number(s.utilisation_pct) : null;

  return (
    <div className="flex flex-col space-y-4 bg-infra-bg/50 p-4 border border-infra-accent/30 rounded-lg">
      <div className="flex justify-between items-center">
        <h3 className="text-infra-highlight font-bold uppercase text-sm tracking-wider">EC2 Crack Width</h3>
        <span className="text-xs px-2 py-0.5 rounded bg-infra-highlight/25 text-infra-highlight border border-infra-highlight/40">EN 1992-1-1 §7.3</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Width b" value={inputs.b_mm ?? 300} onChange={(v) => onInputChange('b_mm', v)} unit="mm" />
        <Field label="Depth h" value={inputs.h_mm ?? 500} onChange={(v) => onInputChange('h_mm', v)} unit="mm" />
        <Field label="Cover" value={inputs.cover_mm ?? 35} onChange={(v) => onInputChange('cover_mm', v)} unit="mm" />
        <Field label="Bar diameter" value={inputs.bar_dia_mm ?? 16} onChange={(v) => onInputChange('bar_dia_mm', v)} unit="mm" />
        <Field label="No. of bars" value={inputs.n_bars ?? 3} onChange={(v) => onInputChange('n_bars', v)} step={1} />
        <Field label="fck" value={inputs.fck_mpa ?? 30} onChange={(v) => onInputChange('fck_mpa', v)} unit="MPa" />
        <Field label="fyk" value={inputs.fyk_mpa ?? 500} onChange={(v) => onInputChange('fyk_mpa', v)} unit="MPa" />
        <Field label="Es" value={inputs.Es_gpa ?? 200} onChange={(v) => onInputChange('Es_gpa', v)} unit="GPa" />
        <Field label="Moment M" value={inputs.M_knm ?? 80} onChange={(v) => onInputChange('M_knm', v)} unit="kNm" />
        <Field label="Axial N (+ tension)" value={inputs.N_kn ?? 0} onChange={(v) => onInputChange('N_kn', v)} unit="kN" />
        <Field label="wk limit" value={inputs.wk_limit_mm ?? 0.3} onChange={(v) => onInputChange('wk_limit_mm', v)} unit="mm" step={0.05} />
        <Select
          label="Bond condition"
          value={String(inputs.bond_condition ?? 'good')}
          options={[{ value: 'good', label: 'Good (deformed bars)' }, { value: 'poor', label: 'Poor (smooth/top cast)' }]}
          onChange={(v) => onInputChange('bond_condition', v)}
        />
      </div>

      <button
        type="button"
        onClick={compute}
        disabled={loading}
        className="w-full py-2 bg-infra-highlight text-white text-xs font-bold rounded uppercase tracking-wider hover:bg-infra-highlight/80 disabled:opacity-50"
      >
        {loading ? 'COMPUTING...' : 'CHECK CRACK WIDTH'}
      </button>

      {error && <div className="p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">{error}</div>}

      {result && s && (
        <>
          {/* Pass/Fail badge */}
          <div className={`p-3 rounded border text-center font-bold text-sm ${
            result.status === 'pass'
              ? 'bg-green-900/30 border-green-700/50 text-green-400'
              : 'bg-red-900/30 border-red-700/50 text-red-400'
          }`}>
            {result.status === 'pass' ? '✓ PASS' : '✗ FAIL'} — wk = {Number(s.wk_mm).toFixed(3)} mm
            {limit !== null ? ` (limit ${limit} mm, ${util?.toFixed(0)}% utilised)` : ''}
          </div>

          {/* Utilisation bar */}
          {util !== null && (
            <div className="w-full bg-infra-darker rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${util > 100 ? 'bg-red-500' : util > 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(util, 100)}%` }}
              />
            </div>
          )}

          {/* Key values */}
          <div className="grid grid-cols-2 gap-1">
            <Row label="d (mm)" value={Number(s.d_mm).toFixed(1)} />
            <Row label="As (mm²)" value={Number(s.As_mm2).toFixed(0)} />
            <Row label="αe = Es/Ecm" value={Number(s.alpha_e).toFixed(2)} />
            <Row label="NA depth x (mm)" value={Number(s.x_mm).toFixed(1)} />
            <Row label="σs (MPa)" value={Number(s.sigma_s_mpa).toFixed(1)} />
            <Row label="fctm (MPa)" value={Number(s.fctm_mpa).toFixed(2)} />
            <Row label="hc,eff (mm)" value={Number(s.hc_eff_mm).toFixed(1)} />
            <Row label="ρp,eff" value={Number(s.rho_p_eff).toFixed(5)} />
            <Row label="εsm - εcm" value={Number(s.eps_sm_minus_cm).toFixed(6)} />
            <Row label="sr,max (mm)" value={Number(s.sr_max_mm).toFixed(1)} />
            <Row label="wk (mm)" value={Number(s.wk_mm).toFixed(4)} highlight />
            <Row label="Utilisation" value={`${util?.toFixed(1)}%`} highlight />
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="space-y-1">
              {result.warnings.map((w, i) => (
                <div key={i} className="p-2 bg-yellow-900/20 border border-yellow-700/40 rounded text-xs text-yellow-300">⚠ {w}</div>
              ))}
            </div>
          )}

          {/* Calculation steps */}
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-400 hover:text-infra-highlight py-1">Show calculation steps ({result.steps.length})</summary>
            <div className="mt-2 space-y-2">
              {result.steps.map((step) => (
                <div key={step.step_number} className="border border-infra-accent/20 rounded p-2 space-y-0.5">
                  <div className="text-infra-highlight font-bold">{step.step_number}. {step.title}</div>
                  <div className="text-gray-500 font-mono">{step.formula}</div>
                  <div className="text-gray-400">{step.substitution}</div>
                  <div className="text-white">{step.result} <span className="text-gray-500">{step.unit}</span></div>
                  <div className="text-gray-600 text-xs">{step.reference}</div>
                </div>
              ))}
            </div>
          </details>
        </>
      )}
    </div>
  );
}
