import { useState } from 'react';
import { LandfillGas } from './LandfillGas';
import { SoilMoisture } from './SoilMoisture';
import { TankHoopStress } from './TankHoopStress';

type EnvTab = 'landfill' | 'soil' | 'tank';

interface Props { inputs: Record<string, unknown> }

export function EnvPanel({ inputs }: Props) {
  const [tab, setTab] = useState<EnvTab>('landfill');

  const tabs: { id: EnvTab; label: string; icon: string }[] = [
    { id: 'landfill', label: 'LFG Curve',     icon: '🗑' },
    { id: 'soil',     label: 'Soil Moisture', icon: '💧' },
    { id: 'tank',     label: 'Hoop Stress',   icon: '🔵' },
  ];

  return (
    <div className="mt-4 border-t border-gray-700 pt-4 space-y-3">
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10px] text-gray-500 mr-1">SIM:</span>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-2 py-1 text-[10px] rounded transition-colors ${
              tab === t.id ? 'bg-teal-700/40 text-teal-200 border border-teal-500/50'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-transparent'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'landfill' && (
        <LandfillGas
          population={Number(inputs.population ?? 50000)}
          waste_generation_kg_capita_day={Number(inputs.waste_generation_kg_capita_day ?? 1.2)}
          design_life_years={Number(inputs.design_life_years ?? inputs.design_life ?? 20)}
          compacted_waste_density_kg_m3={Number(inputs.compacted_waste_density_kg_m3 ?? 800)}
        />
      )}

      {tab === 'soil' && (
        <SoilMoisture
          crop_area_ha={Number(inputs.crop_area_ha ?? 50)}
          crop_coefficient_kc={Number(inputs.crop_coefficient_kc ?? 1.1)}
          reference_evapotranspiration_mm_day={Number(inputs.reference_evapotranspiration_mm_day ?? 6)}
          irrigation_efficiency={Number(inputs.irrigation_efficiency ?? 0.85)}
        />
      )}

      {tab === 'tank' && (
        <TankHoopStress
          height={Number(inputs.height ?? 6)}
          radius={Number(inputs.radius ?? 4)}
          gamma_w={Number(inputs.gamma_w ?? 9.81)}
          wind_force={Number(inputs.wind_force ?? 120)}
          mu={Number(inputs.mu ?? 0.5)}
          tank_weight={Number(inputs.tank_weight ?? 800)}
        />
      )}
    </div>
  );
}
