import type { CalculatorFormProps } from '../CalculatorTypes';

export function TimberCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  return (
    <div className="space-y-3">
      <Field label="Span (m)" type="number" value={inputs.length ?? 4} onChange={(v) => onInputChange('length', v)} />
      <Field label="Width (b) [mm]" type="number" value={inputs.b ?? 50} onChange={(v) => onInputChange('b', v)} />
      <Field label="Depth (h) [mm]" type="number" value={inputs.h ?? 200} onChange={(v) => onInputChange('h', v)} />
      <Field label="Bending Strength (fm,k) [MPa]" type="number" value={inputs.fm_k ?? 24} onChange={(v) => onInputChange('fm_k', v)} />
      <Field label="Shear Strength (fv,k) [MPa]" type="number" value={inputs.fv_k ?? 4.0} onChange={(v) => onInputChange('fv_k', v)} />
      <Field label="Mean Modulus of Elasticity (E0,mean) [MPa]" type="number" value={inputs.E0_mean ?? 11000} onChange={(v) => onInputChange('E0_mean', v)} />
      <Field label="Modification Factor (k_mod)" type="number" value={inputs.k_mod ?? 0.8} onChange={(v) => onInputChange('k_mod', v)} />
      <Field label="Design Load (ULS) [kN/m]" type="number" value={inputs.w ?? 5} onChange={(v) => onInputChange('w', v)} />
      <Field label="Service Load (SLS) [kN/m]" type="number" value={inputs.w_sls ?? 3.5} onChange={(v) => onInputChange('w_sls', v)} />
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: string;
  value: unknown;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value as number}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none focus:border-infra-highlight/60"
      />
    </div>
  );
}
