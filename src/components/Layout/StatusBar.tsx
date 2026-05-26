import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useViewerStore } from '../../store/viewerStore';
import { calculationAPI } from '../../services/calculationAPI';
import { loadProjectMetaLocal } from '../../services/offlineCache';
import { useOfflineSyncStore } from '../../store/offlineSyncStore';

export function StatusBar() {
  const { t } = useTranslation();
  const { loadedModel, selectedElement } = useViewerStore();
  const { pending, refreshStatus, pushSync, isSyncing } = useOfflineSyncStore();
  const [serverOk, setServerOk] = useState(false);
  const [version, setVersion] = useState('1.0.0');
  const [cachedProject, setCachedProject] = useState<string | null>(null);

  useEffect(() => {
    const check = () => calculationAPI.checkHealth().then(setServerOk);
    check();
    const timer = window.setInterval(check, 5000);
    window.electronAPI?.getAppVersion().then(setVersion);
    refreshStatus();
    const meta = loadProjectMetaLocal();
    if (meta?.name) setCachedProject(String(meta.name));
    return () => window.clearInterval(timer);
  }, [refreshStatus]);

  return (
    <footer className="statusbar-shell">
      <span>
        Model: {loadedModel ? loadedModel.name : 'None loaded'}
      </span>
      <span>
        Elements: {loadedModel?.elementCount ?? 0}
      </span>
      <span>
        Selected: {selectedElement?.name || 'None'}
      </span>
      {!serverOk && cachedProject && (
        <span className="text-amber-400">{t('status.offlineCache')}: {cachedProject}</span>
      )}
      {window.electronAPI && pending > 0 && (
        <button
          type="button"
          onClick={() => pushSync()}
          disabled={isSyncing || !serverOk}
          className="text-amber-400 hover:text-amber-300 underline disabled:opacity-40 text-sm"
        >
          {isSyncing ? 'Syncing…' : `Sync ${pending} offline`}
        </button>
      )}
      <span className="flex-1" />
      <span className="flex items-center gap-2">
        <span
          className={`w-2.5 h-2.5 rounded-full ${serverOk ? 'bg-green-500' : 'bg-orange-500'}`}
        />
        {serverOk ? t('status.serverOnline') : t('status.serverOffline')}
      </span>
      <span>v{version}</span>
    </footer>
  );
}
