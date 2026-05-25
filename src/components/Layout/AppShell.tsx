import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import { BIMViewer } from '../BIMViewer/BIMViewer';
import { ViewerSidePanel } from '../BIMViewer/ViewerSidePanel';
import { CalculatorPanel } from '../Calculator/CalculatorPanel';
import { BoQPanel } from '../BoQ/BoQPanel';
import { GeoPanel } from '../GeoIntelligence/GeoPanel';
import { AIDesignPanel } from '../AIDesign/AIDesignPanel';
import { RealEstatePanel } from '../RealEstate/RealEstatePanel';
import { PortfolioDashboard } from '../Government/PortfolioDashboard';
import { DocumentPanel } from '../Documents/DocumentPanel';
import { WashPanel } from '../WASH/WashPanel';
import { EnergyPanel } from '../Energy/EnergyPanel';
import { IntelligencePanel } from '../Intelligence/IntelligencePanel';
import { CarbonPanel } from '../Sustainability/CarbonPanel';
import { SchedulePanel } from '../Schedule/SchedulePanel';
import { OptimizerPanel } from '../Optimizer/OptimizerPanel';
import { SeismicPanel } from '../Seismic/SeismicPanel';
import { EmergingTechPanel } from '../Emerging/EmergingTechPanel';
import { VisionPanel } from '../VisionCapture/VisionPanel';
import { ViewerToolRibbon } from '../BIMViewer/ViewerToolRibbon';
import { ToolResultBanner } from '../BIMViewer/ToolResultBanner';
import { useViewerShortcuts } from '../../hooks/useViewerShortcuts';
import { LayerPanel } from '../BIMViewer/LayerPanel';
import { ModelTree } from '../BIMViewer/ModelTree';
import { useViewerStore } from '../../store/viewerStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useBIMViewer } from '../../hooks/useBIMViewer';
import { ErrorBoundary } from '../ErrorBoundary';

interface AppShellProps {
  onBackToDashboard: () => void;
}

export function AppShell({ onBackToDashboard }: AppShellProps) {
  const { activePanel, showInspector, setActivePanel, togglePanel, toggleInspector } = useWorkspaceStore();
  const { modelPath, activeStorey, hiddenTypes, selectedElement } = useViewerStore();
  const { handleElementSelected, handleModelLoaded } = useBIMViewer();
  useViewerShortcuts();

  const showSidePanel = ['calculator', 'boq', 'geo', 'vision', 'ai', 'realestate', 'government', 'documents', 'wash', 'energy', 'intelligence', 'carbon', 'schedule', 'emerging', 'optimizer', 'seismic'].includes(activePanel);

  const renderSidePanel = () => {
    switch (activePanel) {
      case 'calculator':
        return <CalculatorPanel />;
      case 'boq':
        return <BoQPanel />;
      case 'geo':
        return <GeoPanel />;
      case 'ai':
        return <AIDesignPanel />;
      case 'realestate':
        return <RealEstatePanel />;
      case 'government':
        return <PortfolioDashboard />;
      case 'documents':
        return <DocumentPanel />;
      case 'wash':
        return <WashPanel />;
      case 'energy':
        return <EnergyPanel />;
      case 'intelligence':
        return <IntelligencePanel />;
      case 'carbon':
        return <CarbonPanel />;
      case 'schedule':
        return <SchedulePanel />;
      case 'optimizer':
        return <OptimizerPanel />;
      case 'seismic':
        return <SeismicPanel />;
      case 'emerging':
        return <EmergingTechPanel />;
      case 'vision':
        return <VisionPanel />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-infra-dark">
      <TopBar
        onBack={onBackToDashboard}
        onToggleCalculator={() => togglePanel('calculator')}
        onToggleInspector={toggleInspector}
      />
      <div className="relative z-20">
        <ViewerToolRibbon />
        <ToolResultBanner />
      </div>
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar activePanel={activePanel} onPanelChange={setActivePanel} />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="w-56 flex-shrink-0 border-r border-infra-accent/30 overflow-y-auto z-10 bg-infra-dark">
            <ModelTree />
            <LayerPanel />
          </div>
          <div className="flex-1 relative min-h-0 min-w-0 overflow-hidden">
            <ErrorBoundary>
              <BIMViewer
                modelPath={modelPath}
                onElementSelected={handleElementSelected}
                onModelLoaded={handleModelLoaded}
                activeStorey={activeStorey}
                hiddenLayers={hiddenTypes}
              />
            </ErrorBoundary>
          </div>
          {showInspector && (
            <div className="w-80 flex-shrink-0 border-l border-infra-accent/30 overflow-hidden flex flex-col">
              <ViewerSidePanel element={selectedElement} />
            </div>
          )}
        </div>
        {showSidePanel && (
          <div className="w-96 flex-shrink-0 border-l border-infra-accent/30 overflow-y-auto">
            <ErrorBoundary>
              {renderSidePanel()}
            </ErrorBoundary>
          </div>
        )}
      </div>
      <StatusBar />
    </div>
  );
}
