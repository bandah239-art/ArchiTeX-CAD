import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import { api } from '../../../services/api';

interface PilesCalculatorProps {
  inputs: Record<string, any>;
  onInputChange: (key: string, value: any) => void;
}

export function PilesCalculator({ inputs, onInputChange }: PilesCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  const handleCalculate = async () => {
    runCalculation(async () => {
      const payload = {
        pile_diameter_m: inputs.pile_diameter_m || 0.6,
        pile_length_m: inputs.pile_length_m || 20,
        soil_cohesion_kpa: inputs.soil_cohesion_kpa || 50,
        adhesion_factor_alpha: inputs.adhesion_factor_alpha || 0.5,
        end_bearing_capacity_factor_nc: inputs.end_bearing_capacity_factor_nc || 9,
        factor_of_safety: inputs.factor_of_safety || 2.5
      };
      
      const res = await api.post('/geo/piles', payload);
      return {
        status: 'pass',
        summary: res,
        steps: [
          {
            step_number: 1,
            title: 'Skin Friction (Shaft Resistance)',
            formula: 'Qs = alpha * cu * As',
            substitution: `As = pi * D * L`,
            result: `${res.shaft_resistance_kn} kN`,
            unit: 'kN',
            reference: 'Alpha Method'
          },
          {
            step_number: 2,
            title: 'End Bearing Resistance',
            formula: 'Qb = Nc * cu * Ab',
            substitution: `Ab = pi * D² / 4`,
            result: `${res.end_bearing_kn} kN`,
            unit: 'kN',
            reference: 'Bearing Capacity Theory'
          },
          {
            step_number: 3,
            title: 'Allowable Capacity',
            formula: 'Qall = (Qs + Qb) / FS',
            substitution: `FS = ${payload.factor_of_safety}`,
            result: `${res.allowable_capacity_kn} kN`,
            unit: 'kN',
            reference: 'Foundation Design'
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
          label="Pile Diameter (D)"
          value={inputs.pile_diameter_m || 0.6}
          onChange={(v) => onInputChange('pile_diameter_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="Pile Length (L)"
          value={inputs.pile_length_m || 20}
          onChange={(v) => onInputChange('pile_length_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="Soil Cohesion (cu)"
          value={inputs.soil_cohesion_kpa || 50}
          onChange={(v) => onInputChange('soil_cohesion_kpa', Number(v))}
          type="number"
          unit="kPa"
        />
        <InputGroup
          label="Adhesion Factor (alpha)"
          value={inputs.adhesion_factor_alpha || 0.5}
          onChange={(v) => onInputChange('adhesion_factor_alpha', Number(v))}
          type="number"
          unit=""
        />
        <InputGroup
          label="Bearing Factor (Nc)"
          value={inputs.end_bearing_capacity_factor_nc || 9}
          onChange={(v) => onInputChange('end_bearing_capacity_factor_nc', Number(v))}
          type="number"
          unit=""
        />
        <InputGroup
          label="Factor of Safety"
          value={inputs.factor_of_safety || 2.5}
          onChange={(v) => onInputChange('factor_of_safety', Number(v))}
          type="number"
          unit=""
        />
      </div>

      <Button onClick={handleCalculate} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Calculate Pile Capacity'}
      </Button>
    </div>
  );
}
