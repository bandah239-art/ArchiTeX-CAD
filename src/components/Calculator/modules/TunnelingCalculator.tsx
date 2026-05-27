import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import { GeoMorePanel } from '../../Geo/GeoMorePanel';
interface TunnelingCalculatorProps {
  inputs: Record<string, unknown>;
  onInputChange: (key: string, value: unknown) => void;
}

export function TunnelingCalculator({ inputs, onInputChange }: TunnelingCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <InputGroup
          label="Rock Quality Designation (RQD)"
          value={(inputs.rqd_percent as number) || 60}
          onChange={(v) => onInputChange('rqd_percent', Number(v))}
          type="number"
          unit="%"
        />
        <InputGroup
          label="Intact Rock Strength (UCS)"
          value={(inputs.intact_rock_strength_mpa as number) || 50}
          onChange={(v) => onInputChange('intact_rock_strength_mpa', Number(v))}
          type="number"
          unit="MPa"
        />
        <InputGroup
          label="Joint Spacing Rating (0-20)"
          value={(inputs.joint_spacing_rating as number) || 10}
          onChange={(v) => onInputChange('joint_spacing_rating', Number(v))}
          type="number"
          unit=""
        />
        <InputGroup
          label="Joint Condition Rating (0-30)"
          value={(inputs.joint_condition_rating as number) || 12}
          onChange={(v) => onInputChange('joint_condition_rating', Number(v))}
          type="number"
          unit=""
        />
        <InputGroup
          label="Groundwater Rating (0-15)"
          value={(inputs.groundwater_rating as number) || 10}
          onChange={(v) => onInputChange('groundwater_rating', Number(v))}
          type="number"
          unit=""
        />
      </div>

      <Button onClick={() => void runCalculation()} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Calculate RMR & Tunnel Support'}
      </Button>
      <GeoMorePanel inputs={inputs} />
    </div>
  );
}
