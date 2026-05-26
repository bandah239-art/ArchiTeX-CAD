import { useProjectStore } from '../../store/projectStore';
import { useProject } from '../../hooks/useProject';
import { useIfcModelStore } from '../../store/ifcModelStore';
import { bimGeometryAPI } from '../../services/bimGeometryAPI';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { APP_NAME } from '../../constants/brand';
import { useWorkspaceStore } from '../../store/workspaceStore';

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
  const { mainView, setMainView } = useWorkspaceStore();
  const [exporting, setExporting] = useState(false);

  const exportIfc = async () => {
    if (!ifcElements.length) {
      alert('Open an IFC model first to export elements.');
      return;
    }
    setExporting(true);
    try {
      const payload = {
        name: currentProject?.name ?? 'ARCHITEX-CAD Export',
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
    <header className="topbar-shell">
      <button
        onClick={onBack}
        className="text-gray-300 hover:text-white text-base font-medium transition-colors"
      >
        ← {t('topbar.dashboard')}
      </button>
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-white text-lg">
          {currentProject?.name || 'Untitled Project'}
        </span>
        <span className="ml-2 text-[10px] uppercase tracking-wider text-gray-500 hidden sm:inline">
          {APP_NAME}
        </span>
        {currentProject?.ifcPath && (
          <span className="ml-3 text-sm text-gray-400 truncate">
            {currentProject.ifcPath}
          </span>
        )}
      </div>
      <div className="flex bg-infra-dark border border-gray-700 rounded-md overflow-hidden mr-4">
        <button
          onClick={() => setMainView('bim')}
          className={`px-3 py-1 text-sm ${mainView === 'bim' ? 'bg-infra-accent text-white font-medium' : 'text-gray-400 hover:bg-gray-800'}`}
        >
          BIM 3D
        </button>
        <button
          onClick={() => setMainView('gis')}
          className={`px-3 py-1 text-sm ${mainView === 'gis' ? 'bg-infra-accent text-white font-medium' : 'text-gray-400 hover:bg-gray-800'}`}
        >
          GIS Map
        </button>
        <button
          onClick={() => setMainView('sld')}
          className={`px-3 py-1 text-sm ${mainView === 'sld' ? 'bg-infra-accent text-white font-medium' : 'text-gray-400 hover:bg-gray-800'}`}
        >
          Energy SLD
        </button>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <LanguageSwitcher />
        <button onClick={openIFC} className="topbar-btn bg-infra-accent hover:bg-infra-accent/80 text-white">
          {t('topbar.openIfc')}
        </button>
        <button
          onClick={saveProject}
          className="topbar-btn bg-infra-accent/50 hover:bg-infra-accent/70 text-white"
        >
          {t('topbar.save')}
        </button>
        <button
          onClick={exportIfc}
          disabled={exporting}
          className="topbar-btn border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40"
        >
          {exporting ? '…' : t('topbar.exportIfc')}
        </button>
        <button
          onClick={onToggleInspector}
          className="topbar-btn border border-infra-accent/50 hover:bg-infra-accent/25"
        >
          {t('topbar.inspector')}
        </button>
        <button
          onClick={onToggleCalculator}
          className="topbar-btn border-2 border-infra-highlight/60 text-infra-highlight hover:bg-infra-highlight/15 font-semibold"
        >
          {t('topbar.calculator')}
        </button>
      </div>
    </header>
  );
}
