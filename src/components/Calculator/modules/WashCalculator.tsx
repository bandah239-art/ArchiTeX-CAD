import type { CalculatorFormProps } from '../CalculatorTypes';
import type { WashSubmodule } from '../../../types/calculations';
import { WashSimulationPanel } from '../../WASH/WashSimulationPanel';
import { NumField } from '../FormElements';

const WASH_SUBMODULES: { id: WashSubmodule; label: string }[] = [
  { id: 'water_demand', label: 'Water Demand' },
  { id: 'pipe_network', label: 'Pipe Network' },
  { id: 'sewer_design', label: 'Sewer Design' },
  { id: 'borehole', label: 'Borehole' },
  { id: 'treatment_plant', label: 'Treatment Plant' },
];

const COUNTRIES = ['Zambia', 'Kenya', 'Nigeria', 'Ghana', 'South Africa', 'Ethiopia'];

const DEMAND_CONTEXTS = [
  { value: 'rural_basic', label: 'Rural (Basic)' },
  { value: 'rural_improved', label: 'Rural (Improved)' },
  { value: 'urban_low', label: 'Urban (Low Income)' },
  { value: 'urban_middle', label: 'Urban (Middle Income)' },
  { value: 'institutional', label: 'Institutional' },
  { value: 'commercial', label: 'Commercial' },
];

const PIPE_MATERIALS = [
  { value: 'pvc', label: 'PVC' },
  { value: 'hdpe', label: 'HDPE' },
  { value: 'steel', label: 'Steel' },
  { value: 'concrete', label: 'Concrete' },
  { value: 'cast_iron', label: 'Cast Iron' },
];

const FILTER_TYPES = [
  { value: 'rapid', label: 'Rapid Sand Filter' },
  { value: 'slow', label: 'Slow Sand Filter' },
];

