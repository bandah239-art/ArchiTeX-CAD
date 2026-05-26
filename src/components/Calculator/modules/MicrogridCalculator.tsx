import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';

interface MicrogridCalculatorProps {
  inputs: Record<string, unknown>;
  onInputChange: (key: string, value: unknown) => void;
}

export function MicrogridCalculator({ inputs, onInputChange }: MicrogridCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <InputGroup
          label="Cable Length"
          value={(inputs.cable_length_m as number) || 250}
          onChange={(v) => onInputChange('cable_length_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="Load Current"
          value={(inputs.load_current_amps as number) || 45}
          onChange={(v) => onInputChange('load_current_amps', Number(v))}
          type="number"
          unit="A"
        />
        <InputGroup
          label="System Voltage"
          value={(inputs.system_voltage as number) || 230}
          onChange={(v) => onInputChange('system_voltage', Number(v))}
          type="number"
          unit="V"
        />
        <InputGroup
          label="Cable Material"
          value={(inputs.cable_material as string) || 'aluminum'}
          onChange={(v) => onInputChange('cable_material', v)}
          type="select"
          options={[
            { label: 'Aluminum', value: 'aluminum' },
            { label: 'Copper', value: 'copper' },
          ]}
        />
        <InputGroup
          label="Max Voltage Drop"
          value={(inputs.max_voltage_drop_percent as number) || 5}
          onChange={(v) => onInputChange('max_voltage_drop_percent', Number(v))}
          type="number"
          unit="%"
        />
      </div>

      <Button onClick={() => void runCalculation()} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Size Microgrid Cable'}
      </Button>
    </div>
  );
}
