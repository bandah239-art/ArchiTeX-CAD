import { useState } from 'react';
import { useWashStore } from '../../store/washStore';
import { WaterTowerAnimation } from './WaterTowerAnimation';
import { PipePressureDiagram } from './PipePressureDiagram';

type MainTab = 'calc' | 'sim';
type CalcTab = 'demand' | 'borehole' | 'sewerage';
type SimTab = 'tower' | 'pipe';

export function WashPanel() {
  const s = useWashStore();
  const summary = s.result?.summary as Record<string, unknown> | undefined;

  const [mainTab, setMainTab] = useState<MainTab>('calc');
  const [calcTab, setCalcTab] = useState<CalcTab>('demand');
  const [simTab, setSimTab] = useState<SimTab>('tower');

  // Simulation defaults — derived from calc inputs when available
  const population = s.population ?? 500;
  const lpcd = s.lpcd ?? 50;
  const daily_demand_m3 = (population * lpcd) / 1000;
  const tank_capacity_m3 = Math.max(daily_demand_m3 * 0.5, 5);
  const pump_flow_m3h = Math.max(daily_demand_m3 / 8, 1);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-infra-accent/30">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">💧 WASH Engineering</h2>

        {/* Main tabs: Calculators / Simulations */}
        <div className="flex gap-1 mt-2">
          {(['calc', 'sim'] as MainTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setMainTab(t)}
              className={`flex-1 py-1 text-xs rounded font-medium transition-colors ${
                mainTab === t
                  ? 'bg-cyan-600 text-white'
                  : 'bg-infra-accent/30 text-gray-400 hover:bg-infra-accent/50'
              }`}
            >
              {t === 'calc' ? '📐 Calculators' : '📊 Simulations'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {/* ── CALCULATORS ── */}
        {mainTab === 'calc' && (
          <>
            <div className="flex gap-1">
              {(['demand', 'borehole', 'sewerage'] as CalcTab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCalcTab(t)}
                  className={`flex-1 py-1 text-xs rounded capitalize ${
                    calcTab === t ? 'bg-infra-highlight text-white' : 'bg-infra-accent/30 text-gray-400'
                  }`}
                >
                  {t === 'demand' ? 'Water Demand' : t === 'borehole' ? 'Borehole' : 'Sewerage'}
                </button>
              ))}
            </div>

            {(calcTab === 'demand' || calcTab === 'sewerage') && (
              <>
                <Field label="Population" value={s.population} onChange={s.setPopulation} />
                <Field label="LPCD (L/capita/day)" value={s.lpcd} onChange={s.setLpcd} />
              </>
            )}
            {calcTab === 'borehole' && (
              <Field label="Daily demand (m³)" value={s.dailyDemandM3} onChange={s.setDailyDemandM3} />
            )}

            <button
              type="button"
              onClick={() => s.runCalculation()}
              disabled={s.isLoading}
              className="w-full py-2 bg-infra-highlight text-white text-sm rounded disabled:opacity-50"
            >
              {s.isLoading ? 'Calculating...' : 'CALCULATE'}
            </button>

            {s.error && (
              <div className="text-xs text-red-300 bg-red-900/30 p-2 rounded">{s.error}</div>
            )}

            {summary && (
              <div className="p-3 bg-infra-darker border border-infra-accent/30 rounded text-xs text-gray-300 space-y-1">
                {Object.entries(summary).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-gray-500">{k.replace(/_/g, ' ')}</span>
                    <span className="text-white">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── SIMULATIONS ── */}
        {mainTab === 'sim' && (
          <>
            <div className="flex gap-1">
              {([
                { id: 'tower' as SimTab, label: '🏗 Tower Day Cycle' },
                { id: 'pipe'  as SimTab, label: '🔵 Pipe Pressure' },
              ]).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSimTab(t.id)}
                  className={`flex-1 py-1 text-xs rounded transition-colors ${
                    simTab === t.id
                      ? 'bg-cyan-700/50 text-cyan-200 border border-cyan-500/50'
                      : 'bg-infra-accent/30 text-gray-400 hover:bg-infra-accent/50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="text-xs text-gray-500 bg-infra-darker/50 rounded p-2">
              {simTab === 'tower'
                ? `Simulating daily storage cycle — pop. ${population.toLocaleString()}, demand ${daily_demand_m3.toFixed(1)} m³/day, tank ${tank_capacity_m3.toFixed(1)} m³`
                : 'Pipe pressure profile along a gravity main. Adjust inputs in the Calculators tab to update.'}
            </div>

            {simTab === 'tower' && (
              <WaterTowerAnimation
                daily_demand_m3={daily_demand_m3 || 25}
                tank_capacity_m3={tank_capacity_m3 || 12.5}
                pump_flow_m3h={pump_flow_m3h || 6}
                pump_start_hour={6}
                pump_hours={8}
              />
            )}

            {simTab === 'pipe' && (
              <PipePressureDiagram
                flow_rate_lps={Math.max(daily_demand_m3 / 86.4, 0.5)}
                pipe_length_m={500}
                pipe_material="HDPE"
                max_velocity_mps={1.5}
                min_pressure_m={10}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
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
