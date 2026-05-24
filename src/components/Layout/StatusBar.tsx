import { useEffect, useState } from 'react';
import { useViewerStore } from '../../store/viewerStore';
import { calculationAPI } from '../../services/calculationAPI';

export function StatusBar() {
  const { loadedModel, selectedElement } = useViewerStore();
  const [serverOk, setServerOk] = useState(false);
  const [version, setVersion] = useState('1.0.0');

  useEffect(() => {
    calculationAPI.checkHealth().then(setServerOk);
    window.electronAPI?.getAppVersion().then(setVersion);
  }, []);

  return (
    <footer className="h-6 flex items-center px-4 bg-infra-darker border-t border-infra-accent/30 text-xs text-gray-500 gap-4">
      <span>
        Model: {loadedModel ? loadedModel.name : 'None loaded'}
      </span>
      <span>
        Elements: {loadedModel?.elementCount ?? 0}
      </span>
      <span>
        Selected: {selectedElement?.name || 'None'}
      </span>
      <span className="flex-1" />
      <span className="flex items-center gap-1">
        <span
          className={`w-2 h-2 rounded-full ${serverOk ? 'bg-green-500' : 'bg-red-500'}`}
        />
        Python Server {serverOk ? 'Online' : 'Offline'}
      </span>
      <span>v{version}</span>
    </footer>
  );
}
