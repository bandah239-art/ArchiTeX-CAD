import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import { EnergyExtendedPanel } from '../../Energy/EnergyExtendedPanel';

interface GridFaultCalculatorProps {
  inputs: Record<string, unknown>;
  onInputChange: (key: string, value: unknown) => void;
}

export function GridFaultCalculator({ inputs, onInputChange }: GridFaultCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <InputGroup
          label="Generator Capacity"
          value={(inputs.generator_kva as number) || 1000}
          onChange={(v) => onInputChange('generator_kva', Number(v))}
          type="number"
          unit="kVA"
        />
        <InputGroup
          label="System Voltage"
          value={(inputs.generator_voltage_v as number) || 400}
          onChange={(v) => onInputChange('generator_voltage_v', Number(v))}
          type="number"
          unit="V"
        />
        <InputGroup
          label={'Gen Subtransient Reactance (X"d)'}
          value={(inputs.generator_subtransient_reactance_pu as number) || 0.15}
          onChange={(v) => onInputChange('generator_subtransient_reactance_pu', Number(v))}
          type="number"
          unit="pu"
        />
        <InputGroup
          label="Cable Length to Fault"
          value={(inputs.cable_length_m as number) || 50}
          onChange={(v) => onInputChange('cable_length_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="Cable Resistance"
          value={(inputs.cable_resistance_ohm_km as number) || 0.16}
          onChange={(v) => onInputChange('cable_resistance_ohm_km', Number(v))}
          type="number"
          unit="Ohm/km"
        />
        <InputGroup
          label="Cable Reactance"
          value={(inputs.cable_reactance_ohm_km as number) || 0.08}
          onChange={(v) => onInputChange('cable_reactance_ohm_km', Number(v))}
          type="number"
          unit="Ohm/km"
        />
      </div>

      <Button onClick={() => void runCalculation()} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Calculate Fault Current'}
      </Button>
      <EnergyExtendedPanel inputs={inputs} />
    </div>
  );
}
