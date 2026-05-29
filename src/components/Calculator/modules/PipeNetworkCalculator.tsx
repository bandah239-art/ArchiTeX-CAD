import { useState } from 'react';
import type { CalculatorFormProps } from '../CalculatorTypes';
import { NumField, SelectField } from '../FormElements';
import { API_BASE } from '../../../services/apiConfig';

interface NodeConfig {
  id: string;
  population: number;
  nodeType: string;
  elevation_m: number;
  pipe_length_m: number;
  pipe_diameter_mm: number;
}

interface NetworkResult {
  status: string;
  summary: Record<string, number | string>;
  pipe_results: { id: string; diameter_mm: number; flow_lps: number; velocity_ms: number; head_loss_m: number; pipe_class: string; status: string }[];
  node_results: { id: string; type: string; residual_head_m: number; pressure_kpa: number; min_head_required_m: number; demand_lps: number; status: string }[];
  steps: { step_number: number; title: string; formula: string; substitution: string; result: string; unit: string; reference: string; status: string }[];
  warnings: string[];
  errors: string[];
}

const SETTLEMENT_TYPES = [
  { value: 'urban', label: 'Urban (80 L/person/day)' },
  { value: 'peri_urban', label: 'Peri-Urban (50 L/person/day)' },
  { value: 'rural', label: 'Rural (25 L/person/day)' },
];

const MATERIALS = [
  { value: 'hdpe', label: 'HDPE (C=140)' },
  { value: 'pvc', label: 'uPVC (C=150)' },
  { value: 'steel', label: 'Galv. Steel (C=120)' },
  { value: 'ductile_iron', label: 'Ductile Iron (C=130)' },
];

const NODE_TYPES = [
  { value: 'residential', label: 'Residential (min 7 m)' },
  { value: 'commercial', label: 'Commercial (min 14 m)' },
  { value: 'school', label: 'School (min 10 m)' },
  { value: 'clinic', label: 'Clinic / Health (min 14 m)' },
  { value: 'industrial', label: 'Industrial (min 20 m)' },
];

const DEFAULT_NODES: NodeConfig[] = [
  { id: 'N1', population: 500, nodeType: 'residential', elevation_m: 0, pipe_length_m: 300, pipe_diameter_mm: 110 },
  { id: 'N2', population: 300, nodeType: 'commercial', elevation_m: 5, pipe_length_m: 200, pipe_diameter_mm: 90 },
  { id: 'N3', population: 200, nodeType: 'school', elevation_m: 8, pipe_length_m: 150, pipe_diameter_mm: 63 },
];

function Row({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex justify-between border-b border-infra-accent/20 py-0.5">
      <span className="text-gray-400 text-xs">{label}</span>
      <span className={`font-mono text-xs ${highlight ? 'text-infra-highlight font-bold' : 'text-white'}`}>{value}</span>
    </div>
  );
}

