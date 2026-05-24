import { useWashStore } from '../../store/washStore';

const TABS = [
  { id: 'demand' as const, label: 'Water Demand' },
  { id: 'borehole' as const, label: 'Borehole' },
  { id: 'sewerage' as const, label: 'Sewerage' },
];

export function WashPanel() {
  const s = useWashStore();
  const summary = s.result?.summary as Record<string, unknown> | undefined;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-infra-accent/30">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">WASH Engineering</h2>
        <div className="flex gap-1 mt-2">
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => s.setActiveTab(t.id)} className={`flex-1 py-1 text-xs rounded ${s.activeTab === t.id ? 'bg-infra-highlight text-white' : 'bg-infra-accent/30 text-gray-400'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {(s.activeTab === 'demand' || s.activeTab === 'sewerage') && (
          <>
            <Field label="Population" value={s.population} onChange={s.setPopulation} />
            <Field label="LPCD (L/capita/day)" value={s.lpcd} onChange={s.setLpcd} />
          </>
        )}
        {s.activeTab === 'borehole' && <Field label="Daily demand (m³)" value={s.dailyDemandM3} onChange={s.setDailyDemandM3} />}
        <button type="button" onClick={() => s.runCalculation()} disabled={s.isLoading} className="w-full py-2 bg-infra-highlight text-white text-sm rounded disabled:opacity-50">
          {s.isLoading ? 'Calculating...' : 'CALCULATE'}
        </button>
        {s.error && <div className="text-xs text-red-300 bg-red-900/30 p-2 rounded">{s.error}</div>}
        {summary && (
          <div className="p-3 bg-infra-darker border border-infra-accent/30 rounded text-xs text-gray-300 space-y-1">
            {Object.entries(summary).map(([k, v]) => (
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
