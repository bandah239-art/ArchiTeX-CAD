import { useState } from 'react';
import type { CalculatorFormProps } from '../CalculatorTypes';
import { NumField, SelectField } from '../FormElements';
import { API_BASE } from '../../../services/apiConfig';

interface MasonryResult {
  status: string;
  summary: Record<string, number | string>;
  steps: { step_number: number; title: string; formula: string; substitution: string; result: string; unit: string; reference: string }[];
  warnings: string[];
}

function Row({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`flex justify-between border-b border-infra-accent/20 py-0.5`}>
      <span className="text-gray-400 text-xs">{label}</span>
      <span className={`font-mono text-xs ${highlight ? 'text-infra-highlight font-bold' : 'text-white'}`}>{value}</span>
    </div>
  );
}

const BRICK_CLASSES = [
  { value: 'class_1', label: 'Class 1 (Engineering Brick — 7.0 MPa)' },
  { value: 'class_2', label: 'Class 2 (High Quality Face — 5.8 MPa)' },
  { value: 'class_3', label: 'Class 3 (Most Common Zambia — 4.4 MPa)' },
  { value: 'class_4', label: 'Class 4 (Common Lusaka — 2.8 MPa)' },
  { value: 'hollow_140', label: 'Hollow Block 140mm (3.5 MPa)' },
  { value: 'hollow_190', label: 'Hollow Block 190mm (4.2 MPa)' },
];

const MORTAR_DESIGNATIONS = [
  { value: 'i',   label: 'Designation i  (1:¼:3 Cement-Lime-Sand)' },
  { value: 'ii',  label: 'Designation ii (1:½:4½ — Common)' },
  { value: 'iii', label: 'Designation iii (1:1:6)' },
  { value: 'iv',  label: 'Designation iv (1:2:9 — Lime mortar)' },
];

const RESTRAINT_OPTIONS = [
  { value: 'restrained', label: 'Restrained (pinned/lateral support)' },
  { value: 'free',       label: 'Free (cantilever / unrestrained)' },
];

const WALL_CONDITIONS = [
  { value: 'normal',  label: 'Normal Construction (γm = 3.5)' },
  { value: 'special', label: 'Special Supervision / Testing (γm = 2.5)' },
];

const LOAD_TYPES = [
  { value: 'axial',          label: 'Axial only' },
  { value: 'axial_eccentric', label: 'Axial + Eccentric moment' },
];

