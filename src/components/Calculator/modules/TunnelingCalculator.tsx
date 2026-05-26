import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import { api } from '../../../services/api';

interface TunnelingCalculatorProps {
  inputs: Record<string, any>;
  onInputChange: (key: string, value: any) => void;
}

export function TunnelingCalculator({ inputs, onInputChange }: TunnelingCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  const handleCalculate = async () => {
    runCalculation(async () => {
      const payload = {
        rqd_percent: inputs.rqd_percent || 60,
        joint_spacing_rating: inputs.joint_spacing_rating || 10,
        joint_condition_rating: inputs.joint_condition_rating || 12,
        groundwater_rating: inputs.groundwater_rating || 10,
        intact_rock_strength_mpa: inputs.intact_rock_strength_mpa || 50
      };
      
      const res = await api.post('/geo/tunneling', payload);
      return {
        status: res.rmr_score < 40 ? 'warning' : 'pass',
        summary: res,
        steps: [
          {
            step_number: 1,
            title: 'Rock Mass Rating (RMR)',
            formula: 'Sum of 5 Parameters',
            substitution: `RQD, Strength, Spacing, Condition, Water`,
            result: `${res.rmr_score} / 100`,
            unit: 'RMR',
            reference: 'Bieniawski (1989)'
          },
          {
            step_number: 2,
            title: 'Rock Classification',
            formula: 'Based on RMR Score',
            substitution: `Score: ${res.rmr_score}`,
            result: `${res.rock_class}`,
            unit: '',
            reference: 'Geomechanics Classification'
          },
          {
            step_number: 3,
            title: 'Recommended Tunnel Support',
            formula: 'Empirical Guidelines',
            substitution: `Class: ${res.rock_class}`,
            result: `${res.recommended_support}`,
            unit: '',
            reference: 'Underground Excavation'
          }
        ],
        warnings: res.rmr_score < 40 ? ['Poor rock conditions. Heavy tunnel support and pre-support may be required.'] : [],
        errors: [],
        timestamp: new Date().toISOString()
      };
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <InputGroup
          label="Rock Quality Designation (RQD)"
          value={inputs.rqd_percent || 60}
          onChange={(v) => onInputChange('rqd_percent', Number(v))}
          type="number"
          unit="%"
        />
        <InputGroup
          label="Intact Rock Strength (UCS)"
          value={inputs.intact_rock_strength_mpa || 50}
          onChange={(v) => onInputChange('intact_rock_strength_mpa', Number(v))}
          type="number"
          unit="MPa"
        />
        <InputGroup
          label="Joint Spacing Rating (0-20)"
          value={inputs.joint_spacing_rating || 10}
          onChange={(v) => onInputChange('joint_spacing_rating', Number(v))}
          type="number"
          unit=""
        />
        <InputGroup
          label="Joint Condition Rating (0-30)"
          value={inputs.joint_condition_rating || 12}
          onChange={(v) => onInputChange('joint_condition_rating', Number(v))}
          type="number"
          unit=""
        />
        <InputGroup
          label="Groundwater Rating (0-15)"
          value={inputs.groundwater_rating || 10}
          onChange={(v) => onInputChange('groundwater_rating', Number(v))}
          type="number"
          unit=""
        />
      </div>

      <Button onClick={handleCalculate} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Calculate RMR & Tunnel Support'}
      </Button>
    </div>
  );
}
