import { useState } from 'react';
import { VoltageDrop } from './VoltageDrop';
import { BiogasYield } from './BiogasYield';
import { CatenaryProfile } from './CatenaryProfile';
import { FaultCurrentDecay } from './FaultCurrentDecay';

type EnergyTab = 'voltage' | 'biogas' | 'catenary' | 'fault';

interface Props {
  inputs: Record<string, unknown>;
}

export function EnergyExtendedPanel({ inputs }: Props) {
  const [tab, setTab] = useState<EnergyTab>('voltage');

  const tabs: { id: EnergyTab; label: string; icon: string }[] = [
    { id: 'voltage',  label: 'Voltage Drop', icon: '⚡' },
    { id: 'biogas',   label: 'Biogas Yield', icon: '🔥' },
    { id: 'catenary', label: 'Catenary',     icon: '🔌' },
    { id: 'fault',    label: 'Fault Decay',  icon: '⚠' },
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
                ? 'bg-orange-700/40 text-orange-200 border border-orange-500/50'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-transparent'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'voltage' && (
        <VoltageDrop
          cable_length_m={Number(inputs.cable_length_m ?? 250)}
          load_current_amps={Number(inputs.load_current_amps ?? 45)}
          system_voltage={Number(inputs.system_voltage ?? 230)}
          cable_material={String(inputs.cable_material ?? 'aluminum')}
          max_voltage_drop_percent={Number(inputs.max_voltage_drop_percent ?? 5)}
        />
      )}

      {tab === 'biogas' && (
        <BiogasYield
          cattle_count={Number(inputs.cattle_count ?? 50)}
          poultry_count={Number(inputs.poultry_count ?? 0)}
          human_count={Number(inputs.human_count ?? 10)}
          temperature_c={Number(inputs.temperature_c ?? 25)}
        />
      )}

      {tab === 'catenary' && (
        <CatenaryProfile
          span_length_m={Number(inputs.span_length_m ?? 50)}
          conductor_weight_kg_m={Number(inputs.conductor_weight_kg_m ?? 1.5)}
          max_tension_kg={Number(inputs.max_tension_kg ?? 2000)}
          ground_clearance_m={Number(inputs.ground_clearance_m ?? 8)}
          temperature_c={Number(inputs.temperature_c ?? 40)}
        />
      )}

      {tab === 'fault' && (
        <FaultCurrentDecay
          generator_kva={Number(inputs.generator_kva ?? 1000)}
          generator_voltage_v={Number(inputs.generator_voltage_v ?? 400)}
          generator_subtransient_reactance_pu={Number(inputs.generator_subtransient_reactance_pu ?? 0.15)}
          cable_length_m={Number(inputs.cable_length_m ?? 50)}
          cable_resistance_ohm_km={Number(inputs.cable_resistance_ohm_km ?? 0.16)}
          cable_reactance_ohm_km={Number(inputs.cable_reactance_ohm_km ?? 0.08)}
        />
      )}
    </div>
  );
}
