import { useState } from 'react';
import { pressureAPI, type PressureModule, type PressureResult } from '../../../services/pressureAPI';
import { ResultsDisplay } from '../ResultsDisplay';
import { PressureDiagram } from './PressureDiagram';

const MODULES: { id: PressureModule; label: string }[] = [
  { id: 'foundation-bearing', label: 'Foundation bearing' },
  { id: 'lateral-earth', label: 'Lateral earth' },
  { id: 'wind-distribution', label: 'Wind' },
  { id: 'boussinesq', label: 'Boussinesq' },
  { id: 'consolidation', label: 'Consolidation' },
  { id: 'bridge-hydrostatic', label: 'Hydrostatic' },
  { id: 'bridge-hydrodynamic', label: 'Hydrodynamic' },
  { id: 'bridge-foundation', label: 'Bridge foundation' },
  { id: 'pavement-pressure', label: 'Pavement' },
  { id: 'pipe-pressure', label: 'Pipe network' },
  { id: 'tank-pressure', label: 'Tank' },
];

const DEFAULTS: Record<PressureModule, Record<string, unknown>> = {
  'foundation-bearing': {
    N: 1500,
    Mx: 120,
    My: 80,
    B: 2.5,
    L: 3.0,
    bearing_method: 'structural_linear',
  },
  'lateral-earth': { phi: 30, c: 0, gamma: 18, H: 5, q: 0 },
  'wind-distribution': { vb: 30, height: 12, terrain_category: 2, cpi: 0.2 },
  boussinesq: { q: 200, B: 2.5, L: 3.0, z: 0.5, use_2_1: true },
  consolidation: { delta_sigma: 75, water_table_depth: 1.5, OCR: 1.2, layer_gamma: 18, layer_thickness: 5 },
  'bridge-hydrostatic': { pier_width: 1.5, water_depth: 8, gamma_w: 9.81 },
  'bridge-hydrodynamic': { pier_width: 1.5, water_depth: 8, velocity: 2.5, pier_shape: 'circular' },
  'bridge-foundation': { N: 5000, n_piles: 6, Mx: 200, My: 100 },
  'pavement-pressure': { P: 80, p0: 552, asphalt_mm: 100, base_mm: 200, cbr: 8, n_contact_points: 4 },
  'pipe-pressure': { P_node: 320, diameter_mm: 200, wall_mm: 10, material: 'HDPE' },
  'tank-pressure': { height: 6, radius: 4, gamma_w: 9.81, wind_force: 120, mu: 0.5, tank_weight: 800 },
};

async function runModule(id: PressureModule, inputs: Record<string, unknown>): Promise<PressureResult> {
  const payload = { ...inputs };
  if (id === 'consolidation') {
    payload.layers = [{ gamma: payload.layer_gamma ?? 18, thickness: payload.layer_thickness ?? 5 }];
  }
  if (id === 'boussinesq' && payload.use_2_1 === undefined) {
    payload.use_2_1 = true;
  }
  if (id === 'wind-distribution' && payload.terrain_category != null) {
    payload.terrain_category = Number(payload.terrain_category);
  }

  switch (id) {
    case 'foundation-bearing':
      return pressureAPI.foundationBearing(payload);
    case 'lateral-earth':
      return pressureAPI.lateralEarth(payload);
    case 'wind-distribution':
      return pressureAPI.windDistribution(payload);
    case 'boussinesq':
      return pressureAPI.boussinesq(payload);
    case 'consolidation':
      return pressureAPI.consolidation(payload);
    case 'bridge-hydrostatic':
      return pressureAPI.bridgeHydrostatic(payload);
    case 'bridge-hydrodynamic':
      return pressureAPI.bridgeHydrodynamic(payload);
    case 'bridge-foundation':
      return pressureAPI.bridgeFoundation(payload);
    case 'pavement-pressure':
      return pressureAPI.pavement(payload);
    case 'pipe-pressure':
      return pressureAPI.pipe(payload);
    case 'tank-pressure':
      return pressureAPI.tank(payload);
    default:
      throw new Error(`Unknown module ${id}`);
  }
}

