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
import { LayerPanel } from '../BIMViewer/LayerPanel';
import { ModelTree } from '../BIMViewer/ModelTree';
import { useViewerStore } from '../../store/viewerStore';
import { useBIMViewer } from '../../hooks/useBIMViewer';
import { useState } from 'react';
import type { WorkspacePanel } from '../../types/boq';

interface AppShellProps {
  onBackToDashboard: () => void;
}

export function AppShell({ onBackToDashboard }: AppShellProps) {
  const [activePanel, setActivePanel] = useState<WorkspacePanel>('viewer');
  const [showInspector, setShowInspector] = useState(true);
  const { modelPath, activeStorey, hiddenTypes, selectedElement } = useViewerStore();
  const { handleElementSelected, handleModelLoaded } = useBIMViewer();

  const showSidePanel = ['calculator', 'boq', 'geo', 'ai', 'realestate', 'government', 'documents', 'wash', 'energy', 'intelligence', 'carbon', 'schedule', 'emerging', 'optimizer', 'seismic'].includes(activePanel);

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
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-infra-dark">
      <TopBar
        onBack={onBackToDashboard}
        onToggleCalculator={() => setActivePanel((p) => (p === 'calculator' ? 'viewer' : 'calculator'))}
        onToggleInspector={() => setShowInspector((v) => !v)}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activePanel={activePanel} onPanelChange={setActivePanel} />
        <div className="flex flex-1 overflow-hidden">
          <div className="w-56 flex-shrink-0 border-r border-infra-accent/30 overflow-y-auto">
            <ModelTree />
            <LayerPanel />
          </div>
          <div className="flex-1 relative">
            <BIMViewer
              modelPath={modelPath}
              onElementSelected={handleElementSelected}
              onModelLoaded={handleModelLoaded}
              activeStorey={activeStorey}
              hiddenLayers={hiddenTypes}
            />
          </div>
          {showInspector && (
            <div className="w-80 flex-shrink-0 border-l border-infra-accent/30 overflow-hidden flex flex-col">
              <ViewerSidePanel element={selectedElement} />
            </div>
          )}
        </div>
        {showSidePanel && (
          <div className="w-96 flex-shrink-0 border-l border-infra-accent/30 overflow-y-auto">
            {renderSidePanel()}
          </div>
        )}
      </div>
      <StatusBar />
    </div>
  );
}
