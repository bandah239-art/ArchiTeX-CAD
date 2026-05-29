import { useState } from 'react';
import { NumField } from '../FormElements';
import { API_BASE } from '../../../services/apiConfig';

interface FloorRow { level_m: number; slab_thickness_mm: number; imposed_kPa: number; finishes_kPa: number; partitions_kPa: number; grid_x_m: number; grid_y_m: number; }
interface LTResult {
  status: string;
  load_summary: { level_m: number; slab_dl_kpa: number; uls_floor_load_kpa: number; tributary_area_m2: number; floor_axial_load_kn: number; cumulative_axial_load_kn: number }[];
  column_schedule: { grid_ref: string; section: string; axial_load_uls_kn: number; concrete_volume_m3: number }[];
  foundation_schedule: { footing_type: string; axial_load_sls_kn: number; pad_dimensions: string; concrete_volume_m3: number }[];
  total_concrete_m3: number;
  total_rebar_tonnes: number;
  boq_ready_quantities: Record<string, number>;
}

const DEF_FLOOR: FloorRow = { level_m: 3, slab_thickness_mm: 150, imposed_kPa: 2.5, finishes_kPa: 1.0, partitions_kPa: 1.0, grid_x_m: 4, grid_y_m: 4 };

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-[10px] text-gray-400 font-semibold text-left py-1 px-2 border-b border-infra-accent/30">{children}</th>;
}
function Td({ children, hi }: { children: React.ReactNode; hi?: boolean }) {
  return <td className={`text-xs py-1 px-2 border-b border-infra-accent/15 ${hi ? 'text-infra-highlight font-bold' : 'text-gray-300'}`}>{children}</td>;
}

