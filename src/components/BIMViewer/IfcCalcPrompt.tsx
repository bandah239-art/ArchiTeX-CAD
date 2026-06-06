import { useEffect, useRef, useState } from 'react';
import { useViewerStore } from '../../store/viewerStore';
import { useCalculationStore } from '../../store/calculationStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useProjectStore } from '../../store/projectStore';
import {
  calcModuleForIfcType,
  calcPrefillFromElement,
  type CalcPrefillResult,
} from '../../services/selectionBridge';
import { projectAPI } from '../../services/projectAPI';
import type { IFCElement } from '../../types/ifc';

const MODULE_LABELS: Record<string, string> = {
  beam: 'Beam Design',
  slab: 'Slab Design',
  column: 'Column Design',
  foundation: 'Foundation Design',
};

export function IfcCalcPrompt() {
  const selectedElement = useViewerStore((s) => s.selectedElement);
  const [prompt, setPrompt] = useState<CalcPrefillResult | null>(null);
  const [visible, setVisible] = useState(false);
  const lastGlobalId = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedElement) return;
    const module = calcModuleForIfcType(selectedElement.type);
    if (!module) return;
    if (selectedElement.globalId === lastGlobalId.current) return;

    const prefill = calcPrefillFromElement(selectedElement);
    setPrompt(prefill);
    setVisible(true);
    lastGlobalId.current = selectedElement.globalId;

    const t = setTimeout(() => setVisible(false), 12_000);
    return () => clearTimeout(t);
  }, [selectedElement]);

  if (!visible || !prompt) return null;

  const runCalc = async () => {
    useWorkspaceStore.getState().openPanel('calculator');
    useCalculationStore.getState().prefillFromElement(prompt.element, { logAudit: true });
    setVisible(false);

    const projectId = useProjectStore.getState().currentProject?.id ?? 'default';
    try {
      await projectAPI.logIfcCalcLink({
        project_id: projectId,
        ifc_global_id: prompt.element.globalId,
        ifc_express_id: prompt.element.id,
        ifc_type: prompt.element.type,
        calc_module: prompt.module,
        confidence: prompt.confidence,
        inputs: prompt.inputs,
      });
    } catch {
      /* audit log is best-effort */
    }
  };

  const confidenceColor =
    prompt.confidence === 'high'
      ? 'text-emerald-400'
      : prompt.confidence === 'medium'
        ? 'text-amber-400'
        : 'text-orange-400';

  return (
    <div className="fixed bottom-10 right-6 z-[300] pointer-events-auto w-80 animate-slide-up">
      <div className="bg-[#0f172a] border border-blue-500/50 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-blue-500/10 border-b border-blue-500/30">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
              IFC Element Selected
            </span>
          </div>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="text-gray-500 hover:text-gray-300 text-sm"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-3 space-y-1">
          <p className="text-xs text-gray-400 font-medium truncate">{prompt.element.name}</p>
          <p className="text-[10px] text-gray-500 font-mono">{prompt.element.type}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
            {Object.entries(prompt.fieldConfidence).slice(0, 4).map(([k, c]) => (
              <span key={k} className="text-[10px] font-mono text-gray-300">
                {k}: {String((prompt.inputs as Record<string, unknown>)[k] ?? '—')}
                <span className={`ml-1 ${c === 'high' ? 'text-emerald-500' : c === 'medium' ? 'text-amber-500' : 'text-orange-500'}`}>
                  ({c[0]})
                </span>
              </span>
            ))}
          </div>
          <p className={`text-[10px] mt-1 ${confidenceColor}`}>
            Overall confidence: {prompt.confidence} — {prompt.confidenceNote}
          </p>
        </div>

        <div className="px-4 pb-3 flex gap-2">
          <button
            type="button"
            onClick={runCalc}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
          >
            Run {MODULE_LABELS[prompt.module] ?? prompt.module} →
          </button>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="px-3 py-2 bg-infra-accent/30 hover:bg-infra-accent/50 text-gray-400 text-xs rounded-lg"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
