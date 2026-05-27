import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import { WashSimulationPanel } from '../../WASH/WashSimulationPanel';

interface WaterTowerCalculatorProps {
  inputs: Record<string, unknown>;
  onInputChange: (key: string, value: unknown) => void;
}

export function WaterTowerCalculator({ inputs, onInputChange }: WaterTowerCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <InputGroup
          label="Population Served"
          value={(inputs.population as number) || 500}
          onChange={(v) => onInputChange('population', Number(v))}
          type="number"
          unit="people"
        />
        <InputGroup
          label="Liters per Capita per Day"
          value={(inputs.liters_per_capita_day as number) || 50}
          onChange={(v) => onInputChange('liters_per_capita_day', Number(v))}
          type="number"
          unit="L/c/d"
        />
        <InputGroup
          label="Borehole Depth to Water"
          value={(inputs.borehole_depth_m as number) || 80}
          onChange={(v) => onInputChange('borehole_depth_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="Stanchion/Tower Height"
          value={(inputs.tower_height_m as number) || 12}
          onChange={(v) => onInputChange('tower_height_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="Pump Efficiency"
          value={(inputs.pump_efficiency as number) || 0.6}
          onChange={(v) => onInputChange('pump_efficiency', Number(v))}
          type="number"
          unit="eta"
        />
      </div>

      <Button onClick={() => void runCalculation()} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Size Water Tower & Pump'}
      </Button>
      <WashSimulationPanel inputs={inputs} />
    </div>
  );
}
