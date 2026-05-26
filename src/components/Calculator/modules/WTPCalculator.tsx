import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import { api } from '../../../services/api';

interface WTPCalculatorProps {
  inputs: Record<string, any>;
  onInputChange: (key: string, value: any) => void;
}

export function WTPCalculator({ inputs, onInputChange }: WTPCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  const handleCalculate = async () => {
    runCalculation(async () => {
      const payload = {
        flow_rate_m3_d: inputs.flow_rate_m3_d || 5000,
        turbidity_ntu: inputs.turbidity_ntu || 50
      };
      
      const res = await api.post('/wash/wtp', payload);
      return {
        status: 'pass',
        summary: res,
        steps: [
          {
            step_number: 1,
            title: 'Clarifier Sizing',
            formula: 'Area = Flow / SOR',
            substitution: `SOR = 25 m³/m²/day`,
            result: `Dia: ${res.clarifier_diameter_m}m, Depth: ${res.clarifier_depth_m}m`,
            unit: 'm',
            reference: 'Sedimentation'
          },
          {
            step_number: 2,
            title: 'Rapid Sand Filter',
            formula: 'Area = Flow / Filtration Rate',
            substitution: `Rate = 120 m³/m²/day`,
            result: `${res.filter_beds_count} Beds (${res.area_per_bed_m2} m² each)`,
            unit: 'm²',
            reference: 'Filtration'
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
          label="Daily Flow Rate"
          value={inputs.flow_rate_m3_d || 5000}
          onChange={(v) => onInputChange('flow_rate_m3_d', Number(v))}
          type="number"
          unit="m³/d"
        />
        <InputGroup
          label="Raw Water Turbidity"
          value={inputs.turbidity_ntu || 50}
          onChange={(v) => onInputChange('turbidity_ntu', Number(v))}
          type="number"
          unit="NTU"
        />
      </div>

      <Button onClick={handleCalculate} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Size Water Treatment Plant'}
      </Button>
    </div>
  );
}
