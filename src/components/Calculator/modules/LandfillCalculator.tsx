import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
interface LandfillCalculatorProps {
  inputs: Record<string, unknown>;
  onInputChange: (key: string, value: unknown) => void;
}

export function LandfillCalculator({ inputs, onInputChange }: LandfillCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <InputGroup
          label="Population Served"
          value={(inputs.population as number) || 50000}
          onChange={(v) => onInputChange('population', Number(v))}
          type="number"
          unit="people"
        />
        <InputGroup
          label="Waste Generation Rate"
          value={(inputs.waste_generation_kg_capita_day as number) || 1.2}
          onChange={(v) => onInputChange('waste_generation_kg_capita_day', Number(v))}
          type="number"
          unit="kg/c/day"
        />
        <InputGroup
          label="Design Life"
          value={(inputs.design_life_years as number) || 20}
          onChange={(v) => onInputChange('design_life_years', Number(v))}
          type="number"
          unit="years"
        />
        <InputGroup
          label="Compacted Waste Density"
          value={(inputs.compacted_waste_density_kg_m3 as number) || 800}
          onChange={(v) => onInputChange('compacted_waste_density_kg_m3', Number(v))}
          type="number"
          unit="kg/m³"
        />
      </div>

      <Button onClick={() => void runCalculation()} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Size Sanitary Landfill'}
      </Button>
    </div>
  );
}