export function WashCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  const submodule = (inputs.wash_submodule as WashSubmodule) ?? 'water_demand';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {WASH_SUBMODULES.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onInputChange('wash_submodule', tab.id)}
            className={`flex-1 min-w-[80px] px-2 py-1.5 text-xs rounded transition-colors ${
              submodule === tab.id
                ? 'bg-infra-highlight text-white'
                : 'bg-infra-accent/30 text-gray-400 hover:bg-infra-accent/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {submodule === 'water_demand' && <WaterDemandForm inputs={inputs} onInputChange={onInputChange} />}
      {submodule === 'pipe_network' && <PipeNetworkForm inputs={inputs} onInputChange={onInputChange} />}
      {submodule === 'sewer_design' && <SewerDesignForm inputs={inputs} onInputChange={onInputChange} />}
      {submodule === 'borehole' && <BoreholeForm inputs={inputs} onInputChange={onInputChange} />}
      {submodule === 'treatment_plant' && <TreatmentPlantForm inputs={inputs} onInputChange={onInputChange} />}

      <WashSimulationPanel inputs={inputs} />
    </div>
  );
}

function WaterDemandForm({ inputs, onInputChange }: CalculatorFormProps) {
  return (
    <>
      <NumField label="Population" value={inputs.population ?? 500} onChange={(v) => onInputChange('population', v)} />
      <SelectField label="Context" value={(inputs.context as string) ?? 'urban_low'} options={DEMAND_CONTEXTS} onChange={(v) => onInputChange('context', v)} />
      <NumField label="LPCD (override)" value={inputs.lpcd ?? 50} onChange={(v) => onInputChange('lpcd', v)} />
      <NumField label="Peak Factor" value={inputs.peak_factor ?? 2.5} onChange={(v) => onInputChange('peak_factor', v)} />
      <NumField label="Storage Days" value={inputs.storage_days ?? 1.0} onChange={(v) => onInputChange('storage_days', v)} />
      <NumField label="Leakage (%)" value={inputs.leakage_pct ?? 15} onChange={(v) => onInputChange('leakage_pct', v)} />
      <SelectField label="Country" value={(inputs.country as string) ?? 'Zambia'} options={COUNTRIES.map((c) => ({ value: c, label: c }))} onChange={(v) => onInputChange('country', v)} />
    </>
  );
}

function PipeNetworkForm({ inputs, onInputChange }: CalculatorFormProps) {
  // Simplified for UI: Hardcode the sample network or allow basic parameters to be sent to backend
  // In a real implementation this would have a dynamic table of nodes and pipes.
  return (
    <div className="p-3 bg-infra-darker rounded border border-infra-accent/30 text-sm text-gray-300">
      <p>This module analyzes a predefined 3-node sample pipe network using Hardy-Cross.</p>
      <p className="mt-2 text-xs text-gray-500">Nodes: 1 (Source), 2 (8 L/s), 3 (5 L/s)</p>
      <p className="text-xs text-gray-500">Pipes: P1(500m), P2(400m), P3(600m)</p>
      
      {/* Set the default dummy network for testing if not already set */}
      {inputs.nodes === undefined && (
        <button 
          onClick={() => {
            onInputChange('nodes', [
              {"id": "1", "elevation": 100, "demand_lps": 0, "is_source": true},
              {"id": "2", "elevation": 95, "demand_lps": 8},
              {"id": "3", "elevation": 98, "demand_lps": 5}
            ]);
            onInputChange('pipes', [
              {"id": "P1", "start": "1", "end": "2", "length": 500, "diameter_mm": 200, "material": "pvc", "c_value": 120},
              {"id": "P2", "start": "2", "end": "3", "length": 400, "diameter_mm": 150, "material": "pvc", "c_value": 120},
              {"id": "P3", "start": "3", "end": "1", "length": 600, "diameter_mm": 200, "material": "pvc", "c_value": 120}
            ]);
          }}
          className="mt-4 px-3 py-1 bg-infra-highlight rounded text-white text-xs hover:bg-opacity-80 transition-colors"
        >
          Load 3-Node Example Network
        </button>
      )}
    </div>
  );
}

function SewerDesignForm({ inputs, onInputChange }: CalculatorFormProps) {
  return (
    <>
      <NumField label="Population" value={inputs.population ?? 500} onChange={(v) => onInputChange('population', v)} />
      <NumField label="Sewage Generation (LPCD)" value={inputs.lpcd ?? 80} onChange={(v) => onInputChange('lpcd', v)} />
      <NumField label="Infiltration (%)" value={inputs.infiltration_pct ?? 20} onChange={(v) => onInputChange('infiltration_pct', v)} />
      <NumField label="Peak Factor" value={inputs.peak_factor ?? 2.5} onChange={(v) => onInputChange('peak_factor', v)} />
      <SelectField label="Pipe Material" value={(inputs.material as string) ?? 'pvc'} options={PIPE_MATERIALS} onChange={(v) => onInputChange('material', v)} />
    </>
  );
}

function BoreholeForm({ inputs, onInputChange }: CalculatorFormProps) {
  return (
    <>
      <NumField label="Pumping Rate (m³/day)" value={inputs.pumping_rate_m3d ?? 100} onChange={(v) => onInputChange('pumping_rate_m3d', v)} />
      <NumField label="Transmissivity (m²/day)" value={inputs.transmissivity_m2d ?? 50} onChange={(v) => onInputChange('transmissivity_m2d', v)} />
      <NumField label="Storage Coefficient" value={inputs.storage_coeff ?? 0.001} onChange={(v) => onInputChange('storage_coeff', v)} />
      <NumField label="Time (days)" value={inputs.time_days ?? 1.0} onChange={(v) => onInputChange('time_days', v)} />
      <NumField label="Borehole Radius (m)" value={inputs.radius_m ?? 0.1} onChange={(v) => onInputChange('radius_m', v)} />
      <NumField label="Aquifer Thickness (m)" value={inputs.aquifer_thickness_m ?? 20} onChange={(v) => onInputChange('aquifer_thickness_m', v)} />
      <NumField label="Static Lift (m)" value={inputs.static_lift_m ?? 30} onChange={(v) => onInputChange('static_lift_m', v)} />
      <NumField label="Friction Losses (m)" value={inputs.friction_losses_m ?? 5} onChange={(v) => onInputChange('friction_losses_m', v)} />
      <NumField label="Residual Pressure (m)" value={inputs.residual_pressure_m ?? 15} onChange={(v) => onInputChange('residual_pressure_m', v)} />
    </>
  );
}

function TreatmentPlantForm({ inputs, onInputChange }: CalculatorFormProps) {
  return (
    <>
      <p className="text-[10px] text-gray-500 -mb-1">
        After calculate, clearwell tank pressure is auto-linked from sedimentation sizing (override below if needed).
      </p>
      <NumField label="Flow Rate (m³/hr)" value={inputs.flow_rate_m3h ?? 100} onChange={(v) => onInputChange('flow_rate_m3h', v)} />
      <NumField label="Flocculation Detention (min)" value={inputs.floc_detention_min ?? 30} onChange={(v) => onInputChange('floc_detention_min', v)} />
      <NumField label="Velocity Gradient (G, s⁻¹)" value={inputs.velocity_gradient_g ?? 40} onChange={(v) => onInputChange('velocity_gradient_g', v)} />
      <NumField label="Sedimentation SOR (m/h)" value={inputs.surface_overflow_rate_mh ?? 1.5} onChange={(v) => onInputChange('surface_overflow_rate_mh', v)} />
      <NumField label="Sedimentation Detention (hr)" value={inputs.sed_detention_hr ?? 3} onChange={(v) => onInputChange('sed_detention_hr', v)} />
      <SelectField label="Filter Type" value={(inputs.filter_type as string) ?? 'rapid'} options={FILTER_TYPES} onChange={(v) => onInputChange('filter_type', v)} />
      <NumField label="Filtration Rate (m/h)" value={inputs.filtration_rate_mh ?? 10} onChange={(v) => onInputChange('filtration_rate_mh', v)} />
      <NumField label="Chlorine Contact (min)" value={inputs.chlorine_contact_min ?? 30} onChange={(v) => onInputChange('chlorine_contact_min', v)} />
      <NumField label="Chlorine Residual (mg/L)" value={inputs.chlorine_residual_mgl ?? 0.5} onChange={(v) => onInputChange('chlorine_residual_mgl', v)} />
      <h4 className="text-xs font-semibold text-infra-highlight mt-3 mb-1">Clearwell tank (pressure check)</h4>
      <NumField label="Tank height H (m) — optional" value={inputs.tank_height_m ?? 0} onChange={(v) => onInputChange('tank_height_m', v)} />
      <NumField label="Tank radius r (m) — optional" value={inputs.tank_radius_m ?? 0} onChange={(v) => onInputChange('tank_radius_m', v)} />
      <NumField label="Wind force on tank (kN)" value={inputs.tank_wind_force_kn ?? 80} onChange={(v) => onInputChange('tank_wind_force_kn', v)} />
      <NumField label="Tank weight W (kN) — optional" value={inputs.tank_weight_kn ?? 0} onChange={(v) => onInputChange('tank_weight_kn', v)} />
    </>
  );
}


function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none focus:border-infra-highlight/60"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
