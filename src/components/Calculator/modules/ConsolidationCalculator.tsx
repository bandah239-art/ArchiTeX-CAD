import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import { api } from '../../../services/api';

interface ConsolidationCalculatorProps {
  inputs: Record<string, any>;
  onInputChange: (key: string, value: any) => void;
}

export function ConsolidationCalculator({ inputs, onInputChange }: ConsolidationCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  const handleCalculate = async () => {
    runCalculation(async () => {
      const payload = {
        clay_thickness_m: inputs.clay_thickness_m || 5,
        initial_void_ratio: inputs.initial_void_ratio || 0.8,
        compression_index_cc: inputs.compression_index_cc || 0.25,
        initial_effective_stress_kpa: inputs.initial_effective_stress_kpa || 100,
        added_stress_kpa: inputs.added_stress_kpa || 50
      };
      
      const res = await api.post('/geo/consolidation', payload);
      return {
        status: 'pass',
        summary: res,
        steps: [
          {
            step_number: 1,
            title: 'Primary Consolidation',
            formula: 'Sc = (Cc*H / (1+e0)) * log((s0 + ds) / s0)',
            substitution: `Cc=${payload.compression_index_cc}, H=${payload.clay_thickness_m}m, e0=${payload.initial_void_ratio}`,
            result: `${res.settlement_mm} mm`,
            unit: 'mm',
            reference: 'Terzaghi Theory'
          }
        ],
        warnings: res.settlement_mm > 25 ? ['Settlement exceeds 25mm limit. Deep foundations or ground improvement recommended.'] : [],
        errors: [],
        timestamp: new Date().toISOString()
      };
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <InputGroup
          label="Clay Layer Thickness (H)"
          value={inputs.clay_thickness_m || 5}
          onChange={(v) => onInputChange('clay_thickness_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="Initial Void Ratio (e0)"
          value={inputs.initial_void_ratio || 0.8}
          onChange={(v) => onInputChange('initial_void_ratio', Number(v))}
          type="number"
          unit=""
        />
        <InputGroup
          label="Compression Index (Cc)"
          value={inputs.compression_index_cc || 0.25}
          onChange={(v) => onInputChange('compression_index_cc', Number(v))}
          type="number"
          unit=""
        />
        <InputGroup
          label="Initial Effective Stress"
          value={inputs.initial_effective_stress_kpa || 100}
          onChange={(v) => onInputChange('initial_effective_stress_kpa', Number(v))}
          type="number"
          unit="kPa"
        />
        <InputGroup
          label="Added Stress (Delta Sigma)"
          value={inputs.added_stress_kpa || 50}
          onChange={(v) => onInputChange('added_stress_kpa', Number(v))}
          type="number"
          unit="kPa"
        />
      </div>

      <Button onClick={handleCalculate} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Calculate Soil Settlement'}
      </Button>
    </div>
  );
}
