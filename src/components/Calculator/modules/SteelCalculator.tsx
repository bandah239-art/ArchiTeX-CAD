import { useState } from 'react';
import type { CalculatorFormProps } from '../CalculatorTypes';
import { NumField } from '../FormElements';
import { SectionPicker } from '../../Sections/SectionPicker';

export function SteelCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setShowPicker((p) => !p)}
        className="w-full py-1.5 text-xs font-bold rounded border border-infra-highlight/50 text-infra-highlight hover:bg-infra-highlight/10 transition-colors"
      >
        {showPicker ? '▲ Hide' : '▼ Pick'} SANS Steel Section
      </button>

      {showPicker && (
        <SectionPicker
          onSectionSelect={({ Wpl, Aw, sectionName }) => {
            onInputChange('Wpl', Wpl);
            onInputChange('Aw', Aw);
            onInputChange('section_name', sectionName);
            setShowPicker(false);
          }}
        />
      )}

      {inputs.section_name != null && (
        <div className="px-2 py-1 bg-infra-highlight/10 border border-infra-highlight/30 rounded text-xs text-infra-highlight">
          Section: {inputs.section_name as string}
        </div>
      )}

      <NumField label="Span (m)" value={inputs.length ?? 5} onChange={(v) => onInputChange('length', v)} />
      <NumField label="Yield Strength fy (MPa)" value={inputs.fy ?? 275} onChange={(v) => onInputChange('fy', v)} />
      <NumField label="Design Load w (kN/m)" value={inputs.w ?? 20} onChange={(v) => onInputChange('w', v)} />
      <NumField label="Plastic Section Modulus Wpl (cm³)" value={inputs.Wpl ?? 721} onChange={(v) => onInputChange('Wpl', v)} />
      <NumField label="Shear Area Aw (cm²)" value={inputs.Aw ?? 22.8} onChange={(v) => onInputChange('Aw', v)} />
    </div>
  );
}
