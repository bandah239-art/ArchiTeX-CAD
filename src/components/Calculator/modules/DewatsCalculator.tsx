import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';

interface DewatsCalculatorProps {
  inputs: Record<string, unknown>;
  onInputChange: (key: string, value: unknown) => void;
}

export function DewatsCalculator({ inputs, onInputChange }: DewatsCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <InputGroup
          label="Population Served"
          value={(inputs.population as number) || 200}
          onChange={(v) => onInputChange('population', Number(v))}
          type="number"
          unit="people"
        />
        <InputGroup
          label="Wastewater Generation"
          value={(inputs.wastewater_generation_lps_capita as number) || 40}
          onChange={(v) => onInputChange('wastewater_generation_lps_capita', Number(v))}
          type="number"
          unit="L/c/d"
        />
        <InputGroup
          label="Influent BOD"
          value={(inputs.influent_bod_mg_l as number) || 300}
          onChange={(v) => onInputChange('influent_bod_mg_l', Number(v))}
          type="number"
          unit="mg/L"
        />
        <InputGroup
          label="Design Temperature"
          value={(inputs.temperature_c as number) || 25}
          onChange={(v) => onInputChange('temperature_c', Number(v))}
          type="number"
          unit="°C"
        />
      </div>

      <Button onClick={() => void runCalculation()} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Size DEWATS Facility'}
      </Button>
    </div>
  );
}
