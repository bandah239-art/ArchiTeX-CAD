import { useEffect, useState } from 'react';
import { useDrawStore } from '../../store/drawStore';
import { useCalculationStore } from '../../store/calculationStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { KIND_TO_CALC } from '../../services/sketchToBoQ';
import type { SketchElement } from '../../store/drawStore';
import type { CalculationModule } from '../../types/calculations';

interface Prompt {
  el: SketchElement;
  module: string;
  label: string;
  inputs: Record<string, number | string>;
}

export function SketchCalcPrompt() {
  const { lastFinishedElement, clearLastFinished } = useDrawStore();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!lastFinishedElement) return;
    const mapping = KIND_TO_CALC[lastFinishedElement.kind];
    if (!mapping) return;

    setPrompt({
      el: lastFinishedElement,
      module: mapping.module,
      label: mapping.label,
      inputs: mapping.inputs(lastFinishedElement),
    });
    setVisible(true);
    clearLastFinished();
    // Auto-dismiss after 12s
    const t = setTimeout(() => setVisible(false), 12_000);
    return () => clearTimeout(t);
  }, [lastFinishedElement, clearLastFinished]);

  if (!visible || !prompt) return null;

  const runCalc = () => {
    useWorkspaceStore.getState().openPanel('calculator');
    useCalculationStore.getState().setModule(prompt.module as CalculationModule);
    useCalculationStore.getState().setInputs(prompt.inputs);
    setVisible(false);
  };

  const { el } = prompt;

  // Build a compact dimension summary for the toast
  const dims: string[] = [];
  if (el.lengthM) dims.push(`L = ${el.lengthM.toFixed(2)} m`);
  if (el.areaM2) dims.push(`A = ${el.areaM2.toFixed(2)} m²`);
  if (el.height) dims.push(`h = ${el.height.toFixed(2)} m`);
  if (el.thickness) dims.push(`t = ${(el.thickness * 1000).toFixed(0)} mm`);

  return (
    <div className="fixed bottom-10 right-6 z-[300] pointer-events-auto w-80 animate-slide-up">
      <div className="bg-[#0f172a] border border-infra-highlight/50 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-infra-highlight/10 border-b border-infra-highlight/30">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-infra-highlight animate-pulse" />
            <span className="text-xs font-bold text-infra-highlight uppercase tracking-wider">
              Element Drawn
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

        {/* Dimensions */}
        <div className="px-4 py-3 space-y-1">
          <p className="text-xs text-gray-400 capitalize font-medium">
            {el.kind.replace(/-/g, ' ')}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {dims.map((d) => (
              <span key={d} className="text-xs font-mono text-white">{d}</span>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="px-4 pb-3 flex gap-2">
          <button
            type="button"
            onClick={runCalc}
            className="flex-1 py-2 bg-infra-highlight hover:bg-infra-highlight/80 text-white text-xs font-bold rounded-lg transition-colors"
          >
            Run {prompt.label} →
          </button>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="px-3 py-2 bg-infra-accent/30 hover:bg-infra-accent/50 text-gray-400 text-xs rounded-lg transition-colors"
          >
            Skip
          </button>
        </div>

        {/* Progress bar — auto-dismiss timer */}
        <div className="h-0.5 bg-infra-highlight/20">
          <div
            className="h-full bg-infra-highlight/60 transition-none"
            style={{ animation: 'shrink-width 12s linear forwards' }}
          />
        </div>
      </div>
    </div>
  );
}
