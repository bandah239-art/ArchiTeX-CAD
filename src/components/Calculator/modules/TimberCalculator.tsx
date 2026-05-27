import type { CalculatorFormProps } from '../CalculatorTypes';
import { NumField } from '../FormElements';

export function TimberCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  return (
    <div className="space-y-3">
      <NumField label="Span (m)" value={inputs.length ?? 4} onChange={(v) => onInputChange('length', v)} />
      <NumField label="Width (b) [mm]" value={inputs.b ?? 50} onChange={(v) => onInputChange('b', v)} />
      <NumField label="Depth (h) [mm]" value={inputs.h ?? 200} onChange={(v) => onInputChange('h', v)} />
      <NumField label="Bending Strength (fm,k) [MPa]" value={inputs.fm_k ?? 24} onChange={(v) => onInputChange('fm_k', v)} />
      <NumField label="Shear Strength (fv,k) [MPa]" value={inputs.fv_k ?? 4.0} onChange={(v) => onInputChange('fv_k', v)} />
      <NumField label="Mean Modulus of Elasticity (E0,mean) [MPa]" value={inputs.E0_mean ?? 11000} onChange={(v) => onInputChange('E0_mean', v)} />
      <NumField label="Modification Factor (k_mod)" value={inputs.k_mod ?? 0.8} onChange={(v) => onInputChange('k_mod', v)} />
      <NumField label="Design Load (ULS) [kN/m]" value={inputs.w ?? 5} onChange={(v) => onInputChange('w', v)} />
      <NumField label="Service Load (SLS) [kN/m]" value={inputs.w_sls ?? 3.5} onChange={(v) => onInputChange('w_sls', v)} />
    </div>
  );
}
