import { useTranslation } from 'react-i18next';
import type { WorkspacePanel } from '../../types/boq';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import { BIMViewer } from '../BIMViewer/BIMViewer';
import { ViewerSidePanel } from '../BIMViewer/ViewerSidePanel';
import { CalculatorPanel } from '../Calculator/CalculatorPanel';
import { GISViewer } from '../GIS/GISViewer';
import { SLDViewer } from '../Energy/SLDViewer';
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
import { CadToolsPanel } from '../BIMViewer/CadToolsPanel';
import { ToolResultBanner } from '../BIMViewer/ToolResultBanner';
import { useViewerShortcuts } from '../../hooks/useViewerShortcuts';
import { LayerPanel } from '../BIMViewer/LayerPanel';
import { ModelTree } from '../BIMViewer/ModelTree';
import { useViewerStore } from '../../store/viewerStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useBIMViewer } from '../../hooks/useBIMViewer';
import { ErrorBoundary } from '../ErrorBoundary';
import { useToolbarStore } from '../BIMViewer/toolRegistry';
import { FeatureTreePanel } from '../../cad/history/FeatureTreePanel';

const PANEL_INFO: Record<WorkspacePanel, { title: string; icon: string; key: string }> = {
  viewer: { title: '3D Viewer', icon: '🏗️', key: 'sidebar.viewer' },
  calculator: { title: 'Calculator', icon: '📐', key: 'sidebar.calculator' },
  boq: { title: 'Bill of Quantities', icon: '📋', key: 'sidebar.boq' },
  schedule: { title: '4D Schedule', icon: '📅', key: 'sidebar.schedule' },
  optimizer: { title: 'Generative Design', icon: '🧬', key: 'sidebar.optimizer' },
  seismic: { title: 'Seismic Analysis', icon: '🌋', key: 'sidebar.seismic' },
  geo: { title: 'Geo Intelligence', icon: '🌍', key: 'sidebar.geo' },
  vision: { title: 'Vision AI Capture', icon: '👁️', key: 'sidebar.vision' },
  ai: { title: 'AI Design', icon: '🤖', key: 'sidebar.ai' },
  realestate: { title: 'Real Estate', icon: '🏠', key: 'sidebar.realestate' },
  government: { title: 'Government', icon: '🏛️', key: 'sidebar.government' },
  documents: { title: 'Documents', icon: '📄', key: 'sidebar.documents' },
  carbon: { title: 'Carbon/ESG', icon: '🌱', key: 'sidebar.carbon' },
  wash: { title: 'WASH', icon: '💧', key: 'sidebar.wash' },
  energy: { title: 'Solar/Energy', icon: '☀️', key: 'sidebar.energy' },
  intelligence: { title: 'Digital Twin', icon: '🔮', key: 'sidebar.intelligence' },
  emerging: { title: 'Emerging Tech', icon: '🚀', key: 'sidebar.emerging' },
};

interface AppShellProps {
  onBackToDashboard: () => void;
}

export function AppShell({ onBackToDashboard }: AppShellProps) {
  const { t } = useTranslation();
  const {
    activePanel,
    showInspector,
    setActivePanel,
    togglePanel,
    toggleInspector,
    mainView,
    openTabs,
    closeTab,
  } = useWorkspaceStore();
  const { modelPath, activeStorey, hiddenTypes, selectedElement } = useViewerStore();
  const { handleElementSelected, handleModelLoaded } = useBIMViewer();
  const { activeTab } = useToolbarStore();
  useViewerShortcuts();

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
      <div className="relative z-20 flex-shrink-0">
        <ViewerToolRibbon />
        <ToolResultBanner />
      </div>
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar activePanel={activePanel} onPanelChange={setActivePanel} />
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Workspace Tabs Header Bar */}
          <div className="flex items-center bg-[#11192e] border-b border-[#1f293d]/50 px-2 h-11 flex-shrink-0 gap-1 overflow-x-auto overflow-y-hidden select-none">
            {openTabs.map((panelId) => {
              const info = PANEL_INFO[panelId] || { title: panelId, icon: '⚙️', key: `sidebar.${panelId}` };
              const isActive = activePanel === panelId;
              return (
                <div
                  key={panelId}
                  className={`flex items-center h-full px-4 border-r border-[#1f293d]/30 text-sm cursor-pointer transition-all duration-150 relative select-none ${
                    isActive
                      ? 'bg-[#16213e] text-infra-highlight font-semibold border-t-2 border-t-infra-highlight'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#16213e]/40'
                  }`}
                  onClick={() => setActivePanel(panelId)}
                >
                  <span className="mr-2">{info.icon}</span>
                  <span className="truncate max-w-[125px]">{t(info.key) || info.title}</span>
                  {panelId !== 'viewer' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(panelId);
                      }}
                      className="ml-2.5 p-0.5 rounded-full hover:bg-black/35 hover:text-red-400 text-gray-500 transition-colors animate-fade-in"
                      title={t('common.close', 'Close')}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Active Tab Content Area */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activePanel === 'viewer' ? (
              <div className="flex flex-1 h-full min-h-0 overflow-hidden">
                <div className="panel-tree flex flex-col min-h-0">
                  {activeTab === 'draw' ? (
                    <FeatureTreePanel />
                  ) : (
                    <>
                      <ModelTree />
                      <LayerPanel />
                    </>
                  )}
                </div>
                <div className="flex-1 relative min-h-0 min-w-0 overflow-hidden">
                  <ErrorBoundary>
                    {mainView === 'bim' && (
                      <>
                        <BIMViewer
                          modelPath={modelPath}
                          onElementSelected={handleElementSelected}
                          onModelLoaded={handleModelLoaded}
                          activeStorey={activeStorey}
                          hiddenLayers={hiddenTypes}
                        />
                        <CadToolsPanel />
                      </>
                    )}
                    {mainView === 'gis' && <GISViewer />}
                    {mainView === 'sld' && <SLDViewer />}
                  </ErrorBoundary>
                </div>
                {showInspector && mainView === 'bim' && (
                  <div className="panel-inspector">
                    <ViewerSidePanel element={selectedElement} />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 h-full min-h-0 overflow-auto bg-infra-dark/10">
                <ErrorBoundary>
                  {renderSidePanel()}
                </ErrorBoundary>
              </div>
            )}
          </div>
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
