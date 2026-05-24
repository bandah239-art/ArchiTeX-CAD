import type { CalculatorFormProps } from '../CalculatorTypes';
import { CONCRETE_GRADES, STEEL_GRADES } from '../CalculatorTypes';

const FOUNDATION_TYPES = [
  { value: 'pad', label: 'Pad Foundation' },
  { value: 'strip', label: 'Strip Foundation' },
  { value: 'raft', label: 'Raft Foundation' },
];

export function FoundationCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  const ftype = (inputs.foundation_type as string) ?? 'pad';

  return (
    <div className="space-y-3">
      <SelectField
        label="Foundation Type"
        value={ftype}
        options={FOUNDATION_TYPES}
        onChange={(v) => onInputChange('foundation_type', v)}
      />
      <NumField label="Column Load (kN)" value={inputs.column_load ?? 800} onChange={(v) => onInputChange('column_load', v)} />
      <NumField label="Moment X (kNm)" value={inputs.moment_x ?? 0} onChange={(v) => onInputChange('moment_x', v)} />
      <NumField label="Moment Y (kNm)" value={inputs.moment_y ?? 0} onChange={(v) => onInputChange('moment_y', v)} />
      <NumField label="Soil Bearing Capacity (kN/m²)" value={inputs.soil_bearing ?? 150} onChange={(v) => onInputChange('soil_bearing', v)} />
      <NumField label="Soil Unit Weight (kN/m³)" value={inputs.soil_unit_weight ?? 18} onChange={(v) => onInputChange('soil_unit_weight', v)} />
      <NumField label="Foundation Embedment Depth (m)" value={inputs.foundation_depth ?? 1.2} onChange={(v) => onInputChange('foundation_depth', v)} />
      {ftype === 'strip' && (
        <>
          <NumField label="Foundation Width (m)" value={inputs.foundation_width ?? 1.2} onChange={(v) => onInputChange('foundation_width', v)} />
          <NumField label="Foundation Length (m per run)" value={inputs.foundation_length ?? 1.0} onChange={(v) => onInputChange('foundation_length', v)} />
        </>
      )}
      <NumField label="Concrete Thickness (mm)" value={inputs.foundation_depth_concrete ?? 400} onChange={(v) => onInputChange('foundation_depth_concrete', v)} />
      <NumField label="Column Width (mm)" value={inputs.column_width ?? 300} onChange={(v) => onInputChange('column_width', v)} />
      <NumField label="Column Depth (mm)" value={inputs.column_depth ?? 300} onChange={(v) => onInputChange('column_depth', v)} />
      <SelectField label="Concrete Grade (fck)" value={String(inputs.fck ?? 25)} options={CONCRETE_GRADES} onChange={(v) => onInputChange('fck', v)} />
      <SelectField label="Steel Grade (fyk)" value={String(inputs.fyk ?? 500)} options={STEEL_GRADES} onChange={(v) => onInputChange('fyk', v)} />
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: unknown; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type="number"
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
  options: { value: string; label: string }[] | number[];
  onChange: (v: string | number) => void;
}) {
  const opts = Array.isArray(options) && typeof options[0] === 'number'
    ? (options as number[]).map((g) => ({ value: String(g), label: `${g} MPa` }))
    : (options as { value: string; label: string }[]);

  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          const num = Number(raw);
          onChange(Number.isNaN(num) ? raw : num);
        }}
        className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none focus:border-infra-highlight/60"
      >
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
