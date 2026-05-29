import { useEffect, useState } from 'react';
import { useBoQStore } from '../../store/boqStore';
import { useViewerStore } from '../../store/viewerStore';
import { elementsFromViewer, toBimPayload } from '../../services/ifcBoqService';
import { useIfcModelStore } from '../../store/ifcModelStore';
import { API_BASE } from '../../services/apiConfig';
import { formatZppaBoQ } from '../../services/zppaExport';

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
    sketchBoQItems,
    clearSketchBoQ,
  } = useBoQStore();
  const { selectedElement } = useViewerStore();
  const { getBoqElements } = useIfcModelStore();
  const [zmwRates, setZmwRates] = useState<Record<string, { rate: number; unit: string; description: string }> | null>(null);
  const [showZmwRates, setShowZmwRates] = useState(false);
  const [loadingRates, setLoadingRates] = useState(false);

  const handleImportBim = () => {
    const parsed = getBoqElements();
    const els = elementsFromViewer(parsed.length ? parsed : null, selectedElement);
    importFromBim(toBimPayload(els));
  };

  const handleLoadZmwRates = async () => {
    if (zmwRates) { setShowZmwRates((v) => !v); return; }
    setLoadingRates(true);
    try {
      const res = await fetch(`${API_BASE}/boq/zambia-rates`);
      const data = await res.json();
      setZmwRates(data.rates);
      setShowZmwRates(true);
    } catch { /* fallback silent */ } finally {
      setLoadingRates(false);
    }
  };

  useEffect(() => {
    if (!elements.length) loadDemoProject();
  }, [elements.length, loadDemoProject]);

  const summary = compiledBoQ?.summary;

  const sketchTotal = sketchBoQItems.reduce((s, i) => s + i.total_zmw, 0);

  return (
    <div className="flex flex-col h-full">

      {/* ── Sketch BOQ banner ── */}
      {sketchBoQItems.length > 0 && (
        <div className="mx-3 mt-3 rounded-lg border border-infra-highlight/50 bg-infra-highlight/10 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-infra-highlight/30">
            <span className="text-xs font-bold text-infra-highlight uppercase tracking-wider">
              📐 Sketch BOQ — {sketchBoQItems.length} items
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-white">
                ZMW {sketchTotal.toLocaleString()}
              </span>
              <button type="button" onClick={clearSketchBoQ} className="text-gray-500 hover:text-red-400 text-xs">✕</button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {sketchBoQItems.map((item) => (
              <div key={`${item.source_element_id}-${item.code}`}
                className="flex items-start justify-between px-3 py-1.5 border-b border-infra-highlight/10 text-xs hover:bg-infra-highlight/5">
                <div className="flex-1 min-w-0 pr-2">
                  <span className="text-gray-400 font-mono mr-1.5">{item.code}</span>
                  <span className="text-gray-200 truncate">{item.description}</span>
                </div>
                <div className="flex-shrink-0 text-right font-mono">
                  <span className="text-gray-400">{item.qty} {item.unit}</span>
                  <span className="text-white ml-2">ZMW {item.total_zmw.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="px-3 py-1.5 flex justify-between items-center bg-infra-highlight/5">
            <span className="text-[10px] text-gray-500">From drawn sketch elements — verify quantities before submission</span>
            <span className="text-xs font-bold text-infra-highlight">Total: ZMW {sketchTotal.toLocaleString()}</span>
          </div>
        </div>
      )}

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

            {/* Zambia ZMW Rate Reference */}
            <div>
              <button
                type="button"
                onClick={handleLoadZmwRates}
                disabled={loadingRates}
                className="w-full py-1.5 text-xs border border-amber-500/40 hover:bg-amber-500/10 rounded text-amber-300 font-medium transition-colors disabled:opacity-50"
              >
                🇿🇲 {loadingRates ? 'Loading...' : showZmwRates ? 'Hide Zambia ZMW Rates' : 'Show Zambia ZMW Rates'}
              </button>
              {showZmwRates && zmwRates && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded border border-amber-500/20 bg-amber-900/10 text-xs">
                  {Object.entries(zmwRates).map(([key, v]) => (
                    <div key={key} className="flex justify-between px-2 py-1 border-b border-amber-500/10">
                      <span className="text-gray-400 truncate max-w-[55%]" title={v.description}>{v.description}</span>
                      <span className="text-amber-300 font-mono">ZMW {v.rate.toLocaleString()}/{v.unit}</span>
                    </div>
                  ))}
                  <p className="text-gray-600 text-[10px] px-2 py-1">Q4-2025 benchmarks. Verify before tendering.</p>
                </div>
              )}
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

                <div className="flex gap-2 mt-6 pt-4 border-t border-infra-accent/20 flex-wrap">
                  <button
                    type="button"
                    onClick={() => exportExcel()}
                    disabled={isExporting}
                    className="flex-1 py-2 text-xs border border-infra-accent/50 hover:bg-infra-accent/20 rounded-lg text-white font-medium transition-all"
                  >
                    📊 Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => exportPdf()}
                    disabled={isExporting}
                    className="flex-1 py-2 text-xs border border-infra-accent/50 hover:bg-infra-accent/20 rounded-lg text-white font-medium transition-all"
                  >
                    📄 PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const html = formatZppaBoQ(sketchBoQItems, {
                        project_name: projectName || 'Project',
                        employer:     client || 'Government of the Republic of Zambia',
                        location:     'Zambia',
                        date:         new Date().toLocaleDateString('en-ZM'),
                      });
                      const w = window.open('', '_blank');
                      if (w) { w.document.write(html); w.document.close(); }
                    }}
                    className="flex-1 py-2 text-xs bg-amber-700/30 hover:bg-amber-700/50 border border-amber-600/40 rounded-lg text-amber-200 font-bold transition-all"
                    title="Export in ZPPA standard BOQ format for government tender submission"
                  >
                    🇿🇲 ZPPA Format
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
