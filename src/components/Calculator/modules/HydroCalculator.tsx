import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import { EnergySimulationPanel } from '../../Energy/EnergySimulationPanel';
interface HydroCalculatorProps {
  inputs: Record<string, unknown>;
  onInputChange: (key: string, value: unknown) => void;
}

export function HydroCalculator({ inputs, onInputChange }: HydroCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <InputGroup
          label="Flow Rate (Q)"
          value={(inputs.flow_rate_m3_s as number) || 5.0}
          onChange={(v) => onInputChange('flow_rate_m3_s', Number(v))}
          type="number"
          unit="m³/s"
        />
        <InputGroup
          label="Net Head (H)"
          value={(inputs.net_head_m as number) || 25.0}
          onChange={(v) => onInputChange('net_head_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="System Efficiency"
          value={(inputs.system_efficiency as number) || 0.85}
          onChange={(v) => onInputChange('system_efficiency', Number(v))}
          type="number"
          unit="eta"
        />
      </div>

      <Button onClick={() => void runCalculation()} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Calculate Hydro Power'}
      </Button>
      <EnergySimulationPanel inputs={inputs} />
    </div>
  );
}