export function PipeNetworkCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  const [nodes, setNodes] = useState<NodeConfig[]>(DEFAULT_NODES);
  const [result, setResult] = useState<NetworkResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateNode(idx: number, field: keyof NodeConfig, val: string | number) {
    setNodes((prev) => prev.map((n, i) => i === idx ? { ...n, [field]: val } : n));
  }

  function addNode() {
    if (nodes.length >= 6) return;
    const idx = nodes.length + 1;
    setNodes((prev) => [...prev, { id: `N${idx}`, population: 200, nodeType: 'residential', elevation_m: 0, pipe_length_m: 150, pipe_diameter_mm: 63 }]);
  }

  function removeNode() {
    if (nodes.length <= 1) return;
    setNodes((prev) => prev.slice(0, -1));
  }

  async function compute() {
    setLoading(true);
    setError(null);
    try {
      const material = String(inputs.pipe_material ?? 'hdpe');
      const sourceHead = Number(inputs.source_head_m ?? 50);
      const settlementType = String(inputs.settlement_type ?? 'urban');

      const nodesPayload = nodes.map((n) => ({
        id: n.id,
        population: n.population,
        type: n.nodeType,
        elevation_m: n.elevation_m,
      }));

      const pipesPayload = nodes.map((n, i) => ({
        id: `P${i + 1}`,
        start: i === 0 ? 'src' : nodes[i - 1].id,
        end: n.id,
        length_m: n.pipe_length_m,
        diameter_mm: n.pipe_diameter_mm,
        material,
      }));

      const body = {
        nodes: nodesPayload,
        pipes: pipesPayload,
        loops: [],
        source_head_m: sourceHead,
        settlement_type: settlementType,
      };

      const res = await fetch(`${API_BASE}/wash/pipe-network`, {
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
    <div className="flex flex-col space-y-4 bg-infra-bg/50 p-4 border border-infra-accent/30 rounded-lg">
      <div className="flex justify-between items-center">
        <h3 className="text-infra-highlight font-bold uppercase text-sm tracking-wider">Pipe Network Analysis</h3>
        <span className="text-xs px-2 py-0.5 rounded bg-infra-highlight/25 text-infra-highlight border border-infra-highlight/40">Hardy-Cross · NWASCO</span>
      </div>

      <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
        <h4 className="text-xs font-bold text-white mb-2">Network Parameters</h4>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Settlement Type" value={String(inputs.settlement_type ?? 'urban')} options={SETTLEMENT_TYPES} onChange={(v) => onInputChange('settlement_type', v)} />
          <NumField label="Source Head (m)" value={inputs.source_head_m ?? 50} onChange={(v) => onInputChange('source_head_m', v)} />
          <SelectField label="Pipe Material" value={String(inputs.pipe_material ?? 'hdpe')} options={MATERIALS} onChange={(v) => onInputChange('pipe_material', v)} />
        </div>
      </div>

      <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-xs font-bold text-white">Distribution Nodes (linear chain from source)</h4>
          <div className="flex gap-1">
            <button type="button" onClick={removeNode} disabled={nodes.length <= 1} className="px-2 py-0.5 text-xs bg-red-900/40 text-red-300 rounded hover:bg-red-900/60 disabled:opacity-40">− Node</button>
            <button type="button" onClick={addNode} disabled={nodes.length >= 6} className="px-2 py-0.5 text-xs bg-infra-accent/40 text-gray-300 rounded hover:bg-infra-accent/60 disabled:opacity-40">+ Node</button>
          </div>
        </div>
        <div className="space-y-3">
          {nodes.map((node, i) => (
            <div key={node.id} className="p-2 bg-infra-bg/40 rounded border border-infra-accent/15">
              <div className="text-xs font-bold text-infra-highlight mb-2">
                {node.id} — Pipe P{i + 1}: {i === 0 ? 'Source' : nodes[i - 1].id} → {node.id}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <SelectField label="Node Type" value={node.nodeType} options={NODE_TYPES} onChange={(v) => updateNode(i, 'nodeType', v)} />
                <NumField label="Population" value={node.population} onChange={(v) => updateNode(i, 'population', Math.round(v))} />
                <NumField label="Elevation (m)" value={node.elevation_m} onChange={(v) => updateNode(i, 'elevation_m', v)} />
                <NumField label={`Pipe P${i + 1} Length (m)`} value={node.pipe_length_m} onChange={(v) => updateNode(i, 'pipe_length_m', v)} />
                <NumField label={`Pipe P${i + 1} Diameter (mm)`} value={node.pipe_diameter_mm} onChange={(v) => updateNode(i, 'pipe_diameter_mm', v)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={compute}
        disabled={loading}
        className="w-full py-2 bg-infra-highlight text-white text-xs font-bold rounded uppercase tracking-wider hover:bg-infra-highlight/80 disabled:opacity-50"
      >
        {loading ? 'COMPUTING...' : 'ANALYSE NETWORK — NWASCO / HARDY-CROSS'}
      </button>

      {error && <div className="p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">{error}</div>}

      {result && s && (
        <>
          <div className={`p-3 rounded border text-center font-bold text-sm ${result.status === 'pass' ? 'bg-green-900/30 border-green-700/50 text-green-400' : result.status === 'fail' ? 'bg-red-900/30 border-red-700/50 text-red-400' : 'bg-yellow-900/20 border-yellow-700/40 text-yellow-300'}`}>
            {result.status === 'pass' ? '✓ NWASCO COMPLIANT' : result.status === 'fail' ? '✗ PRESSURE FAILURE' : '⚠ CHECK WARNINGS'}
          </div>

          <div className="grid grid-cols-2 gap-1">
            <Row label="Total demand (L/s)" value={Number(s.total_demand_lps ?? 0).toFixed(2)} highlight />
            <Row label="Nodes / Pipes" value={`${s.node_count ?? 0} / ${s.pipe_count ?? 0}`} />
            <Row label="Required pump head (m)" value={Number(s.required_pump_head_m ?? 0).toFixed(1)} />
            <Row label="Pump power (kW)" value={Number(s.pump_power_kw ?? 0).toFixed(1)} />
            <Row label="Motor rating (kW)" value={Number(s.motor_rating_kw ?? 0).toFixed(1)} highlight />
            <Row label="Max water hammer (kPa)" value={Number(s.max_water_hammer_kpa ?? 0).toFixed(0)} />
          </div>

          {result.node_results.length > 0 && (
            <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
              <h4 className="text-xs font-bold text-white mb-2">Nodal Pressure (NWASCO Check)</h4>
              <div className="space-y-1">
                {result.node_results.map((n) => (
                  <div key={n.id} className={`flex justify-between text-xs py-0.5 border-b border-infra-accent/10 ${n.status === 'fail' ? 'text-red-400' : 'text-white'}`}>
                    <span className="text-gray-400">{n.id} ({n.type})</span>
                    <span className="font-mono">{Number(n.residual_head_m).toFixed(1)} m residual / {n.min_head_required_m} m min — {Number(n.demand_lps).toFixed(2)} L/s</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.pipe_results.length > 0 && (
            <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
              <h4 className="text-xs font-bold text-white mb-2">Pipe Hydraulics (H-W + Darcy-Weisbach)</h4>
              <div className="space-y-1">
                {result.pipe_results.map((p) => (
                  <div key={p.id} className={`flex justify-between text-xs py-0.5 border-b border-infra-accent/10 ${p.status === 'warning' ? 'text-yellow-300' : 'text-white'}`}>
                    <span className="text-gray-400">{p.id} (D{p.diameter_mm}mm)</span>
                    <span className="font-mono">{Number(p.flow_lps).toFixed(2)} L/s · {Number(p.velocity_ms).toFixed(2)} m/s · hf {Number(p.head_loss_m).toFixed(2)} m · {p.pipe_class}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.warnings.length > 0 && (
            <div className="space-y-1">
              {result.warnings.map((w, i) => (
                <div key={i} className="p-2 bg-yellow-900/20 border border-yellow-700/40 rounded text-xs text-yellow-300">⚠ {w}</div>
              ))}
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="space-y-1">
              {result.errors.map((e, i) => (
                <div key={i} className="p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">✗ {e}</div>
              ))}
            </div>
          )}

          <details className="text-xs">
            <summary className="cursor-pointer text-gray-400 hover:text-infra-highlight py-1">Show calculation steps ({result.steps.length})</summary>
            <div className="mt-2 space-y-2">
              {result.steps.map((step) => (
                <div key={step.step_number} className={`border rounded p-2 space-y-0.5 ${step.status === 'fail' ? 'border-red-700/50' : step.status === 'warning' ? 'border-yellow-700/40' : 'border-infra-accent/20'}`}>
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
