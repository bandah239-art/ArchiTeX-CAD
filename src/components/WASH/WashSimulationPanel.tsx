import { useState } from 'react';
import { WaterTowerAnimation } from './WaterTowerAnimation';
import { PipePressureDiagram } from './PipePressureDiagram';

type WashTab = 'tower' | 'pipe';

interface Props {
  inputs: Record<string, unknown>;
}

export function WashSimulationPanel({ inputs }: Props) {
  const [tab, setTab] = useState<WashTab>('tower');

  const tabs: { id: WashTab; label: string; icon: string }[] = [
    { id: 'tower', label: 'Tower Day Cycle', icon: '🏗' },
    { id: 'pipe',  label: 'Pipe Pressure',   icon: '🔵' },
  ];

  // Derive daily demand from population + lpcd if available
  const population = Number(inputs.population ?? 500);
  const lpcd = Number(inputs.liters_per_capita_day ?? inputs.lpcd ?? 50);
  const daily_demand_m3 = population * lpcd / 1000;

  // Tank capacity: default to 1 day storage
  const tank_capacity_m3 = Number(inputs.tank_capacity_m3 ?? daily_demand_m3 * 0.5);

  // Pump flow: deliver daily demand in pump_hours
  const pump_hours_val = Number(inputs.pump_hours ?? 8);
  const pump_flow_m3h = Number(inputs.pump_flow_m3h ?? daily_demand_m3 / pump_hours_val);

  return (
    <div className="mt-4 border-t border-gray-700 pt-4 space-y-3">
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10px] text-gray-500 mr-1">SIM:</span>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-2 py-1 text-[10px] rounded transition-colors ${
              tab === t.id
                ? 'bg-cyan-700/40 text-cyan-200 border border-cyan-500/50'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-transparent'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'tower' && (
        <WaterTowerAnimation
          daily_demand_m3={daily_demand_m3 || 25}
          tank_capacity_m3={tank_capacity_m3 || 12.5}
          pump_flow_m3h={pump_flow_m3h || 6}
          pump_start_hour={Number(inputs.pump_start_hour ?? 6)}
          pump_hours={pump_hours_val}
        />
      )}

      {tab === 'pipe' && (
        <PipePressureDiagram
          flow_rate_lps={Number(inputs.flow_rate_lps ?? 25)}
          pipe_length_m={Number(inputs.pipe_length_m ?? 500)}
          pipe_material={String(inputs.pipe_material ?? inputs.material ?? 'HDPE')}
          max_velocity_mps={Number(inputs.max_velocity_mps ?? 1.5)}
          min_pressure_m={Number(inputs.min_pressure_m ?? inputs.residual_pressure_m ?? 10)}
        />
      )}
    </div>
  );
}
