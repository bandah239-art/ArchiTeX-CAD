import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import { api } from '../../../services/api';

interface GroundImprovementCalculatorProps {
  inputs: Record<string, any>;
  onInputChange: (key: string, value: any) => void;
}

export function GroundImprovementCalculator({ inputs, onInputChange }: GroundImprovementCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  const handleCalculate = async () => {
    runCalculation(async () => {
      const payload = {
        area_to_improve_m2: inputs.area_to_improve_m2 || 1000,
        column_diameter_m: inputs.column_diameter_m || 0.8,
        column_spacing_m: inputs.column_spacing_m || 2.0,
        pattern: inputs.pattern || 'triangular',
        depth_m: inputs.depth_m || 8.0
      };
      
      const res = await api.post('/geo/ground-improvement', payload);
      return {
        status: 'pass',
        summary: res,
        steps: [
          {
            step_number: 1,
            title: 'Area Replacement Ratio',
            formula: 'As / A_tributary',
            substitution: `Spacing: ${payload.column_spacing_m}m (${payload.pattern})`,
            result: `${res.replacement_ratio_percent}%`,
            unit: '%',
            reference: 'Vibro-Replacement Design'
          },
          {
            step_number: 2,
            title: 'Number of Columns',
            formula: 'Total Area / Tributary Area',
            substitution: `1000 m² / Tributary Area`,
            result: `${res.number_of_columns} Columns`,
            unit: '',
            reference: 'Grid Layout'
          },
          {
            step_number: 3,
            title: 'Stone Material Requirement',
            formula: 'Volume * 1.15 (Wastage)',
            substitution: `Depth = ${payload.depth_m}m`,
            result: `${res.total_stone_volume_m3} m³`,
            unit: 'm³',
            reference: 'Construction Estimating'
          }
        ],
        warnings: [],
        errors: [],
        timestamp: new Date().toISOString()
      };
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <InputGroup
          label="Area to Improve"
          value={inputs.area_to_improve_m2 || 1000}
          onChange={(v) => onInputChange('area_to_improve_m2', Number(v))}
          type="number"
          unit="m²"
        />
        <InputGroup
          label="Column Diameter"
          value={inputs.column_diameter_m || 0.8}
          onChange={(v) => onInputChange('column_diameter_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="Column Spacing"
          value={inputs.column_spacing_m || 2.0}
          onChange={(v) => onInputChange('column_spacing_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="Treatment Depth"
          value={inputs.depth_m || 8.0}
          onChange={(v) => onInputChange('depth_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="Grid Pattern"
          value={inputs.pattern || 'triangular'}
          onChange={(v) => onInputChange('pattern', v)}
          type="select"
          options={[
            { label: 'Triangular Grid', value: 'triangular' },
            { label: 'Square Grid', value: 'square' }
          ]}
        />
      </div>

      <Button onClick={handleCalculate} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Design Stone Columns'}
      </Button>
    </div>
  );
}