export function MasonryCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  const [result, setResult] = useState<MasonryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function compute() {
    setLoading(true);
    setError(null);
    try {
      const body = {
        width:              Number(inputs.width ?? 222),
        height:             Number(inputs.height ?? 3.0),
        length:             Number(inputs.length ?? 5.0),
        load_type:          String(inputs.load_type ?? 'axial'),
        axial_load:         Number(inputs.axial_load ?? 100),
        moment:             Number(inputs.moment ?? 0),
        brick_class:        String(inputs.brick_class ?? 'class_3'),
        mortar_designation: String(inputs.mortar_designation ?? 'ii'),
        wall_condition:     String(inputs.wall_condition ?? 'normal'),
        restraint_top:      String(inputs.restraint_top ?? 'restrained'),
        restraint_bottom:   String(inputs.restraint_bottom ?? 'restrained'),
        openings:           Boolean(inputs.openings ?? false),
      };
      const res = await fetch(`${API_BASE}/calculate/masonry`, {
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
  const util = s ? Number(s.utilisation_pct) : null;

  return (
    <div className="flex flex-col space-y-4 bg-infra-bg/50 p-4 border border-infra-accent/30 rounded-lg">
      <div className="flex justify-between items-center">
        <h3 className="text-infra-highlight font-bold uppercase text-sm tracking-wider">Masonry Wall Design</h3>
        <span className="text-xs px-2 py-0.5 rounded bg-infra-highlight/25 text-infra-highlight border border-infra-highlight/40">BS 5628</span>
      </div>

      {/* Geometry */}
      <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
        <h4 className="text-xs font-bold text-white mb-2">Wall Geometry</h4>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Thickness t (mm)" value={inputs.width ?? 222} onChange={(v) => onInputChange('width', v)} />
          <NumField label="Height h (m)" value={inputs.height ?? 3.0} onChange={(v) => onInputChange('height', v)} />
          <NumField label="Length L (m)" value={inputs.length ?? 5.0} onChange={(v) => onInputChange('length', v)} />
          <div>
            <label className="block text-xs text-gray-400 mb-1">Has Openings?</label>
            <select
              value={inputs.openings ? 'true' : 'false'}
              onChange={(e) => onInputChange('openings', e.target.value === 'true')}
              className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none focus:border-infra-highlight/60"
            >
              <option value="false">No (Solid Wall)</option>
              <option value="true">Yes (Reduces area)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading */}
      <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
        <h4 className="text-xs font-bold text-white mb-2">Loading & Restraints</h4>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Load Type" value={(inputs.load_type as string) ?? 'axial'} options={LOAD_TYPES} onChange={(v) => onInputChange('load_type', v)} />
          <NumField label="Axial N (kN/m)" value={inputs.axial_load ?? 100} onChange={(v) => onInputChange('axial_load', v)} />
          <NumField label="Moment M (kNm/m)" value={inputs.moment ?? 0} onChange={(v) => onInputChange('moment', v)} />
          <SelectField label="Top Restraint" value={(inputs.restraint_top as string) ?? 'restrained'} options={RESTRAINT_OPTIONS} onChange={(v) => onInputChange('restraint_top', v)} />
          <SelectField label="Bottom Restraint" value={(inputs.restraint_bottom as string) ?? 'restrained'} options={RESTRAINT_OPTIONS} onChange={(v) => onInputChange('restraint_bottom', v)} />
        </div>
      </div>

      {/* Materials */}
      <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
        <h4 className="text-xs font-bold text-white mb-2">Materials (BS 5628)</h4>
        <div className="space-y-2">
          <SelectField label="Brick Class / Block" value={(inputs.brick_class as string) ?? 'class_3'} options={BRICK_CLASSES} onChange={(v) => onInputChange('brick_class', v)} />
          <SelectField label="Mortar Designation" value={(inputs.mortar_designation as string) ?? 'ii'} options={MORTAR_DESIGNATIONS} onChange={(v) => onInputChange('mortar_designation', v)} />
          <SelectField label="Construction Quality" value={(inputs.wall_condition as string) ?? 'normal'} options={WALL_CONDITIONS} onChange={(v) => onInputChange('wall_condition', v)} />
        </div>
      </div>

      <button
        type="button"
        onClick={compute}
        disabled={loading}
        className="w-full py-2 bg-infra-highlight text-white text-xs font-bold rounded uppercase tracking-wider hover:bg-infra-highlight/80 disabled:opacity-50"
      >
        {loading ? 'COMPUTING...' : 'CHECK MASONRY WALL'}
      </button>

      {error && <div className="p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">{error}</div>}

      {result && s && (
        <>
          <div className={`p-3 rounded border text-center font-bold text-sm ${result.status === 'pass' ? 'bg-green-900/30 border-green-700/50 text-green-400' : 'bg-red-900/30 border-red-700/50 text-red-400'}`}>
            {result.status === 'pass' ? '✓ PASS' : '✗ FAIL'}
            {s.geotech_design ? ` — ${s.geotech_design}` : ''}
          </div>

          {util !== null && (
            <div className="w-full bg-infra-darker rounded-full h-2">
              <div className={`h-2 rounded-full transition-all ${util > 100 ? 'bg-red-500' : util > 80 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${Math.min(util, 100)}%` }} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-1">
            <Row label="Slenderness ratio" value={Number(s.slenderness_ratio ?? 0).toFixed(1)} />
            <Row label="Effective height (m)" value={Number(s.effective_height_m ?? 0).toFixed(2)} />
            <Row label="β factor" value={Number(s.beta ?? 0).toFixed(3)} />
            <Row label="fk (MPa)" value={Number(s.fk_mpa ?? 0).toFixed(2)} />
            <Row label="NRd (kN/m)" value={Number(s.NRd_kn_m ?? 0).toFixed(1)} highlight />
            <Row label="N applied (kN/m)" value={Number(s.N_applied_kn_m ?? 0).toFixed(1)} />
            <Row label="Eccentricity (mm)" value={Number(s.eccentricity_mm ?? 0).toFixed(1)} />
            <Row label="Utilisation" value={`${util?.toFixed(1)}%`} highlight />
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
