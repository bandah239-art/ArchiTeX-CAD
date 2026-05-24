import { useSeismicStore } from '../../store/seismicStore';

const ANALYSIS_TYPES = [
  { value: 'modal', label: 'Modal (periods + base shear)' },
  { value: 'time_history', label: 'Time-history (storey drifts)' },
  { value: 'pushover', label: 'Pushover (simplified)' },
];

export function SeismicPanel() {
  const s = useSeismicStore();
  const r = s.result;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-infra-accent/30">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">Seismic Analysis</h2>
        <p className="text-xs text-gray-500 mt-1">OpenSeesPy modal / time-history + numpy MDOF fallback</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <Field label="Storeys" value={s.nStoreys} onChange={(v) => useSeismicStore.setState({ nStoreys: v })} />
        <Field label="Storey height (m)" value={s.storeyHeight} onChange={(v) => useSeismicStore.setState({ storeyHeight: v })} />
        <Field label="PGA (g)" value={s.pgaG} step={0.01} onChange={(v) => useSeismicStore.setState({ pgaG: v })} />
        <div>
          <label className="block text-xs text-gray-400 mb-1">Analysis type</label>
          <select
            value={s.analysisType}
            onChange={(e) => useSeismicStore.setState({ analysisType: e.target.value as typeof s.analysisType })}
            className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white"
          >
            {ANALYSIS_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={() => s.runAnalysis()} disabled={s.isRunning} className="w-full py-2 text-xs font-semibold bg-orange-800 hover:bg-orange-700 rounded disabled:opacity-40">
          {s.isRunning ? 'Running OpenSees…' : 'Run Seismic Analysis'}
        </button>

        {s.error && <div className="text-xs text-red-300 bg-red-900/30 p-2 rounded">{s.error}</div>}

        {r && (
          <div className="p-3 bg-infra-darker border border-orange-500/30 rounded text-xs space-y-1">
            <Row label="Engine" value={String(r.engine)} />
            {r.fundamental_period_s != null && <Row label="T₁ period" value={`${r.fundamental_period_s} s`} />}
            {r.base_shear_kn != null && <Row label="Base shear" value={`${r.base_shear_kn} kN`} />}
            {r.max_drift_pct != null && (
              <Row label="Max drift" value={`${r.max_drift_pct}% ${r.compliant ? '✓' : '✗'}`} warn={!r.compliant} />
            )}
            {Array.isArray(r.storey_drifts_pct) && (
              <div className="mt-2 text-gray-500">
                Storey drifts: {(r.storey_drifts_pct as number[]).map((d) => `${d}%`).join(', ')}
              </div>
            )}
            {r.note != null && String(r.note).length > 0 && (
              <div className="text-gray-500 mt-1">{String(r.note)}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, step, onChange }: { label: string; value: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input type="number" step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white" />
    </div>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <span className={warn ? 'text-red-400 font-medium' : 'text-orange-300 font-medium'}>{value}</span>
    </div>
  );
}
