import { useEffect } from 'react';
import { useBoQStore } from '../../store/boqStore';
import { useViewerStore } from '../../store/viewerStore';
import { elementsFromViewer, toBimPayload } from '../../services/ifcBoqService';
import { useIfcModelStore } from '../../store/ifcModelStore';

const COUNTRIES = [
  { code: 'ZM', label: '🇿🇲 Zambia' },
  { code: 'KE', label: '🇰🇪 Kenya' },
  { code: 'NG', label: '🇳🇬 Nigeria' },
  { code: 'GH', label: '🇬🇭 Ghana' },
  { code: 'TZ', label: '🇹🇿 Tanzania' },
  { code: 'ZW', label: '🇿🇼 Zimbabwe' },
  { code: 'BW', label: '🇧🇼 Botswana' },
  { code: 'MZ', label: '🇲🇿 Mozambique' },
];

export function BoQPanel() {
  const {
    countryCode,
    projectName,
    client,
    elements,
    compiledBoQ,
    isGenerating,
    isExporting,
    error,
    setCountryCode,
    setProjectName,
    setClient,
    removeElement,
    generateBoQ,
    exportExcel,
    exportPdf,
    loadDemoProject,
    importFromBim,
    isImportingBim,
  } = useBoQStore();
  const { selectedElement } = useViewerStore();
  const { getBoqElements } = useIfcModelStore();

  const handleImportBim = () => {
    const parsed = getBoqElements();
    const els = elementsFromViewer(parsed.length ? parsed : null, selectedElement);
    importFromBim(toBimPayload(els));
  };

  useEffect(() => {
    if (!elements.length) loadDemoProject();
  }, [elements.length, loadDemoProject]);

  const summary = compiledBoQ?.summary;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-infra-accent/30">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wide">Bill of Quantities</h2>
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="text-xs bg-infra-darker border border-infra-accent/40 rounded px-2 py-1 text-white"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="Project name"
          className="w-full mt-2 px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white"
        />
        <input
          type="text"
          value={client}
          onChange={(e) => setClient(e.target.value)}
          placeholder="Client name"
          className="w-full mt-2 px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Project Elements</h3>
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={handleImportBim}
            disabled={isImportingBim}
            className="flex-1 py-1.5 text-xs border border-infra-accent/50 hover:bg-infra-accent/20 rounded disabled:opacity-50"
          >
            {isImportingBim ? 'Importing...' : 'Import from BIM'}
          </button>
          <button
            type="button"
            onClick={() => loadDemoProject()}
            className="flex-1 py-1.5 text-xs border border-infra-accent/50 hover:bg-infra-accent/20 rounded"
          >
            Load Demo
          </button>
        </div>
        <div className="space-y-2">
          {elements.map((el) => (
            <div
              key={el.ref}
              className="p-3 bg-infra-darker border border-infra-accent/30 rounded text-xs text-gray-300"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <span className="text-green-400 mr-1">✓</span>
                  <span className="text-white font-medium">{el.description}</span>
                  <span className="text-gray-500 ml-1">({el.element_count} no.)</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeElement(el.ref)}
                  className="text-gray-500 hover:text-red-400"
                >
                  ×
                </button>
              </div>
              <div className="mt-1 text-gray-400">→ {el.summary_text ?? 'Quantities pending'}</div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => generateBoQ()}
          disabled={isGenerating}
          className="w-full mt-4 py-2 bg-infra-highlight hover:bg-infra-highlight/80 disabled:opacity-50 text-white text-sm font-semibold rounded"
        >
          {isGenerating ? 'Generating BoQ...' : 'GENERATE BoQ'}
        </button>

        {error && (
          <div className="mt-3 p-3 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">
            {error}
          </div>
        )}

        {summary && (
          <div className="mt-6 border-t border-infra-accent/30 pt-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Summary</h3>
            <div className="space-y-1 text-sm text-gray-300">
              {Object.entries(compiledBoQ?.section_totals ?? {}).map(([key, val]) =>
                val.mid > 0 ? (
                  <div key={key} className="flex justify-between">
                    <span>Section {key}</span>
                    <span>USD {val.mid.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                ) : null
              )}
              <div className="border-t border-infra-accent/30 pt-2 mt-2 flex justify-between font-semibold text-white">
                <span>TOTAL</span>
                <span>
                  USD {summary.total_project_estimate_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex justify-between text-infra-highlight text-xs">
                <span>{summary.local_currency}</span>
                <span>{summary.total_local_currency.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Range: USD {summary.total_project_range_usd[0].toLocaleString()} –{' '}
                {summary.total_project_range_usd[1].toLocaleString()}
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => exportExcel()}
                disabled={isExporting}
                className="flex-1 py-2 text-xs border border-infra-accent/50 hover:bg-infra-accent/20 rounded"
              >
                Export Excel
              </button>
              <button
                type="button"
                onClick={() => exportPdf()}
                disabled={isExporting}
                className="flex-1 py-2 text-xs border border-infra-accent/50 hover:bg-infra-accent/20 rounded"
              >
                Export PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
