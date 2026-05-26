import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import { api } from '../../../services/api';

interface StormwaterCalculatorProps {
  inputs: Record<string, any>;
  onInputChange: (key: string, value: any) => void;
}

export function StormwaterCalculator({ inputs, onInputChange }: StormwaterCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  const handleCalculate = async () => {
    runCalculation(async () => {
      const payload = {
        catchment_area_ha: inputs.catchment_area_ha || 10,
        runoff_coefficient: inputs.runoff_coefficient || 0.85,
        rainfall_intensity_mm_hr: inputs.rainfall_intensity_mm_hr || 75,
        duration_hours: inputs.duration_hours || 2
      };
      
      const res = await api.post('/wash/stormwater', payload);
      return {
        status: 'pass',
        summary: res,
        steps: [
          {
            step_number: 1,
            title: 'Peak Runoff',
            formula: 'Q = C * i * A / 360',
            substitution: `(${payload.runoff_coefficient} * ${payload.rainfall_intensity_mm_hr} * ${payload.catchment_area_ha}) / 360`,
            result: `${res.peak_runoff_m3_s} m³/s`,
            unit: 'm³/s',
            reference: 'Rational Method'
          },
          {
            step_number: 2,
            title: 'Total Runoff Volume',
            formula: 'V = Q_peak * Duration',
            substitution: `${res.peak_runoff_m3_s} * ${payload.duration_hours}h`,
            result: `${res.total_runoff_volume_m3} m³`,
            unit: 'm³',
            reference: 'Hydrology'
          },
          {
            step_number: 3,
            title: 'Attenuation Pond Sizing',
            formula: 'Store 60% of Volume',
            substitution: `Depth = 2.0m`,
            result: `${res.pond_volume_m3} m³ (${res.pond_area_m2} m²)`,
            unit: 'm³',
            reference: 'Urban Drainage'
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
          label="Catchment Area"
          value={inputs.catchment_area_ha || 10}
          onChange={(v) => onInputChange('catchment_area_ha', Number(v))}
          type="number"
          unit="Hectares"
        />
        <InputGroup
          label="Runoff Coefficient (C)"
          value={inputs.runoff_coefficient || 0.85}
          onChange={(v) => onInputChange('runoff_coefficient', Number(v))}
          type="number"
          unit=""
        />
        <InputGroup
          label="Rainfall Intensity"
          value={inputs.rainfall_intensity_mm_hr || 75}
          onChange={(v) => onInputChange('rainfall_intensity_mm_hr', Number(v))}
          type="number"
          unit="mm/hr"
        />
        <InputGroup
          label="Storm Duration"
          value={inputs.duration_hours || 2}
          onChange={(v) => onInputChange('duration_hours', Number(v))}
          type="number"
          unit="hours"
        />
      </div>

      <Button onClick={handleCalculate} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Size Stormwater Pond'}
      </Button>
    </div>
  );
}
