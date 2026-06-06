import { useState } from 'react';
import { API_BASE } from '../../../services/apiConfig';
import { ResponseSpectrumChart } from '../../Seismic/ResponseSpectrumChart';
import { useCalculationStore } from '../../../store/calculationStore';

interface SeismicCalculatorProps {
  inputs: Record<string, unknown>;
  onInputChange: (key: string, value: unknown) => void;
}

interface ModalResult {
  mode: number;
  period_s: number;
  freq_hz: number;
  Se_ms2: number;
  Sd_ms2: number;
  modal_base_shear_x_kn: number;
  mass_participation_x_pct: number;
}

interface SpectrumResult {
  status: string;
  ag_ms2: number;
  spectrum_curve: { periods: number[]; Se: number[]; Sd: number[]; Sve: number[] };
  modal_combination?: {
    modal_results: ModalResult[];
    combined_base_shear_x_kn: number;
    combined_base_shear_y_kn: number;
    cumulative_mass_participation_pct: number;
  };
}

const GROUND_TYPES = ['A', 'B', 'C', 'D', 'E'];
const IMPORTANCE_CLASSES = ['I', 'II', 'III', 'IV'];
const COMBINATIONS = ['SRSS', 'CQC'];

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between border-b border-infra-accent/20 py-0.5">
      <span className="text-gray-400">{label}</span>
      <span className="text-white font-mono">{value}</span>
    </div>
  );
}

