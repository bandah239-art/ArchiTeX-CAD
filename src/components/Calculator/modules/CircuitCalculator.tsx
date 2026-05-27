import { useState } from 'react';
import { API_BASE } from '../../../services/apiConfig';
import { BodePlot } from '../../Circuit/BodePlot';
import { TransientPlot } from '../../Circuit/TransientPlot';

type AnalysisMode = 'dc' | 'ac' | 'transient';

// ---------------------------------------------------------------------------
// Preset circuit definitions
// ---------------------------------------------------------------------------

interface Preset {
  label: string;
  description: string;
  components: (vals: Record<string, number>) => object[];
  params: { key: string; label: string; default: number; unit: string }[];
  acInputNode?: string;
  acOutputNode?: string;
  transientOutputNodes?: string[];
}

const PRESETS: Record<string, Preset> = {
  rc_divider: {
    label: 'RC Low-Pass Filter',
    description: 'First-order RC filter — Vout at capacitor. f₋₃dB = 1/(2πRC)',
    params: [
      { key: 'R', label: 'R (Ω)', default: 1000, unit: 'Ω' },
      { key: 'C', label: 'C (F)', default: 100e-9, unit: 'F' },
      { key: 'Vin', label: 'Vin (V)', default: 5, unit: 'V' },
    ],
    components: (v) => [
      { type: 'V', id: 'V1', 'n+': '1', 'n-': '0', value: v.Vin, ac_value: 1 },
      { type: 'R', id: 'R1', 'n+': '1', 'n-': '2', value: v.R },
      { type: 'C', id: 'C1', 'n+': '2', 'n-': '0', value: v.C },
    ],
    acInputNode: '1',
    acOutputNode: '2',
    transientOutputNodes: ['1', '2'],
  },
  rc_highpass: {
    label: 'RC High-Pass Filter',
    description: 'Series capacitor — Vout across R. f₋₃dB = 1/(2πRC)',
    params: [
      { key: 'R', label: 'R (Ω)', default: 1000, unit: 'Ω' },
      { key: 'C', label: 'C (F)', default: 100e-9, unit: 'F' },
      { key: 'Vin', label: 'Vin (V)', default: 5, unit: 'V' },
    ],
    components: (v) => [
      { type: 'V', id: 'V1', 'n+': '1', 'n-': '0', value: v.Vin, ac_value: 1 },
      { type: 'C', id: 'C1', 'n+': '1', 'n-': '2', value: v.C },
      { type: 'R', id: 'R1', 'n+': '2', 'n-': '0', value: v.R },
    ],
    acInputNode: '1',
    acOutputNode: '2',
    transientOutputNodes: ['1', '2'],
  },
  rlc_bandpass: {
    label: 'RLC Band-Pass',
    description: 'Series RLC — Vout across R. f₀ = 1/(2π√LC), Q = ω₀L/R',
    params: [
      { key: 'R', label: 'R (Ω)', default: 100, unit: 'Ω' },
      { key: 'L', label: 'L (H)', default: 1e-3, unit: 'H' },
      { key: 'C', label: 'C (F)', default: 10e-9, unit: 'F' },
      { key: 'Vin', label: 'Vin (V)', default: 1, unit: 'V' },
    ],
    components: (v) => [
      { type: 'V', id: 'V1', 'n+': '1', 'n-': '0', value: v.Vin, ac_value: 1 },
      { type: 'R', id: 'R1', 'n+': '1', 'n-': '2', value: v.R },
      { type: 'L', id: 'L1', 'n+': '2', 'n-': '3', value: v.L },
      { type: 'C', id: 'C1', 'n+': '3', 'n-': '0', value: v.C },
    ],
    acInputNode: '1',
    acOutputNode: '2',
    transientOutputNodes: ['2', '3'],
  },
  voltage_divider: {
    label: 'Resistive Divider',
    description: 'Two-resistor divider. Vout = Vin × R2/(R1+R2)',
    params: [
      { key: 'R1', label: 'R1 (Ω)', default: 10000, unit: 'Ω' },
      { key: 'R2', label: 'R2 (Ω)', default: 10000, unit: 'Ω' },
      { key: 'Vin', label: 'Vin (V)', default: 12, unit: 'V' },
    ],
    components: (v) => [
      { type: 'V', id: 'V1', 'n+': '1', 'n-': '0', value: v.Vin },
      { type: 'R', id: 'R1', 'n+': '1', 'n-': '2', value: v.R1 },
      { type: 'R', id: 'R2', 'n+': '2', 'n-': '0', value: v.R2 },
    ],
    acInputNode: '1',
    acOutputNode: '2',
    transientOutputNodes: ['2'],
  },
  wheatstone: {
    label: 'Wheatstone Bridge',
    description: 'Classic bridge. Vout = Vin×(R3/(R1+R3) − R4/(R2+R4))',
    params: [
      { key: 'R1', label: 'R1 (Ω)', default: 1000, unit: 'Ω' },
      { key: 'R2', label: 'R2 (Ω)', default: 1000, unit: 'Ω' },
      { key: 'R3', label: 'R3 (Ω)', default: 1000, unit: 'Ω' },
      { key: 'R4', label: 'R4 (Ω)', default: 1100, unit: 'Ω' },
      { key: 'Vin', label: 'Vin (V)', default: 5, unit: 'V' },
    ],
    components: (v) => [
      { type: 'V', id: 'VS', 'n+': '1', 'n-': '0', value: v.Vin },
      { type: 'R', id: 'R1', 'n+': '1', 'n-': '2', value: v.R1 },
      { type: 'R', id: 'R2', 'n+': '1', 'n-': '3', value: v.R2 },
      { type: 'R', id: 'R3', 'n+': '2', 'n-': '0', value: v.R3 },
      { type: 'R', id: 'R4', 'n+': '3', 'n-': '0', value: v.R4 },
    ],
    acInputNode: '1',
    acOutputNode: '2',
    transientOutputNodes: ['2', '3'],
  },
  opamp_inverting: {
    label: 'Op-Amp Inverting',
    description: 'Ideal inverting amplifier. Gain = -Rf/Rin. V(out) = -(Rf/Rin)×Vin',
    params: [
      { key: 'Rin', label: 'Rin (Ω)', default: 10000, unit: 'Ω' },
      { key: 'Rf', label: 'Rf (Ω)', default: 100000, unit: 'Ω' },
      { key: 'Vin', label: 'Vin (V)', default: 0.5, unit: 'V' },
      { key: 'A', label: 'Open-loop gain', default: 1e5, unit: '' },
    ],
    components: (v) => [
      { type: 'V', id: 'Vin', 'n+': 'in', 'n-': '0', value: v.Vin, ac_value: 1 },
      { type: 'R', id: 'Rin', 'n+': 'in', 'n-': 'vm', value: v.Rin },
      { type: 'R', id: 'Rf', 'n+': 'vm', 'n-': 'out', value: v.Rf },
      // Ideal op-amp: V(out) = A × (V(vp) - V(vm)), vp = GND
      { type: 'E', id: 'E1', 'n+': 'out', 'n-': '0', 'nc+': '0', 'nc-': 'vm', value: v.A },
    ],
    acInputNode: 'in',
    acOutputNode: 'out',
    transientOutputNodes: ['in', 'out'],
  },
  opamp_noninverting: {
    label: 'Op-Amp Non-Inverting',
    description: 'Ideal non-inverting amplifier. Gain = 1 + Rf/R1.',
    params: [
      { key: 'R1', label: 'R1 (Ω)', default: 10000, unit: 'Ω' },
      { key: 'Rf', label: 'Rf (Ω)', default: 90000, unit: 'Ω' },
      { key: 'Vin', label: 'Vin (V)', default: 0.1, unit: 'V' },
      { key: 'A', label: 'Open-loop gain', default: 1e5, unit: '' },
    ],
    components: (v) => [
      { type: 'V', id: 'Vin', 'n+': 'vp', 'n-': '0', value: v.Vin, ac_value: 1 },
      { type: 'R', id: 'R1', 'n+': '0', 'n-': 'vm', value: v.R1 },
      { type: 'R', id: 'Rf', 'n+': 'vm', 'n-': 'out', value: v.Rf },
      { type: 'E', id: 'E1', 'n+': 'out', 'n-': '0', 'nc+': 'vp', 'nc-': 'vm', value: v.A },
    ],
    acInputNode: 'vp',
    acOutputNode: 'out',
    transientOutputNodes: ['vp', 'out'],
  },
  opamp_integrator: {
    label: 'Op-Amp Integrator',
    description: 'Miller integrator. Vout = -1/(RC)×∫Vin·dt. f₋₃dB = 1/(2πRC)',
    params: [
      { key: 'R', label: 'R (Ω)', default: 10000, unit: 'Ω' },
      { key: 'C', label: 'C (F)', default: 1e-6, unit: 'F' },
      { key: 'A', label: 'Open-loop gain', default: 1e5, unit: '' },
    ],
    components: (v) => [
      { type: 'V', id: 'Vin', 'n+': 'in', 'n-': '0', value: 1, ac_value: 1, waveform: 'sin', amplitude: 1, frequency: 100 },
      { type: 'R', id: 'Rin', 'n+': 'in', 'n-': 'vm', value: v.R },
      { type: 'C', id: 'Cf', 'n+': 'vm', 'n-': 'out', value: v.C },
      { type: 'E', id: 'E1', 'n+': 'out', 'n-': '0', 'nc+': '0', 'nc-': 'vm', value: v.A },
    ],
    acInputNode: 'in',
    acOutputNode: 'out',
    transientOutputNodes: ['in', 'out'],
  },
};

