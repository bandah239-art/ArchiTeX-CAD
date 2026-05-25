import type { CalculatorFormProps } from '../CalculatorTypes';
import { FormField } from '../FormElements';

export function TankCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-infra-darker/60 rounded border border-infra-accent/30">
        <h3 className="text-sm font-semibold text-white mb-4">Tank Pressure Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Tank Height (m)"
            type="number"
            value={(inputs.height as number) || 6}
            onChange={(val) => onInputChange('height', val)}
          />
          <FormField
            label="Tank Radius (m)"
            type="number"
            value={(inputs.radius as number) || 4}
            onChange={(val) => onInputChange('radius', val)}
          />
          <FormField
            label="Water Unit Weight γw (kN/m³)"
            type="number"
            value={(inputs.gamma_w as number) || 9.81}
            onChange={(val) => onInputChange('gamma_w', val)}
          />
          <FormField
            label="Wind Force (kN)"
            type="number"
            value={(inputs.wind_force as number) || 120}
            onChange={(val) => onInputChange('wind_force', val)}
          />
          <FormField
            label="Friction Coeff μ"
            type="number"
            value={(inputs.mu as number) || 0.5}
            onChange={(val) => onInputChange('mu', val)}
            step="0.1"
          />
          <FormField
            label="Tank Empty Weight (kN)"
            type="number"
            value={(inputs.tank_weight as number) || 800}
            onChange={(val) => onInputChange('tank_weight', val)}
          />
        </div>
      </div>
    </div>
  );
}
