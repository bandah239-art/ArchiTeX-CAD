import { useState, useEffect } from 'react';
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
import { CircuitCalculator } from './modules/CircuitCalculator';
import { WindCFDCalculator } from './modules/WindCFDCalculator';
import { SeismicCalculator } from './modules/SeismicCalculator';
import { CrackWidthCalculator } from './modules/CrackWidthCalculator';
import { WaterHammerCalculator } from './modules/WaterHammerCalculator';
import { WinklerCalculator } from './modules/WinklerCalculator';
import { MasonryCalculator } from './modules/MasonryCalculator';
import { BlackCottonCalculator } from './modules/BlackCottonCalculator';
import { MODULES_WITH_INLINE_CALCULATE } from './calculatorModuleUtils';
import { ResultsDisplay, PressureBearingSection } from './ResultsDisplay';
import { PressurePanel } from './pressure/PressurePanel';
import { ReportExporter } from './ReportExporter';
import type { CalculationModule } from '../../types/calculations';

// ── Category definitions ────────────────────────────────────────────────────

type CalcCategory = 'architectural' | 'electrical' | 'wash' | 'geo';

const CATEGORIES: { id: CalcCategory; label: string; icon: string; active: string; idle: string }[] = [
  {
    id: 'architectural',
    label: 'Architectural',
    icon: '🏛',
    active: 'bg-blue-700/60 text-blue-100 border-blue-500/70',
    idle:   'bg-infra-accent/20 text-gray-400 hover:bg-blue-900/30 hover:text-blue-300',
  },
  {
    id: 'electrical',
    label: 'Electrical',
    icon: '⚡',
    active: 'bg-yellow-700/60 text-yellow-100 border-yellow-500/70',
    idle:   'bg-infra-accent/20 text-gray-400 hover:bg-yellow-900/30 hover:text-yellow-300',
  },
  {
    id: 'wash',
    label: 'WASH',
    icon: '💧',
    active: 'bg-cyan-700/60 text-cyan-100 border-cyan-500/70',
    idle:   'bg-infra-accent/20 text-gray-400 hover:bg-cyan-900/30 hover:text-cyan-300',
  },
  {
    id: 'geo',
    label: 'Geo',
    icon: '🌍',
    active: 'bg-emerald-700/60 text-emerald-100 border-emerald-500/70',
    idle:   'bg-infra-accent/20 text-gray-400 hover:bg-emerald-900/30 hover:text-emerald-300',
  },
];

const MODULES_BY_CATEGORY: Record<CalcCategory, { id: CalculationModule; label: string }[]> = {
  architectural: [
    { id: 'loadCombinations',  label: 'Load Combinations'  },
    { id: 'beam',              label: 'Beam — BS 8110'      },
    { id: 'slab',              label: 'Slab — BS 8110'      },
    { id: 'column',            label: 'Column — BS 8110'    },
    { id: 'foundation',        label: 'Foundation'          },
    { id: 'bearing',           label: 'Bearing Pad'         },
    { id: 'loads',             label: 'Load Analysis'       },
    { id: 'wind',              label: 'Wind Loads'          },
    { id: 'steel',             label: 'Steel Section'       },
    { id: 'timber',            label: 'Timber Design'       },
    { id: 'masonry',           label: 'Masonry — BS 5628'   },
    { id: 'fea',               label: 'FEA Analysis'        },
    { id: 'crack_width',       label: 'Crack Width'         },
    { id: 'winkler',           label: 'Winkler Foundation'  },
    { id: 'road',              label: 'Road / Pavement'     },
    { id: 'pressure',          label: 'Pressure Diagrams'   },
    { id: 'materials',         label: 'Materials Library'   },
  ],
  electrical: [
    { id: 'energy_bess',         label: 'Solar & BESS'          },
    { id: 'energy_microgrid',    label: 'Microgrid / Cables'     },
    { id: 'energy_transmission', label: 'Transmission Sag'       },
    { id: 'energy_hydro',        label: 'Micro-Hydro Power'      },
    { id: 'energy_biogas',       label: 'Biogas Digester'        },
    { id: 'energy_wind_wake',    label: 'Wind Farm Wake'         },
    { id: 'energy_grid_fault',   label: 'Grid Fault Analysis'    },
    { id: 'circuit',             label: 'Circuit / SPICE'        },
    { id: 'wind_cfd',            label: 'Wind CFD Panel Method'  },
  ],
  wash: [
    { id: 'wash',               label: 'Water Demand'           },
    { id: 'wash_water_tower',   label: 'Water Tower & Pump'     },
    { id: 'wash_epanet',        label: 'Pipe Network (H-C)'     },
    { id: 'wash_dewats',        label: 'DEWATS Treatment'       },
    { id: 'wash_wtp',           label: 'Water Treatment Plant'  },
    { id: 'wash_stormwater',    label: 'Stormwater & Ponds'     },
    { id: 'wash_landfill',      label: 'Sanitary Landfill'      },
    { id: 'wash_irrigation',    label: 'Agri-Irrigation'        },
    { id: 'water_hammer',       label: 'Water Hammer'           },
    { id: 'tank',               label: 'Tank Pressure'          },
  ],
  geo: [
    { id: 'geo',                    label: 'Site Geotechnics'      },
    { id: 'geo_piles',              label: 'Pile Capacity'         },
    { id: 'geo_slope',              label: 'Slope Stability'       },
    { id: 'geo_consolidation',      label: 'Consolidation'         },
    { id: 'geo_ground_improvement', label: 'Ground Improvement'    },
    { id: 'geo_tunneling',          label: 'Tunneling / RMR'       },
    { id: 'seismic',                label: 'Seismic Analysis EC8'  },
    { id: 'black_cotton',           label: 'Black Cotton Soil'     },
  ],
};

