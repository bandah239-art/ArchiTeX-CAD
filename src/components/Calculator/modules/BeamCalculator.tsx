import type { CalculatorFormProps } from '../CalculatorTypes';
import {
  CONCRETE_GRADES,
  STEEL_GRADES,
  EXPOSURE_CLASSES,
  DESIGN_CODES,
  SUPPORT_CONDITIONS,
} from '../CalculatorTypes';

export function BeamCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  return (
    <div className="space-y-3">
      <Field label="Span (m)" type="number" value={inputs.span ?? 6} onChange={(v) => onInputChange('span', v)} />
      <SelectField
        label="Support Condition"
        value={(inputs.support_condition as string) ?? 'simply_supported'}
        options={SUPPORT_CONDITIONS}
        onChange={(v) => onInputChange('support_condition', v)}
      />
      <Field label="Dead Load (kN/m)" type="number" value={inputs.dead_load ?? 15} onChange={(v) => onInputChange('dead_load', v)} />
      <Field label="Imposed Load (kN/m)" type="number" value={inputs.imposed_load ?? 10} onChange={(v) => onInputChange('imposed_load', v)} />
      <Field label="Beam Width (mm)" type="number" value={inputs.width ?? 300} onChange={(v) => onInputChange('width', v)} />
      <Field label="Beam Depth (mm)" type="number" value={inputs.depth ?? 500} onChange={(v) => onInputChange('depth', v)} />
      <SelectField
        label="Concrete Grade (fck)"
        value={String(inputs.fck ?? 30)}
        options={CONCRETE_GRADES.map((g) => ({ value: String(g), label: `${g} MPa` }))}
        onChange={(v) => onInputChange('fck', Number(v))}
      />
      <SelectField
        label="Steel Grade (fyk)"
        value={String(inputs.fyk ?? 500)}
        options={STEEL_GRADES.map((g) => ({ value: String(g), label: `${g} MPa` }))}
        onChange={(v) => onInputChange('fyk', Number(v))}
      />
      <SelectField
        label="Exposure Class"
        value={(inputs.exposure_class as string) ?? 'XC1'}
        options={EXPOSURE_CLASSES.map((c) => ({ value: c, label: c }))}
        onChange={(v) => onInputChange('exposure_class', v)}
      />
      <SelectField
        label="Design Code"
        value={(inputs.design_code as string) ?? 'Eurocode2'}
        options={DESIGN_CODES.map((c) => ({ value: c, label: c }))}
        onChange={(v) => onInputChange('design_code', v)}
      />
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
