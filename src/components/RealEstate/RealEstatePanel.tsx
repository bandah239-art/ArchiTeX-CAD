import type { ReactNode } from 'react';
import { useRealEstateStore } from '../../store/realEstateStore';

export function RealEstatePanel() {
  const store = useRealEstateStore();
  const tabs = [
    { id: 'valuation' as const, label: 'Plot Valuation' },
    { id: 'feasibility' as const, label: 'Feasibility' },
    { id: 'landuse' as const, label: 'Land Use' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-infra-accent/30">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">Real Estate Feasibility</h2>
        <div className="flex gap-1 mt-2">
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => store.setActiveTab(t.id)} className={`flex-1 py-1 text-xs rounded ${store.activeTab === t.id ? 'bg-infra-highlight text-white' : 'bg-infra-accent/30 text-gray-400'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {store.activeTab === 'valuation' && <ValuationTab />}
        {store.activeTab === 'feasibility' && <FeasibilityTab />}
        {store.activeTab === 'landuse' && <LandUseTab />}
        {store.error && <div className="text-xs text-red-300 bg-red-900/30 p-2 rounded">{store.error}</div>}
      </div>
    </div>
  );
}

function ValuationTab() {
  const s = useRealEstateStore();
  const r = s.valuationResult;
  return (
    <>
      <FieldNumber label="Plot area (m²)" value={s.plotArea} onChange={s.setPlotArea} />
      <FieldNumber label="Asking price USD" value={s.askingPrice} onChange={s.setAskingPrice} />
      <FieldText label="Neighbourhood" value={s.neighbourhood} onChange={s.setNeighbourhood} />
      <button type="button" onClick={() => s.runValuation()} disabled={s.isLoading} className="w-full py-2 bg-infra-highlight text-white text-sm rounded">VALUE THIS PLOT</button>
      {r && (
        <ResultBox title="Valuation Result">
          <Row label="Market value" value={`USD ${(r.estimated_market_value_usd as number[])?.[0]?.toLocaleString()}–${(r.estimated_market_value_usd as number[])?.[1]?.toLocaleString()}`} />
          <Row label="Assessment" value={r.assessment as string} />
          <Row label="Plot score" value={`${r.plot_potential_score}/10`} />
        </ResultBox>
      )}
    </>
  );
}

function FeasibilityTab() {
  const s = useRealEstateStore();
  const r = s.feasibilityResult;
  return (
    <>
      <FieldNumber label="GFA (m²)" value={s.gfa} onChange={s.setGfa} />
      <FieldNumber label="Sale price / m² USD" value={s.salePricePerM2} onChange={s.setSalePricePerM2} />
      <button type="button" onClick={() => s.runFeasibility()} disabled={s.isLoading} className="w-full py-2 bg-infra-highlight text-white text-sm rounded">RUN FEASIBILITY</button>
      <button type="button" onClick={() => s.runMortgage()} disabled={s.isLoading} className="w-full py-2 text-xs border border-infra-accent/50 rounded">Mortgage Calculator</button>
      {r && (
        <ResultBox title="Development Appraisal">
          <Row label="TDC" value={`USD ${(r.total_development_cost_usd as number)?.toLocaleString()}`} />
          <Row label="GDV" value={`USD ${(r.gross_development_value_usd as number)?.toLocaleString()}`} />
          <Row label="Profit" value={`USD ${(r.profit_usd as number)?.toLocaleString()}`} />
          <Row label="Profit on Cost" value={`${r.profit_on_cost_pct}% — ${r.viability_assessment}`} />
        </ResultBox>
      )}
      {s.mortgageResult && (
        <ResultBox title="Mortgage">
          <Row label="Monthly payment" value={`USD ${s.mortgageResult.monthly_payment_usd}`} />
          <Row label="Required income" value={`USD ${s.mortgageResult.required_monthly_income_usd}/mo`} />
        </ResultBox>
      )}
    </>
  );
}

function LandUseTab() {
  const s = useRealEstateStore();
  const r = s.landUseResult;
  const options = (r?.options as Record<string, unknown>[]) ?? [];
  return (
    <>
      <button type="button" onClick={() => s.runLandUse()} disabled={s.isLoading} className="w-full py-2 bg-infra-highlight text-white text-sm rounded">ANALYSE BEST USE</button>
      {options.map((o) => (
        <div key={o.option as string} className="p-3 bg-infra-darker border border-infra-accent/30 rounded text-xs">
          <div className="text-white font-medium">
            {String(o.rank)}. {String(o.option)} {o.recommended ? '⭐' : ''}
          </div>
          <div className="text-gray-400 mt-1">
            PoC: {String(o.profit_on_cost_pct)}% | Risk: {String(o.risk)}
          </div>
          <div className="text-gray-500">{String(o.notes ?? '')}</div>
        </div>
      ))}
    </>
  );
}

function FieldNumber({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white"
      />
    </div>
  );
}

function FieldText({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white"
      />
    </div>
  );
}

function ResultBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="p-3 bg-infra-darker border border-infra-accent/30 rounded">
      <div className="text-xs font-semibold text-gray-400 uppercase mb-2">{title}</div>
      <div className="space-y-1 text-xs text-gray-300">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span>{label}</span>
      <span className="text-white text-right">{value}</span>
    </div>
  );
}
