import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import { GeoSimulationPanel } from '../../Geo/GeoSimulationPanel';
interface PilesCalculatorProps {
  inputs: Record<string, unknown>;
  onInputChange: (key: string, value: unknown) => void;
}

export function PilesCalculator({ inputs, onInputChange }: PilesCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <InputGroup
          label="Pile Diameter (D)"
          value={(inputs.pile_diameter_m as number) || 0.6}
          onChange={(v) => onInputChange('pile_diameter_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="Pile Length (L)"
          value={(inputs.pile_length_m as number) || 20}
          onChange={(v) => onInputChange('pile_length_m', Number(v))}
          type="number"
          unit="m"
        />
        <InputGroup
          label="Soil Cohesion (cu)"
          value={(inputs.soil_cohesion_kpa as number) || 50}
          onChange={(v) => onInputChange('soil_cohesion_kpa', Number(v))}
          type="number"
          unit="kPa"
        />
        <InputGroup
          label="Adhesion Factor (alpha)"
          value={(inputs.adhesion_factor_alpha as number) || 0.5}
          onChange={(v) => onInputChange('adhesion_factor_alpha', Number(v))}
          type="number"
          unit=""
        />
        <InputGroup
          label="Bearing Factor (Nc)"
          value={(inputs.end_bearing_capacity_factor_nc as number) || 9}
          onChange={(v) => onInputChange('end_bearing_capacity_factor_nc', Number(v))}
          type="number"
          unit=""
        />
        <InputGroup
          label="Factor of Safety"
          value={(inputs.factor_of_safety as number) || 2.5}
          onChange={(v) => onInputChange('factor_of_safety', Number(v))}
          type="number"
          unit=""
        />
      </div>

      <Button onClick={() => void runCalculation()} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Calculate Pile Capacity'}
      </Button>
      <GeoSimulationPanel inputs={inputs} />
    </div>
  );
}
