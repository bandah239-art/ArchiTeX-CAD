import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';

interface TransmissionCalculatorProps {
  inputs: Record<string, unknown>;
  onInputChange: (key: string, value: unknown) => void;
}

export function TransmissionCalculator({ inputs, onInputChange }: TransmissionCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <InputGroup
          label="Span Length"
          value={(inputs.span_length_m as number) || 50}
          onChange={(v) => onInputChange('span_length_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="Conductor Weight"
          value={(inputs.conductor_weight_kg_m as number) || 1.5}
          onChange={(v) => onInputChange('conductor_weight_kg_m', Number(v))}
          type="number"
          unit="kg/m"
        />
        <InputGroup
          label="Max Tension"
          value={(inputs.max_tension_kg as number) || 2000}
          onChange={(v) => onInputChange('max_tension_kg', Number(v))}
          type="number"
          unit="kg"
        />
        <InputGroup
          label="Required Ground Clearance"
          value={(inputs.ground_clearance_m as number) || 8.0}
          onChange={(v) => onInputChange('ground_clearance_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="Temperature (Worst Case)"
          value={(inputs.temperature_c as number) || 40}
          onChange={(v) => onInputChange('temperature_c', Number(v))}
          type="number"
          unit="°C"
        />
      </div>

      <Button onClick={() => void runCalculation()} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Calculate Sag-Tension'}
      </Button>
    </div>
  );
}
