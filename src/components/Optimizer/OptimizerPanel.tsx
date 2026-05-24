import { useOptimizerStore } from '../../store/optimizerStore';

export function OptimizerPanel() {
  const s = useOptimizerStore();
  const structural = s.structuralResult?.summary as Record<string, unknown> | undefined;
  const solar = s.solarResult?.summary as Record<string, unknown> | undefined;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-infra-accent/30">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">Generative Design</h2>
        <p className="text-xs text-gray-500 mt-1">scipy DE + Optuna multi-objective optimization</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <section className="space-y-2">
          <div className="text-xs font-semibold text-gray-400 uppercase">Structural Layout</div>
          <Field label="Floor area (m²)" value={s.floorArea} onChange={(v) => useOptimizerStore.setState({ floorArea: v })} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Min span (m)" value={s.spanMin} onChange={(v) => useOptimizerStore.setState({ spanMin: v })} />
            <Field label="Max span (m)" value={s.spanMax} onChange={(v) => useOptimizerStore.setState({ spanMax: v })} />
          </div>
          <button type="button" onClick={() => s.runStructural()} disabled={s.isRunning} className="w-full py-2 text-xs font-semibold bg-purple-800 hover:bg-purple-700 rounded disabled:opacity-40">
            Optimize Grid Layout
          </button>
          {structural && (
            <ResultBox rows={[
              ['Span X', `${structural.optimal_span_x_m} m`],
              ['Span Y', `${structural.optimal_span_y_m} m`],
              ['Columns', String(structural.total_columns)],
              ['Steel', `${structural.estimated_steel_kg_m2} kg/m²`],
              ['Slab depth', `${structural.slab_depth_mm} mm`],
              ['Engine', String(s.structuralResult?.engine ?? 'scipy')],
            ]} />
          )}
        </section>

        <section className="space-y-2">
          <div className="text-xs font-semibold text-gray-400 uppercase">Solar Orientation</div>
          <Field label="Roof area (m²)" value={s.roofArea} onChange={(v) => useOptimizerStore.setState({ roofArea: v })} />
          <button type="button" onClick={() => s.runSolar()} disabled={s.isRunning} className="w-full py-2 text-xs font-semibold border border-amber-500/50 text-amber-400 hover:bg-amber-500/10 rounded disabled:opacity-40">
            Optimize Tilt & Azimuth
          </button>
          {solar && (
            <ResultBox rows={[
              ['Azimuth', `${solar.optimal_azimuth_deg}°`],
              ['Tilt', `${solar.optimal_tilt_deg}°`],
              ['Yield gain', `${solar.estimated_yield_improvement_pct}%`],
              ['Engine', String(s.solarResult?.engine ?? 'optuna')],
            ]} />
          )}
        </section>

        {s.error && <div className="text-xs text-red-300 bg-red-900/30 p-2 rounded">{s.error}</div>}
      </div>
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

function ResultBox({ rows }: { rows: [string, string][] }) {
  return (
    <div className="p-3 bg-infra-darker border border-purple-500/30 rounded text-xs space-y-1">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2">
          <span className="text-gray-500">{k}</span>
          <span className="text-purple-300 font-medium">{v}</span>
        </div>
      ))}
    </div>
  );
}
