import type { CalculatorFormProps } from '../CalculatorTypes';
import { NumField } from '../FormElements';

export function SteelCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  return (
    <div className="space-y-3">
      <NumField label="Span (m)" value={inputs.length ?? 5} onChange={(v) => onInputChange('length', v)} />
      <NumField label="Yield Strength (fy) [MPa]" value={inputs.fy ?? 275} onChange={(v) => onInputChange('fy', v)} />
      <NumField label="Design Load (kN/m)" value={inputs.w ?? 20} onChange={(v) => onInputChange('w', v)} />
      <NumField label="Plastic Section Modulus (Wpl) [cm³]" value={inputs.Wpl ?? 721} onChange={(v) => onInputChange('Wpl', v)} />
      <NumField label="Shear Area (Aw) [cm²]" value={inputs.Aw ?? 22.8} onChange={(v) => onInputChange('Aw', v)} />
    </div>
  );
}
