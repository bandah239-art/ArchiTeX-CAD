import { lazy, Suspense, useState } from 'react';
import { ProjectDashboard } from './components/Dashboard/ProjectDashboard';
import { useProject } from './hooks/useProject';
import { VoiceAssistant } from './components/AI/VoiceAssistant';

const AppShell = lazy(() =>
  import('./components/Layout/AppShell')
    .then((m) => ({ default: m.AppShell }))
    .catch((err) => {
      console.error('[ARCHITEX-CAD] Failed to load workspace shell:', err);
      throw err;
    }),
);

type View = 'dashboard' | 'workspace';

function WorkspaceFallback() {
  return (
    <div className="flex h-full items-center justify-center bg-infra-dark text-gray-400 text-sm">
      Loading workspace…
    </div>
  );
}

function App() {
  const [view, setView] = useState<View>('dashboard');
  const { currentProject, openIFC } = useProject();

  const handleOpenProject = async () => {
    await openIFC();
    setView('workspace');
  };

  const handleOpenWorkspace = () => {
    if (currentProject) setView('workspace');
  };

  if (view === 'workspace') {
    return (
      <Suspense fallback={<WorkspaceFallback />}>
        <AppShell onBackToDashboard={() => setView('dashboard')} />
        <VoiceAssistant />
      </Suspense>
    );
  }

  return (
    <>
      <ProjectDashboard
        onOpenProject={handleOpenProject}
        onEnterWorkspace={handleOpenWorkspace}
        hasProject={!!currentProject}
      />
      <VoiceAssistant />
    </>
  );
}

export default App;
