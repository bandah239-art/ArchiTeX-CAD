import type { CalculatorFormProps } from '../CalculatorTypes';
import type { GeoSubmodule } from '../../../types/calculations';
import { GeoSimulationPanel } from '../../Geo/GeoSimulationPanel';
import { NumField } from '../FormElements';

const GEO_SUBMODULES: { id: GeoSubmodule; label: string }[] = [
  { id: 'bearing_capacity', label: 'Bearing Capacity' },
  { id: 'settlement', label: 'Settlement' },
  { id: 'slope_stability', label: 'Slope Stability' },
  { id: 'site_classification', label: 'Site Class & Liq' },
];

const SOIL_TYPES = [
  { value: 'sandy', label: 'Sandy / Granular' },
  { value: 'laterite', label: 'Laterite' },
  { value: 'black_cotton', label: 'Black Cotton Clay' },
  { value: 'weathered_rock', label: 'Weathered Rock' },
  { value: 'soft_clay', label: 'Soft Clay' },
];

const SAMPLER_TYPES = [
  { value: 'standard', label: 'Standard (with liner)' },
  { value: 'without_liner', label: 'Without Liner' },
];

export function GeoCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  const submodule = (inputs.geo_submodule as GeoSubmodule) ?? 'bearing_capacity';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {GEO_SUBMODULES.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onInputChange('geo_submodule', tab.id)}
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

      {submodule === 'bearing_capacity' && <BearingCapacityForm inputs={inputs} onInputChange={onInputChange} />}
      {submodule === 'settlement' && <SettlementForm inputs={inputs} onInputChange={onInputChange} />}
      {submodule === 'slope_stability' && <SlopeStabilityForm inputs={inputs} onInputChange={onInputChange} />}
      {submodule === 'site_classification' && <SiteClassificationForm inputs={inputs} onInputChange={onInputChange} />}

      <GeoSimulationPanel inputs={inputs} />
    </div>
  );
}

function BearingCapacityForm({ inputs, onInputChange }: CalculatorFormProps) {
  return (
    <>
      <SelectField label="Soil Type" value={(inputs.soil_type as string) ?? 'sandy'} options={SOIL_TYPES} onChange={(v) => onInputChange('soil_type', v)} />
      <NumField label="Foundation Width, B (m)" value={inputs.foundation_width_m ?? 2.0} onChange={(v) => onInputChange('foundation_width_m', v)} />
      <NumField label="Foundation Length, L (m)" value={inputs.foundation_length_m ?? 2.0} onChange={(v) => onInputChange('foundation_length_m', v)} />
      <NumField label="Foundation Depth, Df (m)" value={inputs.foundation_depth_m ?? 1.2} onChange={(v) => onInputChange('foundation_depth_m', v)} />
      <NumField label="Factor of Safety (FOS)" value={inputs.fos ?? 3.0} onChange={(v) => onInputChange('fos', v)} />
      
      <div className="mt-4 p-3 bg-infra-darker border border-infra-accent/30 rounded">
        <label className="flex items-center text-xs text-gray-300 mb-2">
          <input 
            type="checkbox" 
            checked={!!inputs.use_custom_soil} 
            onChange={(e) => onInputChange('use_custom_soil', e.target.checked)}
            className="mr-2"
          />
          Override with Custom Soil Parameters
        </label>
        
        {!!inputs.use_custom_soil && (
          <div className="space-y-2 mt-2">
            <NumField label="Cohesion, c (kPa)" value={inputs.cohesion_kpa ?? 0} onChange={(v) => onInputChange('cohesion_kpa', v)} />
            <NumField label="Friction Angle, φ (deg)" value={inputs.friction_angle_deg ?? 30} onChange={(v) => onInputChange('friction_angle_deg', v)} />
            <NumField label="Unit Weight, γ (kN/m³)" value={inputs.unit_weight_knm3 ?? 18} onChange={(v) => onInputChange('unit_weight_knm3', v)} />
          </div>
        )}
      </div>
    </>
  );
}

