import type { CalculatorFormProps } from '../CalculatorTypes';

export function SteelCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  return (
    <div className="space-y-3">
      <Field label="Span (m)" type="number" value={inputs.length ?? 5} onChange={(v) => onInputChange('length', v)} />
      <Field label="Yield Strength (fy) [MPa]" type="number" value={inputs.fy ?? 275} onChange={(v) => onInputChange('fy', v)} />
      <Field label="Design Load (kN/m)" type="number" value={inputs.w ?? 20} onChange={(v) => onInputChange('w', v)} />
      <Field label="Plastic Section Modulus (Wpl) [cm³]" type="number" value={inputs.Wpl ?? 721} onChange={(v) => onInputChange('Wpl', v)} />
      <Field label="Shear Area (Aw) [cm²]" type="number" value={inputs.Aw ?? 22.8} onChange={(v) => onInputChange('Aw', v)} />
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
