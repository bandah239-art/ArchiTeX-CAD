import { useProjectStore } from '../../store/projectStore';
import { useProject } from '../../hooks/useProject';
import { useIfcModelStore } from '../../store/ifcModelStore';
import { bimGeometryAPI } from '../../services/bimGeometryAPI';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';

interface TopBarProps {
  onBack: () => void;
  onToggleCalculator: () => void;
  onToggleInspector: () => void;
}

export function TopBar({ onBack, onToggleCalculator, onToggleInspector }: TopBarProps) {
  const { t } = useTranslation();
  const { currentProject } = useProjectStore();
  const { openIFC, saveProject } = useProject();
  const ifcElements = useIfcModelStore((s) => s.elements);
  const [exporting, setExporting] = useState(false);

  const exportIfc = async () => {
    if (!ifcElements.length) {
      alert('Open an IFC model first to export elements.');
      return;
    }
    setExporting(true);
    try {
      const payload = {
        name: currentProject?.name ?? 'INFRAFRICA Export',
        site_name: currentProject?.name ?? 'Site',
        elements: ifcElements.map((el) => ({
          type: el.type,
          name: el.name,
          globalId: el.globalId,
          length: el.length,
          width: el.width,
          height: el.height,
          volume: el.volume,
          area: el.area,
        })),
      };
      const result = await bimGeometryAPI.exportIfc(payload);
      if (result.status !== 'complete' || !result.ifc_bytes_b64) {
        throw new Error(result.error ?? 'Export failed');
      }
      const bytes = Uint8Array.from(atob(result.ifc_bytes_b64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/x-step' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentProject?.name ?? 'export'}.ifc`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'IFC export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="h-12 flex items-center px-4 bg-infra-darker border-b border-infra-accent/30 gap-4">
      <button
        onClick={onBack}
        className="text-gray-400 hover:text-white text-sm transition-colors"
      >
        ← {t('topbar.dashboard')}
      </button>
      <div className="flex-1">
        <span className="font-semibold text-white">
          {currentProject?.name || 'Untitled Project'}
        </span>
        {currentProject?.ifcPath && (
          <span className="ml-3 text-xs text-gray-500 truncate">
            {currentProject.ifcPath}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <button
          onClick={openIFC}
          className="px-3 py-1 text-xs bg-infra-accent hover:bg-infra-accent/80 rounded transition-colors"
        >
          {t('topbar.openIfc')}
        </button>
        <button
          onClick={saveProject}
          className="px-3 py-1 text-xs bg-infra-accent/50 hover:bg-infra-accent/70 rounded transition-colors"
        >
          {t('topbar.save')}
        </button>
        <button
          onClick={exportIfc}
          disabled={exporting}
          className="px-3 py-1 text-xs border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors disabled:opacity-40"
        >
          {exporting ? '…' : t('topbar.exportIfc')}
        </button>
        <button
          onClick={onToggleInspector}
          className="px-3 py-1 text-xs border border-infra-accent/50 hover:bg-infra-accent/20 rounded transition-colors"
        >
          {t('topbar.inspector')}
        </button>
        <button
          onClick={onToggleCalculator}
          className="px-3 py-1 text-xs border border-infra-highlight/50 text-infra-highlight hover:bg-infra-highlight/10 rounded transition-colors"
        >
          {t('topbar.calculator')}
        </button>
      </div>
    </header>
  );
}