function SettlementForm({ inputs, onInputChange }: CalculatorFormProps) {
  return (
    <>
      <NumField label="Applied Pressure (kPa)" value={inputs.applied_pressure_kpa ?? 150} onChange={(v) => onInputChange('applied_pressure_kpa', v)} />
      <NumField label="Foundation Width (m)" value={inputs.foundation_width_m ?? 2.0} onChange={(v) => onInputChange('foundation_width_m', v)} />
      <NumField label="Elastic Modulus, E (kPa)" value={inputs.elastic_modulus_kpa ?? 20000} onChange={(v) => onInputChange('elastic_modulus_kpa', v)} />
      <NumField label="Poisson's Ratio" value={inputs.poissons_ratio ?? 0.3} onChange={(v) => onInputChange('poissons_ratio', v)} />
      <NumField label="Shape Factor (Is)" value={inputs.shape_factor_is ?? 1.0} onChange={(v) => onInputChange('shape_factor_is', v)} />
      
      <div className="mt-4 p-3 bg-infra-darker border border-infra-accent/30 rounded">
        <label className="flex items-center text-xs text-gray-300 mb-2">
          <input 
            type="checkbox" 
            checked={inputs.calc_consolidation !== false} 
            onChange={(e) => onInputChange('calc_consolidation', e.target.checked)}
            className="mr-2"
          />
          Calculate 1D Consolidation
        </label>
        
        {inputs.calc_consolidation !== false && (
          <div className="space-y-2 mt-2">
            <NumField label="Compression Index, Cc" value={inputs.compression_index_cc ?? 0.3} onChange={(v) => onInputChange('compression_index_cc', v)} />
            <NumField label="Initial Void Ratio, e0" value={inputs.initial_void_ratio_e0 ?? 0.8} onChange={(v) => onInputChange('initial_void_ratio_e0', v)} />
            <NumField label="Clay Layer Thickness, H (m)" value={inputs.clay_layer_thickness_m ?? 5.0} onChange={(v) => onInputChange('clay_layer_thickness_m', v)} />
            <NumField label="Initial Eff. Stress, σ0' (kPa)" value={inputs.initial_effective_stress_kpa ?? 50.0} onChange={(v) => onInputChange('initial_effective_stress_kpa', v)} />
            <NumField label="Stress Increase, Δσ (kPa)" value={inputs.stress_increase_kpa ?? 75.0} onChange={(v) => onInputChange('stress_increase_kpa', v)} />
          </div>
        )}
      </div>
      
      <NumField label="Allowable Total Settlement (mm)" value={inputs.allowable_settlement_mm ?? 25.0} onChange={(v) => onInputChange('allowable_settlement_mm', v)} />
    </>
  );
}

function SlopeStabilityForm({ inputs, onInputChange }: CalculatorFormProps) {
  return (
    <div className="space-y-3">
      <NumField
        label="Retaining wall / slope height H (m)"
        value={inputs.retaining_wall_height_m ?? 5}
        onChange={(v) => onInputChange('retaining_wall_height_m', v)}
      />
      <NumField label="Friction angle φ (°)" value={inputs.friction_angle_deg ?? 30} onChange={(v) => onInputChange('friction_angle_deg', v)} />
      <NumField label="Cohesion c (kPa)" value={inputs.cohesion_kpa ?? 10} onChange={(v) => onInputChange('cohesion_kpa', v)} />
      <NumField label="Unit weight γ (kN/m³)" value={inputs.unit_weight_knm3 ?? 18} onChange={(v) => onInputChange('unit_weight_knm3', v)} />
    <div className="p-3 bg-infra-darker rounded border border-infra-accent/30 text-sm text-gray-300">
      <p>Bishop slope analysis below; lateral earth pressure runs automatically on calculate.</p>
      
      {/* Set the default dummy network for testing if not already set */}
      {inputs.slices === undefined && (
        <button 
          onClick={() => {
            onInputChange('slices', [
              {"b": 2.0, "w": 50.0, "alpha": 45.0, "c": 10.0, "phi": 30.0, "u": 5.0},
              {"b": 2.0, "w": 100.0, "alpha": 15.0, "c": 10.0, "phi": 30.0, "u": 15.0},
              {"b": 2.0, "w": 40.0, "alpha": -10.0, "c": 10.0, "phi": 30.0, "u": 0.0}
            ]);
          }}
          className="mt-4 px-3 py-1 bg-infra-highlight rounded text-white text-xs hover:bg-opacity-80 transition-colors"
        >
          Load Example Slices
        </button>
      )}
    </div>
    </div>
  );
}

function SiteClassificationForm({ inputs, onInputChange }: CalculatorFormProps) {
  return (
    <>
      <NumField label="Measured SPT N-value" value={inputs.spt_n ?? 15} onChange={(v) => onInputChange('spt_n', v)} />
      <NumField label="Hammer Energy Ratio (%)" value={inputs.energy_ratio ?? 60} onChange={(v) => onInputChange('energy_ratio', v)} />
      <NumField label="Borehole Diameter (mm)" value={inputs.borehole_diam_mm ?? 100} onChange={(v) => onInputChange('borehole_diam_mm', v)} />
      <SelectField label="Sampler Type" value={(inputs.sampler_type as string) ?? 'standard'} options={SAMPLER_TYPES} onChange={(v) => onInputChange('sampler_type', v)} />
      <NumField label="Rod Length (m)" value={inputs.rod_length_m ?? 5.0} onChange={(v) => onInputChange('rod_length_m', v)} />
      <NumField label="Effective Stress, σv' (kPa)" value={inputs.effective_stress_kpa ?? 50.0} onChange={(v) => onInputChange('effective_stress_kpa', v)} />
      <hr className="border-infra-accent/30 my-2" />
      <h3 className="text-xs font-semibold text-gray-300">Liquefaction Check</h3>
      <NumField label="Peak Ground Accel (PGA), g" value={inputs.pga_g ?? 0.15} onChange={(v) => onInputChange('pga_g', v)} />
      <NumField label="Earthquake Magnitude (Mw)" value={inputs.magnitude ?? 7.5} onChange={(v) => onInputChange('magnitude', v)} />
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
