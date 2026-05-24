import type { CalculatorFormProps } from '../CalculatorTypes';

const EXPOSURE = [
  { value: 'B', label: 'B — Suburban' },
  { value: 'C', label: 'C — Open terrain' },
  { value: 'D', label: 'D — Coastal / flat unobstructed' },
];

export function WindCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  return (
    <div className="space-y-3">
      <NumField label="Basic wind speed Vb (m/s)" value={inputs.basic_wind_speed ?? 45} onChange={(v) => onInputChange('basic_wind_speed', v)} />
      <NumField label="Building height (m)" value={inputs.building_height ?? 12} onChange={(v) => onInputChange('building_height', v)} />
      <NumField label="Building width B (m)" value={inputs.building_width ?? 20} onChange={(v) => onInputChange('building_width', v)} />
      <NumField label="Building length L (m)" value={inputs.building_length ?? 30} onChange={(v) => onInputChange('building_length', v)} />
      <SelectField label="Exposure category" value={(inputs.exposure_category as string) ?? 'B'} options={EXPOSURE} onChange={(v) => onInputChange('exposure_category', v)} />
      <p className="text-[10px] text-gray-500">ASCE 7-22 / SANS 10160-3 MWFRS wind pressures and base shear.</p>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: unknown; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input type="number" value={value as number} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none focus:border-infra-highlight/60" />
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none focus:border-infra-highlight/60">
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