// ---------------------------------------------------------------------------
// DC results table component
// ---------------------------------------------------------------------------

function DCResults({ components }: { components: object[] }) {
  const [result, setResult] = useState<{ node_voltages: Record<string, number>; branch_currents: Record<string, number>; status: string } | null>(null);

  useState(() => {
    if (!components.length) return;
    fetch(`${API_BASE}/circuit/dc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ components }),
    })
      .then((r) => r.json())
      .then(setResult)
      .catch(() => null);
  });

  if (!result) return <div className="text-xs text-gray-500">Running DC…</div>;
  if (result.status !== 'ok') return <div className="text-xs text-red-400">{result.status}</div>;

  return (
    <div className="space-y-2">
      <div>
        <div className="text-[10px] text-gray-500 uppercase mb-1">Node Voltages</div>
        <div className="grid grid-cols-3 gap-1">
          {Object.entries(result.node_voltages).map(([nd, v]) => (
            <div key={nd} className="bg-gray-800/60 rounded p-1.5 text-center">
              <div className="text-[10px] text-gray-400">V({nd})</div>
              <div className="text-xs font-mono text-purple-400 font-bold">{v.toFixed(4)} V</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] text-gray-500 uppercase mb-1">Branch Currents</div>
        <div className="grid grid-cols-3 gap-1">
          {Object.entries(result.branch_currents).map(([id, i]) => (
            <div key={id} className="bg-gray-800/60 rounded p-1.5 text-center">
              <div className="text-[10px] text-gray-400">I({id})</div>
              <div className="text-xs font-mono text-green-400 font-bold">
                {Math.abs(i) < 1e-3 ? `${(i * 1e6).toFixed(2)} µA` : Math.abs(i) < 1 ? `${(i * 1000).toFixed(3)} mA` : `${i.toFixed(4)} A`}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main CircuitCalculator
// ---------------------------------------------------------------------------

export function CircuitCalculator({ inputs: _inputs, onInputChange: _onInputChange }: { inputs: Record<string, unknown>; onInputChange: (k: string, v: unknown) => void }) {
  const [presetKey, setPresetKey] = useState<string>('rc_divider');
  const [mode, setMode] = useState<AnalysisMode>('dc');
  const [paramVals, setParamVals] = useState<Record<string, Record<string, number>>>({});

  const preset = PRESETS[presetKey];

  const getParams = (key: string): Record<string, number> => {
    const defaults: Record<string, number> = {};
    PRESETS[key].params.forEach((p) => { defaults[p.key] = p.default; });
    return { ...defaults, ...(paramVals[key] ?? {}) };
  };

  const setParam = (pKey: string, val: number) => {
    setParamVals((prev) => ({
      ...prev,
      [presetKey]: { ...getParams(presetKey), [pKey]: val },
    }));
  };

  const currentParams = getParams(presetKey);
  const components = preset.components(currentParams);

  const f0 = (() => {
    const R = currentParams.R ?? currentParams.R1 ?? 1000;
    const C = currentParams.C ?? 100e-9;
    const L = currentParams.L;
    if (L) return 1 / (2 * Math.PI * Math.sqrt(L * C));
    return 1 / (2 * Math.PI * R * C);
  })();

  const freqStart = f0 < 100 ? 1 : f0 > 1e6 ? 1e3 : 0.1;
  const freqStop = Math.max(f0 * 1000, 1e6);

  return (
    <div className="space-y-3">
      {/* Preset selector */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Circuit Preset</label>
        <select
          value={presetKey}
          onChange={(e) => setPresetKey(e.target.value)}
          className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none"
        >
          {Object.entries(PRESETS).map(([k, p]) => (
            <option key={k} value={k}>{p.label}</option>
          ))}
        </select>
        <p className="text-[10px] text-gray-500 mt-1">{preset.description}</p>
      </div>

      {/* Component values */}
      <div className="grid grid-cols-2 gap-2">
        {preset.params.map((p) => (
          <div key={p.key}>
            <label className="block text-[10px] text-gray-400 mb-0.5">{p.label}</label>
            <input
              type="number"
              value={currentParams[p.key]}
              step="any"
              onChange={(e) => setParam(p.key, parseFloat(e.target.value) || p.default)}
              className="w-full px-2 py-1 text-xs bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none"
            />
          </div>
        ))}
      </div>

      {/* Analysis mode tabs */}
      <div className="flex gap-1 border-b border-gray-700 pb-2">
        {(['dc', 'ac', 'transient'] as AnalysisMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`text-xs px-3 py-1 rounded-t border transition-colors ${
              mode === m
                ? 'bg-purple-900/30 text-purple-400 border-purple-700/50'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Results */}
      {mode === 'dc' && <DCResults components={components} />}

      {mode === 'ac' && (
        <BodePlot
          components={components}
          freq_start={freqStart}
          freq_stop={freqStop}
          n_pts={120}
          input_node={preset.acInputNode ?? '1'}
          output_node={preset.acOutputNode ?? '2'}
        />
      )}

      {mode === 'transient' && (
        <TransientPlot
          components={components.map((c: object) => {
            const comp = c as Record<string, unknown>;
            if (comp.type === 'V' && (preset.acInputNode === comp['n+'] || comp.id === 'V1' || comp.id === 'VS')) {
              return { ...comp, waveform: 'sin', amplitude: comp.value, frequency: Math.min(f0, 10000) };
            }
            return comp;
          })}
          t_stop={Math.min(5 / Math.max(f0, 1), 0.05)}
          dt={Math.min(1 / (Math.max(f0, 1) * 200), 1e-4)}
          output_nodes={preset.transientOutputNodes ?? ['2']}
        />
      )}
    </div>
  );
}
