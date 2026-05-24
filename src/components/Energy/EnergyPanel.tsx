import { useEnergyStore } from '../../store/energyStore';

export function EnergyPanel() {
  const s = useEnergyStore();
  const summary = s.result?.summary as Record<string, unknown> | undefined;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-infra-accent/30">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">Solar & Energy</h2>
        <div className="flex gap-1 mt-2">
          {(['solar', 'battery'] as const).map((t) => (
            <button key={t} type="button" onClick={() => s.setActiveTab(t)} className={`flex-1 py-1 text-xs rounded capitalize ${s.activeTab === t ? 'bg-infra-highlight text-white' : 'bg-infra-accent/30 text-gray-400'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <Field label="Daily load (kWh)" value={s.dailyLoadKwh} onChange={s.setDailyLoadKwh} />
        {s.activeTab === 'battery' && <Field label="Autonomy (days)" value={s.autonomyDays} onChange={s.setAutonomyDays} />}
        <button type="button" onClick={() => s.runCalculation()} disabled={s.isLoading} className="w-full py-2 bg-infra-highlight text-white text-sm rounded disabled:opacity-50">
          {s.isLoading ? 'Calculating...' : 'CALCULATE'}
        </button>
        {s.error && <div className="text-xs text-red-300 bg-red-900/30 p-2 rounded">{s.error}</div>}
        {summary && (
          <div className="p-3 bg-infra-darker border border-infra-accent/30 rounded text-xs text-gray-300 space-y-1">
            {Object.entries(summary).slice(0, 10).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <span className="text-gray-500">{k.replace(/_/g, ' ')}</span>
                <span className="text-white">{String(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white" />
    </div>
  );
}