function getCategory(mod: CalculationModule | null): CalcCategory {
  if (!mod) return 'architectural';
  for (const [cat, mods] of Object.entries(MODULES_BY_CATEGORY)) {
    if (mods.some((m) => m.id === mod)) return cat as CalcCategory;
  }
  return 'architectural';
}

// ── Component ───────────────────────────────────────────────────────────────

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

  const [category, setCategory] = useState<CalcCategory>(() => getCategory(activeModule));

  // When the active module changes from outside (e.g. voice command), sync category
  useEffect(() => {
    setCategory(getCategory(activeModule));
  }, [activeModule]);

  const cat = CATEGORIES.find((c) => c.id === category)!;
  const modulesInCategory = MODULES_BY_CATEGORY[category];

  const renderModule = () => {
    const props = { inputs: currentInputs, onInputChange: setInput };
    switch (activeModule) {
      case 'loadCombinations':       return <LoadCombinations />;
      case 'beam':                   return <BeamCalculator {...props} />;
      case 'slab':                   return <SlabCalculator {...props} />;
      case 'column':                 return <ColumnCalculator {...props} />;
      case 'foundation':             return <FoundationCalculator {...props} />;
      case 'loads':                  return <LoadCalculator {...props} />;
      case 'wind':                   return <WindCalculator {...props} />;
      case 'bearing':                return <BearingCalculator {...props} />;
      case 'materials':              return <MaterialSelector {...props} />;
      case 'road':                   return <RoadCalculator {...props} />;
      case 'wash':                   return <WashCalculator {...props} />;
      case 'geo':                    return <GeoCalculator {...props} />;
      case 'pressure':               return <PressurePanel />;
      case 'tank':                   return <TankCalculator {...props} />;
      case 'steel':                  return <SteelCalculator {...props} />;
      case 'timber':                 return <TimberCalculator {...props} />;
      case 'fea':                    return <FEACalculator {...props} />;
      case 'energy_bess':            return <EnergyCalculator {...props} />;
      case 'energy_microgrid':       return <MicrogridCalculator {...props} />;
      case 'energy_transmission':    return <TransmissionCalculator {...props} />;
      case 'energy_hydro':           return <HydroCalculator {...props} />;
      case 'energy_biogas':          return <BiogasCalculator {...props} />;
      case 'energy_wind_wake':       return <WindWakeCalculator {...props} />;
      case 'energy_grid_fault':      return <GridFaultCalculator {...props} />;
      case 'wash_water_tower':       return <WaterTowerCalculator {...props} />;
      case 'wash_epanet':            return <PipeNetworkCalculator {...props} />;
      case 'wash_dewats':            return <DewatsCalculator {...props} />;
      case 'wash_wtp':               return <WTPCalculator {...props} />;
      case 'wash_stormwater':        return <StormwaterCalculator {...props} />;
      case 'wash_landfill':          return <LandfillCalculator {...props} />;
      case 'wash_irrigation':        return <IrrigationCalculator {...props} />;
      case 'geo_piles':              return <PilesCalculator {...props} />;
      case 'geo_slope':              return <SlopeStabilityCalculator {...props} />;
      case 'geo_consolidation':      return <ConsolidationCalculator {...props} />;
      case 'geo_ground_improvement': return <GroundImprovementCalculator {...props} />;
      case 'geo_tunneling':          return <TunnelingCalculator {...props} />;
      case 'circuit':                return <CircuitCalculator {...props} />;
      case 'wind_cfd':               return <WindCFDCalculator {...props} />;
      case 'seismic':                return <SeismicCalculator {...props} />;
      case 'crack_width':            return <CrackWidthCalculator {...props} />;
      case 'water_hammer':           return <WaterHammerCalculator {...props} />;
      case 'winkler':                return <WinklerCalculator {...props} />;
      case 'masonry':                return <MasonryCalculator {...props} />;
      case 'black_cotton':           return <BlackCottonCalculator {...props} />;
      default:                       return null;
    }
  };

  return (
    <div className="flex flex-col h-full">

      {/* ── Category + Module selector ── */}
      <div className="p-4 border-b border-infra-accent/30 space-y-3">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">
          📐 Calculation Engine
        </h2>

        {/* Category tabs */}
        <div className="grid grid-cols-4 gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`py-1.5 text-xs rounded-md border font-semibold transition-colors ${
                category === c.id ? c.active : c.idle
              }`}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        {/* Module grid for selected category */}
        <div className="space-y-1">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">
            {cat.icon} {cat.label} — {modulesInCategory.length} calculators
          </p>
          <div className="flex flex-wrap gap-1">
            {modulesInCategory.map((mod) => (
              <button
                key={mod.id}
                type="button"
                onClick={() => setModule(mod.id)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  activeModule === mod.id
                    ? cat.active + ' border font-semibold'
                    : 'bg-infra-accent/25 text-gray-400 hover:bg-infra-accent/40 hover:text-gray-200'
                }`}
              >
                {mod.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Calculator body ── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          {/* Left: Inputs */}
          <div className="space-y-6 bg-infra-dark/30 p-5 rounded-xl border border-infra-accent/20">
            <h3 className="text-xs font-bold text-infra-highlight uppercase tracking-wider">
              Input Parameters
            </h3>
            {renderModule()}

            {activeModule !== 'loadCombinations' &&
              activeModule !== 'pressure' &&
              !MODULES_WITH_INLINE_CALCULATE.includes(activeModule) && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => runCalculation()}
                  disabled={isCalculating}
                  className="w-full py-3 bg-infra-highlight hover:bg-infra-highlight/80 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-lg transition-all"
                >
                  {isCalculating ? 'Calculating...' : 'RUN SOLVER & GENERATE REPORT'}
                </button>
                {error && (
                  <div className="mt-3 p-3 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Results & Diagrams */}
          <div className="space-y-6">
            {currentResults?.steps?.length ? (
              <div className="bg-[#16213e]/90 p-5 rounded-xl border border-infra-accent/30 shadow-xl">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-infra-accent/20">
                  <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Calculation Trace & Verification
                  </h3>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono uppercase">
                    Code Compliant
                  </span>
                </div>

                <ResultsDisplay result={currentResults} reviewKeyPrefix={activeModule ?? ''} />

                {currentResults.pressure_bearing && (
                  <PressureBearingSection title="Foundation bearing pressure" bearing={currentResults.pressure_bearing} />
                )}
                {currentResults.pressure_pavement && (
                  <PressureBearingSection title="Pavement layer pressure" bearing={currentResults.pressure_pavement} />
                )}
                {currentResults.pressure_wind && (
                  <PressureBearingSection title="Wind pressure distribution" bearing={currentResults.pressure_wind} />
                )}
                {currentResults.pressure_bridge && (
                  <PressureBearingSection title="Bridge hydrostatic / hydrodynamic" bearing={currentResults.pressure_bridge} />
                )}
                {currentResults.pressure_lateral && (
                  <PressureBearingSection title="Lateral earth pressure" bearing={currentResults.pressure_lateral} />
                )}
                {currentResults.pressure_boussinesq && (
                  <PressureBearingSection title="Boussinesq stress in soil" bearing={currentResults.pressure_boussinesq} />
                )}
                {currentResults.pressure_consolidation && (
                  <PressureBearingSection title="Consolidation / effective stress" bearing={currentResults.pressure_consolidation} />
                )}
                {currentResults.pressure_pipe && (
                  <PressureBearingSection title="Pipe / node pressure" bearing={currentResults.pressure_pipe} />
                )}
                {currentResults.pressure_tank && (
                  <PressureBearingSection title="Tank pressure" bearing={currentResults.pressure_tank} />
                )}

                <div className="mt-6 pt-4 border-t border-infra-accent/20">
                  <ReportExporter result={currentResults} />
                </div>
              </div>
            ) : currentResults?.status === 'received' ? (
              <div className="p-4 bg-infra-accent/15 border border-infra-accent/30 rounded-xl text-xs text-gray-300">
                Inputs received by server — compiling analytical solver equations.
              </div>
            ) : (
              <div className="p-8 border border-dashed border-infra-accent/30 rounded-xl flex flex-col items-center justify-center text-center text-gray-500 h-64 bg-[#16213e]/20">
                <span className="text-4xl mb-3">📈</span>
                <p className="text-sm font-medium">Awaiting Calculation Execution</p>
                <p className="text-xs text-gray-400 mt-1 max-w-xs">
                  Select a calculator from the {cat.label} category above, fill in inputs, then run the solver.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
