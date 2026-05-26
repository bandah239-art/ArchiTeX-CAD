import { useCalculationStore } from '../../store/calculationStore';
import { BeamCalculator } from './modules/BeamCalculator';
import { SlabCalculator } from './modules/SlabCalculator';
import { ColumnCalculator } from './modules/ColumnCalculator';
import { FoundationCalculator } from './modules/FoundationCalculator';
import { LoadCalculator } from './modules/LoadCalculator';
import { LoadCombinations } from './modules/LoadCombinations';
import { RoadCalculator } from './modules/RoadCalculator';
import { WindCalculator } from './modules/WindCalculator';
import { WashCalculator } from './modules/WashCalculator';
import { GeoCalculator } from './modules/GeoCalculator';
import { BearingCalculator } from './modules/BearingCalculator';
import { TankCalculator } from './modules/TankCalculator';
import { MaterialSelector } from './modules/MaterialSelector';
import { SteelCalculator } from './modules/SteelCalculator';
import { TimberCalculator } from './modules/TimberCalculator';
import { FEACalculator } from './modules/FEACalculator';
import { EnergyCalculator } from './modules/EnergyCalculator';
import { MicrogridCalculator } from './modules/MicrogridCalculator';
import { TransmissionCalculator } from './modules/TransmissionCalculator';
import { HydroCalculator } from './modules/HydroCalculator';
import { BiogasCalculator } from './modules/BiogasCalculator';
import { WindWakeCalculator } from './modules/WindWakeCalculator';
import { GridFaultCalculator } from './modules/GridFaultCalculator';
import { WaterTowerCalculator } from './modules/WaterTowerCalculator';
import { PipeNetworkCalculator } from './modules/PipeNetworkCalculator';
import { DewatsCalculator } from './modules/DewatsCalculator';
import { WTPCalculator } from './modules/WTPCalculator';
import { StormwaterCalculator } from './modules/StormwaterCalculator';
import { LandfillCalculator } from './modules/LandfillCalculator';
import { IrrigationCalculator } from './modules/IrrigationCalculator';
import { PilesCalculator } from './modules/PilesCalculator';
import { SlopeStabilityCalculator } from './modules/SlopeStabilityCalculator';
import { ConsolidationCalculator } from './modules/ConsolidationCalculator';
import { GroundImprovementCalculator } from './modules/GroundImprovementCalculator';
import { TunnelingCalculator } from './modules/TunnelingCalculator';
import { MODULES_WITH_INLINE_CALCULATE } from './calculatorModuleUtils';
import { ResultsDisplay, PressureBearingSection } from './ResultsDisplay';
import { PressurePanel } from './pressure/PressurePanel';
import { ReportExporter } from './ReportExporter';
import type { CalculationModule } from '../../types/calculations';

const MODULES: { id: CalculationModule; label: string }[] = [
  { id: 'loadCombinations', label: 'Load Combos' },
  { id: 'beam', label: 'Beam' },
  { id: 'slab', label: 'Slab' },
  { id: 'column', label: 'Column' },
  { id: 'foundation', label: 'Foundation' },
  { id: 'loads', label: 'Loads' },
  { id: 'wind', label: 'Wind' },
  { id: 'bearing', label: 'Bearing' },
  { id: 'materials', label: 'Materials' },
  { id: 'road', label: 'Road' },
  { id: 'wash', label: 'WASH' },
  { id: 'geo', label: 'GEO' },
  { id: 'pressure', label: 'Pressure' },
  { id: 'tank', label: 'Tank' },
  { id: 'steel', label: 'Steel' },
  { id: 'timber', label: 'Timber' },
  { id: 'fea', label: 'FEA Mesh' },
  { id: 'energy_bess', label: 'Solar & BESS' },
  { id: 'energy_microgrid', label: 'Microgrid Cables' },
  { id: 'energy_transmission', label: 'Sag-Tension' },
  { id: 'energy_hydro', label: 'Micro-Hydro Power' },
  { id: 'energy_biogas', label: 'Biogas Digester' },
  { id: 'energy_wind_wake', label: 'Wind Farm Wake' },
  { id: 'energy_grid_fault', label: 'Grid Faults' },
  { id: 'wash_water_tower', label: 'Water Tower & Pump' },
  { id: 'wash_epanet', label: 'Pipe Network (EPANET)' },
  { id: 'wash_dewats', label: 'DEWATS Wastewater' },
  { id: 'wash_wtp', label: 'Water Treatment (WTP)' },
  { id: 'wash_stormwater', label: 'Stormwater & Ponds' },
  { id: 'wash_landfill', label: 'Sanitary Landfill' },
  { id: 'wash_irrigation', label: 'Agri-Irrigation' },
  { id: 'geo_piles', label: 'Pile Capacity' },
  { id: 'geo_slope', label: 'Slope Stability' },
  { id: 'geo_consolidation', label: 'Consolidation' },
  { id: 'geo_ground_improvement', label: 'Ground Improve' },
  { id: 'geo_tunneling', label: 'Tunneling RMR' },
];

