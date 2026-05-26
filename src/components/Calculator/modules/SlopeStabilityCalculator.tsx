import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import { GeoSimulationPanel } from '../../Geo/GeoSimulationPanel';
interface SlopeStabilityCalculatorProps {
  inputs: Record<string, unknown>;
  onInputChange: (key: string, value: unknown) => void;
}

export function SlopeStabilityCalculator({ inputs, onInputChange }: SlopeStabilityCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <InputGroup
          label="Slope Angle (beta)"
          value={(inputs.slope_angle_degrees as number) || 30}
          onChange={(v) => onInputChange('slope_angle_degrees', Number(v))}
          type="number"
          unit="°"
        />
        <InputGroup
          label="Slope Height (H)"
          value={(inputs.slope_height_m as number) || 10}
          onChange={(v) => onInputChange('slope_height_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="Soil Cohesion (c')"
          value={(inputs.soil_cohesion_kpa as number) || 20}
          onChange={(v) => onInputChange('soil_cohesion_kpa', Number(v))}
          type="number"
          unit="kPa"
        />
        <InputGroup
          label="Friction Angle (phi')"
          value={(inputs.friction_angle_degrees as number) || 25}
          onChange={(v) => onInputChange('friction_angle_degrees', Number(v))}
          type="number"
          unit="°"
        />
        <InputGroup
          label="Unit Weight (gamma)"
          value={(inputs.soil_unit_weight_kn_m3 as number) || 18}
          onChange={(v) => onInputChange('soil_unit_weight_kn_m3', Number(v))}
          type="number"
          unit="kN/m³"
        />
      </div>

      <Button onClick={() => void runCalculation()} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Analyze Slope Stability'}
      </Button>
      <GeoSimulationPanel inputs={inputs} />
    </div>
  );
}
