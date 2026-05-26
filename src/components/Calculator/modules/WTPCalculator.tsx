import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
interface WTPCalculatorProps {
  inputs: Record<string, unknown>;
  onInputChange: (key: string, value: unknown) => void;
}

export function WTPCalculator({ inputs, onInputChange }: WTPCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <InputGroup
          label="Daily Flow Rate"
          value={(inputs.flow_rate_m3_d as number) || 5000}
          onChange={(v) => onInputChange('flow_rate_m3_d', Number(v))}
          type="number"
          unit="m³/d"
        />
        <InputGroup
          label="Raw Water Turbidity"
          value={(inputs.turbidity_ntu as number) || 50}
          onChange={(v) => onInputChange('turbidity_ntu', Number(v))}
          type="number"
          unit="NTU"
        />
      </div>

      <Button onClick={() => void runCalculation()} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Size Water Treatment Plant'}
      </Button>
    </div>
  );
}
