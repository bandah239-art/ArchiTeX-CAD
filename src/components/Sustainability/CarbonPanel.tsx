import { useState } from 'react';
import { useCarbonStore } from '../../store/carbonStore';
import { CarbonVerifierPanel } from '../Carbon/CarbonVerifierPanel';

export function CarbonPanel() {
  const s = useCarbonStore();
  const summary = s.result?.summary as Record<string, unknown> | undefined;
  const credits = s.creditResult?.summary as Record<string, unknown> | undefined;
  const [tab, setTab] = useState<'manual' | 'sketch'>('sketch');

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-infra-accent/30">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">🌱 Carbon & ESG</h2>
        <div className="flex gap-1 mt-2">
          {(['sketch', 'manual'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`flex-1 py-1 text-xs rounded transition-colors ${tab === t ? 'bg-emerald-600 text-white' : 'bg-infra-accent/30 text-gray-400'}`}>
              {t === 'sketch' ? '📐 From Drawing' : '✏️ Manual Entry'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'sketch' && <div className="flex-1 overflow-hidden"><CarbonVerifierPanel /></div>}

      {tab === 'manual' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <p className="text-xs text-gray-500">RICS WLCA embodied carbon + VCS credit estimates</p>
          <p className="text-xs text-gray-500 mb-4">RICS WLCA embodied carbon + VCS credit estimates</p>
          <Field label="Concrete (m³)" value={s.materials.concrete_m3_rcc ?? 0} onChange={(v) => s.setMaterial('concrete_m3_rcc', v)} />
          <Field label="Steel (tonnes)" value={s.materials.steel_t ?? 0} onChange={(v) => s.setMaterial('steel_t', v)} />
          <Field label="Transport distance (km)" value={s.transportKm} onChange={(v) => useCarbonStore.setState({ transportKm: v })} />
          <Field label="Transport mass (t)" value={s.transportMass} onChange={(v) => useCarbonStore.setState({ transportMass: v })} />
          <Field label="Site energy (kWh)" value={s.energyKwh} onChange={(v) => useCarbonStore.setState({ energyKwh: v })} />

          <div className="flex gap-2">
            <button type="button" onClick={() => s.runCarbon()} disabled={s.isLoading} className="flex-1 py-2 text-xs font-semibold rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40">
              Embodied Carbon
            </button>
            <button type="button" onClick={() => s.runCredits()} disabled={s.isLoading} className="flex-1 py-2 text-xs font-semibold rounded border border-infra-accent/50 hover:bg-infra-accent/20 disabled:opacity-40">
              Carbon Credits
            </button>
          </div>

          {s.error && <div className="text-xs text-red-300 bg-red-900/30 p-2 rounded">{s.error}</div>}

          {summary && (
            <div className="p-3 bg-infra-darker border border-infra-accent/30 rounded text-xs space-y-1">
              <Row label="Total embodied" value={`${summary.total_tCO2e} tCO₂e`} />
              <Row label="Materials" value={`${summary.material_kgCO2e} kgCO₂e`} />
              <Row label="Transport" value={`${summary.transport_kgCO2e} kgCO₂e`} />
            </div>
          )}

          {credits && (
            <div className="p-3 bg-infra-darker border border-emerald-500/30 rounded text-xs space-y-1">
              <Row label="VCUs (est.)" value={String(credits.total_VCUs)} />
              <Row label="Value (USD)" value={`$${credits.total_value_USD}`} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white" />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <span className="text-emerald-400 font-medium">{value}</span>
    </div>
  );
}
