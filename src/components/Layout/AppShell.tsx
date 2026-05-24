import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import { BIMViewer } from '../BIMViewer/BIMViewer';
import { ElementInspector } from '../BIMViewer/ElementInspector';
import { CalculatorPanel } from '../Calculator/CalculatorPanel';
import { BoQPanel } from '../BoQ/BoQPanel';
import { GeoPanel } from '../GeoIntelligence/GeoPanel';
import { AIDesignPanel } from '../AIDesign/AIDesignPanel';
import { RealEstatePanel } from '../RealEstate/RealEstatePanel';
import { PortfolioDashboard } from '../Government/PortfolioDashboard';
import { DocumentPanel } from '../Documents/DocumentPanel';
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
  const { modelPath, activeStorey, visibleTypes, selectedElement } = useViewerStore();
  const { handleElementSelected, handleModelLoaded } = useBIMViewer();

  const showSidePanel = ['calculator', 'boq', 'geo', 'ai', 'realestate', 'government', 'documents'].includes(activePanel);

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
              visibleLayers={visibleTypes}
            />
          </div>
          {showInspector && (
            <div className="w-72 flex-shrink-0 border-l border-infra-accent/30 overflow-y-auto">
              <ElementInspector element={selectedElement} />
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
