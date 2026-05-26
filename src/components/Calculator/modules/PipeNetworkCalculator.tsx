import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import type { CalculatorFormProps } from '../CalculatorTypes';

/** Hazen–Williams pipe sizing (EPANET-style) via /wash/epanet. */
export function PipeNetworkCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <InputGroup
          label="Design Flow Rate"
          value={(inputs.flow_rate_lps as number) ?? 25}
          onChange={(v) => onInputChange('flow_rate_lps', Number(v))}
          type="number"
          unit="L/s"
        />
        <InputGroup
          label="Pipe Run Length"
          value={(inputs.pipe_length_m as number) ?? 500}
          onChange={(v) => onInputChange('pipe_length_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="Pipe Material"
          value={(inputs.pipe_material as string) ?? 'HDPE'}
          onChange={(v) => onInputChange('pipe_material', v)}
          type="select"
          options={[
            { label: 'HDPE', value: 'HDPE' },
            { label: 'PVC', value: 'PVC' },
            { label: 'Steel', value: 'Steel' },
          ]}
        />
        <InputGroup
          label="Maximum Velocity"
          value={(inputs.max_velocity_mps as number) ?? 1.5}
          onChange={(v) => onInputChange('max_velocity_mps', Number(v))}
          type="number"
          unit="m/s"
        />
        <InputGroup
          label="Minimum Node Pressure"
          value={(inputs.min_pressure_m as number) ?? 10}
          onChange={(v) => onInputChange('min_pressure_m', Number(v))}
          type="number"
          unit="m"
        />
      </div>
      <Button onClick={() => runCalculation()} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'CALCULATE PIPE SIZE'}
      </Button>
    </div>
  );
}