export function SeismicCalculator({ inputs, onInputChange }: SeismicCalculatorProps) {
  const [result, setResult] = useState<SpectrumResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState(0);
  const fromSite = useCalculationStore((s) => s.sitePrefillFields.seismic?.includes('ag') ?? false);

  async function compute() {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        ag: Number(inputs.ag ?? 0.15),
        ground_type: inputs.ground_type ?? 'B',
        xi_pct: Number(inputs.xi_pct ?? 5.0),
        q: Number(inputs.q ?? 1.5),
        importance_class: inputs.importance_class ?? 'II',
        spectrum_type: Number(inputs.spectrum_type ?? 1),
        combination: inputs.combination ?? 'SRSS',
      };

      // Modal data if provided
      const periodsRaw = String(inputs.modal_periods ?? '').trim();
      if (periodsRaw) {
        const periods = periodsRaw.split(',').map(Number).filter(isFinite);
        if (periods.length) {
          body.modal_periods = periods;
          body.modal_eff_masses_x = String(inputs.modal_eff_masses_x ?? '').split(',').map(Number).filter(isFinite);
          body.modal_eff_masses_y = String(inputs.modal_eff_masses_y ?? '').split(',').map(Number).filter(isFinite);
          body.modal_mass_part_x = String(inputs.modal_mass_part_x ?? '').split(',').map(Number).filter(isFinite);
        }
      }

      const res = await fetch(`${API_BASE}/seismic/response-spectrum`, {
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

  const modalResults = result?.modal_combination?.modal_results;
  const combo = result?.modal_combination;

  return (
    <div className="flex flex-col space-y-4 bg-infra-bg/50 p-4 border border-infra-accent/30 rounded-lg">
      <div className="flex justify-between items-center">
        <h3 className="text-infra-highlight font-bold uppercase text-sm tracking-wider">Seismic Response Spectrum</h3>
        <span className="text-xs px-2 py-0.5 rounded bg-infra-highlight/25 text-infra-highlight border border-infra-highlight/40">EC8 Type 1</span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        {/* ag */}
        <div className="flex flex-col space-y-1">
          <label className="text-gray-400 font-semibold">
            PGA ag (g)
            {fromSite && (
              <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-400/90 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-500/30">
                Site intel
              </span>
            )}
          </label>
          <input
            type="number" step="0.01" min="0.01" max="1.0"
            value={String(inputs.ag ?? 0.15)}
            onChange={(e) => onInputChange('ag', Number(e.target.value))}
            className={`w-full px-2 py-1.5 bg-infra-darker border rounded text-white text-xs focus:outline-none ${
              fromSite ? 'border-emerald-500/50 focus:border-emerald-400' : 'border-infra-accent/40 focus:border-infra-highlight/60'
            }`}
          />
        </div>

        {/* Ground type */}
        <div className="flex flex-col space-y-1">
          <label className="text-gray-400 font-semibold">Ground Type</label>
          <select
            value={String(inputs.ground_type ?? 'B')}
            onChange={(e) => onInputChange('ground_type', e.target.value)}
            className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white text-xs focus:outline-none focus:border-infra-highlight/60"
          >
            {GROUND_TYPES.map((g) => <option key={g} value={g}>Type {g}</option>)}
          </select>
        </div>

        {/* Damping */}
        <div className="flex flex-col space-y-1">
          <label className="text-gray-400 font-semibold">Damping ξ (%)</label>
          <input
            type="number" step="0.5" min="0.5" max="30"
            value={String(inputs.xi_pct ?? 5.0)}
            onChange={(e) => onInputChange('xi_pct', Number(e.target.value))}
            className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white text-xs focus:outline-none focus:border-infra-highlight/60"
          />
        </div>

        {/* Behaviour factor */}
        <div className="flex flex-col space-y-1">
          <label className="text-gray-400 font-semibold">Behaviour Factor q</label>
          <input
            type="number" step="0.1" min="1.0" max="8.0"
            value={String(inputs.q ?? 1.5)}
            onChange={(e) => onInputChange('q', Number(e.target.value))}
            className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white text-xs focus:outline-none focus:border-infra-highlight/60"
          />
        </div>

        {/* Importance class */}
        <div className="flex flex-col space-y-1">
          <label className="text-gray-400 font-semibold">Importance Class</label>
          <select
            value={String(inputs.importance_class ?? 'II')}
            onChange={(e) => onInputChange('importance_class', e.target.value)}
            className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white text-xs focus:outline-none focus:border-infra-highlight/60"
          >
            {IMPORTANCE_CLASSES.map((c) => <option key={c} value={c}>Class {c}</option>)}
          </select>
        </div>

        {/* Modal combination */}
        <div className="flex flex-col space-y-1">
          <label className="text-gray-400 font-semibold">Modal Combination</label>
          <select
            value={String(inputs.combination ?? 'SRSS')}
            onChange={(e) => onInputChange('combination', e.target.value)}
            className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white text-xs focus:outline-none focus:border-infra-highlight/60"
          >
            {COMBINATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Optional modal data */}
      <details className="text-xs">
        <summary className="cursor-pointer text-gray-400 hover:text-infra-highlight py-1">
          Optional: Paste modal periods for SRSS/CQC combination
        </summary>
        <div className="mt-2 flex flex-col space-y-2">
          {[
            ['modal_periods', 'Periods T1, T2, ... (s)'],
            ['modal_eff_masses_x', 'Eff. masses X, ... (kg)'],
            ['modal_eff_masses_y', 'Eff. masses Y, ... (kg)'],
            ['modal_mass_part_x', 'Mass participation X, ... (%)'],
          ].map(([key, label]) => (
            <div key={key} className="flex flex-col space-y-0.5">
              <label className="text-gray-400">{label}</label>
              <input
                type="text"
                placeholder="comma-separated"
                value={String(inputs[key] ?? '')}
                onChange={(e) => onInputChange(key, e.target.value)}
                className="px-2 py-1 bg-infra-darker border border-infra-accent/40 rounded text-white text-xs focus:outline-none focus:border-infra-highlight/60"
              />
            </div>
          ))}
        </div>
      </details>

      <button
        type="button"
        onClick={compute}
        disabled={loading}
        className="w-full py-2 bg-infra-highlight text-white text-xs font-bold rounded uppercase tracking-wider hover:bg-infra-highlight/80 disabled:opacity-50"
      >
        {loading ? 'COMPUTING...' : 'GENERATE SPECTRUM'}
      </button>

      {error && (
        <div className="p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">{error}</div>
      )}

      {result && (
        <>
          <ResponseSpectrumChart
            curve={result.spectrum_curve}
            modalResults={modalResults}
            selectedMode={selectedMode}
          />

          {/* Summary */}
          <div className="grid grid-cols-2 gap-1 text-xs">
            <Row label="ag,design (m/s²)" value={result.ag_ms2.toFixed(3)} />
            <Row label="Ground Type" value={result.spectrum_curve ? String(inputs.ground_type ?? 'B') : '-'} />
          </div>

          {/* Modal combination table */}
          {combo && (
            <div className="mt-2 space-y-2">
              <div className="text-xs font-bold text-infra-highlight uppercase tracking-wider">
                Modal Combination ({String(inputs.combination ?? 'SRSS')})
              </div>

              <div className="flex flex-wrap gap-1">
                {combo.modal_results.map((m, i) => (
                  <button
                    key={m.mode}
                    type="button"
                    onClick={() => setSelectedMode(i)}
                    className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                      selectedMode === i
                        ? 'bg-infra-highlight text-white border-infra-highlight'
                        : 'border-infra-accent/40 text-gray-400 hover:border-infra-highlight/50'
                    }`}
                  >
                    Mode {m.mode}
                  </button>
                ))}
              </div>

              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-infra-accent/30 text-gray-400">
                    <th className="py-1 text-left">Mode</th>
                    <th className="py-1 text-right">T (s)</th>
                    <th className="py-1 text-right">Se (m/s²)</th>
                    <th className="py-1 text-right">Sd (m/s²)</th>
                    <th className="py-1 text-right">Vx (kN)</th>
                    <th className="py-1 text-right">MPF-x (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {combo.modal_results.map((m, i) => (
                    <tr
                      key={m.mode}
                      onClick={() => setSelectedMode(i)}
                      className={`border-b border-infra-accent/20 cursor-pointer transition-colors ${
                        selectedMode === i ? 'text-infra-highlight bg-infra-highlight/10' : 'text-gray-300 hover:bg-infra-accent/10'
                      }`}
                    >
                      <td className="py-1">{m.mode}</td>
                      <td className="py-1 text-right font-mono">{m.period_s.toFixed(3)}</td>
                      <td className="py-1 text-right font-mono">{m.Se_ms2.toFixed(3)}</td>
                      <td className="py-1 text-right font-mono">{m.Sd_ms2.toFixed(3)}</td>
                      <td className="py-1 text-right font-mono">{m.modal_base_shear_x_kn.toFixed(2)}</td>
                      <td className="py-1 text-right font-mono">{m.mass_participation_x_pct.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="grid grid-cols-2 gap-1 text-xs mt-2">
                <Row label="Combined Vx (kN)" value={combo.combined_base_shear_x_kn.toFixed(2)} />
                <Row label="Combined Vy (kN)" value={combo.combined_base_shear_y_kn.toFixed(2)} />
                <Row label="Cum. Mass Part. X (%)" value={combo.cumulative_mass_participation_pct.toFixed(1)} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
