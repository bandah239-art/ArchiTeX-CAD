import { useState } from 'react';
import type { CalculatorFormProps } from '../CalculatorTypes';
import { NumField, SelectField } from '../FormElements';
import { API_BASE } from '../../../services/apiConfig';

interface BlackCottonResult {
  status: string;
  summary: Record<string, number | string>;
  steps: { step_number: number; title: string; formula: string; substitution: string; result: string; unit: string; reference: string }[];
  options: { name: string; description: string; pros: string; cons: string; cost_indicator: string }[];
  warnings: string[];
}

function Row({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex justify-between border-b border-infra-accent/20 py-0.5">
      <span className="text-gray-400 text-xs">{label}</span>
      <span className={`font-mono text-xs ${highlight ? 'text-infra-highlight font-bold' : 'text-white'}`}>{value}</span>
    </div>
  );
}

const FOUNDATION_OPTIONS = [
  { value: 'raft',  label: 'Stiffened Raft Slab' },
  { value: 'pad',   label: 'Pad Footing on Replacement Fill' },
  { value: 'piers', label: 'Bored Piers / Under-reamed' },
];

const RISK_COLORS: Record<string, string> = {
  low:       'text-green-400 bg-green-900/30 border-green-700/50',
  moderate:  'text-yellow-400 bg-yellow-900/30 border-yellow-700/50',
  high:      'text-orange-400 bg-orange-900/30 border-orange-700/50',
  very_high: 'text-red-400 bg-red-900/30 border-red-700/50',
};

