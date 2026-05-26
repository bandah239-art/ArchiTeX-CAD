import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import { EnergySimulationPanel } from '../../Energy/EnergySimulationPanel';
interface WindWakeCalculatorProps {
  inputs: Record<string, unknown>;
  onInputChange: (key: string, value: unknown) => void;
}

export function WindWakeCalculator({ inputs, onInputChange }: WindWakeCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <InputGroup
          label="Rotor Diameter (D)"
          value={(inputs.turbine_rotor_diameter_m as number) || 80}
          onChange={(v) => onInputChange('turbine_rotor_diameter_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="Turbine Rating"
          value={(inputs.turbine_rating_kw as number) || 2000}
          onChange={(v) => onInputChange('turbine_rating_kw', Number(v))}
          type="number"
          unit="kW"
        />
        <InputGroup
          label="Freestream Wind Speed"
          value={(inputs.wind_speed_mps as number) || 12}
          onChange={(v) => onInputChange('wind_speed_mps', Number(v))}
          type="number"
          unit="m/s"
        />
        <InputGroup
          label="Number of Rows"
          value={(inputs.rows as number) || 4}
          onChange={(v) => onInputChange('rows', Number(v))}
          type="number"
          unit="rows"
        />
        <InputGroup
          label="Spacing Factor"
          value={(inputs.spacing_factor_d as number) || 5}
          onChange={(v) => onInputChange('spacing_factor_d', Number(v))}
          type="number"
          unit="x D"
        />
      </div>

      <Button onClick={() => void runCalculation()} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Analyze Wake Effect'}
      </Button>
      <EnergySimulationPanel inputs={inputs} />
    </div>
  );
}
