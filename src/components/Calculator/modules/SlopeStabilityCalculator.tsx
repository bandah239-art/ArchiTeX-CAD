import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import { api } from '../../../services/api';

interface SlopeStabilityCalculatorProps {
  inputs: Record<string, any>;
  onInputChange: (key: string, value: any) => void;
}

export function SlopeStabilityCalculator({ inputs, onInputChange }: SlopeStabilityCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  const handleCalculate = async () => {
    runCalculation(async () => {
      const payload = {
        slope_angle_degrees: inputs.slope_angle_degrees || 30,
        soil_cohesion_kpa: inputs.soil_cohesion_kpa || 20,
        friction_angle_degrees: inputs.friction_angle_degrees || 25,
        soil_unit_weight_kn_m3: inputs.soil_unit_weight_kn_m3 || 18,
        slope_height_m: inputs.slope_height_m || 10
      };
      
      const res = await api.post('/geo/slope', payload);
      return {
        status: res.status, // "safe", "warning", "unsafe"
        summary: res,
        steps: [
          {
            step_number: 1,
            title: 'Cohesive Contribution',
            formula: 'c / (gamma * H * cos²(B) * tan(B))',
            substitution: `c = ${payload.soil_cohesion_kpa} kPa`,
            result: `${res.cohesive_contribution} (FS part 1)`,
            unit: '',
            reference: 'Infinite Slope Model'
          },
          {
            step_number: 2,
            title: 'Frictional Contribution',
            formula: 'tan(phi) / tan(beta)',
            substitution: `phi = ${payload.friction_angle_degrees}°, beta = ${payload.slope_angle_degrees}°`,
            result: `${res.frictional_contribution} (FS part 2)`,
            unit: '',
            reference: 'Infinite Slope Model'
          },
          {
            step_number: 3,
            title: 'Factor of Safety',
            formula: 'FS = Cohesive + Frictional',
            substitution: `FS >= 1.5 is safe`,
            result: `${res.factor_of_safety}`,
            unit: 'FS',
            reference: 'Geotechnical Standards'
          }
        ],
        warnings: res.status !== 'safe' ? ['Slope is potentially unstable. Retaining structures recommended.'] : [],
        errors: [],
        timestamp: new Date().toISOString()
      };
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <InputGroup
          label="Slope Angle (beta)"
          value={inputs.slope_angle_degrees || 30}
          onChange={(v) => onInputChange('slope_angle_degrees', Number(v))}
          type="number"
          unit="°"
        />
        <InputGroup
          label="Slope Height (H)"
          value={inputs.slope_height_m || 10}
          onChange={(v) => onInputChange('slope_height_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="Soil Cohesion (c')"
          value={inputs.soil_cohesion_kpa || 20}
          onChange={(v) => onInputChange('soil_cohesion_kpa', Number(v))}
          type="number"
          unit="kPa"
        />
        <InputGroup
          label="Friction Angle (phi')"
          value={inputs.friction_angle_degrees || 25}
          onChange={(v) => onInputChange('friction_angle_degrees', Number(v))}
          type="number"
          unit="°"
        />
        <InputGroup
          label="Unit Weight (gamma)"
          value={inputs.soil_unit_weight_kn_m3 || 18}
          onChange={(v) => onInputChange('soil_unit_weight_kn_m3', Number(v))}
          type="number"
          unit="kN/m³"
        />
      </div>

      <Button onClick={handleCalculate} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Analyze Slope Stability'}
      </Button>
    </div>
  );
}
