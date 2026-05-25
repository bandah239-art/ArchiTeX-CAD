import { useState } from 'react';
import { calculationAPI } from '../../../services/calculationAPI';
import { useCalculationStore } from '../../../store/calculationStore';
import { exportToPDF } from '../../../services/exportService';
import type { LoadCombinationCode, LoadCombinationRow, LoadCombinationsResult } from '../../../types/loadCombinations';
import type { CalculationResult } from '../../../types/calculations';

const CODES: { id: LoadCombinationCode; label: string }[] = [
  { id: 'EC0', label: 'EC0' },
  { id: 'ACI318', label: 'ACI 318' },
  { id: 'BS8110', label: 'BS 8110' },
];

function toReportResult(data: LoadCombinationsResult): CalculationResult {
  const steps = [
    ...data.uls_combinations.map((c, i) => rowToStep(i + 1, 'ULS', c)),
    ...data.sls_combinations.map((c, i) => rowToStep(i + 1 + data.uls_combinations.length, 'SLS', c)),
  ];
  return {
    status: 'pass',
    summary: {
      governing_uls: data.governing_uls.value,
      governing_sls: data.governing_sls?.value ?? '—',
      code: data.code,
    },
    steps,
    warnings: [],
    errors: [],
    timestamp: data.timestamp,
  };
}

function rowToStep(n: number, group: string, c: LoadCombinationRow) {
  return {
    step_number: n,
    title: `${group} ${c.combo_number}${c.governing ? ' ★ GOVERNING' : ''}`,
    formula: c.expression,
    substitution: c.substitution,
    result: `${c.result} ${c.unit}`,
    unit: c.unit,
    reference: c.reference,
    status: c.governing ? ('pass' as const) : ('info' as const),
  };
}

function ComboCard({ row }: { row: LoadCombinationRow }) {
  return (
    <div
      className={`rounded border px-3 py-2 text-xs ${
        row.governing
          ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-100'
          : 'border-infra-accent/25 bg-infra-darker/40 text-gray-300'
      }`}
    >
      {row.governing && (
        <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-400 mb-1">★ Governing</div>
      )}
      <div className="font-mono text-[11px]">
        {row.expression} = <span className="text-white font-semibold">{row.result}</span> {row.unit}
      </div>
      <div className="text-[10px] text-gray-500 mt-1">{row.reference}</div>
    </div>
  );
}

export function LoadCombinations() {
  const { applyGoverningLoad } = useCalculationStore();
  const [gk, setGk] = useState(15);
  const [qk, setQk] = useState(10);
  const [wk, setWk] = useState(3);
  const [ek, setEk] = useState(0);
  const [code, setCode] = useState<LoadCombinationCode>('EC0');
  const [result, setResult] = useState<LoadCombinationsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await calculationAPI.calculateLoadCombinations({
        gk,
        qk,
        wk,
        ek,
        code,
        unit: 'kN/m',
      });
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load combinations failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const designLoad = result?.feed_to_calculators.beam_design_load;

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-bold text-white uppercase tracking-wide">Load Combinations Generator</h3>

      <div className="flex flex-wrap gap-1">
        {CODES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCode(c.id)}
            className={`px-2 py-1 text-[10px] font-semibold rounded border transition-colors ${
              code === c.id
                ? 'border-emerald-500 bg-emerald-900/40 text-emerald-300'
                : 'border-infra-accent/30 text-gray-500 hover:text-gray-300'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Num label="Permanent Gk" value={gk} onChange={setGk} />
        <Num label="Variable Qk" value={qk} onChange={setQk} />
        <Num label="Wind Wk" value={wk} onChange={setWk} />
        <Num label="Seismic Ek" value={ek} onChange={setEk} />
      </div>

      <button
        type="button"
        onClick={() => void generate()}
        disabled={loading}
        className="w-full py-2.5 text-xs font-bold uppercase tracking-wide rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white"
      >
        {loading ? 'Generating…' : 'Generate Combinations'}
      </button>

      {error && (
        <div className="p-2 text-xs text-red-300 bg-red-900/30 border border-red-700/40 rounded">{error}</div>
      )}

      {result && (
        <>
          <section>
            <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-2">ULS Combinations</h4>
            <div className="space-y-2">
              {result.uls_combinations.map((row) => (
                <ComboCard key={`uls-${row.combo_number}`} row={row} />
              ))}
            </div>
          </section>

          {result.sls_combinations.length > 0 && (
            <section>
              <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-2">SLS Combinations</h4>
              <div className="space-y-2">
                {result.sls_combinations.map((row) => (
                  <ComboCard key={`sls-${row.combo_number}`} row={row} />
                ))}
              </div>
            </section>
          )}

          <div className="text-[10px] text-gray-500 border-t border-infra-accent/20 pt-2">
            Governing ULS: <span className="text-emerald-400 font-semibold">{result.governing_uls.value} kN/m</span>
            {' · '}
            {result.governing_uls.expression}
          </div>

          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              disabled={!designLoad}
              onClick={() => designLoad && applyGoverningLoad('beam', designLoad)}
              className="w-full py-2 text-[10px] font-semibold uppercase rounded border border-emerald-600/50 hover:bg-emerald-900/30 text-emerald-300 disabled:opacity-40"
            >
              → Send to Beam Calculator
            </button>
            <button
              type="button"
              disabled={!designLoad}
              onClick={() => designLoad && applyGoverningLoad('slab', designLoad)}
              className="w-full py-2 text-[10px] font-semibold uppercase rounded border border-emerald-600/50 hover:bg-emerald-900/30 text-emerald-300 disabled:opacity-40"
            >
              → Send to Slab Calculator
            </button>
            <button
              type="button"
              disabled={!designLoad}
              onClick={() => designLoad && applyGoverningLoad('foundation', designLoad)}
              className="w-full py-2 text-[10px] font-semibold uppercase rounded border border-emerald-600/50 hover:bg-emerald-900/30 text-emerald-300 disabled:opacity-40"
            >
              → Send to Foundation Calculator
            </button>
          </div>

          <button
            type="button"
            onClick={() => void exportToPDF(toReportResult(result))}
            className="w-full py-2 text-xs border border-infra-accent/50 hover:bg-infra-accent/20 rounded"
          >
            Export PDF
          </button>
        </>
      )}
    </div>
  );
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-gray-400">
      <span>{label} (kN/m)</span>
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-infra-darker border border-infra-accent/30 rounded px-2 py-1 text-gray-200"
      />
    </label>
  );
}