export function LoadTakedownCalculator() {
  const [floors, setFloors] = useState<FloorRow[]>([
    { level_m: 6, slab_thickness_mm: 150, imposed_kPa: 2.5, finishes_kPa: 1.0, partitions_kPa: 1.0, grid_x_m: 4, grid_y_m: 4 },
    { level_m: 3, slab_thickness_mm: 150, imposed_kPa: 2.5, finishes_kPa: 1.0, partitions_kPa: 1.0, grid_x_m: 4, grid_y_m: 4 },
  ]);
  const [soilBearing, setSoilBearing] = useState(150);
  const [result, setResult] = useState<LTResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addFloor() {
    const topLevel = floors.length > 0 ? Math.max(...floors.map(f => f.level_m)) + 3 : 3;
    setFloors([...floors, { ...DEF_FLOOR, level_m: topLevel }]);
  }

  function removeFloor(i: number) {
    setFloors(floors.filter((_, idx) => idx !== i));
  }

  function updateFloor(i: number, field: keyof FloorRow, val: number) {
    setFloors(floors.map((f, idx) => idx === i ? { ...f, [field]: val } : f));
  }

  async function compute() {
    if (floors.length === 0) { setError('Add at least one floor.'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/calculate/load-takedown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          floors,
          walls: [],
          columns: [{ grid_ref: 'C1', section_b: 300, section_h: 300 }],
          foundation: { soil_bearing_capacity_kpa: soilBearing },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const boq = result?.boq_ready_quantities;

  return (
    <div className="flex flex-col space-y-4 bg-infra-bg/50 p-4 border border-infra-accent/30 rounded-lg">
      <div className="flex justify-between items-center">
        <h3 className="text-infra-highlight font-bold uppercase text-sm tracking-wider">Load Takedown</h3>
        <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">BS 8110 ULS</span>
      </div>

      {/* Floors */}
      <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-xs font-bold text-white">Floor Levels</h4>
          <button type="button" onClick={addFloor} className="text-xs px-2 py-0.5 border border-infra-highlight/50 rounded text-infra-highlight hover:bg-infra-highlight/10">+ Add Floor</button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {floors.map((f, i) => (
            <div key={i} className="p-2 border border-infra-accent/20 rounded space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 font-semibold">Floor {i + 1} — {f.level_m}m agl</span>
                <button type="button" onClick={() => removeFloor(i)} className="text-xs text-red-400 hover:text-red-300">✕</button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <NumField label="Level (m)" value={f.level_m} onChange={(v) => updateFloor(i, 'level_m', v)} />
                <NumField label="Slab t (mm)" value={f.slab_thickness_mm} onChange={(v) => updateFloor(i, 'slab_thickness_mm', v)} />
                <NumField label="Imposed (kPa)" value={f.imposed_kPa} onChange={(v) => updateFloor(i, 'imposed_kPa', v)} />
                <NumField label="Finishes (kPa)" value={f.finishes_kPa} onChange={(v) => updateFloor(i, 'finishes_kPa', v)} />
                <NumField label="Partitions (kPa)" value={f.partitions_kPa} onChange={(v) => updateFloor(i, 'partitions_kPa', v)} />
                <NumField label="Grid X (m)" value={f.grid_x_m} onChange={(v) => updateFloor(i, 'grid_x_m', v)} />
                <NumField label="Grid Y (m)" value={f.grid_y_m} onChange={(v) => updateFloor(i, 'grid_y_m', v)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <NumField label="Allowable Soil Bearing Capacity (kPa)" value={soilBearing} onChange={setSoilBearing} />

      <button
        type="button"
        onClick={compute}
        disabled={loading}
        className="w-full py-2 bg-infra-highlight text-white text-xs font-bold rounded uppercase tracking-wider hover:bg-infra-highlight/80 disabled:opacity-50"
      >
        {loading ? 'CALCULATING...' : 'RUN LOAD TAKEDOWN'}
      </button>

      {error && <div className="p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">{error}</div>}

      {result && (
        <div className="space-y-3">
          {/* Load summary table */}
          <div className="overflow-x-auto">
            <h4 className="text-xs font-bold text-white mb-1">Floor Load Summary</h4>
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <Th>Level (m)</Th><Th>ULS (kPa)</Th><Th>Trib. (m²)</Th><Th>Floor (kN)</Th><Th>Cumulative (kN)</Th>
                </tr>
              </thead>
              <tbody>
                {result.load_summary.map((row, i) => (
                  <tr key={i}>
                    <Td>{row.level_m}</Td>
                    <Td>{row.uls_floor_load_kpa}</Td>
                    <Td>{row.tributary_area_m2}</Td>
                    <Td>{row.floor_axial_load_kn}</Td>
                    <Td hi>{row.cumulative_axial_load_kn}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Foundation */}
          {result.foundation_schedule.map((f, i) => (
            <div key={i} className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
              <h4 className="text-xs font-bold text-white mb-1">{f.footing_type}</h4>
              <div className="flex flex-wrap gap-4 text-xs">
                <span className="text-gray-400">SLS Load: <span className="text-infra-highlight font-bold">{f.axial_load_sls_kn} kN</span></span>
                <span className="text-gray-400">Pad size: <span className="text-white font-bold">{f.pad_dimensions}</span></span>
                <span className="text-gray-400">Concrete: <span className="text-white">{f.concrete_volume_m3} m³</span></span>
              </div>
            </div>
          ))}

          {/* BoQ */}
          {boq && (
            <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
              <h4 className="text-xs font-bold text-white mb-2">BoQ Quantities</h4>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(boq).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-infra-accent/15 py-0.5">
                    <span className="text-gray-400 text-xs capitalize">{k.replace(/_/g, ' ')}</span>
                    <span className="text-infra-highlight font-bold text-xs font-mono">{Number(v).toFixed(1)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-b border-infra-accent/15 py-0.5">
                  <span className="text-gray-400 text-xs">Total concrete (m³)</span>
                  <span className="text-infra-highlight font-bold text-xs font-mono">{result.total_concrete_m3}</span>
                </div>
                <div className="flex justify-between border-b border-infra-accent/15 py-0.5">
                  <span className="text-gray-400 text-xs">Total rebar (t)</span>
                  <span className="text-infra-highlight font-bold text-xs font-mono">{result.total_rebar_tonnes}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
