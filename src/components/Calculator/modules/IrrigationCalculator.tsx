import { InputGroup } from '../InputGroup';
import { Button } from '../../ui/Button';
import { useCalculationStore } from '../../../store/calculationStore';
import { api } from '../../../services/api';

interface IrrigationCalculatorProps {
  inputs: Record<string, any>;
  onInputChange: (key: string, value: any) => void;
}

export function IrrigationCalculator({ inputs, onInputChange }: IrrigationCalculatorProps) {
  const { runCalculation, isCalculating } = useCalculationStore();

  const handleCalculate = async () => {
    runCalculation(async () => {
      const payload = {
        crop_area_ha: inputs.crop_area_ha || 50,
        crop_coefficient_kc: inputs.crop_coefficient_kc || 1.1,
        reference_evapotranspiration_mm_day: inputs.reference_evapotranspiration_mm_day || 6,
        irrigation_efficiency: inputs.irrigation_efficiency || 0.85
      };
      
      const res = await api.post('/wash/irrigation', payload);
      return {
        status: 'pass',
        summary: res,
        steps: [
          {
            step_number: 1,
            title: 'Crop Evapotranspiration (ETc)',
            formula: 'ETc = ET0 * Kc',
            substitution: `${payload.reference_evapotranspiration_mm_day} * ${payload.crop_coefficient_kc}`,
            result: `${res.crop_evapotranspiration_mm_day} mm/day`,
            unit: 'mm/day',
            reference: 'FAO Penman-Monteith'
          },
          {
            step_number: 2,
            title: 'Gross Irrigation Requirement',
            formula: 'GIR = ETc / Efficiency',
            substitution: `${res.crop_evapotranspiration_mm_day} / ${payload.irrigation_efficiency}`,
            result: `${res.gross_irrigation_req_mm_day} mm/day`,
            unit: 'mm/day',
            reference: 'Agronomy'
          },
          {
            step_number: 3,
            title: 'Pump Flow Rate Sizing',
            formula: 'Q = (GIR * Area) / 12 hrs',
            substitution: `Area = ${payload.crop_area_ha} Ha`,
            result: `${res.daily_volume_m3}m³/d (${res.pump_flow_rate_lps} L/s)`,
            unit: 'L/s',
            reference: 'Hydraulics'
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
          label="Crop Area"
          value={inputs.crop_area_ha || 50}
          onChange={(v) => onInputChange('crop_area_ha', Number(v))}
          type="number"
          unit="Hectares"
        />
        <InputGroup
          label="Crop Coefficient (Kc)"
          value={inputs.crop_coefficient_kc || 1.1}
          onChange={(v) => onInputChange('crop_coefficient_kc', Number(v))}
          type="number"
          unit=""
        />
        <InputGroup
          label="Reference ET (ET0)"
          value={inputs.reference_evapotranspiration_mm_day || 6}
          onChange={(v) => onInputChange('reference_evapotranspiration_mm_day', Number(v))}
          type="number"
          unit="mm/day"
        />
        <InputGroup
          label="Irrigation Efficiency"
          value={inputs.irrigation_efficiency || 0.85}
          onChange={(v) => onInputChange('irrigation_efficiency', Number(v))}
          type="number"
          unit="ratio"
        />
      </div>

      <Button onClick={handleCalculate} disabled={isCalculating} className="w-full">
        {isCalculating ? 'Calculating...' : 'Calculate Irrigation'}
      </Button>
    </div>
  );
}
