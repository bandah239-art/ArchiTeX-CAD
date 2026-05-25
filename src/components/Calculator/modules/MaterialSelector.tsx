import { type CalculatorFormProps } from '../../../types/calculations';
import { NumField, SelectField } from '../FormElements';

const STRUCTURE_TYPES = [
  { value: 'beam', label: 'Beam' },
  { value: 'column', label: 'Column' },
  { value: 'slab', label: 'Slab' },
  { value: 'wall', label: 'Wall' },
  { value: 'foundation', label: 'Foundation' },
  { value: 'bridge', label: 'Bridge' },
  { value: 'roof', label: 'Roof' },
  { value: 'truss', label: 'Truss' },
];

const EXPOSURE = [
  { value: 'internal', label: 'Internal (Dry)' },
  { value: 'external', label: 'External (Wet/Dry)' },
  { value: 'aggressive', label: 'Aggressive (Chemical/Industrial)' },
  { value: 'marine', label: 'Marine (Coastal)' },
];

const BUDGET = [
  { value: 'low', label: 'Low Budget / Economical' },
  { value: 'medium', label: 'Medium Budget / Standard' },
  { value: 'high', label: 'High Budget / Premium' },
];

const REGIONS = [
  { value: 'Zambia', label: 'Zambia' },
  { value: 'Kenya', label: 'Kenya' },
  { value: 'Ghana', label: 'Ghana' },
  { value: 'Global', label: 'Global (Generic)' },
];

export function MaterialSelector({ inputs, onInputChange }: CalculatorFormProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-200 border-b border-gray-700 pb-2">
        Material Selection Engine
      </h3>
      
      <SelectField
        label="Structure Type"
        value={(inputs.structure_type as string) ?? 'beam'}
        options={STRUCTURE_TYPES}
        onChange={(v) => onInputChange('structure_type', v)}
      />
      
      <div className="grid grid-cols-2 gap-4">
        <NumField
          label="Span (m)"
          value={inputs.span ?? 5.0}
          onChange={(v) => onInputChange('span', v)}
        />
        <NumField
          label="Design Load (kN/m or kPa)"
          value={inputs.load ?? 10.0}
          onChange={(v) => onInputChange('load', v)}
        />
      </div>

      <SelectField
        label="Environmental Exposure"
        value={(inputs.exposure as string) ?? 'internal'}
        options={EXPOSURE}
        onChange={(v) => onInputChange('exposure', v)}
      />

      <SelectField
        label="Project Budget"
        value={(inputs.budget as string) ?? 'medium'}
        options={BUDGET}
        onChange={(v) => onInputChange('budget', v)}
      />

      <SelectField
        label="Local Availability (Country)"
        value={(inputs.availability as string) ?? 'Zambia'}
        options={REGIONS}
        onChange={(v) => onInputChange('availability', v)}
      />
    </div>
  );
}
