import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import { RoadSimPanel } from '../../Road/RoadSimPanel';
interface StormwaterCalculatorProps {
  inputs: Record<string, unknown>;
  onInputChange: (key: string, value: unknown) => void;
}

export function StormwaterCalculator({ inputs, onInputChange }: StormwaterCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <InputGroup
          label="Catchment Area"
          value={(inputs.catchment_area_ha as number) || 10}
          onChange={(v) => onInputChange('catchment_area_ha', Number(v))}
          type="number"
          unit="Hectares"
        />
        <InputGroup
          label="Runoff Coefficient (C)"
          value={(inputs.runoff_coefficient as number) || 0.85}
          onChange={(v) => onInputChange('runoff_coefficient', Number(v))}
          type="number"
          unit=""
        />
        <InputGroup
          label="Rainfall Intensity"
          value={(inputs.rainfall_intensity_mm_hr as number) || 75}
          onChange={(v) => onInputChange('rainfall_intensity_mm_hr', Number(v))}
          type="number"
          unit="mm/hr"
        />
        <InputGroup
          label="Storm Duration"
          value={(inputs.duration_hours as number) || 2}
          onChange={(v) => onInputChange('duration_hours', Number(v))}
          type="number"
          unit="hours"
        />
      </div>

      <Button onClick={() => void runCalculation()} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Size Stormwater Pond'}
      </Button>
      <RoadSimPanel inputs={inputs} />
    </div>
  );
}
