import { useDocumentsStore } from '../../store/documentsStore';

const TABS = [
  { id: 'tender' as const, label: 'Tender' },
  { id: 'calculation' as const, label: 'Calc Report' },
  { id: 'eia' as const, label: 'EIA' },
  { id: 'esg' as const, label: 'ESG / Carbon' },
  { id: 'ipc' as const, label: 'IPC' },
];

export function DocumentPanel() {
  const store = useDocumentsStore();

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-infra-accent/30">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">Document Generation</h2>
        <div className="flex gap-1 mt-2 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => store.setActiveTab(t.id)}
              className={`flex-1 py-1 text-xs rounded min-w-[60px] ${store.activeTab === t.id ? 'bg-infra-highlight text-white' : 'bg-infra-accent/30 text-gray-400'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <Field label="Project name" value={store.projectName} onChange={store.setProjectName} />
        {store.activeTab === 'tender' && (
          <Field label="Employer" value={store.employer} onChange={store.setEmployer} />
        )}
        {(store.activeTab === 'tender' || store.activeTab === 'eia') && (
          <FieldNumber label="Estimated value USD" value={store.estimatedValue} onChange={store.setEstimatedValue} />
        )}
        {store.activeTab === 'eia' && (
          <select
            value={store.eiaType}
            onChange={(e) => store.setEiaType(e.target.value)}
            className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white"
          >
            <option value="building">Building</option>
            <option value="road">Road</option>
            <option value="water_wash">Water/WASH</option>
            <option value="industrial">Industrial</option>
          </select>
        )}

        {store.activeTab === 'esg' && (
          <div className="text-xs text-gray-400 p-2 bg-infra-darker border border-emerald-500/30 rounded">
            Generates embodied carbon report from current BoQ material quantities. Import BIM or compile BoQ first for best results.
          </div>
        )}

        <button
          type="button"
          onClick={() => store.generate()}
          disabled={store.isGenerating}
          className="w-full py-2 bg-infra-highlight text-white text-sm font-semibold rounded disabled:opacity-50"
        >
          {store.isGenerating ? 'Generating...' : 'GENERATE DOCUMENT'}
        </button>

        {store.error && <div className="text-xs text-red-300 bg-red-900/30 p-2 rounded">{store.error}</div>}

        {store.result && (
          <div className="space-y-2">
            <pre className="p-3 bg-infra-darker border border-infra-accent/30 rounded text-xs text-gray-300 whitespace-pre-wrap max-h-64 overflow-y-auto">
              {String(store.result.content ?? store.result.invitation_to_tender ?? store.result.document_text ?? JSON.stringify(store.result, null, 2))}
            </pre>
            <button type="button" onClick={() => store.downloadResult()} className="w-full py-1.5 text-xs border border-infra-accent/50 rounded">
              Download
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white" />
    </div>
  );
}

function FieldNumber({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white" />
    </div>
  );
}