export function BlackCottonCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  const [result, setResult] = useState<BlackCottonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLLChange = (v: number) => {
    onInputChange('LL_pct', v);
    const pl = (inputs.PL_pct as number) ?? 22;
    onInputChange('PI_pct', Math.max(0, v - pl));
  };

  const handlePLChange = (v: number) => {
    onInputChange('PL_pct', v);
    const ll = (inputs.LL_pct as number) ?? 55;
    onInputChange('PI_pct', Math.max(0, ll - v));
  };

  async function compute() {
    setLoading(true);
    setError(null);
    try {
      const body = {
        LL_pct:               Number(inputs.LL_pct ?? 55),
        PL_pct:               Number(inputs.PL_pct ?? 22),
        PI_pct:               Number(inputs.PI_pct ?? 33),
        swell_pressure_kpa:   Number(inputs.swell_pressure_kpa ?? 0),
        depth_to_rock_m:      Number(inputs.depth_to_rock_m ?? 3.5),
        GWT_m:                Number(inputs.GWT_m ?? 2.5),
        dry_unit_weight_knm3: Number(inputs.dry_unit_weight_knm3 ?? 15.5),
        proposed_foundation:  String(inputs.proposed_foundation ?? 'raft'),
        B_m:                  Number(inputs.B_m ?? 1.5),
        Df_m:                 Number(inputs.Df_m ?? 1.0),
        soil_profile: {
          clay_content_pct:       Number(inputs.clay_content_pct ?? 45),
          natural_moisture_pct:   Number(inputs.natural_moisture_pct ?? 18),
          undrained_cohesion_kpa: Number(inputs.undrained_cohesion_kpa ?? 50),
          column_load_kn:         Number(inputs.column_load_kn ?? 150),
        },
      };
      const res = await fetch(`${API_BASE}/geotechnical/black-cotton`, {
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
  const risk = s ? String(s.risk_level ?? '') : '';

  return (
    <div className="flex flex-col space-y-4 bg-infra-bg/50 p-4 border border-infra-accent/30 rounded-lg">
      <div className="flex justify-between items-center">
        <h3 className="text-infra-highlight font-bold uppercase text-sm tracking-wider">Black Cotton Soil</h3>
        <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">Expansive CH Clay</span>
      </div>

      {/* Atterberg limits */}
      <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
        <h4 className="text-xs font-bold text-white mb-2">Atterberg Limits (Plasticity)</h4>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">LL (%)</label>
            <input type="number" value={String(inputs.LL_pct ?? 55)} onChange={(e) => handleLLChange(Number(e.target.value))} className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none focus:border-infra-highlight/60" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">PL (%)</label>
            <input type="number" value={String(inputs.PL_pct ?? 22)} onChange={(e) => handlePLChange(Number(e.target.value))} className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none focus:border-infra-highlight/60" />
          </div>
          <NumField label="PI (%)" value={inputs.PI_pct ?? 33} onChange={(v) => onInputChange('PI_pct', v)} />
        </div>
        <p className="text-[10px] text-gray-400 mt-1 italic">PI auto-calculates from LL − PL. Risk rises sharply above PI = 25%.</p>
      </div>

      {/* Soil properties */}
      <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
        <h4 className="text-xs font-bold text-white mb-2">Soil Properties</h4>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Clay fraction (%)" value={inputs.clay_content_pct ?? 45} onChange={(v) => onInputChange('clay_content_pct', v)} />
          <NumField label="Natural moisture (%)" value={inputs.natural_moisture_pct ?? 18} onChange={(v) => onInputChange('natural_moisture_pct', v)} />
          <NumField label="Dry unit weight (kN/m³)" value={inputs.dry_unit_weight_knm3 ?? 15.5} onChange={(v) => onInputChange('dry_unit_weight_knm3', v)} />
          <NumField label="Cohesion cu (kPa)" value={inputs.undrained_cohesion_kpa ?? 50} onChange={(v) => onInputChange('undrained_cohesion_kpa', v)} />
          <NumField label="Measured swell pressure (kPa, 0=estimate)" value={inputs.swell_pressure_kpa ?? 0} onChange={(v) => onInputChange('swell_pressure_kpa', v)} />
        </div>
      </div>

      {/* Foundation / Site */}
      <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
        <h4 className="text-xs font-bold text-white mb-2">Site & Foundation</h4>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Depth to rock (m)" value={inputs.depth_to_rock_m ?? 3.5} onChange={(v) => onInputChange('depth_to_rock_m', v)} />
          <NumField label="Groundwater level (m)" value={inputs.GWT_m ?? 2.5} onChange={(v) => onInputChange('GWT_m', v)} />
          <NumField label="Footing width B (m)" value={inputs.B_m ?? 1.5} onChange={(v) => onInputChange('B_m', v)} />
          <NumField label="Embedment Df (m)" value={inputs.Df_m ?? 1.0} onChange={(v) => onInputChange('Df_m', v)} />
          <NumField label="Column load (kN)" value={inputs.column_load_kn ?? 150} onChange={(v) => onInputChange('column_load_kn', v)} />
          <SelectField label="Proposed foundation" value={(inputs.proposed_foundation as string) ?? 'raft'} options={FOUNDATION_OPTIONS} onChange={(v) => onInputChange('proposed_foundation', v)} />
        </div>
      </div>

      <button
        type="button"
        onClick={compute}
        disabled={loading}
        className="w-full py-2 bg-infra-highlight text-white text-xs font-bold rounded uppercase tracking-wider hover:bg-infra-highlight/80 disabled:opacity-50"
      >
        {loading ? 'ASSESSING...' : 'ASSESS BLACK COTTON RISK'}
      </button>

      {error && <div className="p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">{error}</div>}

      {result && s && (
        <>
          {/* Risk badge */}
          <div className={`p-3 rounded border text-center font-bold text-sm uppercase ${RISK_COLORS[risk] ?? 'bg-gray-900/30 border-gray-700/50 text-gray-400'}`}>
            Risk Level: {risk.replace('_', ' ')} — {s.classification}
          </div>

          {/* Key values */}
          <div className="grid grid-cols-2 gap-1">
            <Row label="Swell potential" value={`${Number(s.swell_potential_pct ?? 0).toFixed(1)}%`} highlight />
            <Row label="Swell pressure (kPa)" value={Number(s.swell_pressure_kpa ?? 0).toFixed(0)} />
            <Row label="Activity ratio" value={Number(s.activity_ratio ?? 0).toFixed(2)} />
            <Row label="ks (kN/m³)" value={Number(s.subgrade_modulus_ks_knm3 ?? 0).toFixed(0)} />
            <Row label="Min raft thickness" value={`${Number(s.min_raft_thickness_mm ?? 0).toFixed(0)} mm`} />
            <Row label="Lime treatment" value={`${Number(s.lime_treatment_pct ?? 0).toFixed(1)}%`} />
            <Row label="Lime cost (ZMW/m³)" value={`ZMW ${Number(s.lime_cost_zmw_m3 ?? 0).toFixed(0)}`} highlight />
            <Row label="Lime bags/m³" value={Number(s.lime_bags_per_m3 ?? 0).toFixed(1)} />
          </div>

          {/* Foundation options */}
          {result.options && result.options.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white">Foundation Options</h4>
              {result.options.map((opt, i) => (
                <div key={i} className="border border-infra-accent/20 rounded p-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-infra-highlight text-xs font-bold">{opt.name}</span>
                    <span className="text-xs text-gray-500">{opt.cost_indicator}</span>
                  </div>
                  <div className="text-gray-400 text-xs">{opt.description}</div>
                  <div className="flex gap-3 mt-1">
                    <span className="text-green-400 text-[10px]">✓ {opt.pros}</span>
                    <span className="text-red-400 text-[10px]">✗ {opt.cons}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

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
                <div key={step.step_number} className="border border-infra-accent/20 rounded p-2 space-y-0.5">
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
