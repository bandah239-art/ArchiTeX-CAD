import type { CalculatorFormProps } from '../CalculatorTypes';
import { NumField } from '../FormElements';

const LOAD_TYPES = [
  { value: 'udl', label: 'UDL (kN/m)' },
  { value: 'area', label: 'Area Load (kN/m²)' },
];

const DESIGN_CODES = [
  { value: 'eurocode', label: 'Eurocode 0' },
  { value: 'aci318', label: 'ACI 318' },
];

const STRUCTURE_CLASSES = [
  { value: 'ordinary', label: 'Ordinary' },
  { value: 'importance_2', label: 'Importance Class 2' },
  { value: 'importance_3', label: 'Importance Class 3' },
];

export function LoadCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  const loadType = (inputs.load_type as string) ?? 'udl';
  const unit = loadType === 'udl' ? 'kN/m' : 'kN/m²';

  return (
    <div className="space-y-3">
      <SelectField label="Load Type" value={loadType} options={LOAD_TYPES} onChange={(v) => onInputChange('load_type', v)} />
      <NumField label={`Dead Load Gk (${unit})`} value={inputs.dead_load_g ?? 20} onChange={(v) => onInputChange('dead_load_g', v)} />
      <NumField label={`Imposed Load Qk (${unit})`} value={inputs.imposed_load_q ?? 15} onChange={(v) => onInputChange('imposed_load_q', v)} />
      <NumField label={`Wind Load Wk (${unit})`} value={inputs.wind_load_w ?? 5} onChange={(v) => onInputChange('wind_load_w', v)} />
      <NumField label={`Snow Load Sk (${unit})`} value={inputs.snow_load_s ?? 0} onChange={(v) => onInputChange('snow_load_s', v)} />
      <SelectField label="Design Code" value={(inputs.design_code as string) ?? 'eurocode'} options={DESIGN_CODES} onChange={(v) => onInputChange('design_code', v)} />
      <SelectField label="Structure Class" value={(inputs.structure_class as string) ?? 'ordinary'} options={STRUCTURE_CLASSES} onChange={(v) => onInputChange('structure_class', v)} />
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
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
