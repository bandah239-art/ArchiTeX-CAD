import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import { GeoSimulationPanel } from '../../Geo/GeoSimulationPanel';
interface ConsolidationCalculatorProps {
  inputs: Record<string, unknown>;
  onInputChange: (key: string, value: unknown) => void;
}

export function ConsolidationCalculator({ inputs, onInputChange }: ConsolidationCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <InputGroup
          label="Clay Layer Thickness (H)"
          value={(inputs.clay_thickness_m as number) || 5}
          onChange={(v) => onInputChange('clay_thickness_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="Initial Void Ratio (e0)"
          value={(inputs.initial_void_ratio as number) || 0.8}
          onChange={(v) => onInputChange('initial_void_ratio', Number(v))}
          type="number"
          unit=""
        />
        <InputGroup
          label="Compression Index (Cc)"
          value={(inputs.compression_index_cc as number) || 0.25}
          onChange={(v) => onInputChange('compression_index_cc', Number(v))}
          type="number"
          unit=""
        />
        <InputGroup
          label="Initial Effective Stress"
          value={(inputs.initial_effective_stress_kpa as number) || 100}
          onChange={(v) => onInputChange('initial_effective_stress_kpa', Number(v))}
          type="number"
          unit="kPa"
        />
        <InputGroup
          label="Added Stress (Delta Sigma)"
          value={(inputs.added_stress_kpa as number) || 50}
          onChange={(v) => onInputChange('added_stress_kpa', Number(v))}
          type="number"
          unit="kPa"
        />
      </div>

      <Button onClick={() => void runCalculation()} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Calculate Soil Settlement'}
      </Button>
      <GeoSimulationPanel inputs={inputs} />
    </div>
  );
}
