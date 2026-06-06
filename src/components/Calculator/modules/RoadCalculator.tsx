import { useState } from 'react';
import type { CalculatorFormProps } from '../CalculatorTypes';
import type { RoadSubmodule } from '../../../types/calculations';
import { NumField } from '../FormElements';
import { RoadSimPanel } from '../../Road/RoadSimPanel';
import { API_BASE } from '../../../services/apiConfig';

const ROAD_SUBMODULES: { id: RoadSubmodule | 'gravel_road'; label: string }[] = [
  { id: 'pavement', label: 'Pavement Design' },
  { id: 'gravel_road', label: 'Gravel Road (RDA)' },
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

const RAINFALL_ZONES = [
  { value: 'lusaka', label: 'Lusaka (~800 mm/yr)' },
  { value: 'copperbelt', label: 'Copperbelt (~1200 mm/yr)' },
  { value: 'livingstone', label: 'Southern / Livingstone (~650 mm/yr)' },
  { value: 'chipata', label: 'Eastern / Chipata (~900 mm/yr)' },
  { value: 'mansa', label: 'Luapula / Mansa (~1300 mm/yr)' },
];

const TERRAIN_TYPES = [
  { value: 'flat', label: 'Flat (0–3%)' },
  { value: 'rolling', label: 'Rolling (3–8%)' },
  { value: 'mountainous', label: 'Mountainous (>8%)' },
];

const COUNTRIES = ['Zambia', 'Kenya', 'Nigeria', 'Ghana', 'South Africa', 'Ethiopia'];

interface GravelResult {
  status: string;
  summary: Record<string, number | string>;
  steps: { step_number: number; title: string; formula: string; substitution: string; result: string; unit: string; reference: string }[];
  warnings: string[];
}

function Row({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`flex justify-between border-b border-infra-accent/20 py-0.5 ${highlight ? 'text-infra-highlight' : ''}`}>
      <span className="text-gray-400 text-xs">{label}</span>
      <span className={`font-mono text-xs ${highlight ? 'text-infra-highlight font-bold' : 'text-white'}`}>{value}</span>
    </div>
  );
}

