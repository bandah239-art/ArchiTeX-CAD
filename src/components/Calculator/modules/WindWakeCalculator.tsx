import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import { api } from '../../../services/api';

interface WindWakeCalculatorProps {
  inputs: Record<string, any>;
  onInputChange: (key: string, value: any) => void;
}

export function WindWakeCalculator({ inputs, onInputChange }: WindWakeCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  const handleCalculate = async () => {
    runCalculation(async () => {
      const payload = {
        turbine_rotor_diameter_m: inputs.turbine_rotor_diameter_m || 80,
        turbine_rating_kw: inputs.turbine_rating_kw || 2000,
        wind_speed_mps: inputs.wind_speed_mps || 12,
        rows: inputs.rows || 4,
        spacing_factor_d: inputs.spacing_factor_d || 5
      };
      
      const res = await api.post('/energy/wind-wake', payload);
      return {
        status: res.farm_efficiency_percent < 85 ? 'warning' : 'pass',
        summary: res,
        steps: [
          {
            step_number: 1,
            title: 'Ideal vs Actual Power',
            formula: 'Jensen Wake Model',
            substitution: `Ideal: ${res.total_ideal_power_kw} kW`,
            result: `Actual: ${res.total_actual_power_kw} kW`,
            unit: 'kW',
            reference: 'Aerodynamics'
          },
          {
            step_number: 2,
            title: 'Farm Efficiency',
            formula: '(Actual / Ideal) * 100',
            substitution: `Spacing: ${payload.spacing_factor_d}D`,
            result: `${res.farm_efficiency_percent}%`,
            unit: '%',
            reference: 'Wind Farm Design'
          }
        ],
        warnings: res.farm_efficiency_percent < 85 ? ['Significant aerodynamic wake losses. Consider increasing spacing distance.'] : [],
        errors: [],
        timestamp: new Date().toISOString()
      };
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <InputGroup
          label="Rotor Diameter (D)"
          value={inputs.turbine_rotor_diameter_m || 80}
          onChange={(v) => onInputChange('turbine_rotor_diameter_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="Turbine Rating"
          value={inputs.turbine_rating_kw || 2000}
          onChange={(v) => onInputChange('turbine_rating_kw', Number(v))}
          type="number"
          unit="kW"
        />
        <InputGroup
          label="Freestream Wind Speed"
          value={inputs.wind_speed_mps || 12}
          onChange={(v) => onInputChange('wind_speed_mps', Number(v))}
          type="number"
          unit="m/s"
        />
        <InputGroup
          label="Number of Rows"
          value={inputs.rows || 4}
          onChange={(v) => onInputChange('rows', Number(v))}
          type="number"
          unit="rows"
        />
        <InputGroup
          label="Spacing Factor"
          value={inputs.spacing_factor_d || 5}
          onChange={(v) => onInputChange('spacing_factor_d', Number(v))}
          type="number"
          unit="x D"
        />
      </div>

      <Button onClick={handleCalculate} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Analyze Wake Effect'}
      </Button>
    </div>
  );
}
