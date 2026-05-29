import { useState, useRef } from 'react';
import { API_BASE } from '../../../services/apiConfig';
import { RelayGradingChart } from '../../Power/RelayGradingChart';
import { HarmonicSpectrum } from '../../Power/HarmonicSpectrum';
import type { CalculatorFormProps } from '../CalculatorTypes';

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = 'short_circuit' | 'relay_grading' | 'harmonics';

interface RelaySpec {
  id: string;
  label: string;
  pickup_a: number;
  tms: number;
  curve: 'SI' | 'VI' | 'EI';
}

interface ShortCircuitResult {
  fault_current_3ph_ka: number;
  fault_current_1ph_ka: number;
  x_r_ratio: number;
  switchgear_rating_kva: number;
  status: string;
}

// ── Relay presets ────────────────────────────────────────────────────────────

const RELAY_PRESETS: Record<string, { label: string; relays: RelaySpec[] }> = {
  simple_radial: {
    label: 'Simple radial (2 relays)',
    relays: [
      { id: 'R1', label: 'Feeder', pickup_a: 200, tms: 0.1, curve: 'SI' },
      { id: 'R2', label: 'Source', pickup_a: 400, tms: 0.3, curve: 'SI' },
    ],
  },
  ring_feeder: {
    label: 'Ring feeder (3 relays)',
    relays: [
      { id: 'R1', label: 'Zone 1', pickup_a: 150, tms: 0.1, curve: 'VI' },
      { id: 'R2', label: 'Zone 2', pickup_a: 300, tms: 0.2, curve: 'VI' },
      { id: 'R3', label: 'Incomer', pickup_a: 600, tms: 0.4, curve: 'VI' },
    ],
  },
  custom: {
    label: 'Custom',
    relays: [],
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

// Labelled number input matching the dark infra style
function Field({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">
        {label}{unit ? <span className="text-gray-500 ml-1">({unit})</span> : null}
      </label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step ?? 'any'}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-2 py-1 text-xs bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none focus:border-yellow-500/60"
      />
    </div>
  );
}

// ── Short Circuit Tab ─────────────────────────────────────────────────────────

function ShortCircuitTab() {
  const [inputs, setInputs] = useState({
    system_voltage_kv: 11,
    source_impedance_ohm: 0.05,
    cable_length_km: 1.0,
    cable_r_ohm_km: 0.32,
    cable_x_ohm_km: 0.08,
  });
  const [result, setResult] = useState<ShortCircuitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function set<K extends keyof typeof inputs>(k: K, v: number) {
    setInputs((prev) => ({ ...prev, [k]: v }));
  }

  async function run() {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/power/short-circuit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputs),
        signal: ac.signal,
      });
      const data: ShortCircuitResult = await res.json();
      setResult(data);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-[10px] text-gray-500">
        IEC 60909 symmetrical short-circuit calculation. Computes 3-phase and 1-phase fault currents and minimum switchgear rating.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Field label="System Voltage" unit="kV" value={inputs.system_voltage_kv} min={0.4} max={400} step={0.1}
          onChange={(v) => set('system_voltage_kv', v)} />
        <Field label="Source Impedance" unit="Ω" value={inputs.source_impedance_ohm} min={0.001} step={0.001}
          onChange={(v) => set('source_impedance_ohm', v)} />
        <Field label="Cable Length" unit="km" value={inputs.cable_length_km} min={0.01} step={0.01}
          onChange={(v) => set('cable_length_km', v)} />
        <Field label="Cable R" unit="Ω/km" value={inputs.cable_r_ohm_km} min={0.001} step={0.01}
          onChange={(v) => set('cable_r_ohm_km', v)} />
        <Field label="Cable X" unit="Ω/km" value={inputs.cable_x_ohm_km} min={0.001} step={0.01}
          onChange={(v) => set('cable_x_ohm_km', v)} />
      </div>

      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="w-full py-2 bg-yellow-700/70 hover:bg-yellow-600/70 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded transition-all"
      >
        {loading ? 'Calculating…' : 'RUN SHORT-CIRCUIT ANALYSIS'}
      </button>

      {error && (
        <div className="p-2 bg-red-900/30 border border-red-700/40 rounded text-xs text-red-300">{error}</div>
      )}

      {result && result.status === 'ok' && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          <ResultCard label="3-Phase Fault" value={`${result.fault_current_3ph_ka.toFixed(3)} kA`} highlight />
          <ResultCard label="1-Phase Fault" value={`${result.fault_current_1ph_ka.toFixed(3)} kA`} />
          <ResultCard label="X/R Ratio" value={result.x_r_ratio.toFixed(2)} />
          <ResultCard label="Switchgear Rating" value={`${(result.switchgear_rating_kva / 1000).toFixed(1)} MVA`} highlight />
        </div>
      )}

      {result && result.status !== 'ok' && (
        <div className="p-2 bg-red-900/30 border border-red-700/40 rounded text-xs text-red-300">
          Error: {result.status}
        </div>
      )}
    </div>
  );
}

function ResultCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded p-2 text-center ${highlight ? 'bg-yellow-900/30 border border-yellow-700/40' : 'bg-gray-800/60'}`}>
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className={`font-bold text-sm font-mono ${highlight ? 'text-yellow-300' : 'text-indigo-400'}`}>{value}</div>
    </div>
  );
}

// ── Relay Grading Tab ─────────────────────────────────────────────────────────

function RelayGradingTab() {
  const [presetKey, setPresetKey] = useState<string>('simple_radial');
  const [relays, setRelays] = useState<RelaySpec[]>(RELAY_PRESETS.simple_radial.relays);
  const [faultCurrent, setFaultCurrent] = useState(5000);

  function applyPreset(key: string) {
    setPresetKey(key);
    if (key !== 'custom') {
      setRelays(RELAY_PRESETS[key].relays.map((r) => ({ ...r })));
    }
  }

  function addRelay() {
    const n = relays.length + 1;
    setRelays([...relays, { id: `R${n}`, label: `Relay ${n}`, pickup_a: 200 * n, tms: 0.1 * n, curve: 'SI' }]);
  }

  function removeRelay(idx: number) {
    setRelays(relays.filter((_, i) => i !== idx));
  }

  function updateRelay(idx: number, field: keyof RelaySpec, val: string | number) {
    setRelays(relays.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  }

  return (
    <div className="space-y-4">
      <p className="text-[10px] text-gray-500">
        IEC 60255 time-current characteristic curves (SI / VI / EI). Grading margins must be ≥ 300 ms between adjacent relays.
      </p>

      {/* Preset selector */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Configuration Preset</label>
        <select
          value={presetKey}
          onChange={(e) => applyPreset(e.target.value)}
          className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none"
        >
          {Object.entries(RELAY_PRESETS).map(([k, p]) => (
            <option key={k} value={k}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Fault current */}
      <Field label="System Fault Current" unit="A" value={faultCurrent} min={100} max={50000} step={100}
        onChange={setFaultCurrent} />

      {/* Relay table */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400 font-semibold">Relays ({relays.length})</span>
          <button
            type="button"
            onClick={addRelay}
            className="text-[10px] px-2 py-0.5 bg-yellow-800/50 hover:bg-yellow-700/50 text-yellow-300 rounded transition-colors"
          >
            + Add Relay
          </button>
        </div>
        {relays.map((r, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-1 items-center bg-gray-800/40 rounded px-2 py-1.5">
            <input
              className="col-span-2 px-1 py-0.5 text-[10px] bg-infra-darker border border-infra-accent/30 rounded text-white"
              value={r.id}
              onChange={(e) => updateRelay(idx, 'id', e.target.value)}
              placeholder="ID"
            />
            <input
              className="col-span-3 px-1 py-0.5 text-[10px] bg-infra-darker border border-infra-accent/30 rounded text-white"
              value={r.label}
              onChange={(e) => updateRelay(idx, 'label', e.target.value)}
              placeholder="Label"
            />
            <input
              type="number" min={10} step={10}
              className="col-span-2 px-1 py-0.5 text-[10px] bg-infra-darker border border-infra-accent/30 rounded text-white"
              value={r.pickup_a}
              onChange={(e) => updateRelay(idx, 'pickup_a', parseFloat(e.target.value) || 100)}
              placeholder="Ip (A)"
            />
            <input
              type="number" min={0.05} max={1} step={0.05}
              className="col-span-2 px-1 py-0.5 text-[10px] bg-infra-darker border border-infra-accent/30 rounded text-white"
              value={r.tms}
              onChange={(e) => updateRelay(idx, 'tms', parseFloat(e.target.value) || 0.1)}
              placeholder="TMS"
            />
            <select
              value={r.curve}
              onChange={(e) => updateRelay(idx, 'curve', e.target.value as 'SI' | 'VI' | 'EI')}
              className="col-span-2 px-1 py-0.5 text-[10px] bg-infra-darker border border-infra-accent/30 rounded text-white"
            >
              <option value="SI">SI</option>
              <option value="VI">VI</option>
              <option value="EI">EI</option>
            </select>
            <button
              type="button"
              onClick={() => removeRelay(idx)}
              className="col-span-1 text-red-400 hover:text-red-300 text-xs font-bold"
            >
              ×
            </button>
          </div>
        ))}
        <div className="grid grid-cols-12 gap-1 px-2">
          <span className="col-span-2 text-[9px] text-gray-600">ID</span>
          <span className="col-span-3 text-[9px] text-gray-600">Label</span>
          <span className="col-span-2 text-[9px] text-gray-600">Ip (A)</span>
          <span className="col-span-2 text-[9px] text-gray-600">TMS</span>
          <span className="col-span-2 text-[9px] text-gray-600">Curve</span>
        </div>
      </div>

      {relays.length > 0 && (
        <RelayGradingChart relays={relays} fault_current_a={faultCurrent} />
      )}
    </div>
  );
}

// ── Harmonics Tab ─────────────────────────────────────────────────────────────

function HarmonicsTab() {
  const [system_voltage_v, setSystemVoltage] = useState(11000);
  const [load_kva, setLoadKva] = useState(500);
  const [system_impedance_ohm, setSysImpedance] = useState(0.05);
  const [cable_r_ohm, setCableR] = useState(0.32);
  const [cable_x_ohm, setCableX] = useState(0.08);

  return (
    <div className="space-y-4">
      <p className="text-[10px] text-gray-500">
        IEC 61000-2-2 harmonic voltage limits. Models 6-pulse rectifier load injecting odd harmonic currents. Red bars = IEC violation.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Field label="System Voltage" unit="V" value={system_voltage_v} min={100} max={132000} step={100}
          onChange={setSystemVoltage} />
        <Field label="Load" unit="kVA" value={load_kva} min={1} max={100000} step={10}
          onChange={setLoadKva} />
        <Field label="System Impedance" unit="Ω" value={system_impedance_ohm} min={0.001} step={0.001}
          onChange={setSysImpedance} />
        <Field label="Cable R" unit="Ω" value={cable_r_ohm} min={0.001} step={0.01}
          onChange={setCableR} />
        <Field label="Cable X" unit="Ω" value={cable_x_ohm} min={0.001} step={0.01}
          onChange={setCableX} />
      </div>

      <HarmonicSpectrum
        system_voltage_v={system_voltage_v}
        load_kva={load_kva}
        system_impedance_ohm={system_impedance_ohm}
        cable_r_ohm={cable_r_ohm}
        cable_x_ohm={cable_x_ohm}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'short_circuit', label: 'Short Circuit' },
  { id: 'relay_grading', label: 'Relay Grading' },
  { id: 'harmonics', label: 'Harmonics' },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function PowerSystemsCalculator(_props: CalculatorFormProps) {
  const [tab, setTab] = useState<Tab>('short_circuit');

  return (
    <div className="space-y-4">
      {/* Tab strip */}
      <div className="flex gap-1 border-b border-infra-accent/30 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1 text-xs rounded-t font-semibold transition-colors ${
              tab === t.id
                ? 'bg-yellow-700/60 text-yellow-100 border border-yellow-500/60 border-b-0'
                : 'bg-infra-accent/20 text-gray-400 hover:bg-yellow-900/30 hover:text-yellow-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'short_circuit' && <ShortCircuitTab />}
      {tab === 'relay_grading' && <RelayGradingTab />}
      {tab === 'harmonics' && <HarmonicsTab />}
    </div>
  );
}
