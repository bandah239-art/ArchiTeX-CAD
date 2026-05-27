import { useState } from 'react';
import { BeamBMDSFD } from './BeamBMDSFD';
import { FoundationPressure } from './FoundationPressure';

type StructTab = 'beam' | 'foundation';

interface Props {
  inputs: Record<string, unknown>;
}

export function StructuralSimulationPanel({ inputs }: Props) {
  const [tab, setTab] = useState<StructTab>('beam');

  const tabs: { id: StructTab; label: string; icon: string }[] = [
    { id: 'beam',       label: 'BMD / SFD',   icon: '📊' },
    { id: 'foundation', label: 'Found. Press', icon: '🏗' },
  ];

  // Beam inputs
  const udl = Number(inputs.dead_load ?? 0) + Number(inputs.imposed_load ?? inputs.live_load ?? 0) || 25;
  const support_raw = String(inputs.support_condition ?? inputs.support_type ?? 'simply_supported');
  // Map 'fixed' (FEA) → 'fixed_fixed'
  const support = support_raw === 'fixed' ? 'fixed_fixed' : support_raw;

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
                ? 'bg-violet-700/40 text-violet-200 border border-violet-500/50'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-transparent'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'beam' && (
        <BeamBMDSFD
          span_m={Number(inputs.span ?? 6)}
          udl_kn_m={udl}
          support={support}
          fck_mpa={Number(inputs.fck ?? 30)}
          width_mm={Number(inputs.width ?? 300)}
          depth_mm={Number(inputs.depth ?? inputs.height ?? 500)}
        />
      )}

      {tab === 'foundation' && (
        <FoundationPressure
          B_m={Number(inputs.foundation_width_m ?? inputs.B_m ?? 2)}
          L_m={Number(inputs.foundation_length_m ?? inputs.L_m ?? inputs.foundation_width_m ?? 2)}
          P_kn={Number(inputs.column_load ?? inputs.P_kn ?? 800)}
          Mx_knm={Number(inputs.moment_x ?? inputs.Mx_knm ?? 0)}
          My_knm={Number(inputs.moment_y ?? inputs.My_knm ?? 0)}
        />
      )}
    </div>
  );
}
