import { useTranslation } from 'react-i18next';
import type { WorkspacePanel } from '../../types/boq';

interface SidebarProps {
  activePanel: WorkspacePanel;
  onPanelChange: (panel: WorkspacePanel) => void;
}

const PANELS: { id: WorkspacePanel; icon: string; key: string }[] = [
  { id: 'viewer', icon: '🏗️', key: 'sidebar.viewer' },
  { id: 'calculator', icon: '📐', key: 'sidebar.calculator' },
  { id: 'boq', icon: '📋', key: 'sidebar.boq' },
  { id: 'schedule', icon: '📅', key: 'sidebar.schedule' },
  { id: 'optimizer', icon: '🧬', key: 'sidebar.optimizer' },
  { id: 'seismic', icon: '🌋', key: 'sidebar.seismic' },
  { id: 'geo', icon: '🌍', key: 'sidebar.geo' },
  { id: 'vision', icon: '👁️', key: 'sidebar.vision' },
  { id: 'ai', icon: '🤖', key: 'sidebar.ai' },
  { id: 'realestate', icon: '🏠', key: 'sidebar.realestate' },
  { id: 'government', icon: '🏛️', key: 'sidebar.government' },
  { id: 'documents', icon: '📄', key: 'sidebar.documents' },
  { id: 'carbon', icon: '🌱', key: 'sidebar.carbon' },
  { id: 'wash', icon: '💧', key: 'sidebar.wash' },
  { id: 'energy', icon: '☀️', key: 'sidebar.energy' },
  { id: 'intelligence', icon: '🔮', key: 'sidebar.intelligence' },
  { id: 'emerging', icon: '🚀', key: 'sidebar.emerging' },
];

export function Sidebar({ activePanel, onPanelChange }: SidebarProps) {
  const { t } = useTranslation();

  return (
    <nav className="panel-sidebar">
      {PANELS.map((item) => (
        <button
          key={item.id}
          type="button"
          title={t(item.key)}
          onClick={() => onPanelChange(item.id)}
          className={`panel-sidebar-btn ${
            activePanel === item.id ? 'panel-sidebar-btn-active' : 'panel-sidebar-btn-idle'
          }`}
        >
          {item.icon}
        </button>
      ))}
    </nav>
  );
}
