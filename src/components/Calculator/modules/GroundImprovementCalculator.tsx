import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
interface GroundImprovementCalculatorProps {
  inputs: Record<string, unknown>;
  onInputChange: (key: string, value: unknown) => void;
}

export function GroundImprovementCalculator({ inputs, onInputChange }: GroundImprovementCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <InputGroup
          label="Area to Improve"
          value={(inputs.area_to_improve_m2 as number) || 1000}
          onChange={(v) => onInputChange('area_to_improve_m2', Number(v))}
          type="number"
          unit="m²"
        />
        <InputGroup
          label="Column Diameter"
          value={(inputs.column_diameter_m as number) || 0.8}
          onChange={(v) => onInputChange('column_diameter_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="Column Spacing"
          value={(inputs.column_spacing_m as number) || 2.0}
          onChange={(v) => onInputChange('column_spacing_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="Treatment Depth"
          value={(inputs.depth_m as number) || 8.0}
          onChange={(v) => onInputChange('depth_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="Grid Pattern"
          value={(inputs.pattern as string) || 'triangular'}
          onChange={(v) => onInputChange('pattern', v)}
          type="select"
          options={[
            { label: 'Triangular Grid', value: 'triangular' },
            { label: 'Square Grid', value: 'square' }
          ]}
        />
      </div>

      <Button onClick={() => void runCalculation()} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Design Stone Columns'}
      </Button>
    </div>
  );
}
