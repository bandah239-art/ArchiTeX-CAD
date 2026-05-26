import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import { api } from '../../../services/api';

interface BiogasCalculatorProps {
  inputs: Record<string, any>;
  onInputChange: (key: string, value: any) => void;
}

export function BiogasCalculator({ inputs, onInputChange }: BiogasCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  const handleCalculate = async () => {
    runCalculation(async () => {
      const payload = {
        cattle_count: inputs.cattle_count || 50,
        poultry_count: inputs.poultry_count || 0,
        human_count: inputs.human_count || 10,
        temperature_c: inputs.temperature_c || 25
      };
      
      const res = await api.post('/energy/biogas', payload);
      return {
        status: 'pass',
        summary: res,
        steps: [
          {
            step_number: 1,
            title: 'Biogas Yield',
            formula: 'Waste (kg) * Yield Factor',
            substitution: `${res.total_waste_kg_day} kg/day processing`,
            result: `${res.biogas_yield_m3_day} m³/day`,
            unit: 'm³',
            reference: 'Biomass Engineering'
          },
          {
            step_number: 2,
            title: 'Energy Equivalent',
            formula: 'Biogas (m³) * 6 kWh/m³',
            substitution: `${res.biogas_yield_m3_day} * 6`,
            result: `${res.energy_kwh_day} kWh/day`,
            unit: 'kWh',
            reference: 'Energy Conversion'
          },
          {
            step_number: 3,
            title: 'Digester Dome Sizing',
            formula: 'Active Vol * 1.2 (Gas Storage)',
            substitution: `HRT & Temp dependent`,
            result: `${res.digester_volume_m3} m³`,
            unit: 'm³',
            reference: 'Fixed-Dome Design'
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
          label="Cattle Count"
          value={inputs.cattle_count || 50}
          onChange={(v) => onInputChange('cattle_count', Number(v))}
          type="number"
          unit="head"
        />
        <InputGroup
          label="Poultry Count"
          value={inputs.poultry_count || 0}
          onChange={(v) => onInputChange('poultry_count', Number(v))}
          type="number"
          unit="birds"
        />
        <InputGroup
          label="Human Count"
          value={inputs.human_count || 10}
          onChange={(v) => onInputChange('human_count', Number(v))}
          type="number"
          unit="people"
        />
        <InputGroup
          label="Average Ambient Temp"
          value={inputs.temperature_c || 25}
          onChange={(v) => onInputChange('temperature_c', Number(v))}
          type="number"
          unit="°C"
        />
      </div>

      <Button onClick={handleCalculate} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Size Biogas Digester'}
      </Button>
    </div>
  );
}