export function PressurePanel() {
  const [moduleId, setModuleId] = useState<PressureModule>('foundation-bearing');
  const [inputs, setInputs] = useState<Record<string, unknown>>(DEFAULTS['foundation-bearing']);
  const [result, setResult] = useState<PressureResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectModule = (id: PressureModule) => {
    setModuleId(id);
    setInputs({ ...DEFAULTS[id] });
    setResult(null);
    setError(null);
  };

  const setField = (key: string, value: number | string | boolean) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const calculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runModule(moduleId, inputs);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pressure calculation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-gray-500">
        Pressure distribution — structural, geotechnical, bridge, pavement, and WASH.
      </p>

      <div className="flex flex-wrap gap-1">
        {MODULES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => selectModule(m.id)}
            className={`px-2 py-1 text-[10px] rounded ${
              moduleId === m.id ? 'bg-infra-highlight text-white' : 'bg-infra-accent/30 text-gray-400'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <PressureInputForm moduleId={moduleId} inputs={inputs} onChange={setField} />

      <button
        type="button"
        onClick={() => void calculate()}
        disabled={loading}
        className="w-full py-2 bg-infra-highlight hover:bg-infra-highlight/80 disabled:opacity-50 text-white text-sm font-semibold rounded"
      >
        {loading ? 'Calculating…' : 'CALCULATE PRESSURE'}
      </button>

      {error && (
        <div className="p-2 text-xs text-red-300 bg-red-900/30 border border-red-700/50 rounded">{error}</div>
      )}

      {result && <ResultsDisplay result={result} reviewKeyPrefix={`pressure-${moduleId}`} />}
    </div>
  );
}

function PressureInputForm({
  moduleId,
  inputs,
  onChange,
}: {
  moduleId: PressureModule;
  inputs: Record<string, unknown>;
  onChange: (key: string, value: number | string | boolean) => void;
}) {
  const n = (key: string, label: string, fallback: number) => (
    <label key={key} className="block text-xs text-gray-400">
      {label}
      <input
        type="number"
        className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white text-sm"
        value={Number(inputs[key] ?? fallback)}
        onChange={(e) => onChange(key, parseFloat(e.target.value) || 0)}
      />
    </label>
  );

  const sel = (key: string, label: string, options: { value: string; label: string }[]) => (
    <label key={key} className="block text-xs text-gray-400">
      {label}
      <select
        className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white text-sm"
        value={String(inputs[key] ?? options[0].value)}
        onChange={(e) => onChange(key, e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  switch (moduleId) {
    case 'foundation-bearing':
      return (
        <>
          {sel('bearing_method', 'Bearing method', [
            { value: 'structural_linear', label: 'Office standard (Foundation calculator)' },
            { value: 'corner_biaxial', label: 'Alternate — biaxial corners' },
          ])}
          {n('N', 'Vertical load N (kN)', 1500)}
          {n('Mx', 'Moment Mx (kNm)', 120)}
          {n('My', 'Moment My (kNm)', 80)}
          {n('B', 'Width B (m)', 2.5)}
          {n('L', 'Length L (m)', 3.0)}
        </>
      );
    case 'lateral-earth':
      return (
        <>
          {n('phi', 'Friction angle φ (°)', 30)}
          {n('c', 'Cohesion c (kPa)', 0)}
          {n('gamma', 'Unit weight γ (kN/m³)', 18)}
          {n('H', 'Wall height H (m)', 5)}
          {n('q', 'Surcharge q (kPa)', 0)}
        </>
      );
    case 'wind-distribution':
      return (
        <>
          {n('vb', 'Basic wind speed vb (m/s)', 30)}
          {n('height', 'Reference height z (m)', 12)}
          {sel('terrain_category', 'Terrain category', [
            { value: '0', label: '0 — Sea' },
            { value: '1', label: 'I — Open' },
            { value: '2', label: 'II — Rural' },
            { value: '3', label: 'III — Suburban' },
            { value: '4', label: 'IV — Urban' },
          ])}
          {n('cpi', 'Internal pressure coefficient Cpi', 0.2)}
        </>
      );
    case 'boussinesq':
      return (
        <>
          {n('q', 'Surface pressure q (kPa)', 200)}
          {n('B', 'Footing width B (m)', 2.5)}
          {n('L', 'Footing length L (m)', 3.0)}
          {n('z', 'Depth below footing z (m)', 0.5)}
          <label className="flex items-center gap-2 text-xs text-gray-400 mt-2">
            <input
              type="checkbox"
              checked={inputs.use_2_1 !== false}
              onChange={(e) => onChange('use_2_1', e.target.checked)}
            />
            Use 2:1 spread (preliminary)
          </label>
        </>
      );
    case 'consolidation':
      return (
        <>
          {n('layer_gamma', 'Layer unit weight γ (kN/m³)', 18)}
          {n('layer_thickness', 'Layer thickness (m)', 5)}
          {n('water_table_depth', 'Water table depth (m)', 1.5)}
          {n('delta_sigma', 'Stress increase Δσ (kPa)', 75)}
          {n('OCR', 'OCR', 1.2)}
        </>
      );
    case 'bridge-hydrostatic':
      return (
        <>
          {n('pier_width', 'Pier width (m)', 1.5)}
          {n('water_depth', 'Water depth (m)', 8)}
          {n('gamma_w', 'γw (kN/m³)', 9.81)}
        </>
      );
    case 'bridge-hydrodynamic':
      return (
        <>
          {n('pier_width', 'Pier width (m)', 1.5)}
          {n('water_depth', 'Water depth (m)', 8)}
          {n('velocity', 'Flood velocity (m/s)', 2.5)}
          {sel('pier_shape', 'Pier shape', [
            { value: 'circular', label: 'Circular' },
            { value: 'rectangular', label: 'Rectangular' },
          ])}
        </>
      );
    case 'bridge-foundation':
      return (
        <>
          {n('N', 'Vertical load N (kN)', 5000)}
          {n('Mx', 'Moment Mx (kNm)', 200)}
          {n('My', 'Moment My (kNm)', 100)}
          {n('n_piles', 'Number of piles', 6)}
        </>
      );
    case 'pavement-pressure':
      return (
        <>
          {n('P', 'Axle load P (kN)', 80)}
          {n('p0', 'Tyre pressure p0 (kPa)', 552)}
          {n('asphalt_mm', 'Asphalt thickness (mm)', 100)}
          {n('base_mm', 'Base thickness (mm)', 200)}
          {n('cbr', 'Subgrade CBR', 8)}
          {n('n_contact_points', 'Tyre contact points (4 = standard axle)', 4)}
        </>
      );
    case 'pipe-pressure':
      return (
        <>
          {n('P_node', 'Node pressure (kPa)', 320)}
          {n('diameter_mm', 'Pipe diameter (mm)', 200)}
          {n('wall_mm', 'Wall thickness (mm)', 10)}
          {sel('material', 'Material', [
            { value: 'HDPE', label: 'HDPE' },
            { value: 'PVC', label: 'PVC' },
            { value: 'Steel', label: 'Steel' },
            { value: 'CI', label: 'Cast iron' },
          ])}
        </>
      );
    case 'tank-pressure':
      return (
        <>
          {n('height', 'Tank height H (m)', 6)}
          {n('radius', 'Tank radius r (m)', 4)}
          {n('gamma_w', 'γw (kN/m³)', 9.81)}
          {n('wind_force', 'Wind force on tank (kN)', 120)}
          {n('tank_weight', 'Tank + contents weight (kN)', 800)}
          {n('mu', 'Friction coefficient μ', 0.5)}
        </>
      );
    default:
      return null;
  }
}
