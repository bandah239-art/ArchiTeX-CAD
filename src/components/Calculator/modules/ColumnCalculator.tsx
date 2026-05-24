import type { CalculatorFormProps } from '../CalculatorTypes';
import {
  CONCRETE_GRADES,
  SLAB_STEEL_GRADES,
  LE_FACTORS,
} from '../CalculatorTypes';

export function ColumnCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  return (
    <div className="space-y-3">
      <Field
        label="Column Height (m)"
        value={inputs.height ?? 4}
        onChange={(v) => onInputChange('height', v)}
      />
      <Field
        label="Width b (mm)"
        value={inputs.width ?? 300}
        onChange={(v) => onInputChange('width', v)}
      />
      <Field
        label="Depth h (mm)"
        value={inputs.depth ?? 300}
        onChange={(v) => onInputChange('depth', v)}
      />
      <Field
        label="Axial Load NEd (kN)"
        value={inputs.axial_load ?? 850}
        onChange={(v) => onInputChange('axial_load', v)}
      />
      <Field
        label="Moment Major (kNm)"
        value={inputs.moment_major ?? 45}
        onChange={(v) => onInputChange('moment_major', v)}
      />
      <Field
        label="Moment Minor (kNm)"
        value={inputs.moment_minor ?? 20}
        onChange={(v) => onInputChange('moment_minor', v)}
      />
      <SelectField
        label="Concrete Grade (fck)"
        value={String(inputs.fck ?? 30)}
        options={CONCRETE_GRADES.map((g) => ({ value: String(g), label: `${g} MPa` }))}
        onChange={(v) => onInputChange('fck', Number(v))}
      />
      <SelectField
        label="Steel Grade (fyk)"
        value={String(inputs.fyk ?? 500)}
        options={SLAB_STEEL_GRADES.map((g) => ({ value: String(g), label: `${g} MPa` }))}
        onChange={(v) => onInputChange('fyk', Number(v))}
      />
      <SelectField
        label="Effective Length Factor"
        value={String(inputs.le_factor ?? 0.85)}
        options={LE_FACTORS}
        onChange={(v) => onInputChange('le_factor', Number(v))}
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type="number"
        step="any"
        value={value as number}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none focus:border-infra-highlight/60"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none focus:border-infra-highlight/60"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
