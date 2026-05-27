import type { CalculatorFormProps } from '../CalculatorTypes';
import type { RoadSubmodule } from '../../../types/calculations';
import { NumField } from '../FormElements';
import { RoadSimPanel } from '../../Road/RoadSimPanel';

const ROAD_SUBMODULES: { id: RoadSubmodule; label: string }[] = [
  { id: 'pavement', label: 'Pavement Design' },
  { id: 'drainage', label: 'Hydrology / Drainage' },
  { id: 'geometric_design', label: 'Geometric Design' },
  { id: 'traffic_load', label: 'Traffic Load (ESAL)' },
];

const ROAD_CLASSES = [
  { value: 'trunk', label: 'Trunk Road' },
  { value: 'primary', label: 'Primary Road' },
  { value: 'secondary', label: 'Secondary Road' },
  { value: 'feeder', label: 'Feeder Road' },
];

const CLIMATE_ZONES = [
  { value: 'wet', label: 'Wet' },
  { value: 'dry', label: 'Dry' },
  { value: 'semi_arid', label: 'Semi-Arid' },
];

const SUBBASE_MATERIALS = [
  { value: 'crushed_stone', label: 'Crushed Stone' },
  { value: 'natural_gravel', label: 'Natural Gravel' },
  { value: 'stabilised', label: 'Stabilised' },
];

const BASE_MATERIALS = [
  { value: 'bitumen_macadam', label: 'Bitumen Macadam' },
  { value: 'crushed_stone', label: 'Crushed Stone' },
  { value: 'concrete', label: 'Concrete' },
];

const PIPE_MATERIALS = [
  { value: 'concrete', label: 'Concrete' },
  { value: 'hdpe', label: 'HDPE' },
  { value: 'corrugated_steel', label: 'Corrugated Steel' },
];

const COUNTRIES = ['Zambia', 'Kenya', 'Nigeria', 'Ghana', 'South Africa', 'Ethiopia'];

