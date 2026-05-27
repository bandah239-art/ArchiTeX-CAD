import { useState } from 'react';
import { SlabMoments } from './SlabMoments';
import { PMInteraction } from './PMInteraction';
import { WindFacade } from './WindFacade';

type SMoreTab = 'slab' | 'pm' | 'wind';

interface Props { inputs: Record<string, unknown> }

export function StructuralMorePanel({ inputs }: Props) {
  const [tab, setTab] = useState<SMoreTab>('slab');

  const tabs: { id: SMoreTab; label: string; icon: string }[] = [
    { id: 'slab', label: 'Slab Moments', icon: '📐' },
    { id: 'pm',   label: 'P-M Diagram',  icon: '📊' },
    { id: 'wind', label: 'Wind Facade',  icon: '🌬' },
  ];

  return (
    <div className="mt-4 border-t border-gray-700 pt-4 space-y-3">
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10px] text-gray-500 mr-1">SIM:</span>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-2 py-1 text-[10px] rounded transition-colors ${
              tab === t.id ? 'bg-violet-700/40 text-violet-200 border border-violet-500/50'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-transparent'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'slab' && (
        <SlabMoments
          span_lx_m={Number(inputs.span_lx ?? inputs.span ?? 4)}
          span_ly_m={Number(inputs.span_ly ?? 5)}
          dead_load_kn_m2={Number(inputs.dead_load ?? 5)}
          live_load_kn_m2={Number(inputs.live_load ?? 3)}
          depth_mm={Number(inputs.depth ?? 175)}
          fck_mpa={Number(inputs.fck ?? 30)}
          fyk_mpa={Number(inputs.fyk ?? 500)}
          slab_type={String(inputs.slab_type ?? 'two_way')}
          support_condition={String(inputs.support_condition ?? 'simply_supported')}
        />
      )}

      {tab === 'pm' && (
        <PMInteraction
          width_mm={Number(inputs.width ?? 300)}
          depth_mm={Number(inputs.depth ?? 300)}
          fck_mpa={Number(inputs.fck ?? 30)}
          fyk_mpa={Number(inputs.fyk ?? 500)}
          axial_load_kn={Number(inputs.axial_load ?? 850)}
          moment_major_knm={Number(inputs.moment_major ?? 45)}
        />
      )}

      {tab === 'wind' && (
        <WindFacade
          basic_wind_speed={Number(inputs.basic_wind_speed ?? 45)}
          building_height={Number(inputs.building_height ?? 12)}
          building_width={Number(inputs.building_width ?? 20)}
          building_length={Number(inputs.building_length ?? 30)}
          exposure_category={String(inputs.exposure_category ?? 'B')}
        />
      )}
    </div>
  );
}
