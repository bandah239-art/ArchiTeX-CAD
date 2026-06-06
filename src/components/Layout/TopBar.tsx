import { useProjectStore } from '../../store/projectStore';
import { useProject } from '../../hooks/useProject';
import { useIfcModelStore } from '../../store/ifcModelStore';
import { bimGeometryAPI } from '../../services/bimGeometryAPI';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from 'react';
import { APP_NAME } from '../../constants/brand';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useDesignCodeStore, CODE_LABELS } from '../../store/designCodeStore';
import type { DesignCode } from '../../store/designCodeStore';

interface TopBarProps {
  onBack: () => void;
  onToggleCalculator: () => void;
  onToggleInspector: () => void;
}

export function TopBar({ onBack, onToggleCalculator, onToggleInspector }: TopBarProps) {
  const { t } = useTranslation();
  const { currentProject, hasUnsavedChanges, lastSavedAt, markSaved } = useProjectStore();
  const { openIFC, saveProject } = useProject();
  const ifcElements = useIfcModelStore((s) => s.elements);
  const { mainView, setMainView } = useWorkspaceStore();
  const { activeCode, setCode } = useDesignCodeStore();
  const [exporting, setExporting] = useState(false);
  const [serverRunning, setServerRunning] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getPythonServerStatus().then(status => setServerRunning(status.running));
      const cleanup = window.electronAPI.onPythonStatus((status) => {
        setServerRunning(status.running);
      });
      return cleanup;
    }
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      saveProject();
      markSaved();
    } finally {
      setSaving(false);
    }
  }, [saveProject, markSaved]);

  const handleRestartServer = async () => {
    if (window.electronAPI?.restartPythonServer) {
      setServerRunning(true); // Optimistic UI update
      await window.electronAPI.restartPythonServer();
      setTimeout(async () => {
        const status = await window.electronAPI?.getPythonServerStatus() ?? { running: false };
        setServerRunning(status.running);
      }, 3000);
    }
  };
  
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
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="font-semibold text-white text-lg truncate">
          {currentProject?.name || 'Untitled Project'}
        </span>
        {/* Unsaved changes indicator */}
        {currentProject && (
          hasUnsavedChanges ? (
            <span
              className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30"
              title="You have unsaved changes"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Unsaved
            </span>
          ) : lastSavedAt ? (
            <span
              className="flex-shrink-0 text-[10px] text-gray-500"
              title={`Last saved ${new Date(lastSavedAt).toLocaleTimeString()}`}
            >
              Saved
            </span>
          ) : null
        )}
        <span className="ml-1 text-[10px] uppercase tracking-wider text-gray-500 hidden sm:inline flex-shrink-0">
          {APP_NAME}
        </span>
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
        <div className="flex items-center mr-2 px-2 py-1 bg-infra-dark border border-gray-700 rounded gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${serverRunning ? 'bg-green-500' : 'bg-red-500'}`} title={serverRunning ? 'Engine Online' : 'Engine Offline'} />
          {!serverRunning && (
            <button 
              onClick={handleRestartServer}
              className="text-xs text-red-400 hover:text-red-300 ml-1 font-semibold"
            >
              Restart Engine
            </button>
          )}
        </div>
        <select
          value={activeCode}
          onChange={(e) => setCode(e.target.value as DesignCode)}
          className="bg-infra-dark border border-gray-700 rounded text-white text-xs px-2 py-1.5 focus:outline-none focus:border-infra-highlight"
        >
          {Object.entries(CODE_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        <LanguageSwitcher />
        <button onClick={openIFC} className="topbar-btn bg-infra-accent hover:bg-infra-accent/80 text-white">
          {t('topbar.openIfc')}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`topbar-btn text-white transition-colors ${
            hasUnsavedChanges
              ? 'bg-amber-600 hover:bg-amber-500 border border-amber-400/50'
              : 'bg-infra-accent/50 hover:bg-infra-accent/70'
          } disabled:opacity-50`}
          title={hasUnsavedChanges ? 'Save unsaved changes' : 'Project saved'}
        >
          {saving ? '…' : t('topbar.save')}
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
