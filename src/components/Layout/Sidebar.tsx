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
    <nav className="w-14 flex-shrink-0 bg-infra-darker border-r border-infra-accent/30 flex flex-col items-center py-4 gap-2 overflow-y-auto">
      {PANELS.map((item) => (
        <button
          key={item.id}
          type="button"
          title={t(item.key)}
          onClick={() => onPanelChange(item.id)}
          className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-colors flex-shrink-0 ${
            activePanel === item.id
              ? 'bg-infra-highlight/20 text-infra-highlight border border-infra-highlight/40'
              : 'hover:bg-infra-accent/30 text-gray-400'
          }`}
        >
          {item.icon}
        </button>
      ))}
    </nav>
  );
}
