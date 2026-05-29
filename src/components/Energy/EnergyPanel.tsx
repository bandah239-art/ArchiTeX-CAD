import { useState } from 'react';
import { useEnergyStore } from '../../store/energyStore';
import { VoltageDrop } from './VoltageDrop';
import { FaultCurrentDecay } from './FaultCurrentDecay';
import { CatenaryProfile } from './CatenaryProfile';
import { BiogasYield } from './BiogasYield';

type MainTab = 'calc' | 'sim';
type SimTab = 'voltage' | 'catenary' | 'fault' | 'biogas';

export function EnergyPanel() {
  const s = useEnergyStore();
  const summary = s.result?.summary as Record<string, unknown> | undefined;

  const [mainTab, setMainTab] = useState<MainTab>('calc');
  const [simTab, setSimTab] = useState<SimTab>('voltage');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-infra-accent/30">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">☀️ Solar & Energy</h2>

        {/* Main tabs */}
        <div className="flex gap-1 mt-2">
          {(['calc', 'sim'] as MainTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setMainTab(t)}
              className={`flex-1 py-1 text-xs rounded font-medium transition-colors ${
                mainTab === t
                  ? 'bg-orange-600 text-white'
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
              {(['solar', 'battery'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => s.setActiveTab(t)}
                  className={`flex-1 py-1 text-xs rounded capitalize ${
                    s.activeTab === t ? 'bg-infra-highlight text-white' : 'bg-infra-accent/30 text-gray-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <Field label="Daily load (kWh)" value={s.dailyLoadKwh} onChange={s.setDailyLoadKwh} />
            {s.activeTab === 'battery' && (
              <Field label="Autonomy (days)" value={s.autonomyDays} onChange={s.setAutonomyDays} />
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
                {Object.entries(summary).slice(0, 10).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-gray-500">{k.replace(/_/g, ' ')}</span>
                    <span className="text-white">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── ELECTRICAL SIMULATIONS ── */}
        {mainTab === 'sim' && (
          <>
            <div className="flex gap-1 flex-wrap">
              {([
                { id: 'voltage'  as SimTab, label: '⚡ Voltage Drop' },
                { id: 'catenary' as SimTab, label: '🔌 Cable Sag'   },
                { id: 'fault'    as SimTab, label: '⚠ Fault Decay'  },
                { id: 'biogas'   as SimTab, label: '🔥 Biogas Yield' },
              ]).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSimTab(t.id)}
                  className={`flex-1 min-w-[44%] py-1 text-[10px] rounded transition-colors ${
                    simTab === t.id
                      ? 'bg-orange-700/50 text-orange-200 border border-orange-500/50'
                      : 'bg-infra-accent/30 text-gray-400 hover:bg-infra-accent/50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {simTab === 'voltage' && (
              <VoltageDrop
                cable_length_m={250}
                load_current_amps={45}
                system_voltage={230}
                cable_material="aluminum"
                max_voltage_drop_percent={5}
              />
            )}

            {simTab === 'catenary' && (
              <CatenaryProfile
                span_length_m={100}
                conductor_weight_kg_m={1.5}
                max_tension_kg={2000}
                ground_clearance_m={8}
                temperature_c={60}
              />
            )}

            {simTab === 'fault' && (
              <FaultCurrentDecay
                generator_kva={1000}
                generator_voltage_v={400}
                generator_subtransient_reactance_pu={0.15}
                cable_length_m={50}
                cable_resistance_ohm_km={0.16}
                cable_reactance_ohm_km={0.08}
              />
            )}

            {simTab === 'biogas' && (
              <BiogasYield
                cattle_count={50}
                poultry_count={0}
                human_count={10}
                temperature_c={25}
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
