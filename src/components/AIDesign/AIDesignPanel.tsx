import { useAiStore } from '../../store/aiStore';

const COUNTRIES = [
  { code: 'ZM', label: '🇿🇲 Zambia' },
  { code: 'KE', label: '🇰🇪 Kenya' },
  { code: 'NG', label: '🇳🇬 Nigeria' },
  { code: 'GH', label: '🇬🇭 Ghana' },
];

export function AIDesignPanel() {
  const {
    prompt,
    countryCode,
    budgetUsd,
    projectType,
    designBrief,
    variants,
    isGenerating,
    error,
    setPrompt,
    setCountryCode,
    setBudgetUsd,
    setProjectType,
    generateDesign,
    generateVariants,
    pushToCalculators,
    exportProposal,
  } = useAiStore();

  const spaces = (designBrief?.spatial_programme as { space: string; area_m2: number; notes?: string }[]) ?? [];
  const cost = designBrief?.preliminary_cost_estimate as Record<string, unknown> | undefined;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-infra-accent/30">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">AI Design Generation</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          placeholder="Describe your project in plain language..."
          className="w-full px-2 py-2 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white"
        />
        <div className="grid grid-cols-2 gap-2">
          <select value={projectType} onChange={(e) => setProjectType(e.target.value)} className="text-xs bg-infra-darker border border-infra-accent/40 rounded px-2 py-1.5 text-white">
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="industrial">Industrial</option>
            <option value="institutional">Institutional</option>
          </select>
          <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="text-xs bg-infra-darker border border-infra-accent/40 rounded px-2 py-1.5 text-white">
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>
        <input type="number" value={budgetUsd} onChange={(e) => setBudgetUsd(Number(e.target.value))} placeholder="Budget USD" className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white" />

        <button type="button" onClick={() => generateDesign()} disabled={isGenerating} className="w-full py-2 bg-infra-highlight text-white text-sm font-semibold rounded disabled:opacity-50">
          {isGenerating ? 'Generating...' : 'GENERATE DESIGN'}
        </button>

        {error && <div className="text-xs text-red-300 bg-red-900/30 p-2 rounded">{error}</div>}

        {designBrief && (
          <div className="p-3 bg-infra-darker border border-infra-accent/30 rounded text-xs text-gray-300 space-y-2">
            <div className="text-white font-semibold">
              {(designBrief.project_type as string) ?? 'Design'} — {designBrief.gross_floor_area as number}m²
            </div>
            {spaces.slice(0, 8).map((s) => (
              <div key={s.space}>• {s.space} — {s.area_m2}m²</div>
            ))}
            {cost && (
              <div className="text-green-400 pt-2 border-t border-infra-accent/20">
                Estimate: USD {(cost.construction_cost_usd as number)?.toLocaleString()} — {cost.budget_assessment as string}
              </div>
            )}
          </div>
        )}

        {designBrief && (
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={() => generateVariants()} className="flex-1 py-1.5 text-xs border border-infra-accent/50 rounded">Variants</button>
            <button type="button" onClick={() => pushToCalculators()} className="flex-1 py-1.5 text-xs border border-infra-accent/50 rounded">Push to Calculators</button>
            <button type="button" onClick={() => exportProposal()} className="flex-1 py-1.5 text-xs border border-infra-accent/50 rounded">Export Proposal</button>
          </div>
        )}

        {variants && (
          <div className="space-y-2">
            {(['variant_a', 'variant_b', 'variant_c'] as const).map((key) => {
              const v = variants[key] as { label?: string; budget_usd?: number } | undefined;
              if (!v) return null;
              return (
                <div key={key} className="p-2 bg-infra-accent/20 rounded text-xs text-gray-300">
                  {v.label} — USD {v.budget_usd?.toLocaleString()}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
