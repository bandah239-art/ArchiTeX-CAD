import type { CalculatorFormProps } from '../CalculatorTypes';
import {
  CONCRETE_GRADES,
  SLAB_STEEL_GRADES,
  SLAB_SUPPORT_CONDITIONS,
} from '../CalculatorTypes';
import { NumField } from '../FormElements';
import { StructuralMorePanel } from '../../Structural/StructuralMorePanel';

export function SlabCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  const slabType = (inputs.slab_type as string) ?? 'one_way';
  const isTwoWay = slabType === 'two_way';

  return (
    <div className="space-y-3">
      <ToggleField
        label="Slab Type"
        value={slabType}
        options={[
          { value: 'one_way', label: 'One-Way' },
          { value: 'two_way', label: 'Two-Way' },
        ]}
        onChange={(v) => onInputChange('slab_type', v)}
      />
      <Field
        label="Short Span lx (m)"
        value={inputs.span_lx ?? 4}
        onChange={(v) => onInputChange('span_lx', v)}
      />
      {isTwoWay && (
        <Field
          label="Long Span ly (m)"
          value={inputs.span_ly ?? 5}
          onChange={(v) => onInputChange('span_ly', v)}
        />
      )}
      <Field
        label="Dead Load (kN/m²)"
        value={inputs.dead_load ?? 5}
        onChange={(v) => onInputChange('dead_load', v)}
      />
      <Field
        label="Live Load (kN/m²)"
        value={inputs.live_load ?? 3}
        onChange={(v) => onInputChange('live_load', v)}
      />
      <Field
        label="Slab Depth (mm)"
        value={inputs.depth ?? 175}
        onChange={(v) => onInputChange('depth', v)}
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
        label="Support Condition"
        value={(inputs.support_condition as string) ?? 'simply_supported'}
        options={SLAB_SUPPORT_CONDITIONS}
        onChange={(v) => onInputChange('support_condition', v)}
      />
      <StructuralMorePanel inputs={inputs} />
    </div>
  );
}

const Field = NumField;

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

function ToggleField({
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
      <div className="flex gap-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 py-1.5 text-xs rounded transition-colors ${
              value === opt.value
                ? 'bg-infra-highlight text-white'
                : 'bg-infra-accent/30 text-gray-400 hover:bg-infra-accent/50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
