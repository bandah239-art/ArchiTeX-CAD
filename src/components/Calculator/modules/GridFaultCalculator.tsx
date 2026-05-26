import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import { api } from '../../../services/api';

interface GridFaultCalculatorProps {
  inputs: Record<string, any>;
  onInputChange: (key: string, value: any) => void;
}

export function GridFaultCalculator({ inputs, onInputChange }: GridFaultCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  const handleCalculate = async () => {
    runCalculation(async () => {
      const payload = {
        generator_kva: inputs.generator_kva || 1000,
        generator_voltage_v: inputs.generator_voltage_v || 400,
        generator_subtransient_reactance_pu: inputs.generator_subtransient_reactance_pu || 0.15,
        cable_length_m: inputs.cable_length_m || 50,
        cable_reactance_ohm_km: inputs.cable_reactance_ohm_km || 0.08,
        cable_resistance_ohm_km: inputs.cable_resistance_ohm_km || 0.16
      };
      
      const res = await api.post('/energy/grid-fault', payload);
      return {
        status: 'pass',
        summary: res,
        steps: [
          {
            step_number: 1,
            title: 'Base Full Load Current',
            formula: 'I = S / (sqrt(3) * V)',
            substitution: `${payload.generator_kva}kVA / (1.732 * ${payload.generator_voltage_v}V)`,
            result: `${res.full_load_current_amps} A`,
            unit: 'A',
            reference: 'Ohm Law'
          },
          {
            step_number: 2,
            title: '3-Phase Short Circuit Current',
            formula: 'I_sc = V_phase / Z_fault',
            substitution: `Subtransient Reactance: ${payload.generator_subtransient_reactance_pu} pu`,
            result: `${res.fault_current_ka} kA`,
            unit: 'kA',
            reference: 'IEC 60909'
          },
          {
            step_number: 3,
            title: 'Breaker Sizing',
            formula: 'Select Standard Size >= I_sc',
            substitution: `I_sc = ${res.fault_current_ka} kA`,
            result: `${res.recommended_breaker_ka} kA Rating`,
            unit: 'kA',
            reference: 'Switchgear Standards'
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
          label="Generator Capacity"
          value={inputs.generator_kva || 1000}
          onChange={(v) => onInputChange('generator_kva', Number(v))}
          type="number"
          unit="kVA"
        />
        <InputGroup
          label="System Voltage"
          value={inputs.generator_voltage_v || 400}
          onChange={(v) => onInputChange('generator_voltage_v', Number(v))}
          type="number"
          unit="V"
        />
        <InputGroup
          label="Gen Subtransient Reactance (X\"d)"
          value={inputs.generator_subtransient_reactance_pu || 0.15}
          onChange={(v) => onInputChange('generator_subtransient_reactance_pu', Number(v))}
          type="number"
          unit="pu"
        />
        <InputGroup
          label="Cable Length to Fault"
          value={inputs.cable_length_m || 50}
          onChange={(v) => onInputChange('cable_length_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="Cable Resistance"
          value={inputs.cable_resistance_ohm_km || 0.16}
          onChange={(v) => onInputChange('cable_resistance_ohm_km', Number(v))}
          type="number"
          unit="Ohm/km"
        />
        <InputGroup
          label="Cable Reactance"
          value={inputs.cable_reactance_ohm_km || 0.08}
          onChange={(v) => onInputChange('cable_reactance_ohm_km', Number(v))}
          type="number"
          unit="Ohm/km"
        />
      </div>

      <Button onClick={handleCalculate} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Calculate Fault Current'}
      </Button>
    </div>
  );
}
