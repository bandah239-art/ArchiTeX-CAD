import { useState } from 'react';
import { ConsolidationCurve } from './ConsolidationCurve';
import { SlopeSlipCircle } from './SlopeSlipCircle';
import { PileLoadTransfer } from './PileLoadTransfer';

type GeoTab = 'consolidation' | 'slope' | 'pile';

interface Props {
  inputs: Record<string, unknown>;
}

export function GeoSimulationPanel({ inputs }: Props) {
  const [tab, setTab] = useState<GeoTab>('consolidation');

  const tabs: { id: GeoTab; label: string; icon: string }[] = [
    { id: 'consolidation', label: 'Settlement–Time', icon: '⏱' },
    { id: 'slope',         label: 'Slip Circle',     icon: '⛰' },
    { id: 'pile',          label: 'Pile Transfer',   icon: '🔩' },
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
                ? 'bg-emerald-700/40 text-emerald-200 border border-emerald-500/50'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-transparent'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'consolidation' && (
        <ConsolidationCurve
          clay_thickness_m={Number(
            inputs.clay_thickness_m ?? inputs.clay_layer_thickness_m ?? 5
          )}
          drainage="double"
          cv_m2_yr={Number(inputs.cv_m2_yr ?? 1.5)}
          cc={Number(inputs.compression_index_cc ?? inputs.cc ?? 0.25)}
          e0={Number(inputs.initial_void_ratio ?? inputs.initial_void_ratio_e0 ?? 0.8)}
          sigma0_kpa={Number(
            inputs.initial_effective_stress_kpa ?? inputs.sigma0_kpa ?? 100
          )}
          delta_sigma_kpa={Number(
            inputs.added_stress_kpa ?? inputs.stress_increase_kpa ?? inputs.delta_sigma_kpa ?? 50
          )}
        />
      )}

      {tab === 'slope' && (
        <SlopeSlipCircle
          slope_height_m={Number(
            inputs.slope_height_m ?? inputs.retaining_wall_height_m ?? 10
          )}
          slope_angle_degrees={Number(inputs.slope_angle_degrees ?? 30)}
          cohesion_kpa={Number(inputs.soil_cohesion_kpa ?? inputs.cohesion_kpa ?? 20)}
          friction_angle_degrees={Number(
            inputs.friction_angle_degrees ?? inputs.friction_angle_deg ?? 25
          )}
          unit_weight_knm3={Number(
            inputs.soil_unit_weight_kn_m3 ?? inputs.unit_weight_knm3 ?? 18
          )}
        />
      )}

      {tab === 'pile' && (
        <PileLoadTransfer
          pile_diameter_m={Number(inputs.pile_diameter_m ?? 0.6)}
          pile_length_m={Number(inputs.pile_length_m ?? 20)}
          soil_cohesion_kpa={Number(inputs.soil_cohesion_kpa ?? inputs.cohesion_kpa ?? 50)}
          adhesion_factor={Number(inputs.adhesion_factor_alpha ?? inputs.adhesion_factor ?? 0.5)}
          nc={Number(inputs.end_bearing_capacity_factor_nc ?? inputs.nc ?? 9)}
          applied_load_kn={Number(inputs.applied_load_kn ?? 800)}
        />
      )}
    </div>
  );
}
