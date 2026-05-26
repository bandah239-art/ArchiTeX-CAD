import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import { api } from '../../../services/api';

interface HydroCalculatorProps {
  inputs: Record<string, any>;
  onInputChange: (key: string, value: any) => void;
}

export function HydroCalculator({ inputs, onInputChange }: HydroCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  const handleCalculate = async () => {
    runCalculation(async () => {
      const payload = {
        flow_rate_m3_s: inputs.flow_rate_m3_s || 5.0,
        net_head_m: inputs.net_head_m || 25.0,
        system_efficiency: inputs.system_efficiency || 0.85
      };
      
      const res = await api.post('/energy/hydro', payload);
      return {
        status: 'pass',
        summary: res,
        steps: [
          {
            step_number: 1,
            title: 'Hydro Power Potential',
            formula: 'P = rho * g * Q * H * eta',
            substitution: `1000 * 9.81 * ${payload.flow_rate_m3_s} * ${payload.net_head_m} * ${payload.system_efficiency}`,
            result: `${res.power_kw} kW`,
            unit: 'kW',
            reference: 'Fluid Mechanics'
          },
          {
            step_number: 2,
            title: 'Turbine Selection',
            formula: 'Based on Head (H)',
            substitution: `H = ${payload.net_head_m}m`,
            result: `${res.recommended_turbine}`,
            unit: '',
            reference: 'Hydro Engineering'
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
          label="Flow Rate (Q)"
          value={inputs.flow_rate_m3_s || 5.0}
          onChange={(v) => onInputChange('flow_rate_m3_s', Number(v))}
          type="number"
          unit="m³/s"
        />
        <InputGroup
          label="Net Head (H)"
          value={inputs.net_head_m || 25.0}
          onChange={(v) => onInputChange('net_head_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="System Efficiency"
          value={inputs.system_efficiency || 0.85}
          onChange={(v) => onInputChange('system_efficiency', Number(v))}
          type="number"
          unit="eta"
        />
      </div>

      <Button onClick={handleCalculate} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Calculate Hydro Power'}
      </Button>
    </div>
  );
}