function GravelRoadForm({ inputs, onInputChange }: CalculatorFormProps) {
  const [result, setResult] = useState<GravelResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function compute() {
    setLoading(true);
    setError(null);
    try {
      const body = {
        AADT: Number(inputs.gravel_AADT ?? 200),
        CBR_subgrade_pct: Number(inputs.gravel_CBR_sub ?? 5),
        CBR_gravel_pct: Number(inputs.gravel_CBR_gravel ?? 35),
        design_period_years: Number(inputs.gravel_design_period ?? 10),
        traffic_growth_rate_pct: Number(inputs.gravel_growth_rate ?? 3),
        rainfall_zone: String(inputs.gravel_rainfall_zone ?? 'lusaka'),
        terrain_type: String(inputs.gravel_terrain ?? 'flat'),
        road_width_m: Number(inputs.gravel_road_width ?? 6.0),
        road_length_km: Number(inputs.gravel_road_length ?? 1.0),
      };
      const res = await fetch(`${API_BASE}/roads/gravel-design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const s = result?.summary;

  return (
    <div className="space-y-3">
      <div className="p-2 bg-amber-900/20 border border-amber-700/40 rounded text-xs text-amber-300">
        RDA/SATCC method — Zambia Roads Development Agency. For unsealed gravel wearing course design.
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col space-y-0.5">
          <label className="text-gray-400 text-xs font-semibold">AADT (vehicles/day)</label>
          <input type="number" value={String(inputs.gravel_AADT ?? 200)} onChange={(e) => onInputChange('gravel_AADT', Number(e.target.value))} className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white text-xs focus:outline-none focus:border-infra-highlight/60" />
        </div>
        <div className="flex flex-col space-y-0.5">
          <label className="text-gray-400 text-xs font-semibold">Subgrade CBR (%)</label>
          <input type="number" value={String(inputs.gravel_CBR_sub ?? 5)} onChange={(e) => onInputChange('gravel_CBR_sub', Number(e.target.value))} className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white text-xs focus:outline-none focus:border-infra-highlight/60" />
        </div>
        <div className="flex flex-col space-y-0.5">
          <label className="text-gray-400 text-xs font-semibold">Gravel CBR (%)</label>
          <input type="number" value={String(inputs.gravel_CBR_gravel ?? 35)} onChange={(e) => onInputChange('gravel_CBR_gravel', Number(e.target.value))} className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white text-xs focus:outline-none focus:border-infra-highlight/60" />
        </div>
        <div className="flex flex-col space-y-0.5">
          <label className="text-gray-400 text-xs font-semibold">Design Period (yr)</label>
          <input type="number" value={String(inputs.gravel_design_period ?? 10)} onChange={(e) => onInputChange('gravel_design_period', Number(e.target.value))} className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white text-xs focus:outline-none focus:border-infra-highlight/60" />
        </div>
        <div className="flex flex-col space-y-0.5">
          <label className="text-gray-400 text-xs font-semibold">Growth Rate (%/yr)</label>
          <input type="number" value={String(inputs.gravel_growth_rate ?? 3)} onChange={(e) => onInputChange('gravel_growth_rate', Number(e.target.value))} className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white text-xs focus:outline-none focus:border-infra-highlight/60" />
        </div>
        <div className="flex flex-col space-y-0.5">
          <label className="text-gray-400 text-xs font-semibold">Road Width (m)</label>
          <input type="number" value={String(inputs.gravel_road_width ?? 6.0)} onChange={(e) => onInputChange('gravel_road_width', Number(e.target.value))} className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white text-xs focus:outline-none focus:border-infra-highlight/60" />
        </div>
        <div className="flex flex-col space-y-0.5 col-span-2">
          <label className="text-gray-400 text-xs font-semibold">Road Length (km)</label>
          <input type="number" value={String(inputs.gravel_road_length ?? 1.0)} onChange={(e) => onInputChange('gravel_road_length', Number(e.target.value))} className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white text-xs focus:outline-none focus:border-infra-highlight/60" />
        </div>

        <div className="flex flex-col space-y-0.5 col-span-2">
          <label className="text-gray-400 text-xs font-semibold">Rainfall Zone</label>
          <select value={String(inputs.gravel_rainfall_zone ?? 'lusaka')} onChange={(e) => onInputChange('gravel_rainfall_zone', e.target.value)} className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white text-xs focus:outline-none focus:border-infra-highlight/60">
            {RAINFALL_ZONES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col space-y-0.5 col-span-2">
          <label className="text-gray-400 text-xs font-semibold">Terrain Type</label>
          <select value={String(inputs.gravel_terrain ?? 'flat')} onChange={(e) => onInputChange('gravel_terrain', e.target.value)} className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white text-xs focus:outline-none focus:border-infra-highlight/60">
            {TERRAIN_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={compute}
        disabled={loading}
        className="w-full py-2 bg-infra-highlight text-white text-xs font-bold rounded uppercase tracking-wider hover:bg-infra-highlight/80 disabled:opacity-50"
      >
        {loading ? 'DESIGNING...' : 'DESIGN GRAVEL ROAD'}
      </button>

      {error && <div className="p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">{error}</div>}

      {result && s && (
        <>
          <div className={`p-3 rounded border text-center font-bold text-sm ${result.status === 'pass' ? 'bg-green-900/30 border-green-700/50 text-green-400' : 'bg-red-900/30 border-red-700/50 text-red-400'}`}>
            {result.status === 'pass' ? '✓ DESIGN OK' : '✗ CHECK REQUIRED'}
          </div>

          <div className="grid grid-cols-2 gap-1">
            <Row label="E80s (equiv. axles)" value={Number(s.E80s ?? 0).toFixed(0)} />
            <Row label="Wearing course (mm)" value={String(s.wearing_course_mm ?? '-')} highlight />
            <Row label="Subbase required" value={String(s.subbase_required ?? '-')} />
            <Row label="Subbase thickness (mm)" value={String(s.subbase_thickness_mm ?? 'N/A')} />
            <Row label="Gravel volume (m³/km)" value={Number(s.gravel_volume_m3_per_km ?? 0).toFixed(0)} />
            <Row label="Est. cost (ZMW/km)" value={`ZMW ${Number(s.estimated_cost_zmw ?? 0).toLocaleString()}`} highlight />
            <Row label="Maintenance interval" value={String(s.maintenance_interval_years ?? '-') + ' yr'} />
            <Row label="Culvert class" value={String(s.culvert_recommendation ?? '-')} />
          </div>

          {result.warnings.length > 0 && (
            <div className="space-y-1">
              {result.warnings.map((w, i) => (
                <div key={i} className="p-2 bg-yellow-900/20 border border-yellow-700/40 rounded text-xs text-yellow-300">⚠ {w}</div>
              ))}
            </div>
          )}

          <details className="text-xs">
            <summary className="cursor-pointer text-gray-400 hover:text-infra-highlight py-1">Show calculation steps ({result.steps.length})</summary>
            <div className="mt-2 space-y-2">
              {result.steps.map((step) => (
                <div key={step.step_number} className="border border-infra-accent/20 rounded p-2 space-y-0.5">
                  <div className="text-infra-highlight font-bold">{step.step_number}. {step.title}</div>
                  <div className="text-gray-500 font-mono">{step.formula}</div>
                  <div className="text-gray-400">{step.substitution}</div>
                  <div className="text-white">{step.result} <span className="text-gray-500">{step.unit}</span></div>
                  <div className="text-gray-600">{step.reference}</div>
                </div>
              ))}
            </div>
          </details>
        </>
      )}
    </div>
  );
}

export function RoadCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  const submodule = (inputs.road_submodule as string) ?? 'pavement';

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

      {submodule === 'gravel_road' && <GravelRoadForm inputs={inputs} onInputChange={onInputChange} />}
      {submodule === 'pavement' && <PavementForm inputs={inputs} onInputChange={onInputChange} />}
      {submodule === 'drainage' && <DrainageForm inputs={inputs} onInputChange={onInputChange} />}
      {submodule === 'geometric_design' && <GeometricDesignForm inputs={inputs} onInputChange={onInputChange} />}
      {submodule === 'traffic_load' && <TrafficLoadForm inputs={inputs} onInputChange={onInputChange} />}
      {submodule !== 'gravel_road' && <RoadSimPanel inputs={inputs} />}
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
      <NumField label="Subgrade CBR (%)" fieldKey="cbr_subgrade" value={inputs.cbr_subgrade ?? 6} onChange={(v) => onInputChange('cbr_subgrade', v)} />
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
      <NumField label="Rainfall Intensity (mm/hr, 0 = lookup)" fieldKey="rainfall_intensity" value={inputs.rainfall_intensity ?? 65} onChange={(v) => onInputChange('rainfall_intensity', v)} />
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