export function CalculatorPanel() {
  const {
    activeModule,
    setModule,
    currentInputs,
    setInput,
    runCalculation,
    currentResults,
    isCalculating,
    error,
  } = useCalculationStore();

  const renderModule = () => {
    const props = {
      inputs: currentInputs,
      onInputChange: setInput,
    };

    switch (activeModule) {
      case 'loadCombinations':
        return <LoadCombinations />;
      case 'beam':
        return <BeamCalculator {...props} />;
      case 'slab':
        return <SlabCalculator {...props} />;
      case 'column':
        return <ColumnCalculator {...props} />;
      case 'foundation':
        return <FoundationCalculator {...props} />;
      case 'loads':
        return <LoadCalculator {...props} />;
      case 'wind':
        return <WindCalculator {...props} />;
      case 'bearing':
        return <BearingCalculator {...props} />;
      case 'materials':
        return <MaterialSelector {...props} />;
      case 'road':
        return <RoadCalculator {...props} />;
      case 'wash':
        return <WashCalculator {...props} />;
      case 'geo':
        return <GeoCalculator {...props} />;
      case 'pressure':
        return <PressurePanel />;
      case 'tank':
        return <TankCalculator {...props} />;
      case 'steel':
        return <SteelCalculator {...props} />;
      case 'timber':
        return <TimberCalculator {...props} />;
      case 'fea':
        return <FEACalculator {...props} />;
      case 'energy_bess':
        return <EnergyCalculator {...props} />;
      case 'energy_microgrid':
        return <MicrogridCalculator {...props} />;
      case 'energy_transmission':
        return <TransmissionCalculator {...props} />;
      case 'energy_hydro':
        return <HydroCalculator {...props} />;
      case 'energy_biogas':
        return <BiogasCalculator {...props} />;
      case 'energy_wind_wake':
        return <WindWakeCalculator {...props} />;
      case 'energy_grid_fault':
        return <GridFaultCalculator {...props} />;
      case 'wash_water_tower':
        return <WaterTowerCalculator {...props} />;
      case 'wash_epanet':
        return <PipeNetworkCalculator {...props} />;
      case 'wash_dewats':
        return <DewatsCalculator {...props} />;
      case 'wash_wtp':
        return <WTPCalculator {...props} />;
      case 'wash_stormwater':
        return <StormwaterCalculator {...props} />;
      case 'wash_landfill':
        return <LandfillCalculator {...props} />;
      case 'wash_irrigation':
        return <IrrigationCalculator {...props} />;
      case 'geo_piles':
        return <PilesCalculator {...props} />;
      case 'geo_slope':
        return <SlopeStabilityCalculator {...props} />;
      case 'geo_consolidation':
        return <ConsolidationCalculator {...props} />;
      case 'geo_ground_improvement':
        return <GroundImprovementCalculator {...props} />;
      case 'geo_tunneling':
        return <TunnelingCalculator {...props} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-infra-accent/30">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">
          Calculation Engine
        </h2>
        <div className="flex flex-wrap gap-1 mt-3">
          {MODULES.map((mod) => (
            <button
              key={mod.id}
              onClick={() => setModule(mod.id)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                activeModule === mod.id
                  ? 'bg-infra-highlight text-white'
                  : 'bg-infra-accent/30 text-gray-400 hover:bg-infra-accent/50'
              }`}
            >
              {mod.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {renderModule()}

        {activeModule !== 'loadCombinations' &&
          activeModule !== 'pressure' &&
          !MODULES_WITH_INLINE_CALCULATE.includes(activeModule) && (
          <>
            <button
              onClick={() => runCalculation()}
              disabled={isCalculating}
              className="w-full mt-4 py-2 bg-infra-highlight hover:bg-infra-highlight/80 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded transition-colors"
            >
              {isCalculating ? 'Calculating...' : 'CALCULATE'}
            </button>

            {error && (
              <div className="mt-3 p-3 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">
                {error}
              </div>
            )}

            {currentResults?.steps?.length ? (
              <>
                <div className="mt-6 border-t border-infra-accent/30 pt-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Results</h3>
                  <ResultsDisplay result={currentResults} reviewKeyPrefix={activeModule} />
                  {currentResults.pressure_bearing && (
                    <PressureBearingSection
                      title="Foundation bearing pressure"
                      bearing={currentResults.pressure_bearing}
                    />
                  )}
                  {currentResults.pressure_pavement && (
                    <PressureBearingSection
                      title="Pavement layer pressure"
                      bearing={currentResults.pressure_pavement}
                    />
                  )}
                  {currentResults.pressure_wind && (
                    <PressureBearingSection
                      title="Wind pressure distribution"
                      bearing={currentResults.pressure_wind}
                    />
                  )}
                  {currentResults.pressure_bridge && (
                    <PressureBearingSection
                      title="Bridge hydrostatic / hydrodynamic"
                      bearing={currentResults.pressure_bridge}
                    />
                  )}
                  {currentResults.pressure_lateral && (
                    <PressureBearingSection
                      title="Lateral earth pressure"
                      bearing={currentResults.pressure_lateral}
                    />
                  )}
                  {currentResults.pressure_boussinesq && (
                    <PressureBearingSection
                      title="Boussinesq stress in soil"
                      bearing={currentResults.pressure_boussinesq}
                    />
                  )}
                  {currentResults.pressure_consolidation && (
                    <PressureBearingSection
                      title="Consolidation / effective stress"
                      bearing={currentResults.pressure_consolidation}
                    />
                  )}
                  {currentResults.pressure_pipe && (
                    <PressureBearingSection title="Pipe / node pressure" bearing={currentResults.pressure_pipe} />
                  )}
                  {currentResults.pressure_tank && (
                    <PressureBearingSection title="Tank pressure" bearing={currentResults.pressure_tank} />
                  )}
                </div>
                <ReportExporter result={currentResults} />
              </>
            ) : currentResults?.status === 'received' ? (
              <div className="mt-3 p-3 bg-infra-accent/20 border border-infra-accent/40 rounded text-xs text-gray-300">
                Inputs received by server — full calculation results coming soon.
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
