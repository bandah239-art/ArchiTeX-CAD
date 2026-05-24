import type { WorkspacePanel } from '../../types/boq';

interface SidebarProps {
  activePanel: WorkspacePanel;
  onPanelChange: (panel: WorkspacePanel) => void;
}

export function Sidebar({ activePanel, onPanelChange }: SidebarProps) {
  const items: { id: WorkspacePanel; label: string; icon: string }[] = [
    { id: 'viewer', label: '3D Viewer', icon: '🏗️' },
    { id: 'calculator', label: 'Calculator', icon: '📐' },
    { id: 'boq', label: 'Bill of Quantities', icon: '📋' },
    { id: 'geo', label: 'Geo Intelligence', icon: '🌍' },
    { id: 'ai', label: 'AI Design', icon: '🤖' },
    { id: 'realestate', label: 'Real Estate', icon: '🏠' },
    { id: 'government', label: 'Government', icon: '🏛️' },
    { id: 'documents', label: 'Documents', icon: '📄' },
  ];

  return (
    <nav className="w-14 flex-shrink-0 bg-infra-darker border-r border-infra-accent/30 flex flex-col items-center py-4 gap-2 overflow-y-auto">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          title={item.label}
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
      <a
        href="https://github.com/infraafrica/mobile"
        title="Mobile Companion App"
        className="w-10 h-10 rounded-lg flex items-center justify-center text-lg hover:bg-infra-accent/30 text-gray-400 flex-shrink-0 mt-2 border border-dashed border-infra-accent/40"
        onClick={(e) => e.preventDefault()}
      >
        📱
      </a>
    </nav>
  );
}
