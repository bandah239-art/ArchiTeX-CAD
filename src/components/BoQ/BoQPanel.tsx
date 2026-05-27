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

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left Column: Project Elements List & Actions */}
          <div className="space-y-6 bg-infra-dark/30 p-5 rounded-xl border border-infra-accent/20">
            <div className="flex justify-between items-center pb-2 border-b border-infra-accent/20">
              <h3 className="text-xs font-bold text-infra-highlight uppercase tracking-wider">Project Elements Schedule</h3>
              <span className="text-[10px] text-gray-500 font-mono">BIM Extraction Active</span>
            </div>
            
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleImportBim}
                disabled={isImportingBim}
                className="flex-1 py-2 text-xs border border-infra-accent/50 hover:bg-infra-accent/20 rounded-lg disabled:opacity-50 text-white font-medium"
              >
                🔄 Pull from BIM Model
              </button>
              <button
                type="button"
                onClick={() => loadDemoProject()}
                className="flex-1 py-2 text-xs border border-infra-accent/50 hover:bg-infra-accent/20 rounded-lg text-white font-medium"
              >
                💡 Load Demo Items
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {elements.map((el) => (
                <div
                  key={el.ref}
                  className="p-3 bg-infra-darker border border-infra-accent/20 hover:border-infra-accent/40 rounded-lg text-xs text-gray-300 transition-all flex justify-between items-start gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-emerald-400">✓</span>
                      <span className="text-white font-semibold">{el.ref}: {el.description}</span>
                    </div>
                    <div className="text-gray-400 pl-4">{el.summary_text ?? 'Quantities pending calculations'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 bg-black/40 border border-infra-accent/20 rounded font-mono text-gray-400">{el.element_count} pcs</span>
                    <button
                      type="button"
                      onClick={() => removeElement(el.ref)}
                      className="text-gray-500 hover:text-red-400 text-lg leading-none"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => generateBoQ()}
              disabled={isGenerating}
              className="w-full py-3 bg-infra-highlight hover:bg-infra-highlight/80 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-infra-highlight/20 transition-all"
            >
              {isGenerating ? 'Analyzing quantities & unit rates...' : 'COMPILE & GENERATE BILL OF QUANTITIES'}
            </button>

            {error && (
              <div className="mt-3 p-3 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">
                {error}
              </div>
            )}
          </div>

          {/* Right Column: Compiled Summary Breakdown */}
          <div className="space-y-6">
            {summary ? (
              <div className="bg-[#16213e]/90 p-5 rounded-xl border border-infra-accent/30 shadow-xl">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-infra-accent/20">
                  <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Quantities Cost Estimation</h3>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono uppercase">Local Indexed</span>
                </div>

                <div className="space-y-2 text-sm text-gray-300">
                  {Object.entries(compiledBoQ?.section_totals ?? {}).map(([key, val]) =>
                    val.mid > 0 ? (
                      <div key={key} className="flex justify-between py-1 border-b border-infra-accent/10">
                        <span>Section {key}</span>
                        <span className="font-mono">USD {val.mid.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                    ) : null
                  )}
                  
                  <div className="pt-3 mt-4 flex justify-between font-bold text-white text-base">
                    <span>ESTIMATED TOTAL COST</span>
                    <span className="font-mono text-emerald-400">
                      USD {summary.total_project_estimate_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-infra-highlight text-xs py-1 border-t border-infra-accent/20">
                    <span>Local Currency Equivalent ({summary.local_currency})</span>
                    <span className="font-mono">{summary.total_local_currency.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                  
                  <div className="text-xs text-gray-500 mt-2 text-center bg-black/30 p-2 rounded border border-gray-800/40">
                    Expected pricing range: <span className="font-mono text-gray-300">USD {summary.total_project_range_usd[0].toLocaleString()}</span> – <span className="font-mono text-gray-300">{summary.total_project_range_usd[1].toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex gap-4 mt-6 pt-4 border-t border-infra-accent/20">
                  <button
                    type="button"
                    onClick={() => exportExcel()}
                    disabled={isExporting}
                    className="flex-1 py-2 text-xs border border-infra-accent/50 hover:bg-infra-accent/20 rounded-lg text-white font-medium shadow-md transition-all"
                  >
                    📊 Export Excel Spreadsheet
                  </button>
                  <button
                    type="button"
                    onClick={() => exportPdf()}
                    disabled={isExporting}
                    className="flex-1 py-2 text-xs border border-infra-accent/50 hover:bg-infra-accent/20 rounded-lg text-white font-medium shadow-md transition-all"
                  >
                    📄 Export PDF Report
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 border-2 border-dashed border-infra-accent/30 rounded-xl flex flex-col items-center justify-center text-center text-gray-500 h-64 bg-[#16213e]/20">
                <span className="text-4xl mb-3">📊</span>
                <p className="text-sm font-medium">Awaiting BoQ Compilation</p>
                <p className="text-xs text-gray-400 mt-1 max-w-xs">Load or import project elements, then compile the BoQ to view the cost estimate summaries and breakdowns.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
