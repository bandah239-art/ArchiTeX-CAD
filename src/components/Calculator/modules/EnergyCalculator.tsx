import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import { EnergySimulationPanel } from '../../Energy/EnergySimulationPanel';

interface EnergyCalculatorProps {
  inputs: Record<string, unknown>;
  onInputChange: (key: string, value: unknown) => void;
}

export function EnergyCalculator({ inputs, onInputChange }: EnergyCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <InputGroup
          label="Load Profile"
          value={(inputs.load_profile as string) || 'Residential'}
          onChange={(v) => onInputChange('load_profile', v)}
          type="select"
          options={[
            { label: 'Residential', value: 'Residential' },
            { label: 'Rural Hospital', value: 'Rural Hospital' },
            { label: 'School', value: 'School' },
            { label: 'Commercial', value: 'Commercial' },
          ]}
        />
        <InputGroup
          label="Daily Load"
          value={(inputs.daily_load_kwh as number) || 20}
          onChange={(v) => onInputChange('daily_load_kwh', Number(v))}
          type="number"
          unit="kWh"
        />
        <InputGroup
          label="Peak Load"
          value={(inputs.peak_load_kw as number) || 5}
          onChange={(v) => onInputChange('peak_load_kw', Number(v))}
          type="number"
          unit="kW"
        />
        <InputGroup
          label="Peak Sun Hours"
          value={(inputs.peak_sun_hours as number) || 4.5}
          onChange={(v) => onInputChange('peak_sun_hours', Number(v))}
          type="number"
          unit="hrs"
        />
        <InputGroup
          label="Autonomy (Days)"
          value={(inputs.autonomy_days as number) || 2}
          onChange={(v) => onInputChange('autonomy_days', Number(v))}
          type="number"
          unit="days"
        />
        <InputGroup
          label="Battery Type"
          value={(inputs.battery_type as string) || 'lithium_ion'}
          onChange={(v) => onInputChange('battery_type', v)}
          type="select"
          options={[
            { label: 'Lithium Ion', value: 'lithium_ion' },
            { label: 'Tubular Gel / Lead Acid', value: 'tubular_gel' },
          ]}
        />
      </div>

      <Button onClick={() => void runCalculation()} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Size BESS & Solar'}
      </Button>
      <EnergySimulationPanel inputs={inputs} />
    </div>
  );
}
