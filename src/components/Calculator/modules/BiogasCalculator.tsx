import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import { EnergyExtendedPanel } from '../../Energy/EnergyExtendedPanel';
interface BiogasCalculatorProps {
  inputs: Record<string, unknown>;
  onInputChange: (key: string, value: unknown) => void;
}

export function BiogasCalculator({ inputs, onInputChange }: BiogasCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <InputGroup
          label="Cattle Count"
          value={(inputs.cattle_count as number) || 50}
          onChange={(v) => onInputChange('cattle_count', Number(v))}
          type="number"
          unit="head"
        />
        <InputGroup
          label="Poultry Count"
          value={(inputs.poultry_count as number) || 0}
          onChange={(v) => onInputChange('poultry_count', Number(v))}
          type="number"
          unit="birds"
        />
        <InputGroup
          label="Human Count"
          value={(inputs.human_count as number) || 10}
          onChange={(v) => onInputChange('human_count', Number(v))}
          type="number"
          unit="people"
        />
        <InputGroup
          label="Average Ambient Temp"
          value={(inputs.temperature_c as number) || 25}
          onChange={(v) => onInputChange('temperature_c', Number(v))}
          type="number"
          unit="°C"
        />
      </div>

      <Button onClick={() => void runCalculation()} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Size Biogas Digester'}
      </Button>
      <EnergyExtendedPanel inputs={inputs} />
    </div>
  );
}
