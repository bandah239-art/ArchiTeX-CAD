import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
interface IrrigationCalculatorProps {
  inputs: Record<string, unknown>;
  onInputChange: (key: string, value: unknown) => void;
}

export function IrrigationCalculator({ inputs, onInputChange }: IrrigationCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <InputGroup
          label="Crop Area"
          value={(inputs.crop_area_ha as number) || 50}
          onChange={(v) => onInputChange('crop_area_ha', Number(v))}
          type="number"
          unit="Hectares"
        />
        <InputGroup
          label="Crop Coefficient (Kc)"
          value={(inputs.crop_coefficient_kc as number) || 1.1}
          onChange={(v) => onInputChange('crop_coefficient_kc', Number(v))}
          type="number"
          unit=""
        />
        <InputGroup
          label="Reference ET (ET0)"
          value={(inputs.reference_evapotranspiration_mm_day as number) || 6}
          onChange={(v) => onInputChange('reference_evapotranspiration_mm_day', Number(v))}
          type="number"
          unit="mm/day"
        />
        <InputGroup
          label="Irrigation Efficiency"
          value={(inputs.irrigation_efficiency as number) || 0.85}
          onChange={(v) => onInputChange('irrigation_efficiency', Number(v))}
          type="number"
          unit="ratio"
        />
      </div>

      <Button onClick={() => void runCalculation()} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Calculate Irrigation'}
      </Button>
    </div>
  );
}
