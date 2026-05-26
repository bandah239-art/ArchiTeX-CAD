import { useState } from 'react';
import { SolarBatterySimulation } from './SolarBatterySimulation';
import { WindWakeMap } from './WindWakeMap';
import { HydroPowerCurve } from './HydroPowerCurve';

type SimTab = 'solar' | 'wind' | 'hydro';

interface Props {
  inputs: Record<string, unknown>;
}

export function EnergySimulationPanel({ inputs }: Props) {
  const [tab, setTab] = useState<SimTab>('solar');

  const tabs: { id: SimTab; label: string; icon: string }[] = [
    { id: 'solar', label: 'Solar + Battery', icon: '☀' },
    { id: 'wind',  label: 'Wind Wake Map',  icon: '🌀' },
    { id: 'hydro', label: 'Hydro Curve',    icon: '💧' },
  ];

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
                ? 'bg-indigo-600/40 text-indigo-200 border border-indigo-500/50'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-transparent'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'solar' && (
        <SolarBatterySimulation
          installed_kwp={Number(inputs.installed_kwp ?? inputs.peak_load_kw ?? 10)}
          battery_kwh={Number(inputs.battery_kwh ?? inputs.autonomy_days ?? 2) * Number(inputs.daily_load_kwh ?? 15)}
          daily_load_kwh={Number(inputs.daily_load_kwh ?? 15)}
          ghi_kwh_m2_day={Number(inputs.ghi_kwh_m2_day ?? inputs.peak_sun_hours ?? 5.8)}
          dod_pct={Number(inputs.dod_pct ?? 80)}
        />
      )}

      {tab === 'wind' && (
        <WindWakeMap
          rotor_diameter_m={Number(inputs.turbine_rotor_diameter_m ?? 80)}
          ct={Number(inputs.ct ?? 0.8)}
          k={Number(inputs.k ?? 0.075)}
          grid_x_diameters={Number(inputs.grid_x_diameters ?? 12)}
          grid_y_diameters={Number(inputs.grid_y_diameters ?? 5)}
        />
      )}

      {tab === 'hydro' && (
        <HydroPowerCurve
          net_head_m={Number(inputs.net_head_m ?? 20)}
          max_flow_m3s={Number(inputs.flow_rate_m3_s ?? inputs.max_flow_m3s ?? 2)}
          system_efficiency={Number(inputs.system_efficiency ?? 0.85)}
        />
      )}
    </div>
  );
}
