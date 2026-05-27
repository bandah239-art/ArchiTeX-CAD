import { useState } from 'react';
import { PavementStress } from './PavementStress';
import { ESALGrowth } from './ESALGrowth';
import { StormHydrograph } from './StormHydrograph';

type RoadTab = 'pavement' | 'esal' | 'hydro';

interface Props { inputs: Record<string, unknown> }

export function RoadSimPanel({ inputs }: Props) {
  const [tab, setTab] = useState<RoadTab>('pavement');

  const tabs: { id: RoadTab; label: string; icon: string }[] = [
    { id: 'pavement', label: 'Pavement Stress', icon: '🛣' },
    { id: 'esal',     label: 'ESAL Growth',     icon: '📈' },
    { id: 'hydro',    label: 'Hydrograph',      icon: '🌊' },
  ];

  return (
    <div className="mt-4 border-t border-gray-700 pt-4 space-y-3">
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10px] text-gray-500 mr-1">SIM:</span>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-2 py-1 text-[10px] rounded transition-colors ${
              tab === t.id ? 'bg-amber-700/40 text-amber-200 border border-amber-500/50'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-transparent'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'pavement' && (
        <PavementStress
          cbr_subgrade={Number(inputs.cbr_subgrade ?? 6)}
          traffic_count={Number(inputs.traffic_count ?? inputs.aadt ?? 500)}
          heavy_vehicle_pct={Number(inputs.heavy_vehicle_pct ?? inputs.truck_pct ?? 12)}
          design_life={Number(inputs.design_life ?? inputs.design_life_yrs ?? 20)}
          road_class={String(inputs.road_class ?? 'secondary')}
        />
      )}

      {tab === 'esal' && (
        <ESALGrowth
          aadt={Number(inputs.aadt ?? inputs.traffic_count ?? 1000)}
          growth_rate_pct={Number(inputs.growth_rate_pct ?? 4)}
          design_life_yrs={Number(inputs.design_life_yrs ?? inputs.design_life ?? 20)}
          truck_pct={Number(inputs.truck_pct ?? inputs.heavy_vehicle_pct ?? 10)}
          bus_pct={Number(inputs.bus_pct ?? 5)}
          vdf_truck={Number(inputs.vdf_truck ?? 3)}
          vdf_bus={Number(inputs.vdf_bus ?? 1.2)}
          directional_split={Number(inputs.directional_split ?? 0.5)}
          lane_factor={Number(inputs.lane_factor ?? 1)}
        />
      )}

      {tab === 'hydro' && (
        <StormHydrograph
          catchment_area_ha={Number(inputs.catchment_area_ha ?? inputs.catchment_area ?? 10)}
          runoff_coefficient={Number(inputs.runoff_coefficient ?? 0.85)}
          rainfall_intensity_mm_hr={Number(inputs.rainfall_intensity_mm_hr ?? inputs.rainfall_intensity ?? 75)}
          duration_hours={Number(inputs.duration_hours ?? 2)}
        />
      )}
    </div>
  );
}