export function RoadCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  const submodule = (inputs.road_submodule as RoadSubmodule) ?? 'pavement';

  return (
    <div className="workspace-section">
      <div className="flex flex-wrap gap-2">
        {ROAD_SUBMODULES.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onInputChange('road_submodule', tab.id)}
            className={`flex-1 min-w-[7rem] workspace-chip ${
              submodule === tab.id ? 'workspace-chip-active' : 'workspace-chip-idle'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {submodule === 'pavement' && <PavementForm inputs={inputs} onInputChange={onInputChange} />}
      {submodule === 'drainage' && <DrainageForm inputs={inputs} onInputChange={onInputChange} />}
      {submodule === 'geometric_design' && <GeometricDesignForm inputs={inputs} onInputChange={onInputChange} />}
      {submodule === 'traffic_load' && <TrafficLoadForm inputs={inputs} onInputChange={onInputChange} />}
      <RoadSimPanel inputs={inputs} />
    </div>
  );
}

function GeometricDesignForm({ inputs, onInputChange }: CalculatorFormProps) {
  return (
    <>
      <NumField label="Design Speed (km/h)" value={inputs.design_speed_kmh ?? 80} onChange={(v) => onInputChange('design_speed_kmh', v)} />
      <NumField label="Curve Radius, R (m)" value={inputs.radius_m ?? 300} onChange={(v) => onInputChange('radius_m', v)} />
      <NumField label="Max Super-elevation (%)" value={inputs.max_superelevation_pct ?? 8.0} onChange={(v) => onInputChange('max_superelevation_pct', v)} />
      <NumField label="Side Friction Factor (f)" value={inputs.side_friction_factor ?? 0.14} onChange={(v) => onInputChange('side_friction_factor', v)} />
    </>
  );
}

function TrafficLoadForm({ inputs, onInputChange }: CalculatorFormProps) {
  return (
    <>
      <NumField label="AADT (vehicles/day)" value={inputs.aadt ?? 1000} onChange={(v) => onInputChange('aadt', v)} />
      <NumField label="Growth Rate (%)" value={inputs.growth_rate_pct ?? 4.0} onChange={(v) => onInputChange('growth_rate_pct', v)} />
      <NumField label="Design Life (years)" value={inputs.design_life_yrs ?? 20} onChange={(v) => onInputChange('design_life_yrs', v)} />
      <NumField label="Heavy Trucks (%)" value={inputs.truck_pct ?? 10.0} onChange={(v) => onInputChange('truck_pct', v)} />
      <NumField label="Buses (%)" value={inputs.bus_pct ?? 5.0} onChange={(v) => onInputChange('bus_pct', v)} />
      <NumField label="VDF Truck" value={inputs.vdf_truck ?? 3.0} onChange={(v) => onInputChange('vdf_truck', v)} />
      <NumField label="VDF Bus" value={inputs.vdf_bus ?? 1.2} onChange={(v) => onInputChange('vdf_bus', v)} />
      <NumField label="Directional Split" value={inputs.directional_split ?? 0.5} onChange={(v) => onInputChange('directional_split', v)} />
      <NumField label="Lane Factor" value={inputs.lane_factor ?? 1.0} onChange={(v) => onInputChange('lane_factor', v)} />
    </>
  );
}

function PavementForm({ inputs, onInputChange }: CalculatorFormProps) {
  return (
    <>
      <SelectField label="Road Class" value={(inputs.road_class as string) ?? 'secondary'} options={ROAD_CLASSES} onChange={(v) => onInputChange('road_class', v)} />
      <NumField label="Traffic Count (AADT vehicles/day)" value={inputs.traffic_count ?? 500} onChange={(v) => onInputChange('traffic_count', v)} />
      <NumField label="Heavy Vehicle (%)" value={inputs.heavy_vehicle_pct ?? 12} onChange={(v) => onInputChange('heavy_vehicle_pct', v)} />
      <NumField label="Design Life (years)" value={inputs.design_life ?? 20} onChange={(v) => onInputChange('design_life', v)} />
      <NumField label="Subgrade CBR (%)" value={inputs.cbr_subgrade ?? 6} onChange={(v) => onInputChange('cbr_subgrade', v)} />
      <SelectField label="Subbase Material" value={(inputs.subbase_material as string) ?? 'natural_gravel'} options={SUBBASE_MATERIALS} onChange={(v) => onInputChange('subbase_material', v)} />
      <SelectField label="Base Material" value={(inputs.base_material as string) ?? 'crushed_stone'} options={BASE_MATERIALS} onChange={(v) => onInputChange('base_material', v)} />
      <SelectField label="Climate Zone" value={(inputs.climate_zone as string) ?? 'semi_arid'} options={CLIMATE_ZONES} onChange={(v) => onInputChange('climate_zone', v)} />
      <SelectField label="Country" value={(inputs.country as string) ?? 'Zambia'} options={COUNTRIES.map((c) => ({ value: c, label: c }))} onChange={(v) => onInputChange('country', v)} />
    </>
  );
}

function DrainageForm({ inputs, onInputChange }: CalculatorFormProps) {
  return (
    <>
      <NumField label="Catchment Area (ha)" value={inputs.catchment_area ?? 2.5} onChange={(v) => onInputChange('catchment_area', v)} />
      <NumField label="Rainfall Intensity (mm/hr, 0 = lookup)" value={inputs.rainfall_intensity ?? 65} onChange={(v) => onInputChange('rainfall_intensity', v)} />
      <NumField label="Runoff Coefficient" value={inputs.runoff_coefficient ?? 0.6} onChange={(v) => onInputChange('runoff_coefficient', v)} />
      <NumField label="Pipe Gradient (%)" value={inputs.pipe_gradient ?? 1.5} onChange={(v) => onInputChange('pipe_gradient', v)} />
      <SelectField label="Pipe Material" value={(inputs.pipe_material as string) ?? 'concrete'} options={PIPE_MATERIALS} onChange={(v) => onInputChange('pipe_material', v)} />
      <NumField label="Pipe Length (m)" value={inputs.pipe_length ?? 100} onChange={(v) => onInputChange('pipe_length', v)} />
      <SelectField label="Country" value={(inputs.country as string) ?? 'Zambia'} options={COUNTRIES.map((c) => ({ value: c, label: c }))} onChange={(v) => onInputChange('country', v)} />
      <TextField label="Region (optional)" value={(inputs.region as string) ?? ''} onChange={(v) => onInputChange('region', v)} />
    </>
  );
}


function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none focus:border-infra-highlight/60"
      />
    </div>
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
