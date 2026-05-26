import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import { api } from '../../../services/api';

interface LandfillCalculatorProps {
  inputs: Record<string, any>;
  onInputChange: (key: string, value: any) => void;
}

export function LandfillCalculator({ inputs, onInputChange }: LandfillCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  const handleCalculate = async () => {
    runCalculation(async () => {
      const payload = {
        population: inputs.population || 50000,
        waste_generation_kg_capita_day: inputs.waste_generation_kg_capita_day || 1.2,
        design_life_years: inputs.design_life_years || 20,
        compacted_waste_density_kg_m3: inputs.compacted_waste_density_kg_m3 || 800
      };
      
      const res = await api.post('/wash/landfill', payload);
      return {
        status: 'pass',
        summary: res,
        steps: [
          {
            step_number: 1,
            title: 'Total Waste Generation',
            formula: 'Pop * kg/c/d * 365.25 * Years',
            substitution: `${payload.population} * ${payload.waste_generation_kg_capita_day} * ${payload.design_life_years}y`,
            result: `${res.total_waste_tonnes} Tonnes`,
            unit: 't',
            reference: 'Waste Management'
          },
          {
            step_number: 2,
            title: 'Landfill Volume',
            formula: '(Waste / Density) + 20% Soil Cover',
            substitution: `Density = ${payload.compacted_waste_density_kg_m3} kg/m³`,
            result: `${res.total_volume_m3} m³`,
            unit: 'm³',
            reference: 'Sanitary Engineering'
          },
          {
            step_number: 3,
            title: 'Footprint & Liner Area',
            formula: 'Area = Volume / Avg Depth (15m)',
            substitution: `Liner = Area * 1.15`,
            result: `${res.landfill_area_ha} Ha (${res.liner_area_m2} m² liner)`,
            unit: 'Ha',
            reference: 'Environmental Protection'
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
          label="Population Served"
          value={inputs.population || 50000}
          onChange={(v) => onInputChange('population', Number(v))}
          type="number"
          unit="people"
        />
        <InputGroup
          label="Waste Generation Rate"
          value={inputs.waste_generation_kg_capita_day || 1.2}
          onChange={(v) => onInputChange('waste_generation_kg_capita_day', Number(v))}
          type="number"
          unit="kg/c/day"
        />
        <InputGroup
          label="Design Life"
          value={inputs.design_life_years || 20}
          onChange={(v) => onInputChange('design_life_years', Number(v))}
          type="number"
          unit="years"
        />
        <InputGroup
          label="Compacted Waste Density"
          value={inputs.compacted_waste_density_kg_m3 || 800}
          onChange={(v) => onInputChange('compacted_waste_density_kg_m3', Number(v))}
          type="number"
          unit="kg/m³"
        />
      </div>

      <Button onClick={handleCalculate} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Size Sanitary Landfill'}
      </Button>
    </div>
  );
}
