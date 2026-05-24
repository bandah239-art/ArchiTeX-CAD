import { useCalculationStore } from '../../store/calculationStore';
import { BeamCalculator } from './modules/BeamCalculator';
import { SlabCalculator } from './modules/SlabCalculator';
import { ColumnCalculator } from './modules/ColumnCalculator';
import { FoundationCalculator } from './modules/FoundationCalculator';
import { LoadCalculator } from './modules/LoadCalculator';
import { RoadCalculator } from './modules/RoadCalculator';
import { ResultsDisplay } from './ResultsDisplay';
import { ReportExporter } from './ReportExporter';
import type { CalculationModule } from '../../types/calculations';

const MODULES: { id: CalculationModule; label: string }[] = [
  { id: 'beam', label: 'Beam' },
  { id: 'slab', label: 'Slab' },
  { id: 'column', label: 'Column' },
  { id: 'foundation', label: 'Foundation' },
  { id: 'loads', label: 'Loads' },
  { id: 'road', label: 'Road' },
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
      case 'road':
        return <RoadCalculator {...props} />;
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
              <ResultsDisplay result={currentResults} />
            </div>
            <ReportExporter result={currentResults} />
          </>
        ) : currentResults?.status === 'received' ? (
          <div className="mt-3 p-3 bg-infra-accent/20 border border-infra-accent/40 rounded text-xs text-gray-300">
            Inputs received by server — full calculation results coming soon.
          </div>
        ) : null}
      </div>
    </div>
  );
}
