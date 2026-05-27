import { useState } from 'react';
import { TunnelRMR } from './TunnelRMR';
import { GroundImprovLayout } from './GroundImprovLayout';

type GeoMoreTab = 'tunnel' | 'ground';

interface Props { inputs: Record<string, unknown> }

export function GeoMorePanel({ inputs }: Props) {
  const [tab, setTab] = useState<GeoMoreTab>('tunnel');

  const tabs: { id: GeoMoreTab; label: string; icon: string }[] = [
    { id: 'tunnel', label: 'RMR Support',     icon: '🔨' },
    { id: 'ground', label: 'Column Layout',   icon: '⚙' },
  ];

  return (
    <div className="mt-4 border-t border-gray-700 pt-4 space-y-3">
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10px] text-gray-500 mr-1">SIM:</span>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-2 py-1 text-[10px] rounded transition-colors ${
              tab === t.id ? 'bg-emerald-700/40 text-emerald-200 border border-emerald-500/50'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-transparent'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'tunnel' && (
        <TunnelRMR
          rqd_percent={Number(inputs.rqd_percent ?? 60)}
          intact_rock_strength_mpa={Number(inputs.intact_rock_strength_mpa ?? 50)}
          joint_spacing_rating={Number(inputs.joint_spacing_rating ?? 10)}
          joint_condition_rating={Number(inputs.joint_condition_rating ?? 12)}
          groundwater_rating={Number(inputs.groundwater_rating ?? 10)}
        />
      )}

      {tab === 'ground' && (
        <GroundImprovLayout
          column_diameter_m={Number(inputs.column_diameter_m ?? 0.8)}
          column_spacing_m={Number(inputs.column_spacing_m ?? 2.0)}
          depth_m={Number(inputs.depth_m ?? 8)}
          pattern={String(inputs.pattern ?? 'triangular')}
          area_to_improve_m2={Number(inputs.area_to_improve_m2 ?? 1000)}
        />
      )}
    </div>
  );
}
